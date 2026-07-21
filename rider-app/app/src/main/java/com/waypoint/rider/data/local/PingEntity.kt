package com.waypoint.rider.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "location_pings")
data class PingEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val shiftId: String,
    val riderId: String,
    val lat: Double,
    val lng: Double,
    val speed: Float, // m/s from FusedLocationProvider
    val movementType: String, // "traveling" | "resting"
    val timestamp: Long, // Epoch millis
    val isSynced: Boolean = false
)
