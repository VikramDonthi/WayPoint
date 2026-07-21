package com.waypoint.rider.ui.main

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.waypoint.rider.data.storage.SessionManager
import com.waypoint.rider.databinding.ActivityMainBinding
import com.waypoint.rider.service.TrackingService
import com.waypoint.rider.ui.login.LoginActivity

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var sessionManager: SessionManager
    private val db = FirebaseFirestore.getInstance()
    private var shiftListener: ListenerRegistration? = null

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
        listenToActiveShiftDistance()
    }

    override fun onPause() {
        super.onPause()
        shiftListener?.remove()
    }

    private fun setupUI() {
        val riderName = sessionManager.getRiderName() ?: "Rider"
        val riderPhone = sessionManager.getRiderPhone() ?: ""

        binding.tvRiderName.text = riderName
        binding.tvRiderPhone.text = "Mobile: $riderPhone"

        binding.btnToggleShift.setOnClickListener {
            val currentShiftId = sessionManager.getActiveShiftId()
            if (currentShiftId == null) {
                requestPermissionsAndStartShift()
            } else {
                endShift()
            }
        }

        binding.btnLogout.setOnClickListener {
            handleLogout()
        }
    }

    private fun updateShiftStatusUI() {
        val activeShiftId = sessionManager.getActiveShiftId()
        val isOnDuty = activeShiftId != null

        if (isOnDuty) {
            binding.tvShiftStatus.text = "ON DUTY — TRACKING ACTIVE"
            binding.tvShiftStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_green_dark))
            binding.btnToggleShift.text = "End Shift"
            binding.btnToggleShift.setBackgroundColor(ContextCompat.getColor(this, android.R.color.holo_red_dark))
            binding.cardTrackingIndicator.visibility = View.VISIBLE
        } else {
            binding.tvShiftStatus.text = "OFF DUTY — INACTIVE"
            binding.tvShiftStatus.setTextColor(ContextCompat.getColor(this, android.R.color.darker_gray))
            binding.btnToggleShift.text = "Start Shift"
            binding.btnToggleShift.setBackgroundColor(ContextCompat.getColor(this, android.R.color.holo_blue_dark))
            binding.cardTrackingIndicator.visibility = View.GONE
        }
    }

    private fun listenToActiveShiftDistance() {
        val shiftId = sessionManager.getActiveShiftId() ?: return
        shiftListener?.remove()

        shiftListener = db.collection("shifts").document(shiftId)
            .addSnapshotListener { snapshot, e ->
                if (e != null || snapshot == null || !snapshot.exists()) return@addSnapshotListener
                val distKm = snapshot.getDouble("totalDistanceKm") ?: 0.0
                binding.tvShiftDistance.text = String.format("%.2f km", distKm)
            }
    }

    private fun requestPermissionsAndStartShift() {
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

                // Update rider status to active shift
                db.collection("riders").document(riderId)
                    .update("status", "resting", "currentShiftId", shiftId, "totalDistanceKm", 0.0)

                // Start Tracking Service
                val serviceIntent = Intent(this, TrackingService::class.java).apply {
                    action = TrackingService.ACTION_START_TRACKING
                }
                ContextCompat.startForegroundService(this, serviceIntent)

                binding.progressBarShift.visibility = View.GONE
                updateShiftStatusUI()
                listenToActiveShiftDistance()
                Toast.makeText(this, "Shift Started Successfully!", Toast.LENGTH_SHORT).show()
            }
            .addOnFailureListener { e ->
                binding.progressBarShift.visibility = View.GONE
                Toast.makeText(this, "Failed to start shift: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
            }
    }

    private fun endShift() {
        val serviceIntent = Intent(this, TrackingService::class.java).apply {
            action = TrackingService.ACTION_STOP_TRACKING
        }
        startService(serviceIntent)
        sessionManager.saveActiveShiftId(null)
        shiftListener?.remove()
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
