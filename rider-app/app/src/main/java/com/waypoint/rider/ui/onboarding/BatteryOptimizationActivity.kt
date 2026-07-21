package com.waypoint.rider.ui.onboarding

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.waypoint.rider.databinding.ActivityBatteryOptimizationBinding

class BatteryOptimizationActivity : AppCompatActivity() {

    private lateinit var binding: ActivityBatteryOptimizationBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityBatteryOptimizationBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnOpenBatterySettings.setOnClickListener {
            openBatterySettings()
        }

        binding.btnDone.setOnClickListener {
            finish()
        }
    }

    override fun onResume() {
        super.onResume()
        checkStatus()
    }

    private fun checkStatus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            val isIgnoring = powerManager.isIgnoringBatteryOptimizations(packageName)
            if (isIgnoring) {
                binding.tvStatus.text = "Status: Battery Optimization Disabled (Optimized for Waypoint 👍)"
                binding.tvStatus.setTextColor(getColor(android.R.color.holo_green_light))
            } else {
                binding.tvStatus.text = "Status: Battery Optimization Active (May cause location stops ⚠️)"
                binding.tvStatus.setTextColor(getColor(android.R.color.holo_orange_light))
            }
        }
    }

    private fun openBatterySettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                }
                startActivity(intent)
            } catch (e: Exception) {
                try {
                    val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                    startActivity(intent)
                } catch (ex: Exception) {
                    Toast.makeText(this, "Could not open battery settings directly", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}
