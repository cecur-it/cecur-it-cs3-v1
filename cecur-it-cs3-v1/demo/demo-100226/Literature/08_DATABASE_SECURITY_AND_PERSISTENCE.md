# 08. Database Security & Persistence
## In-Memory ACID State, Firestore Cloud Sync, and Security Rules

---

## 1. Storage Architecture

The CS3 Platform implements a **hybrid dual-layer storage architecture**:

```
+----------------------------------------------------------------------------------------+
|                                    APPLICATION LAYER                                   |
+-------------------------------------------+--------------------------------------------+
                                            |
                     +----------------------+----------------------+
                     |                                             |
                     v                                             v
+-----------------------------------------+   +------------------------------------------+
|       IN-MEMORY ACTIVE DATA STORE       |   |       CLOUD FIRESTORE PERSISTENCE        |
|               (Hot Tier)                |   |               (Warm Tier)                |
| - 8 Live Sensor Telemetry Nodes         |   | - `users/{userId}`: Auth Profiles        |
| - Real-Time Incident State Engine       |   | - `transactions/{txId}`: Audit & Billing |
| - Active Offensive Scan Jobs            |   | - `system_audit/{auditId}`: GRC Records  |
| - In-Memory Actor Audit Trail Buffer    |   | - Gated by Firestore Security Rules      |
+-----------------------------------------+   +------------------------------------------+
```

1. **Hot Tier (In-Memory Engine — `server/db.ts`)**: Manages high-throughput, microsecond-latency operations: sensor metrics updates, incident status changes, real-time background simulation ticks, and live SSE event broadcasting.
2. **Warm Tier (Cloud Firestore — `server/firestoreSync.ts`)**: Persists long-term entities: user authentication credentials, payment and retainer transactions, signed compliance audits, and subscription tiers.

---

## 2. In-Memory Database Schema (`server/db.ts`)

The hot tier maintains full in-memory referential integrity:
* `users`: Security analyst, admin, auditor, and executive personas.
* `sensors`: 8 enterprise sensor nodes with CPU, memory, bandwidth, jitter, and dropped packet metrics.
* `incidents`: Full incident lifecycles with timeline events and telemetry traces.
* `cecurAgents`: Enrolled endpoint agents with OS and connection metadata.
* `cecurAlerts`: Parsed log alerts categorized by MITRE ATT&CK tactics.
* `targetAllowlist`: Authorized hosts for offensive reconnaissance.
* `hexstrikeJobs`: Executing and completed vulnerability scan tasks.
* `auditLogs`: Immutable actor operational history.

---

## 3. Firestore Synchronization Engine (`server/firestoreSync.ts`)

The background synchronization service asynchronously persists transactions and credentials:

```typescript
export async function seedFirestoreDemonstrativeCredentials(): Promise<void> {
  // Graceful initialization; skips if Cloud Firestore credentials are not provisioned
  // Seeds default demonstrative user records and billing structures
}

export async function persistTransactionToFirestore(transactionData: Record<string, any>): Promise<string> {
  // Writes validated billing transaction to `transactions` collection with server timestamp
}
```

---

## 4. Firestore Security Rules (`firestore.rules`)

Database security rules enforce strict role-based access control and tenant isolation at the Firestore storage layer:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper Functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    function hasRole(role) {
      return isAuthenticated() && request.auth.token.role == role;
    }
    
    function isAdmin() {
      return hasRole('admin') || hasRole('superadmin');
    }

    // User Profiles: Users can read their own profile; only admins can write
    match /users/{userId} {
      allow read: if isOwner(userId) || isAdmin();
      allow write: if isAdmin();
    }

    // Transactions Collection: Read-only for Auditors & Admins; Writes restricted
    match /transactions/{transactionId} {
      allow read: if isAuthenticated() && (hasRole('admin') || hasRole('auditor') || hasRole('executive'));
      allow create: if isAuthenticated() && (hasRole('admin') || hasRole('analyst'));
      allow update, delete: if isAdmin();
    }

    // Security Audit Trail: Append-only; No updates or deletions allowed
    match /system_audit/{auditId} {
      allow read: if isAuthenticated() && (hasRole('admin') || hasRole('auditor') || hasRole('executive'));
      allow create: if isAuthenticated();
      allow update, delete: if false; // Strict Immutability Gate
    }
  }
}
```

---

## 5. Security & Immutability Guarantees

1. **Strict Append-Only Audit Logs**: Deletion or modification of operational audit events is permanently blocked (`allow update, delete: if false;`).
2. **Credential Hashing & Token Isolation**: Tokens are verified server-side. Passwords and API keys are never written to unencrypted log streams.
3. **Graceful Degradation**: If Firestore is unreachable, the application continues to serve traffic and process incidents entirely from the in-memory engine without throwing fatal exceptions.
