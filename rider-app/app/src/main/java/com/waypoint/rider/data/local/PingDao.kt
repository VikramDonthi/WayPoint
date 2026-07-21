package com.waypoint.rider.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface PingDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPing(ping: PingEntity): Long

    @Query("SELECT * FROM location_pings WHERE isSynced = 0 ORDER BY timestamp ASC LIMIT :limit")
    suspend fun getUnsyncedPings(limit: Int = 20): List<PingEntity>

    @Query("UPDATE location_pings SET isSynced = 1 WHERE id IN (:ids)")
    suspend fun markAsSynced(ids: List<Long>)

    @Query("DELETE FROM location_pings WHERE isSynced = 1")
    suspend fun deleteSyncedPings()

    @Query("SELECT COUNT(*) FROM location_pings WHERE isSynced = 0")
    suspend fun getUnsyncedCount(): Int
}
