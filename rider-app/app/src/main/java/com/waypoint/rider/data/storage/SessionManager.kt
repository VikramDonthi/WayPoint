package com.waypoint.rider.data.storage

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class SessionManager(context: Context) {

    private val sharedPreferences: SharedPreferences

    init {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        sharedPreferences = EncryptedSharedPreferences.create(
            context,
            "waypoint_secure_session",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    fun saveRiderSession(uid: String, phone: String, name: String) {
        sharedPreferences.edit()
            .putString(KEY_RIDER_UID, uid)
            .putString(KEY_RIDER_PHONE, phone)
            .putString(KEY_RIDER_NAME, name)
            .apply()
    }

    fun getRiderUid(): String? = sharedPreferences.getString(KEY_RIDER_UID, null)
    fun getRiderPhone(): String? = sharedPreferences.getString(KEY_RIDER_PHONE, null)
    fun getRiderName(): String? = sharedPreferences.getString(KEY_RIDER_NAME, null)

    fun saveActiveShiftId(shiftId: String?) {
        sharedPreferences.edit()
            .putString(KEY_ACTIVE_SHIFT_ID, shiftId)
            .apply()
    }

    fun getActiveShiftId(): String? = sharedPreferences.getString(KEY_ACTIVE_SHIFT_ID, null)

    fun clearSession() {
        sharedPreferences.edit().clear().apply()
    }

    companion object {
        private const val KEY_RIDER_UID = "key_rider_uid"
        private const val KEY_RIDER_PHONE = "key_rider_phone"
        private const val KEY_RIDER_NAME = "key_rider_name"
        private const val KEY_ACTIVE_SHIFT_ID = "key_active_shift_id"
    }
}
