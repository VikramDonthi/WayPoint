package com.waypoint.rider.ui.login

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.waypoint.rider.data.storage.SessionManager
import com.waypoint.rider.databinding.ActivityLoginBinding
import com.waypoint.rider.ui.main.MainActivity

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
    private lateinit var auth: FirebaseAuth
    private lateinit var sessionManager: SessionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        auth = FirebaseAuth.getInstance()
        sessionManager = SessionManager(this)

        // If already logged in, redirect directly to MainActivity
        if (auth.currentUser != null && sessionManager.getRiderUid() != null) {
            navigateToMain()
            return
        }

        binding.btnLogin.setOnClickListener {
            handleLogin()
        }
    }

    private fun handleLogin() {
        val rawInput = binding.etMobile.text.toString().trim()
        val password = binding.etPassword.text.toString().trim()

        val cleanDigits = rawInput.replace("\\D".toRegex(), "")
        val normalizedPhone = if (cleanDigits.length >= 10) cleanDigits.takeLast(10) else cleanDigits

        if (normalizedPhone.length < 8 && !rawInput.contains("@")) {
            binding.etMobile.error = "Enter valid mobile number"
            return
        }

        if (password.length < 6) {
            binding.etPassword.error = "Password must be at least 6 characters"
            return
        }

        setLoading(true)

        // Synthetic identifier pattern: [NormalizedMobile]@waypoint.app
        val syntheticEmail = if (rawInput.contains("@")) rawInput else "$normalizedPhone@waypoint.app"

        auth.signInWithEmailAndPassword(syntheticEmail, password)
            .addOnSuccessListener { authResult ->
                val uid = authResult.user?.uid
                if (uid != null) {
                    fetchRiderDetailsAndSave(uid, normalizedPhone)
                } else {
                    setLoading(false)
                    Toast.makeText(this, "Authentication failed. Null user ID.", Toast.LENGTH_SHORT).show()
                }
            }
            .addOnFailureListener { e ->
                setLoading(false)
                Toast.makeText(this, "Login Failed: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
            }
    }

    private fun fetchRiderDetailsAndSave(uid: String, phone: String) {
        FirebaseFirestore.getInstance()
            .collection("riders")
            .document(uid)
            .get()
            .addOnSuccessListener { document ->
                val name = document.getString("name") ?: "Rider"
                sessionManager.saveRiderSession(uid, phone, name)
                setLoading(false)
                navigateToMain()
            }
            .addOnFailureListener {
                sessionManager.saveRiderSession(uid, phone, "Rider")
                setLoading(false)
                navigateToMain()
            }
    }

    private fun setLoading(isLoading: Boolean) {
        binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        binding.btnLogin.isEnabled = !isLoading
    }

    private fun navigateToMain() {
        val intent = Intent(this, MainActivity::class.java)
        startActivity(intent)
        finish()
    }
}
