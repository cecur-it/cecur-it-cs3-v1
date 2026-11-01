# 10. Role-Based Access Control & Access Matrix (RBAC / RBAM)
## Security Persona Scopes, Server-Enforced Clearance, and HTTP 403 Enforcement

---

## 1. Overview & Security Tiers

The CS3 SOC Console implements a multi-tier, server-enforced Role-Based Access Control (RBAC) and Role-Based Access Management (RBAM) model. Every incoming HTTP request is authenticated, token-verified, and evaluated against the actor's security clearance tier before granting execution rights.

---

## 2. Server Clearance Matrix (`Consumption/ROLE_BASED_ACCESS_MATRIX.md`)

| Console Panel / Resource | Analyst (Tier 2/3) | Admin (Infra/Red) | Auditor (GRC) | Executive (CISO) | Server Enforced Policy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Overview Dashboard (`overview`)** | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | Public dashboard for all authenticated users. |
| **SIEM / SOAR Incidents (`incidents`)** | ⚡ Full Read/Write | ⚡ Full Read/Write | 👁️ Read-Only | 👁️ Read-Only | Status updates & SOAR execution restricted to Analyst/Admin. |
| **Cecur SIEM/XDR Core (`cecur`)** | ⚡ Full Access | ⚡ Full Access | 👁️ Read-Only | ❌ Denied (`HTTP 403`) | Technical engine metrics hidden from Executive persona. |
| **ActivTrak Insider Risk (`activtrak`)**| ⚡ Full Access | ⚡ Full Access | 👁️ Read-Only | ❌ Denied (`HTTP 403`) | Raw employee productivity data hidden from Executive persona. |
| **CS3 Sensor Grid (`sensors`)** | 🔧 Calibrate / View | ⚡ Full Admin / Reboot | 👁️ Read-Only | ❌ Denied (`HTTP 403`) | Sensor reboot restricted to Admin; Executive blocked. |
| **Asset Fusion 3D Graph (`fusion`)** | ✅ Allowed | ✅ Allowed | ❌ Denied (`HTTP 403`) | ❌ Denied (`HTTP 403`) | Attack graph & blast simulation restricted to technical staff. |
| **HexStrike AI Offensive Recon (`hexstrike`)** | ❌ Denied (`HTTP 403`) | ⚡ Full Authority | ❌ Denied (`HTTP 403`) | ❌ Denied (`HTTP 403`) | Offensive recon restricted strictly to Admin (Red Team). |
| **Operational Audit Trail (`audit`)** | 👁️ View Logs | ⚡ Full Export | ⚡ Full Export | 👁️ View Logs | Export authority granted to GRC Auditor & Admin. |
| **Executive CISO KPIs (`executive`)** | ❌ Denied (`HTTP 403`) | ✅ Full Access | ✅ Full Access | ✅ Full Access | Financial ROI and executive KPIs blocked for Analyst. |
| **Database Reseed / Reset (`reseed_db`)**| ❌ Denied (`HTTP 403`) | ⚡ Allowed | ❌ Denied (`HTTP 403`) | ❌ Denied (`HTTP 403`) | High-impact reset sequence restricted to Admin. |

---

## 3. Persona Definitions & Responsibilities

### 3.1. Security Analyst (`analyst`)
* **Primary Mandate**: Active threat triage, incident investigation, sensor calibration, and SOAR containment execution.
* **Included Panels**: `overview`, `incidents`, `cecur`, `activtrak`, `sensors`, `fusion`, `audit`.
* **Prohibited Capabilities**: Offensive reconnaissance scans (`hexstrike`), Executive financial ROI panels (`executive`), sensor reboots, and database resets.

### 3.2. Security Administrator (`admin`)
* **Primary Mandate**: Complete infrastructure oversight, red-team penetration reconnaissance, system policy enforcement, and node reboots.
* **Included Panels**: All panels (`overview`, `incidents`, `cecur`, `activtrak`, `sensors`, `fusion`, `hexstrike`, `audit`, `executive`, `reseed_db`).
* **Authority Level**: Highest operational clearance tier.

### 3.3. Compliance Auditor (`auditor`)
* **Primary Mandate**: Independent GRC verification, regulatory compliance auditing, and forensic log examination.
* **Included Panels**: `overview`, `incidents` (Read-only), `cecur` (Read-only), `activtrak` (Read-only), `sensors` (Read-only), `audit` (Full Export), `executive` (View).
* **Prohibited Capabilities**: Mutation actions, sensor reboots, SOAR execution, and offensive scanning tools.

### 3.4. Executive CISO (`executive`)
* **Primary Mandate**: High-level board governance, risk posture assessment, ROI tracking, and compliance sign-off.
* **Included Panels**: `overview`, `incidents` (Read-only), `audit` (View-only), `executive` (Full Access).
* **Prohibited Capabilities**: Granular raw network packet inspection, sensor grid configuration, employee surveillance streams, and offensive scanning.

---

## 4. Server-Side Middleware Implementation (`server/middleware/auth.ts`)

Clearance policies are enforced by Express middleware prior to reaching route controllers:

```typescript
// Example: Restricting HexStrike routes to 'admin'
hexstrikeRouter.post('/scan', requireAuth, requirePanel('hexstrike'), requireAction('run_offensive_scan'), (req, res) => {
  // Only executed if user possesses 'admin' role token; otherwise emits HTTP 403 Forbidden
});

export function requirePanel(panelId: ConsolePanel) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role || 'analyst';
    if (!canAccessPanel(userRole, panelId)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Security persona '${userRole}' lacks clearance to access the '${panelId}' console panel.`,
        requiredClearance: 'ADMIN or authorized role tier',
      });
      return;
    }
    next();
  };
}
```
