# Certificate rotation procedures

This runbook covers planned rotation, emergency replacement, and CA rollover for CS3 edge, relay, and agent certificates. Pair it with `mtls-certificate-pinning.md`, `deployment/ansible/playbooks/rotate-certs.yml`, and the installer scripts under `deployment/agents/`.

## 1. Scope

Rotate the following on a 90-day cycle unless a shorter policy applies:

- ingress / reverse-proxy server certificate
- relay-to-relay certificates
- agent client certificates
- CA bundle distributed to forwarders and gateways

## 2. Pre-rotation checklist

1. Confirm NTP is healthy across DMZ, app, data, and management segments.
2. Publish the next CA bundle and pin set before switching server certificates.
3. Ensure the next certificate overlaps the current one by at least 7 days.
4. Verify the current edge CRL is published and reachable.
5. Snapshot current gateway config and certificate serial numbers.

## 3. Planned server certificate rotation

### Linux / reverse proxy hosts

```bash
export CS3_FQDN=ingest.cs3.example.mil
mkdir -p /etc/cecur/pki/$CS3_FQDN
openssl req -new -newkey rsa:3072 -nodes \
  -keyout /etc/cecur/pki/$CS3_FQDN/tls.key \
  -out /etc/cecur/pki/$CS3_FQDN/tls.csr \
  -subj "/CN=$CS3_FQDN" \
  -addext "subjectAltName=DNS:$CS3_FQDN,DNS:cs3.example.mil"
```

Submit the CSR to the internal PKI, then install the returned chain:

```bash
install -m 0640 /path/from-ca/tls.crt /etc/cecur/pki/$CS3_FQDN/tls.crt
install -m 0640 /path/from-ca/fullchain.pem /etc/cecur/pki/$CS3_FQDN/fullchain.pem
nginx -t && systemctl reload nginx
# or
haproxy -c -f /etc/haproxy/haproxy.cfg && systemctl reload haproxy
```

### Kubernetes with cert-manager

```bash
kubectl -n cs3 apply -f - <<'EOF'
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: cs3-ingest-tls
spec:
  secretName: cs3-ingest-tls
  duration: 2160h
  renewBefore: 168h
  issuerRef:
    kind: ClusterIssuer
    name: cs3-internal-issuer
  dnsNames:
    - ingest.cs3.example.mil
    - cs3.example.mil
EOF
kubectl -n cs3 wait --for=condition=Ready certificate/cs3-ingest-tls --timeout=5m
kubectl -n cs3 rollout restart deploy/ingress-nginx-controller
```

### Ansible orchestration

```bash
ansible-playbook deployment/ansible/playbooks/rotate-certs.yml -i inventories/prod/hosts.ini
```

Use the playbook when you want to distribute the new certificate, CA bundle, CRL, and service restart sequence across many edge nodes in one controlled change window.

## 4. Planned agent certificate rotation

### Linux forwarders

```bash
export AGENT_ID=cecur-ag-001122334455
export AGENT_HOST=host001.example.mil
mkdir -p /etc/cecur-forwarder/pki
openssl req -new -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes \
  -keyout /etc/cecur-forwarder/pki/agent.key \
  -out /etc/cecur-forwarder/pki/agent.csr \
  -subj "/CN=$AGENT_ID" \
  -addext "subjectAltName=DNS:$AGENT_HOST,URI:spiffe://cs3/agent/$AGENT_ID"
```

After the CA returns the client certificate and chain:

```bash
install -m 0600 /path/from-ca/agent.crt /etc/cecur-forwarder/pki/agent.crt
install -m 0644 /path/from-ca/cs3-console-chain.pem /etc/cecur-forwarder/pki/cs3-console-chain.pem
systemctl restart cecur-forwarder
```

### Windows forwarders

```powershell
$agentId = 'cecur-ag-001122334455'
$dnsName = 'host001.example.mil'
$inf = @"
[Version]
Signature=\"$Windows NT$\"

[NewRequest]
Subject = \"CN=$agentId\"
MachineKeySet = TRUE
KeySpec = 1
KeyLength = 3072
Exportable = FALSE
RequestType = PKCS10
HashAlgorithm = sha256
KeyUsage = 0xa0

[Extensions]
2.5.29.17 = \"{text}dns=$dnsName&url=spiffe://cs3/agent/$agentId\"
2.5.29.37 = \"{text}1.3.6.1.5.5.7.3.2\"
\"@
Set-Content -Path C:\\ProgramData\\CecurIT\\agent.inf -Value $inf -Encoding ASCII
certreq -new C:\\ProgramData\\CecurIT\\agent.inf C:\\ProgramData\\CecurIT\\agent.csr
# Submit C:\\ProgramData\\CecurIT\\agent.csr to the enterprise CA, then:
# certreq -accept C:\\ProgramData\\CecurIT\\agent.cer
Restart-Service CecurForwarder
```

### Fleet-wide script hooks

- Linux/macOS shell installer: `deployment/agents/install-forwarder.sh`
- Windows installer: `deployment/agents/Install-CecurForwarder.ps1`
- Enrollment helper: `deployment/agents/cs3-enroll.mjs`

Use those scripts as the distribution point for CA bundles, pin lists, and renewed client certificates.

## 5. Emergency server certificate replacement

Use this path for key compromise, wrong SANs, failed OCSP/CRL validation, or exposure of the private key material.

1. Remove the old keypair from the edge host.
2. Issue a new keypair and CSR immediately.
3. Install the new certificate and updated CRL/CA bundle.
4. Reload the gateway.
5. Verify with a pinned-health probe from a clean workstation.

```bash
mkdir -p /root/forensics
mv /etc/cecur/pki/ingest.cs3.example.mil/tls.key /root/forensics/ingest.$(date +%Y%m%d%H%M%S).key.compromised
openssl req -new -newkey rsa:3072 -nodes \
  -keyout /etc/cecur/pki/ingest.cs3.example.mil/tls.key \
  -out /etc/cecur/pki/ingest.cs3.example.mil/tls.csr \
  -subj '/CN=ingest.cs3.example.mil' \
  -addext 'subjectAltName=DNS:ingest.cs3.example.mil,DNS:cs3.example.mil'
nginx -t && systemctl reload nginx
```

## 6. Emergency agent or relay replacement

1. Revoke the compromised client certificate in the CA.
2. Publish a new CRL.
3. Reload the edge gateway.
4. Reissue the agent certificate.
5. Rotate any associated API key if compromise included local config theft.

```bash
ansible-playbook deployment/ansible/playbooks/health-remediation.yml -i inventories/prod/hosts.ini --limit compromised-hosts
```

Use `health-remediation.yml` to force a restart, push a cleaned config, or reinstall the forwarder when the certificate problem is tied to filesystem corruption or a broken trust store.

## 7. CA rotation (planned rollover)

A CA rollover is a **bundle-first** operation.

### Sequence

1. Publish `current + next` intermediate certificates in the gateway trust bundle.
2. Distribute the same dual bundle to forwarders.
3. Add the next SPKI pin to the pin set.
4. Begin issuing new server and agent certificates from the next intermediate.
5. Wait until all active certs have moved to the next intermediate.
6. Remove the old intermediate from edge and agent trust bundles.
7. Remove the old SPKI pin.

### Bundle distribution commands

```bash
cat current-intermediate.pem next-intermediate.pem > /etc/cecur-forwarder/pki/cs3-console-chain.pem
systemctl restart cecur-forwarder
kubectl -n cs3 create secret generic cs3-agent-ca --from-file=ca.crt=/etc/cecur-forwarder/pki/cs3-console-chain.pem --dry-run=client -o yaml | kubectl apply -f -
```

## 8. Validation commands

```bash
openssl x509 -in /etc/cecur/pki/ingest.cs3.example.mil/tls.crt -noout -serial -issuer -subject -dates
curl --fail --silent --show-error --cacert /etc/cecur-forwarder/pki/cs3-console-chain.pem https://ingest.cs3.example.mil/api/health
curl --fail --silent --show-error --cacert /etc/cecur-forwarder/pki/cs3-console-chain.pem --pinnedpubkey 'sha256//CURRENTORNEXTPIN' https://ingest.cs3.example.mil/api/health
kubectl -n cs3 get certificate,secret
ansible-playbook deployment/ansible/playbooks/rotate-certs.yml -i inventories/prod/hosts.ini --check
```

## 9. Rollback

Rollback only if the newly issued certificate is invalid and the old keypair is still trusted and uncompromised.

- Restore the previous certificate and key.
- Restore the previous CRL/CA bundle.
- Reload the gateway.
- Remove the not-yet-active next pin if it was added only for the failed rotation.

If the old private key is compromised, **do not roll back**. Continue forward with replacement and revocation.
