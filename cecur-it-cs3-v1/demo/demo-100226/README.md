# Run and deploy AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/eac70f24-962a-4ae2-b704-6f0bce51392a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Container / Platform Install

This app is the CS3 ESOC Console. Build with `docker build -t cs3-soc-console .` (see `Dockerfile`) or install via the repository root launcher for `cloud`, `onprem`, or `airgap` profiles:

`node cs3-launcher.mjs --profile <cloud|onprem|airgap>` — see the top-level README, Section 4.1.

Copy `.env.example` to `.env` for local dev and fill in your own keys (none are committed).
