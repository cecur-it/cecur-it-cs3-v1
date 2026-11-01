# mTLS and certificate pinning for agent-to-console traffic

This guide hardens the CS3 fleet path used by:

- `POST /api/fleet/enroll/claim` (bootstrap claim)
- `POST /api/cecur/logs/ingest` (steady-state log ingestion)
- `GET /api/health` and `GET /api/events` when these endpoints are exposed through the same reverse proxy

It complements, but does not replace, the application-layer controls already present in `demo/demo-100226/server/fleet/enrollment.ts`:

- single-use enrollment tokens
- default token TTL of 24 hours
- maximum token TTL of 168 hours
- maximum bulk batch of 1,000 agents unless `CS3_ENROLL_MAX_BATCH` overrides it
- per-IP failure throttle on the claim endpoint (`20` failed claims per minute)
- `X-API-Key` support for ingestion, including per-agent keys minted at claim time

## 1. PKI hierarchy

Use a three-tier private PKI:

```text
Offline root CA
└── Online issuing intermediate CA
    ├── Console / ingress issuing profile (serverAuth)
    └── Agent issuing profile (clientAuth)
```

### Required roles

| CA tier | Connectivity | Purpose | Storage requirement |
|---|---|---|---|
| Offline root | Offline only | Sign or cross-sign the online intermediate; no direct issuance to workloads | HSM or encrypted offline media in dual-control custody |
| Online intermediate | Internal management segment only | Signs server and agent certs, publishes CRL/OCSP | HSM-backed or TPM-backed key on a hardened CA host |
| Agent issuing profile | Internal management segment only | Short-lived client certs for forwarders and relays | Same intermediate, separate template/profile and audit trail |

## 2. Certificate profiles

| Certificate | Subject / SAN | EKU | Validity | Key usage | Notes |
|---|---|---|---|---|---|
| Console ingress | `CN=ingest.cs3.example.mil`; SAN DNS:`ingest.cs3.example.mil`, DNS:`cs3.example.mil` | `serverAuth` | 90 days | `digitalSignature,keyEncipherment` | Terminate at NGINX, HAProxy, or ingress controller. |
| Enrollment endpoint | `CN=enroll.cs3.example.mil`; SAN DNS:`enroll.cs3.example.mil` | `serverAuth` | 90 days | `digitalSignature,keyEncipherment` | Keep separate from general UI if you want looser bootstrap policy. |
| Agent / forwarder | `CN=cecur-ag-<id>`; SAN URI:`spiffe://cs3/agent/<id>`, DNS:`<hostname>` | `clientAuth` | **90 days** | `digitalSignature` | Use the CS3 `agentId` inside CN or URI SAN. |
| Site relay | `CN=relay-<site>`; SAN DNS:`relay-<site>.example.mil` | `clientAuth,serverAuth` | 90 days | `digitalSignature,keyEncipherment` | Needed only when relays mutually authenticate with each other. |

### Policy requirements

- RSA 3072 or ECDSA P-256/P-384.
- SHA-256 or stronger.
- Do not reuse the same keypair across agents.
- CRL publish interval: 15 minutes or less in connected environments; at each approved sync window in `airgap`.
- Clock skew budget: less than 60 seconds.

## 3. Bootstrap model: enrollment token first, certificate second

The CS3 application itself issues enrollment tokens and per-agent ingest keys; it does **not** natively act as a CA. In a production deployment, pair the existing API with your internal PKI workflow.

### Recommended sequence

1. Admin bulk-enrolls agents through `POST /api/fleet/enroll/bulk`.
2. Each row returns `agentId` and a single-use `enrollmentToken`.
3. The forwarder installer generates a private key and CSR locally.
4. The installer redeems the enrollment token with `POST /api/fleet/enroll/claim`.
5. The claim response returns the per-agent `ingestKey` and confirms the `agentId`.
6. The installer then submits the CSR to the internal RA/CA workflow authorized for that `agentId`.
7. The forwarder stores:
   - client keypair
   - client certificate
   - CA bundle / intermediate
   - per-agent ingest key
8. Steady-state ingestion uses **both** mTLS and `X-API-Key`.

### Why both mTLS and API keys?

- mTLS proves possession of a valid device credential.
- `X-API-Key` maps directly to the enrolled agent and is already supported by `requireIngestKey()` in the CS3 server.
- If one control is bypassed, the other still blocks anonymous ingestion.

## 4. NGINX example

Use `ssl_verify_client optional` at the server level so bootstrap paths can succeed without a client certificate, then enforce `SUCCESS` in the steady-state ingestion path.

```nginx
server {
  listen 443 ssl http2;
  server_name ingest.cs3.example.mil enroll.cs3.example.mil;

  ssl_certificate           /etc/pki/tls/certs/cs3-ingest-fullchain.pem;
  ssl_certificate_key       /etc/pki/tls/private/cs3-ingest.key;
  ssl_client_certificate    /etc/pki/ca-trust/source/anchors/cs3-agent-intermediate.pem;
  ssl_trusted_certificate   /etc/pki/ca-trust/source/anchors/cs3-agent-chain.pem;
  ssl_crl                   /etc/pki/crl/cs3-agent.crl;
  ssl_verify_client         optional;
  ssl_verify_depth          2;
  ssl_protocols             TLSv1.2 TLSv1.3;
  ssl_session_cache         shared:CS3TLS:50m;
  ssl_session_timeout       10m;

  location = /api/fleet/enroll/claim {
    proxy_set_header Host                 $host;
    proxy_set_header X-Forwarded-Proto    https;
    proxy_set_header X-Forwarded-For      $proxy_add_x_forwarded_for;
    proxy_set_header X-SSL-Client-Verify  $ssl_client_verify;
    proxy_set_header X-SSL-Client-DN      $ssl_client_s_dn;
    proxy_set_header X-SSL-Client-Issuer  $ssl_client_i_dn;
    proxy_pass http://cs3_console:3000;
  }

  location = /api/cecur/logs/ingest {
    if ($ssl_client_verify != SUCCESS) { return 495; }
    proxy_set_header Host                 $host;
    proxy_set_header X-Forwarded-Proto    https;
    proxy_set_header X-Forwarded-For      $proxy_add_x_forwarded_for;
    proxy_set_header X-SSL-Client-Verify  $ssl_client_verify;
    proxy_set_header X-SSL-Client-DN      $ssl_client_s_dn;
    proxy_set_header X-SSL-Client-Issuer  $ssl_client_i_dn;
    proxy_set_header X-SSL-Client-Cert    $ssl_client_escaped_cert;
    proxy_pass http://cs3_console:3000;
  }

  location / {
    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_pass http://cs3_console:3000;
  }
}
```

### Revocation notes

- `ssl_crl` is the minimum revocation control and is broadly deployable.
- If your chosen gateway supports client-certificate OCSP validation, enable it there; otherwise, do not claim OCSP enforcement that the gateway cannot actually perform.
- Refresh CRLs on the edge before revoking the previous CRL object.

## 5. HAProxy example

```haproxy
frontend cs3_ingest
  bind :443 ssl crt /etc/haproxy/tls/cs3-ingest.pem ca-file /etc/haproxy/tls/cs3-agent-intermediate.pem crl-file /etc/haproxy/tls/cs3-agent.crl verify optional
  http-request set-header X-SSL-Client-Verify %[ssl_c_verify]
  http-request set-header X-SSL-Client-DN %{+Q}[ssl_c_s_dn]
  http-request set-header X-SSL-Client-Issuer %{+Q}[ssl_c_i_dn]
  acl ingest_path path -i /api/cecur/logs/ingest
  acl client_ok ssl_c_verify 0
  http-request deny status 495 if ingest_path !client_ok
  default_backend cs3_console

backend cs3_console
  server console1 10.20.20.10:3000 check
```

## 6. Kubernetes ingress example

For NGINX Ingress Controller:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: cs3-ingest
  namespace: cs3
  annotations:
    nginx.ingress.kubernetes.io/auth-tls-secret: cs3/cs3-agent-ca
    nginx.ingress.kubernetes.io/auth-tls-verify-client: "optional"
    nginx.ingress.kubernetes.io/auth-tls-verify-depth: "2"
    nginx.ingress.kubernetes.io/auth-tls-pass-certificate-to-upstream: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: 32m
spec:
  ingressClassName: nginx
  tls:
    - hosts: ["ingest.cs3.example.mil"]
      secretName: cs3-ingest-tls
  rules:
    - host: ingest.cs3.example.mil
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: cs3-console
                port:
                  number: 3000
```

Use an ingress snippet or separate ingress object to deny `/api/cecur/logs/ingest` unless the controller reports successful client-certificate verification.

## 7. Forwarder trust and pinning

Fluent Bit should trust only the CS3 issuing chain used by the edge endpoint.

```ini
[OUTPUT]
    Name          http
    Match         *
    Host          ingest.cs3.example.mil
    Port          443
    URI           /api/cecur/logs/ingest
    Format        json
    tls           On
    tls.verify    On
    tls.ca_file   /etc/cecur-forwarder/pki/cs3-console-chain.pem
    Header        X-API-Key ${CS3_INGEST_KEY}
```

### Compute an SPKI pin

The command below prints a `sha256//...` value suitable for a pin list.

```bash
openssl x509 -in /etc/cecur-forwarder/pki/cs3-console-intermediate.pem -pubkey -noout \
  | openssl pkey -pubin -outform DER \
  | openssl dgst -sha256 -binary \
  | openssl enc -base64 -A \
  | sed 's#^#sha256//#'
```

### Verify the console endpoint with a pin

`curl --pinnedpubkey` validates the public key presented by the peer certificate. In practice, that usually means the ingress leaf certificate. Keep the leaf key stable for the overlap window, or check both the CA bundle and the leaf pin.

```bash
curl --fail --silent --show-error \
  --cacert /etc/cecur-forwarder/pki/cs3-console-chain.pem \
  --pinnedpubkey 'sha256//BASE64SPKIHASH' \
  https://ingest.cs3.example.mil/api/health
```

### Overlapping pin rotation

Keep a current pin and a next pin during certificate rotation.

```bash
cat >/etc/cecur-forwarder/pins.txt <<'EOF'
sha256//CURRENTBASE64PIN
sha256//NEXTBASE64PIN
EOF

while read -r pin; do
  if curl --fail --silent --show-error --cacert /etc/cecur-forwarder/pki/cs3-console-chain.pem \
      --pinnedpubkey "$pin" https://ingest.cs3.example.mil/api/health >/dev/null; then
    echo "pin OK: $pin"
    exit 0
  fi
done </etc/cecur-forwarder/pins.txt

echo "no valid pin matched"
exit 1
```

## 8. Revocation workflow

### Planned revocation

- Publish the new CRL.
- Reload NGINX/HAProxy/ingress.
- Restart forwarders only if they must pick up a new CA bundle.

### Emergency revocation

1. Revoke the agent or relay certificate in the CA.
2. Publish CRL immediately.
3. Reload the edge gateway.
4. Remove the node from any allow-list or site relay ACL.
5. If the shared `SOC_INGESTION_SECRET` was used, rotate it; if per-agent keys were used, revoke that key in the enrollment store or edge policy.

## 9. Operational checks

- `openssl verify -CAfile /etc/cecur-forwarder/pki/cs3-console-chain.pem /etc/cecur-forwarder/pki/agent.crt`
- `curl --cert agent.crt --key agent.key --cacert cs3-console-chain.pem -H 'X-API-Key: …' https://ingest.cs3.example.mil/api/health`
- `journalctl -u cecur-forwarder --since -15m | grep -E 'certificate|x509|pinnedpubkey|401|495'`
- Confirm the gateway passes `X-SSL-Client-*` headers only after a validated TLS handshake.
