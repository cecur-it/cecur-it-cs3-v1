# 12. Developer Contributions Manual
## Development Standards, Code Conventions, and Extension Protocols

---

## 1. Project Organization & Codebase Structure

The CS3 codebase is structured into modular layers separating client presentation, server routing, and core domain engines:

```
├── .env.example              # Environment variable declarations & documentation
├── metadata.json             # AI Studio metadata & permission specifications
├── package.json              # NPM dependencies and dual build scripts
├── server.ts                 # Full-stack entry point & Express SSE lifecycle
├── server/                   # Backend engines & REST APIs
│   ├── ai/cecurAI.ts         # Dual-agent LLM dispatcher & local heuristics
│   ├── connectors/           # External integration connectors (Errow, etc.)
│   ├── data/generators.ts    # Synthetic security telemetry generators
│   ├── db.ts                 # In-memory database with ACID referential integrity
│   ├── engine/cecurEngine.ts # Cecur SIEM/XDR Decoders and detection rules
│   ├── firestoreSync.ts      # Cloud Firestore persistence & billing synchronizer
│   ├── fusion.ts             # 3D Asset Fusion graph and blast radius simulator
│   ├── middleware/auth.ts    # Express RBAC gating & audit interceptors
│   ├── rbac.ts               # Core RBAC/RBAM permission matrix definitions
│   └── routes/               # Modular Express REST API route handlers
├── src/                      # Frontend Single-Page Application (React 18 + TS)
│   ├── components/           # Reusable UI widgets, headers, footers, modals
│   │   ├── panels/           # Top-level SOC console panels
│   │   └── panels/fusion/    # 3D Graph, Blast Simulator, Threat Export
│   ├── context/AuthContext   # Global React authentication & persona context
│   ├── data/                 # Static literature, legal text, initial mock data
│   ├── lib/api.ts            # Frontend HTTP client & SSE streaming manager
│   ├── types.ts              # Canonical TypeScript interfaces & enums
│   └── App.tsx               # Main application view switcher & top navigation
└── Literature/               # Comprehensive technical documentation library
```

---

## 2. Coding Standards & Conventions

1. **Language & Type Safety**:
   * Pure **TypeScript (strict mode)** across all frontend and backend modules.
   * Do not use `any` unless wrapping dynamic third-party external payloads; declare explicit interfaces in `src/types.ts` or local server files.
   * Use standard TypeScript `enum` declarations (avoid `const enum`).
2. **Icons & Visual Styling**:
   * All iconography **must** be imported from `lucide-react`.
   * All styling **must** be implemented via **Tailwind CSS** utility classes directly in JSX/TSX.
3. **Async & Error Handling**:
   * Route handlers must wrap async execution in standard try/catch blocks and return standardized JSON error envelopes: `{ error: string, message?: string }`.
   * Never throw unhandled Promise rejections that crash the Express server process.

---

## 3. Extending the Cecur Engine (`server/engine/cecurEngine.ts`)

### 3.1. Adding a New Log Decoder
To add a new log format decoder (e.g., Cisco ASA Firewall, NGINX Access Logs):
1. Define the decoder metadata in `CecurEngine.decoders`:
   ```typescript
   {
     name: 'cecur-cisco-asa',
     type: 'cisco_asa',
     description: 'Cisco Adaptive Security Appliance (ASA) firewall syslog parser',
     patternSample: '%ASA-4-106023: Deny tcp src outside:198.51.100.22/4128 dst inside:10.0.1.5/80 by access-group',
     fieldsExtracted: ['action', 'protocol', 'src_ip', 'src_port', 'dest_ip', 'dest_port'],
   }
   ```
2. Implement extraction regex in `CecurEngine.parseLogLine(rawLog)`:
   ```typescript
   if (rawLog.includes('%ASA-')) {
     const match = rawLog.match(/Deny (\w+) src \w+:([\d.]+)\/(\d+) dst \w+:([\d.]+)\/(\d+)/);
     if (match) {
       return {
         decoderMatched: 'cecur-cisco-asa',
         extractedFields: {
           action: 'DENY',
           protocol: match[1],
           src_ip: match[2],
           src_port: match[3],
           dest_ip: match[4],
           dest_port: match[5],
         },
         level: 7,
       };
     }
   }
   ```

### 3.2. Adding a Detection Rule
Add your rule to `CecurEngine.rulesCatalog`:
```typescript
{
  id: 10070,
  level: 11,
  category: 'firewall_denial',
  title: 'Cisco ASA: High-Frequency Firewall Denials (Port Scan)',
  description: 'Repetitive connection drops from single external IP against multiple protected endpoints.',
  mitreTactic: 'Discovery',
  mitreTechnique: 'T1046 - Network Service Discovery',
  compliance: ['PCI_DSS_10.6', 'NIST_800_53_SI_4'],
  decoder: 'cecur-cisco-asa',
}
```

---

## 4. Extending Errow Offensive Tool Profiles (`server/connectors/errowClient.ts`)

To register a new reconnaissance tool:
1. Add the tool identifier to `SAFE_TOOL_PROFILES`:
   ```typescript
   export const SAFE_TOOL_PROFILES = [
     'nmap_scan',
     'nuclei_scan',
     'gobuster_scan',
     'subfinder_scan',
     'amass_enum', // Newly added safe profile
   ] as const;
   ```
2. Implement the scanner invocation and finding parser in `runErrowScan()`. Ensure target verification against `db.targetAllowlist` is preserved.

---

## 5. Verification & Testing Workflow

Before submitting contributions or deploying updates, execute full verification:

```bash
# 1. Validate TypeScript syntax and compilation
npm run build

# 2. Start local dev server and test health endpoint
npm run dev

# In another terminal:
curl -s http://localhost:3000/api/health | jq .
```
