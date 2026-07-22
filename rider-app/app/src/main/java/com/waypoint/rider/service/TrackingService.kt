package com.waypoint.rider.service

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.Location
import android.location.LocationManager
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationAvailability
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.waypoint.rider.WaypointApp
import com.waypoint.rider.data.repository.SyncRepository
import com.waypoint.rider.data.storage.SessionManager
import com.waypoint.rider.ui.main.MainActivity
import kotlinx.coroutines.*

class TrackingService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private lateinit var syncRepository: SyncRepository
    private lateinit var sessionManager: SessionManager

    private var lastLocation: Location? = null
    private var currentIntervalMs: Long = INTERVAL_FAST_MS
    private var cumulativeDistanceMeters: Float = 0f

    // Fully Automatic Dwell Anchor Tracker
    private var dwellAnchorLocation: Location? = null
    private var dwellStartTimeMs: Long = 0L
    private var consecutiveTravelPings: Int = 0

    // Receiver to detect GPS Hardware Toggle in real-time mid-shift
    private val gpsStateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == LocationManager.PROVIDERS_CHANGED_ACTION) {
                val gpsEnabled = isGpsHardwareEnabled()
                Log.w(TAG, "GPS Provider state changed mid-shift! Enabled: $gpsEnabled")
                if (!gpsEnabled) {
                    updateNotificationGpsWarning()
                    updateRiderStatusGpsDisabled()
                } else {
                    updateNotificationNormal()
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        syncRepository = SyncRepository(this)
        sessionManager = SessionManager(this)

        setupLocationCallback()

        // Register GPS hardware change listener
        val filter = IntentFilter(LocationManager.PROVIDERS_CHANGED_ACTION)
        registerReceiver(gpsStateReceiver, filter)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == ACTION_STOP_TRACKING) {
            stopTrackingAndShift()
            return START_NOT_STICKY
        }

        val notification = createForegroundNotification()
        startForeground(NOTIFICATION_ID, notification)

        cumulativeDistanceMeters = 0f
        startAdaptiveLocationUpdates()
        fetchInitialLocationPoint()
        startPeriodicSyncWorker()

        // Initial check if GPS is disabled when service starts
        if (!isGpsHardwareEnabled()) {
            updateNotificationGpsWarning()
            updateRiderStatusGpsDisabled()
        }

        return START_STICKY
    }

    @SuppressLint("MissingPermission")
    private fun fetchInitialLocationPoint() {
        try {
            fusedLocationClient.lastLocation.addOnSuccessListener { loc ->
                if (loc != null) {
                    Log.d(TAG, "Initial location point captured: ${loc.latitude}, ${loc.longitude}")
                    handleNewLocation(loc)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to fetch initial location point", e)
        }
    }

    private fun isGpsHardwareEnabled(): Boolean {
        val locationManager = getSystemService(LOCATION_SERVICE) as LocationManager
        return locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
    }

    private fun createForegroundNotification(): Notification {
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val stopIntent = Intent(this, TrackingService::class.java).apply {
            action = ACTION_STOP_TRACKING
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 1, stopIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, WaypointApp.CHANNEL_ID)
            .setContentTitle("Valmo Fleet — Shift Active")
            .setContentText("Live Location Tracking Active")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentIntent(pendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "End Shift", stopPendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun updateNotificationGpsWarning() {
        val notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val warningNotification = NotificationCompat.Builder(this, WaypointApp.CHANNEL_ID)
            .setContentTitle("GPS TURNED OFF — TRACKING PAUSED")
            .setContentText("Location is turned off. Please turn GPS back on to continue shift.")
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setOngoing(true)
            .build()

        notificationManager.notify(NOTIFICATION_ID, warningNotification)
    }

    private fun updateNotificationNormal() {
        val notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, createForegroundNotification())
    }

    private fun updateRiderStatusGpsDisabled() {
        val riderId = sessionManager.getRiderUid() ?: return
        serviceScope.launch {
            try {
                FirebaseFirestore.getInstance().collection("riders").document(riderId)
                    .update("status", "resting")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to update status on GPS disabled", e)
            }
        }
    }

    private fun setupLocationCallback() {
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                val location = locationResult.lastLocation ?: return
                handleNewLocation(location)
            }

            override fun onLocationAvailability(availability: LocationAvailability) {
                super.onLocationAvailability(availability)
                val available = availability.isLocationAvailable && isGpsHardwareEnabled()
                Log.d(TAG, "onLocationAvailability: available = $available")
                if (!available) {
                    updateNotificationGpsWarning()
                    updateRiderStatusGpsDisabled()
                } else {
                    updateNotificationNormal()
                }
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun startAdaptiveLocationUpdates() {
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            currentIntervalMs
        ).setMinUpdateIntervalMillis(currentIntervalMs / 2)
         .build()

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to request location updates", e)
        }
    }

    private fun handleNewLocation(location: Location) {
        val shiftId = sessionManager.getActiveShiftId() ?: return
        val riderId = sessionManager.getRiderUid() ?: return

        // Compute distance increment from previous location point
        val prev = lastLocation
        if (prev != null) {
            val timeDiffMs = location.time - prev.time
            val distMeters = location.distanceTo(prev)
            
            // Skip rapid duplicate pings (<1m movement within 15s) to prevent spamming
            if (distMeters < 1.0f && timeDiffMs < 15000L) {
                Log.d(TAG, "Skipping duplicate rapid ping at same location")
                return
            }

            if (distMeters in 3f..5000f) { // filter out GPS jitter (< 3m) and invalid teleports (> 5km in single ping)
                cumulativeDistanceMeters += distMeters
            }
        }
        val distanceKm = cumulativeDistanceMeters / 1000f

        val speed = if (location.hasSpeed()) location.speed else computeDerivedSpeed(location)
        val movementType = determineAutomaticMovementType(location, speed)

        // 1. Write point to local Room DB queue
        serviceScope.launch {
            syncRepository.enqueuePing(
                shiftId = shiftId,
                riderId = riderId,
                lat = location.latitude,
                lng = location.longitude,
                speed = speed,
                movementType = movementType,
                timestampMillis = location.time
            )
            // Trigger sync immediately for new point
            syncRepository.syncPendingPings()

            // Update shift total distance in Firestore
            try {
                val db = FirebaseFirestore.getInstance()
                db.collection("shifts").document(shiftId)
                    .update("totalDistanceKm", distanceKm)
                db.collection("riders").document(riderId)
                    .update("totalDistanceKm", distanceKm, "status", movementType)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to update totalDistanceKm in Firestore", e)
            }
        }

        lastLocation = location

        val dwellMin = if (dwellStartTimeMs > 0) (location.time - dwellStartTimeMs) / (1000 * 60) else 0L

        // 2. Adjust ping frequency dynamically based on rider movement & idle time
        val newInterval = when {
            movementType == "traveling" -> INTERVAL_FAST_MS       // Active vehicle travel (30s)
            dwellMin >= 2 -> INTERVAL_SLOW_MS                    // Stationary idle > 2m (5 mins)
            else -> INTERVAL_MEDIUM_MS                            // Initial stop registration (60s)
        }

        if (newInterval != currentIntervalMs) {
            Log.d(TAG, "Adaptive Interval Changed to ${newInterval / 1000}s (State: $movementType, Speed: ${speed}m/s)")
            currentIntervalMs = newInterval
            fusedLocationClient.removeLocationUpdates(locationCallback)
            startAdaptiveLocationUpdates()
        }
    }

    private fun determineAutomaticMovementType(location: Location, speed: Float): String {
        val now = System.currentTimeMillis()
        val anchor = dwellAnchorLocation

        if (anchor == null) {
            dwellAnchorLocation = location
            dwellStartTimeMs = now
            consecutiveTravelPings = 0
            return if (speed > 3.0f) "traveling" else "delivering"
        }

        val distanceMeters = location.distanceTo(anchor)

        // Require sustained vehicle movement (>100m away AND speed > 3.0 m/s for 2 consecutive pings) to reset anchor
        if (distanceMeters > 100f && speed > 3.0f) {
            consecutiveTravelPings++
            if (consecutiveTravelPings >= 2) {
                dwellAnchorLocation = null
                dwellStartTimeMs = 0L
                consecutiveTravelPings = 0
                return "traveling"
            }
        } else {
            consecutiveTravelPings = 0
        }

        // Inside 100m anchor area: phone is stationary (deliver/rest). Ignore indoor GPS noise/drift!
        val dwellDurationMinutes = (now - dwellStartTimeMs) / (1000 * 60)

        return if (dwellDurationMinutes >= 15) {
            "resting"
        } else {
            "delivering"
        }
    }

    private fun computeDerivedSpeed(location: Location): Float {
        val last = lastLocation ?: return 0f
        val timeDeltaSec = (location.time - last.time) / 1000f
        if (timeDeltaSec <= 0) return 0f
        val distanceMeters = location.distanceTo(last)
        return distanceMeters / timeDeltaSec
    }

    private fun startPeriodicSyncWorker() {
        serviceScope.launch {
            while (isActive) {
                delay(30000)
                try {
                    syncRepository.syncPendingPings()
                } catch (e: Exception) {
                    Log.e(TAG, "Periodic sync check failed", e)
                }
            }
        }
    }

    private fun stopTrackingAndShift() {
        val shiftId = sessionManager.getActiveShiftId()
        val riderId = sessionManager.getRiderUid()

        if (shiftId != null && riderId != null) {
            serviceScope.launch {
                try {
                    val db = FirebaseFirestore.getInstance()
                    db.collection("shifts").document(shiftId)
                        .update("endTime", FieldValue.serverTimestamp())
                    db.collection("riders").document(riderId)
                        .update("status", "offline", "currentShiftId", null)
                } catch (e: Exception) {
                    Log.e(TAG, "Error ending shift in Firestore", e)
                } finally {
                    sessionManager.saveActiveShiftId(null)
                    stopSelf()
                }
            }
        } else {
            stopSelf()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(gpsStateReceiver)
        } catch (_: Exception) {}
        // Remove the foreground notification first so the OS can kill the process cleanly
        stopForeground(STOP_FOREGROUND_REMOVE)
        fusedLocationClient.removeLocationUpdates(locationCallback)
        serviceScope.cancel()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val ACTION_START_TRACKING = "com.waypoint.rider.ACTION_START_TRACKING"
        const val ACTION_STOP_TRACKING = "com.waypoint.rider.ACTION_STOP_TRACKING"
        const val NOTIFICATION_ID = 1001

        private const val INTERVAL_FAST_MS = 30000L   // 30s when traveling
        private const val INTERVAL_MEDIUM_MS = 60000L  // 60s when delivering at stop
        private const val INTERVAL_SLOW_MS = 300000L   // 5 mins when resting > 30m

        private const val TAG = "TrackingService"
    }
}
