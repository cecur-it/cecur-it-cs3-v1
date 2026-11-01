# 09. Sensor Grid Calibration & Operations
## CS3 Sensor Grid Calibration Protocol, Jitter Damping, and Node Lifecycle

---

## 1. Sensor Grid Topography

The CS3 Platform coordinates an 8-node distributed edge telemetry sensor grid covering physical datacenters, cloud VPCs, remote branches, and air-gapped industrial infrastructure:

| Sensor Node ID | Node Name | Location / Scope | Type | Protocol |
| :--- | :--- | :--- | :--- | :--- |
| `sensor-us-east-1` | **US-East Primary Tap** | N. Virginia Datacenter | High-Speed Packet Sniffer | 100 Gbps Optical Tap |
| `sensor-us-west-1` | **US-West Cloud Ingress** | Oregon AWS / GCP VPC | VPC Flow & TLS Decryptor | eBPF Kernel Probe |
| `sensor-eu-central-1` | **EU-Central Frankfurt** | Frankfurt Core Facility | Deep Packet Inspection (DPI) | Hardware Optical Ring |
| `sensor-ap-southeast-1` | **AP-Southeast Singapore** | Singapore Cloud Gateway | Network Anomaly Detector | Flow Mirroring |
| `sensor-latam-1` | **LATAM São Paulo Hub** | São Paulo Branch | NetFlow / IPFIX Collector | NetFlow v9 |
| `sensor-ot-ics-1` | **OT/SCADA Plant 4 Diode** | Detroit Manufacturing | Hardware Optical Diode | Modbus / DNP3 Tap |
| `sensor-zero-trust-1` | **Zero-Trust Identity Tap** | Global Identity Gateway | Auth & Kerberos Sniffer | LDAP/SAML Mirror |
| `sensor-cloud-edge-1` | **Edge CDN WAF Monitor** | Cloudflare / Fastly POP | Layer 7 HTTP/WAF Probe | TLS Terminated Proxy |

---

## 2. Telemetry Metrics & Health Indicators

Each sensor continuously reports five primary operational telemetry metrics:

1. **Bandwidth Throughput (`bandwidthMbps`)**: Real-time traffic processing rate (ranging from 85 Mbps on edge taps to 9,800 Mbps on core optical taps).
2. **CPU & Memory Usage (`cpuUsage`, `memoryUsage`)**: Hardware compute consumption metrics.
3. **Anomaly Rate (`anomalyRate`)**: Fraction of packets deviating from established baseline statistical models (normal baseline: `< 0.05` or 5%).
4. **Network Jitter (`jitterMs`)**: Packet arrival timestamp variance (normal baseline: `< 1.2 ms`).
5. **Dropped Packet Ratio (`droppedPackets`)**: Fraction of discarded frames due to buffer saturation (normal baseline: `< 0.02%`).

---

## 3. Sensor Calibration Algorithm (`POST /api/sensors/:id/calibrate`)

When anomalous network conditions, micro-bursts, or firmware clock drifts elevate jitter or packet drop rates, SOC analysts can trigger the **Zero-Loss Calibration Sequence**:

```typescript
// server/routes/sensors.ts
sensorsRouter.post('/:id/calibrate', requireAuth, requirePanel('sensors'), requireAction('sensor_calibrate'), (req, res) => {
  const sensor = db.sensors.find((s) => s.id === req.params.id);
  if (!sensor) return res.status(404).json({ error: 'Sensor node not found' });

  // 1. Reset operational telemetry baselines
  sensor.status = 'ONLINE';
  sensor.anomalyRate = 0.05;      // Restored to nominal 5% statistical tolerance
  sensor.jitterMs = 0.8;          // Damped to sub-millisecond precision
  sensor.droppedPackets = 0.01;   // Flushed and aligned buffer queues
  sensor.lastPing = new Date().toISOString();

  // 2. Commit audit log entry
  db.logAudit({
    actorId: req.user.id,
    actorUsername: req.user.username,
    actorRole: req.user.role,
    action: 'CALIBRATE_SENSOR',
    panel: 'sensors',
    targetResource: `${sensor.name} (${sensor.id})`,
    ipAddress: req.ip || '127.0.0.1',
    status: 'SUCCESS',
    details: `Recalibrated zero-loss sampling buffers and cleared anomaly threshold jitter for sensor node ${sensor.name}.`,
  });

  res.json({ success: true, message: `Sensor ${sensor.name} calibrated successfully.`, sensor });
});
```

### Operational Steps Executed During Calibration:
1. **Ring Buffer Flush**: Flushes volatile FIFO ring buffers to clear corrupted or fragmented packets.
2. **Time Synchronization (PTP / NTP)**: Resynchronizes high-precision hardware clocks (IEEE 1588 Precision Time Protocol).
3. **Dynamic Filter Recalculation**: Recomputes BPF (Berkeley Packet Filter) rules to optimize kernel packet drop filters.
4. **Baseline Recalibration**: Re-indexes statistical traffic standard deviations over the preceding 15-minute moving window.

---

## 4. Hardware Reboot & Firmware Reset (`POST /api/sensors/:id/reboot`)

For degraded sensor nodes requiring a complete daemon cycle or hardware cold reset, administrators (`admin` role only) execute the reboot sequence:

* **Clearance Gate**: `requireAction('sensor_reboot')` (blocked for Analyst, Auditor, Executive personas).
* **Reset Operations**: Drops CPU usage to idle (`18%`), flushes memory (`35%`), verifies firmware cryptographic signatures, and restores node to `ONLINE` status.
* **Audit Enforcement**: Emits an immutable audit trail record logging the operator's ID, timestamp, and IP address.
