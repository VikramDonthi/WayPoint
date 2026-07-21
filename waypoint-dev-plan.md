# Waypoint — Rider Tracking App + Admin Dashboard — Development Plan (v2)

**Goal:** Track delivery riders' location, resting time, and traveling time, using resource-optimization patterns inspired by platforms like Swiggy/Rapido, adapted to a **zero-budget, small-fleet (<20 riders)** setup.
**Constraints:** Android-only, sideloaded APK (no Play Store), admin creates rider accounts, no geofencing, secure by default, $0 infra cost.

---

## 1. What We're Borrowing From Swiggy/Rapido-Style Systems

Large delivery platforms optimize for battery + cost using a few core ideas. We adopt the ones that make sense at our scale and skip the ones that don't:

| Pattern (industry) | At their scale | At our scale (adapted) |
|---|---|---|
| Background location service, isolated from UI thread | Dedicated native module | Android **Foreground Service** running a coroutine loop |
| Adaptive ping frequency (fast when moving, slow when idle) | ML-driven | Simple speed/distance threshold — **cheap and effective** |
| Buffer location events before writing to DB (they use Kafka) | Kafka topic, millions of events/sec | **Local Room DB queue** — same idea, zero-infra version |
| Real-time push to consumers (WebSockets) | Persistent WebSocket connections | **Firestore real-time listeners** — same effect, free, no socket server to run |
| Strong auth + token-based sessions | OAuth/JWT via internal auth service | **Firebase Authentication** (free, unlimited on Spark plan) |
| Encrypted transport | TLS everywhere | Firestore + Firebase Hosting use HTTPS/TLS by default — free, already covered |

The point: their scale forces infrastructure (Kafka, persistent sockets, custom auth servers) that costs money and effort. We keep the *design principles* but implement them with free, managed equivalents.

---

## 2. Architecture

```
┌──────────────────┐         ┌───────────────────────┐         ┌───────────────────┐
│   Rider App        │ ─────► │   Firebase (free tier)   │ ◄────── │  Admin Dashboard    │
│  (Kotlin/Android)   │ writes │  Auth + Firestore + Hosting│  reads  │  (React + Hosting)  │
└──────────────────┘         └───────────────────────┘         └───────────────────┘
```

- **Firebase Authentication** — real auth, not custom password hashing. Free, unlimited email/password users on Spark plan.
- **Firestore** — data store + real-time sync (acts like the "push to consumer" layer without needing WebSockets).
- **Firebase Hosting** — serves the admin dashboard.
- **No Cloud Functions, no paid tier** — all derived stats computed client-side.

---

## 3. Authentication (Corrected From v1 — Important)

**v1 used a custom password-hash-in-Firestore approach — this has a real flaw:** anyone who can read the `riders` collection can pull password hashes and crack them offline. Fix it properly, still free:

### How it works
1. **Admin dashboard**, when adding a rider:
   - Uses a **secondary Firebase Auth instance** (so creating the rider's account doesn't log the admin out) to call `createUserWithEmailAndPassword(riderEmail, generatedPassword)`.
   - Stores the resulting `uid` in the rider's Firestore doc (`riders/{uid}`).
   - Displays the generated username/password once, for the admin to share with the rider.
2. **Rider app** signs in with real `FirebaseAuth.signInWithEmailAndPassword()` — Firebase handles password security, token refresh, and session expiry for you.
3. **Admin login** is also a real Firebase Auth account (created once, manually, for your friend).

This costs nothing extra and removes an entire class of security problems.

---

## 4. Data Model (Firestore)

```
riders/{uid}                          // uid = Firebase Auth UID
  ├─ name: string
  ├─ phone: string
  ├─ status: "traveling" | "resting" | "offline"
  ├─ lastLocation: { lat, lng, timestamp }
  ├─ currentShiftId: string | null
  └─ createdAt: timestamp

shifts/{shiftId}
  ├─ riderId: string (uid)
  ├─ startTime: timestamp
  └─ endTime: timestamp | null

pings/{shiftId}/points/{autoId}
  ├─ lat: number
  ├─ lng: number
  ├─ timestamp: timestamp
  ├─ speed: number (m/s, from FusedLocationProvider — free signal, no extra API)
  └─ movementType: "traveling" | "resting"   // derived, see below
```

---

## 5. Rider App (Kotlin, Android)

### 5.1 Adaptive Tracking (the "Swiggy-style" part)

Instead of a rigid fixed interval, scale ping frequency by movement state — this is the actual lever real platforms pull for battery savings:

```
if lastKnownSpeed > 3 m/s (moving/riding):
    interval = 30–60 sec
elif lastKnownSpeed > 0 but slow (walking, doing a delivery):
    interval = 1–2 min
else (stationary):
    interval = 5 min
```

- Use `FusedLocationProviderClient` with `PRIORITY_BALANCED_POWER_ACCURACY` — accurate enough at this granularity, meaningfully cheaper on battery than `PRIORITY_HIGH_ACCURACY`.
- `movementType` is derived the same simple way as before: compare distance between consecutive points relative to elapsed time → "resting" if effectively stationary, "traveling" otherwise. No paid activity-recognition API needed.

### 5.2 Foreground Service (`TrackingService.kt`)
- Started on "Start Shift," stopped on "End Shift."
- Persistent notification: "On Duty — Tracking Active" (required by Android, also keeps this transparent to the rider).
- Runs the adaptive loop in a coroutine — isolated from the UI thread, same principle as running location work off the main thread in production apps.

### 5.3 Local Buffer (the "Kafka, but free" part)
- Every location point is written to a local **Room DB queue** first, then synced to Firestore.
- Sync worker drains the queue in small batches (reduces network wake-ups vs. one write per point) and retries with exponential backoff on failure.
- This gives you the same resilience Kafka buffering gives large platforms — no data loss on flaky network — without running any infrastructure.

### 5.4 Secure Local Storage
- Store the Firebase Auth session using Android's **Jetpack Security (`EncryptedSharedPreferences`)** rather than plain `SharedPreferences` — free, built-in, prevents casual extraction of session tokens from a rooted/compromised device.
- Firebase Auth SDK handles token refresh automatically once signed in.

### 5.5 Permissions
- `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`
- `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` (Android 14+)
- `POST_NOTIFICATIONS` (Android 13+)
- Prompt rider once to **disable battery optimization** for the app (Settings → Battery → Unrestricted) — without this, Android can still kill the foreground service on aggressive OEMs (Xiaomi, Oppo, etc. are notorious for this). Worth a one-time onboarding screen.

---

## 6. Admin Dashboard (React + Firebase Hosting)

### Pages
1. **Login** — Firebase Auth (admin account)
2. **Live Map** — Firestore real-time listener on `riders`, pins colored by status
3. **Rider List** — status, today's traveling/resting time (computed client-side from `pings`)
4. **Add Rider** — creates Firebase Auth account (secondary instance) + Firestore doc, shows credentials once
5. **Rider Detail (phase 2)** — plot a shift's `pings` as a route

### Stats computation (still client-side, no paid Cloud Functions)
Same as v1: walk through a shift's ordered pings, sum time deltas by `movementType`.

---

## 7. Security Checklist

| Layer | Measure | Cost |
|---|---|---|
| Auth | Firebase Authentication (email/password) instead of custom hashing | Free |
| Transport | HTTPS/TLS via Firestore + Hosting (default, not optional) | Free |
| Data access | **Firestore Security Rules** — riders can only read/write their own `riders/{uid}` and `pings/{ownShiftId}`; only the admin UID(s) can read all riders | Free |
| Data validation | Security Rules reject malformed writes (lat/lng out of range, future timestamps, wrong rider writing to another's shift) | Free |
| Local storage | `EncryptedSharedPreferences` for session data on-device | Free |
| Session handling | Firebase Auth manages token expiry/refresh; force sign-out on "End Shift" | Free |
| APK integrity | Sign release APK with your own keystore; don't rebuild/redistribute from untrusted sources | Free |
| Admin access | Hardcode trusted admin UID(s) in Security Rules (fine at 1–2 admins; avoids needing Cloud Functions for custom claims) | Free |

### Example Firestore Security Rule (starting point)
```
match /riders/{riderId} {
  allow read: if request.auth.uid == riderId || request.auth.uid in ['ADMIN_UID_HERE'];
  allow write: if request.auth.uid == riderId || request.auth.uid in ['ADMIN_UID_HERE'];
}
match /pings/{shiftId}/points/{pointId} {
  allow write: if request.auth.uid == resource.data.riderId
                && request.resource.data.lat > -90 && request.resource.data.lat < 90
                && request.resource.data.lng > -180 && request.resource.data.lng < 180;
  allow read: if request.auth.uid in ['ADMIN_UID_HERE'];
}
```
(Exact structure will need minor adjustment once shift/rider linkage is finalized in code — this is the pattern, not copy-paste final rules.)

---

## 8. Build Order

| Phase | Task |
|---|---|
| 1 | Firebase project: enable Auth (Email/Password) + Firestore + Hosting |
| 2 | Write initial Security Rules (lock down before any real data goes in — don't leave test mode open) |
| 3 | Admin dashboard: Add Rider flow (secondary Auth instance + Firestore doc) |
| 4 | Rider app: Firebase Auth login screen |
| 5 | Rider app: Foreground service + adaptive FusedLocation loop + Room buffer + Firestore sync |
| 6 | Dashboard: live map (real-time listener) + rider list |
| 7 | Movement inference (traveling/resting) + stats display |
| 8 | Battery-optimization onboarding screen (guide rider to whitelist the app) |
| 9 | Polish: retry/backoff on sync failures, empty/error states in dashboard |

---

## 9. Out of Scope (per requirements)
- Geofencing
- Push notifications/alerts
- iOS app
- Play Store distribution
- Real-time order assignment/dispatch

## 10. Practical Note
Even with proper auth and encryption, tell riders clearly (verbally or via a short message) that location is tracked during shift hours. It's not a technical requirement, but it avoids trust issues and disputes later.
