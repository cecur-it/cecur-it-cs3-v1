# 02. Environment Configuration
## CS3 Platform Runtime, Networking, and Environment Variables

---

## 1. Overview & Runtime Constraints

The **CS3 (CECUR-IT Cyber Security Operations Console)** backend is built on Node.js (v18+) and Express with TypeScript, seamlessly integrating with the Vite frontend build pipeline.

### Container & Networking Rules
1. **Single Public Port Constraint**: The container exposes **Port 3000** exclusively. All ingress HTTP, REST API, Server-Sent Events (SSE), and static frontend assets are reverse-proxied through `0.0.0.0:3000`.
2. **Server-Side API Security**: Secret API credentials (Gemini, DeepSeek, HexStrike, ActivTrak, Firebase Admin) **must never** be exposed to the browser or prefixed with `VITE_`.
3. **Dual Development & Production Server**: In development mode, Express directly mounts Vite middleware (`middlewareMode: true`) for instantaneous hot execution. In production mode, Express serves pre-built static assets from `/dist` with full SPA route fallback.

---

## 2. Environment Variables Matrix

All configurable environment variables must be declared in `.env.example` to document deployment requirements without committing sensitive credentials.

| Variable Name | Required? | Default / Example | Scope | Functional Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | Built-in | `3000` | Server | HTTP port bound by Express server (must be 3000 for container ingress). |
| `NODE_ENV` | Optional | `development` / `production` | Platform | Controls Vite middleware attachment vs. static `/dist` bundle serving. |
| `GEMINI_API_KEY` | Optional | `AIzaSy...` | Server | Enables the primary **CS3 Agent** (Gemini 3.7 Flash) for threat reasoning. |
| `DEEPSEEK_API_KEY` | Optional | `sk-...` | Server | Enables the secondary **CECUR-IT Agent** (DeepSeek Chat) as fallback. |
| `HEXSTRIKE_BASE_URL` | Optional | `https://hexstrike.internal:8000` | Server | Target URL of active HexStrike AI reconnaissance server daemon. |
| `HEXSTRIKE_API_KEY` | Optional | `hex_secret_token_...` | Server | Authorization bearer token for HexStrike REST API. |
| `ACTIVTRAK_BASE_URL` | Optional | `https://api.activtrak.com/v1` | Server | ActivTrak Insider Risk API gateway endpoint. |
| `ACTIVTRAK_API_KEY` | Optional | `at_sec_...` | Server | API authentication key for ActivTrak cloud service. |
| `ACTIVTRAK_ACCOUNT_ID` | Optional | `act-org-7821` | Server | Organization / Account identifier within ActivTrak tenant. |
| `SOC_INGEST_API_KEY` | Optional | `cecur-ingest-key-prod-01` | Server | Pre-shared key for validating edge forwarder log streams. |
| `FIREBASE_PROJECT_ID` | Optional | `cecur-it-soc` | Shared | Google Cloud / Firebase project ID for Firestore persistence. |

---

## 3. Configuration Setup & Bootstrapping

### 3.1. Local Development Setup
Create a `.env` file in the project root:

```bash
# Server & Runtime Configuration
PORT=3000
NODE_ENV=development

# AI Threat Reasoning Engines (Optional - Platform provides resilient local heuristics)
GEMINI_API_KEY=your_gemini_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# External Security Services (Optional - Platform runs in simulated mode if unset)
HEXSTRIKE_BASE_URL=https://hexstrike.internal:8000
HEXSTRIKE_API_KEY=your_hexstrike_api_key
ACTIVTRAK_BASE_URL=https://api.activtrak.com/v1
ACTIVTRAK_API_KEY=your_activtrak_key
ACTIVTRAK_ACCOUNT_ID=act-org-7821

# Ingestion Security Secret
SOC_INGEST_API_KEY=cecur-ingest-key-prod-01
```

### 3.2. Lazy SDK Client Initialization
To avoid container startup crashes when environment variables are omitted or added dynamically, all SDKs follow the **lazy initialization** pattern:

```typescript
// Example: server/ai/cecurAI.ts
import { GoogleGenAI } from '@google/genai';

let geminiClient: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI | null {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      geminiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'cecur-soc-console',
          },
        },
      });
    }
  }
  return geminiClient;
}
```

---

## 4. Production Build & Start Configuration

The production build pipeline compiles both client and backend TypeScript in a single atomic pass:

```json
{
  "scripts": {
    "dev": "tsx server.ts",
    "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs",
    "start": "node dist/server.cjs"
  }
}
```

### Key Build Mechanics:
1. `vite build`: Compiles React TypeScript components, styles, and assets into `/dist`.
2. `esbuild server.ts`: Bundles the Express server, backend routes, engines, and utilities into `/dist/server.cjs`.
3. `--packages=external`: Leaves native Node modules (e.g., `express`, `@google/genai`) to be resolved at runtime from `node_modules`.
4. `--sourcemap`: Emits accurate line mappings for debugging runtime exceptions in production containers.
