package com.waypoint.rider

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.google.firebase.FirebaseApp

class WaypointApp : Application() {

    override fun onCreate() {
        super.onCreate()
        // Initialize Firebase SDK
        FirebaseApp.initializeApp(this)

        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channelId = CHANNEL_ID
            val name = "Rider Shift Tracking"
            val descriptionText = "Notifications for active location tracking during delivery shifts"
            val importance = NotificationManager.IMPORTANCE_LOW
            val channel = NotificationChannel(channelId, name, importance).apply {
                description = descriptionText
            }
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager?.createNotificationChannel(channel)
        }
    }

    companion object {
        const val CHANNEL_ID = "waypoint_tracking_channel"
    }
}
