package com.waypoint.rider.ui.main

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.View
import android.view.animation.AlphaAnimation
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.GravityCompat
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.waypoint.rider.R
import com.waypoint.rider.data.storage.SessionManager
import com.waypoint.rider.databinding.ActivityMainBinding
import com.waypoint.rider.service.TrackingService
import com.waypoint.rider.ui.login.LoginActivity
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var sessionManager: SessionManager
    private val db = FirebaseFirestore.getInstance()
    
    private var shiftListener: ListenerRegistration? = null
    private var gpsDialog: AlertDialog? = null

    // Real-time GPS Hardware toggle listener
    private val gpsReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == LocationManager.PROVIDERS_CHANGED_ACTION) {
                val enabled = isGpsEnabled()
                if (enabled) {
                    gpsDialog?.dismiss()
                    gpsDialog = null
                } else if (sessionManager.getActiveShiftId() != null) {
                    promptEnableGps()
                }
            }
        }
    }

    // Live Shift Timer Stopwatch
    private var shiftStartTimeMs: Long = 0L
    private val timerHandler = Handler(Looper.getMainLooper())
    private val timerRunnable = object : Runnable {
        override fun run() {
            if (shiftStartTimeMs > 0L) {
                val elapsedMs = System.currentTimeMillis() - shiftStartTimeMs
                val seconds = (elapsedMs / 1000) % 60
                val minutes = (elapsedMs / (1000 * 60)) % 60
                val hours = (elapsedMs / (1000 * 60 * 60))
                binding.tvShiftTimer.text = String.format(Locale.getDefault(), "%02d:%02d:%02d", hours, minutes, seconds)
                timerHandler.postDelayed(this, 1000)
            }
        }
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineLocationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        if (fineLocationGranted) {
            checkBackgroundLocationAndStartShift()
        } else {
            Toast.makeText(this, "Location permission is required for shift tracking", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        sessionManager = SessionManager(this)

        setupUI()
    }

    override fun onResume() {
        super.onResume()
        updateShiftStatusUI()
        listenToActiveShiftData()
        
        try {
            registerReceiver(gpsReceiver, IntentFilter(LocationManager.PROVIDERS_CHANGED_ACTION))
        } catch (_: Exception) {}

        // Check GPS status if currently on duty
        if (sessionManager.getActiveShiftId() != null && !isGpsEnabled()) {
            promptEnableGps()
        }
    }

    override fun onPause() {
        super.onPause()
        try {
            unregisterReceiver(gpsReceiver)
        } catch (_: Exception) {}
        shiftListener?.remove()
        stopTimer()
    }

    private fun setupUI() {
        val riderName = sessionManager.getRiderName() ?: "Rider"
        val riderPhone = sessionManager.getRiderPhone() ?: ""
        val riderUid = sessionManager.getRiderUid() ?: ""

        // Main screen rider details
        binding.tvRiderName.text = riderName
        binding.tvRiderPhone.text = "Mobile: $riderPhone"
        val initial = if (riderName.isNotBlank()) riderName.trim().substring(0, 1).uppercase() else "R"
        binding.tvAvatarInitials.text = initial

        // Side Drawer rider details
        binding.tvDrawerRiderName.text = riderName
        binding.tvDrawerRiderPhone.text = "Mobile: $riderPhone"
        binding.tvDrawerAvatar.text = initial
        binding.tvDrawerRiderUid.text = if (riderUid.length >= 8) "ID: ${riderUid.substring(0, 8)}..." else "ID: $riderUid"

        // Open Side Menu Drawer
        binding.btnOpenDrawer.setOnClickListener {
            binding.drawerLayout.openDrawer(GravityCompat.START)
        }

        // Side Drawer Logout Button
        binding.btnDrawerLogout.setOnClickListener {
            binding.drawerLayout.closeDrawers()
            handleLogout()
        }

        binding.btnToggleShift.setOnClickListener {
            val currentShiftId = sessionManager.getActiveShiftId()
            if (currentShiftId == null) {
                requestPermissionsAndStartShift()
            } else {
                endShift()
            }
        }
    }

    private fun updateShiftStatusUI() {
        val activeShiftId = sessionManager.getActiveShiftId()
        val isOnDuty = activeShiftId != null

        if (isOnDuty) {
            // ON DUTY
            binding.tvStatusBadge.text = "ON DUTY"
            binding.tvStatusBadge.setBackgroundResource(R.drawable.bg_status_badge_active)
            binding.tvStatusBadge.setTextColor(ContextCompat.getColor(this, R.color.accent_green_dark))

            binding.btnToggleShift.text = "END SHIFT"
            binding.btnToggleShift.backgroundTintList = ColorStateList.valueOf(ContextCompat.getColor(this, R.color.accent_red))

            binding.cardOffDutyInfo.visibility = View.GONE
            if (binding.cardTrackingIndicator.visibility != View.VISIBLE) {
                binding.cardTrackingIndicator.visibility = View.VISIBLE
                val fadeIn = AlphaAnimation(0f, 1f).apply { duration = 400 }
                binding.cardTrackingIndicator.startAnimation(fadeIn)
            }
        } else {
            // OFF DUTY
            stopTimer()
            binding.tvStatusBadge.text = "OFF DUTY"
            binding.tvStatusBadge.setBackgroundResource(R.drawable.bg_status_badge_inactive)
            binding.tvStatusBadge.setTextColor(ContextCompat.getColor(this, R.color.text_secondary))

            binding.btnToggleShift.text = "START SHIFT"
            binding.btnToggleShift.backgroundTintList = ColorStateList.valueOf(ContextCompat.getColor(this, R.color.accent_cyan))

            binding.cardTrackingIndicator.visibility = View.GONE
            binding.cardOffDutyInfo.visibility = View.VISIBLE
        }
    }

    private fun isGpsEnabled(): Boolean {
        val locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        return locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
               locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
    }

    private fun promptEnableGps() {
        if (gpsDialog?.isShowing == true) return

        val isOnDuty = sessionManager.getActiveShiftId() != null

        val builder = AlertDialog.Builder(this)
            .setTitle("GPS Required")
            .setMessage("Location Services (GPS) are turned off on your device. Shift tracking requires active GPS.")
            .setPositiveButton("Turn On GPS") { dialog, _ ->
                dialog.dismiss()
                gpsDialog = null
                startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
            }

        if (isOnDuty) {
            // Strict Duty Enforcement: Cannot cancel dialog while on duty! Must either turn on GPS or End Shift!
            builder.setNegativeButton("End Shift") { dialog, _ ->
                dialog.dismiss()
                gpsDialog = null
                endShift()
            }
            builder.setCancelable(false)
        } else {
            builder.setNegativeButton("Cancel") { dialog, _ ->
                dialog.dismiss()
                gpsDialog = null
            }
        }

        gpsDialog = builder.create()
        gpsDialog?.show()
    }

    private fun startTimer(startTime: Date?) {
        shiftStartTimeMs = startTime?.time ?: System.currentTimeMillis()
        timerHandler.removeCallbacks(timerRunnable)
        timerHandler.post(timerRunnable)
    }

    private fun stopTimer() {
        shiftStartTimeMs = 0L
        timerHandler.removeCallbacks(timerRunnable)
    }

    private fun listenToActiveShiftData() {
        val shiftId = sessionManager.getActiveShiftId() ?: return
        shiftListener?.remove()

        shiftListener = db.collection("shifts").document(shiftId)
            .addSnapshotListener { snapshot, e ->
                if (e != null || snapshot == null || !snapshot.exists()) return@addSnapshotListener
                
                // Distance
                val distKm = snapshot.getDouble("totalDistanceKm") ?: 0.0
                binding.tvShiftDistance.text = String.format(Locale.getDefault(), "%.2f km", distKm)

                // Start Time & Stopwatch
                val startTime = snapshot.getTimestamp("startTime")?.toDate()
                if (startTime != null && shiftStartTimeMs == 0L) {
                    startTimer(startTime)
                }
            }
    }

    private fun requestPermissionsAndStartShift() {
        // 1. Verify GPS Hardware Enabled
        if (!isGpsEnabled()) {
            promptEnableGps()
            return
        }

        // 2. Verify Android Location Permissions
        val permissionsToRequest = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val missing = permissionsToRequest.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (missing.isNotEmpty()) {
            permissionLauncher.launch(missing.toTypedArray())
        } else {
            checkBackgroundLocationAndStartShift()
        }
    }

    private fun checkBackgroundLocationAndStartShift() {
        if (!isGpsEnabled()) {
            promptEnableGps()
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "Please select 'Allow all the time' for background tracking", Toast.LENGTH_LONG).show()
                permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION))
                return
            }
        }
        startNewShift()
    }

    private fun startNewShift() {
        val riderId = sessionManager.getRiderUid() ?: return
        binding.progressBarShift.visibility = View.VISIBLE

        val newShiftData = hashMapOf(
            "riderId" to riderId,
            "startTime" to FieldValue.serverTimestamp(),
            "endTime" to null,
            "totalDistanceKm" to 0.0
        )

        db.collection("shifts")
            .add(newShiftData)
            .addOnSuccessListener { documentRef ->
                val shiftId = documentRef.id
                sessionManager.saveActiveShiftId(shiftId)

                // Update rider status to active shift (traveling)
                db.collection("riders").document(riderId)
                    .update("status", "traveling", "currentShiftId", shiftId, "totalDistanceKm", 0.0)

                // Start Tracking Service
                val serviceIntent = Intent(this, TrackingService::class.java).apply {
                    action = TrackingService.ACTION_START_TRACKING
                }
                ContextCompat.startForegroundService(this, serviceIntent)

                binding.progressBarShift.visibility = View.GONE
                startTimer(Date())
                updateShiftStatusUI()
                listenToActiveShiftData()
                Toast.makeText(this, "Shift Started Successfully!", Toast.LENGTH_SHORT).show()
            }
            .addOnFailureListener { e ->
                binding.progressBarShift.visibility = View.GONE
                Toast.makeText(this, "Failed to start shift: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
            }
    }

    private fun endShift() {
        val shiftId = sessionManager.getActiveShiftId()
        val riderId = sessionManager.getRiderUid()

        // 1. Immediately close shift and mark offline in Firestore
        if (shiftId != null && riderId != null) {
            db.collection("shifts").document(shiftId)
                .update("endTime", FieldValue.serverTimestamp())
            db.collection("riders").document(riderId)
                .update("status", "offline", "currentShiftId", null)
        }

        // 2. Stop location tracking service
        val serviceIntent = Intent(this, TrackingService::class.java).apply {
            action = TrackingService.ACTION_STOP_TRACKING
        }
        startService(serviceIntent)

        // 3. Clear session and update UI
        sessionManager.saveActiveShiftId(null)
        shiftListener?.remove()
        stopTimer()
        updateShiftStatusUI()
        Toast.makeText(this, "Shift Ended", Toast.LENGTH_SHORT).show()
    }

    private fun handleLogout() {
        if (sessionManager.getActiveShiftId() != null) {
            endShift()
        }
        FirebaseAuth.getInstance().signOut()
        sessionManager.clearSession()

        val intent = Intent(this, LoginActivity::class.java)
        startActivity(intent)
        finish()
    }
}
