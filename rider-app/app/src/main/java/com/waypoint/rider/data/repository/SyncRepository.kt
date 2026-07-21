package com.waypoint.rider.data.repository

import android.content.Context
import android.util.Log
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.waypoint.rider.data.local.AppDatabase
import com.waypoint.rider.data.local.PingEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.util.Date

class SyncRepository(context: Context) {

    private val db = FirebaseFirestore.getInstance()
    private val pingDao = AppDatabase.getDatabase(context).pingDao()

    suspend fun enqueuePing(
        shiftId: String,
        riderId: String,
        lat: Double,
        lng: Double,
        speed: Float,
        movementType: String,
        timestampMillis: Long
    ) {
        withContext(Dispatchers.IO) {
            val ping = PingEntity(
                shiftId = shiftId,
                riderId = riderId,
                lat = lat,
                lng = lng,
                speed = speed,
                movementType = movementType,
                timestamp = timestampMillis,
                isSynced = false
            )
            pingDao.insertPing(ping)
        }
    }

    /**
     * Drains unsynced pings from local Room DB and uploads to Firestore in batches.
     * Retries automatically on network failure.
     */
    suspend fun syncPendingPings(): Int = withContext(Dispatchers.IO) {
        val pendingPings = pingDao.getUnsyncedPings(limit = 25)
        if (pendingPings.isEmpty()) return@withContext 0

        var syncedCount = 0
        val syncedIds = mutableListOf<Long>()

        for (ping in pendingPings) {
            try {
                val pointData = hashMapOf(
                    "riderId" to ping.riderId,
                    "lat" to ping.lat,
                    "lng" to ping.lng,
                    "speed" to ping.speed,
                    "movementType" to ping.movementType,
                    "timestamp" to Timestamp(Date(ping.timestamp))
                )

                // 1. Add point to pings/{shiftId}/points/{autoId}
                db.collection("pings")
                    .document(ping.shiftId)
                    .collection("points")
                    .add(pointData)
                    .await()

                // 2. Update rider's lastLocation & status in riders/{riderId}
                val riderUpdate = hashMapOf(
                    "status" to ping.movementType,
                    "currentShiftId" to ping.shiftId,
                    "lastLocation" to hashMapOf(
                        "lat" to ping.lat,
                        "lng" to ping.lng,
                        "timestamp" to Timestamp(Date(ping.timestamp))
                    )
                )

                db.collection("riders")
                    .document(ping.riderId)
                    .update(riderUpdate as Map<String, Any>)
                    .await()

                syncedIds.add(ping.id)
                syncedCount++
            } catch (e: Exception) {
                Log.e(TAG, "Sync failed for ping ID ${ping.id}, stopping batch retry later", e)
                break // Stop current batch execution if network fails
            }
        }

        if (syncedIds.isNotEmpty()) {
            pingDao.markAsSynced(syncedIds)
            pingDao.deleteSyncedPings() // Purge synced entries to save local disk
        }

        return@withContext syncedCount
    }

    companion object {
        private const val TAG = "SyncRepository"
    }
}
