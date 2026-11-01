# 04. Easy Installation & Deployment
## Cross-Platform Deployment Guide for CS3 SOC Console

---

## 1. Quickstart (Under 2 Minutes)

Get the full CS3 Unified SOC Console running locally on any development workstation:

```bash
# 1. Clone repository
git clone https://github.com/DaScient/cecur-it-cs3.git
cd cecur-it-cs3/demo/demo-100226

# 2. Install all dependencies
npm install

# 3. Configure local environment variables
cp .env.example .env

# 4. Start full-stack development server
npm run dev
```
Open **`http://localhost:3000`** in your browser to access the live SOC dashboard.

---

## 2. Deployment Targets

### 2.1. Standalone Docker Container

Run the CS3 console inside an isolated container with full backend and frontend bundling:

#### `Dockerfile`
```dockerfile
# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production Runner
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/server.cjs"]
```

#### Build & Run Commands:
```bash
# Build Docker image
docker build -t cecur-soc-console:latest .

# Run container binding to port 3000
docker run -d \
  --name cs3-soc \
  -p 3000:3000 \
  -e GEMINI_API_KEY="AIzaSy..." \
  -e DEEPSEEK_API_KEY="sk-..." \
  cecur-soc-console:latest
```

---

### 2.2. Kubernetes Helm / Manifest Deployment

Deploy CS3 to an enterprise Kubernetes or OpenShift cluster:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cs3-soc-console
  namespace: cecur-security
  labels:
    app.kubernetes.io/name: cs3-soc-console
spec:
  replicas: 2
  selector:
    matchLabels:
      app: cs3-soc-console
  template:
    metadata:
      labels:
        app: cs3-soc-console
    spec:
      containers:
        - name: console
          image: cecur-soc-console:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: "production"
            - name: GEMINI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: cs3-secrets
                  key: gemini-api-key
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: cs3-soc-service
  namespace: cecur-security
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 3000
  selector:
    app: cs3-soc-console
```

---

### 2.3. Google Cloud Run Deployment

Deploy as a scalable, serverless container on Google Cloud Platform:

```bash
# 1. Build and push image to Artifact Registry
gcloud builds submit --tag gcr.io/your-project-id/cs3-soc-console:v1

# 2. Deploy to Cloud Run (automatically binding port 3000)
gcloud run deploy cs3-soc-console \
  --image gcr.io/your-project-id/cs3-soc-console:v1 \
  --platform managed \
  --region us-west1 \
  --allow-unauthenticated \
  --port 3000 \
  --set-env-vars="NODE_ENV=production" \
  --set-secrets="GEMINI_API_KEY=GEMINI_SECRET:latest"
```

---

## 3. Post-Deployment Verification Checklist

Once the container or service is active, execute these verification checks:

1. **System Health Check**:
   ```bash
   curl -s http://localhost:3000/api/health | jq .
   ```
   *Expected Output*:
   ```json
   {
     "status": "nominal",
     "service": "CECUR-IT Unified SOC Console",
     "sensorsCount": 8,
     "incidentsCount": 8,
     "cecurAgentsCount": 5
   }
   ```

2. **Real-Time Stream Check**:
   ```bash
   curl -N -H "Accept: text/event-stream" http://localhost:3000/api/live/stream
   ```
   *Expected Output*: Initial `CONNECTED` handshake followed by streaming JSON telemetry deltas every 3.5 seconds.

3. **RBAC Token Verification**:
   ```bash
   curl -H "Authorization: Bearer mock-token-analyst-1" http://localhost:3000/api/auth/me | jq .
   ```
