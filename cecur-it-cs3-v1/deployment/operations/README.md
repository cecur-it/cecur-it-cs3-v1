# CS3 operations runbooks

This directory contains production operations SOPs for the CS3 / CECUR-IT SOC platform.

## Core operations

- [backup-restore.md](backup-restore.md)
- [postgres-persistence.md](postgres-persistence.md)
- [opensearch-cluster.md](opensearch-cluster.md)
- [ingestion-tuning.md](ingestion-tuning.md)
- [ollama-multinode-scaling.md](ollama-multinode-scaling.md)
- [capacity-planning.md](capacity-planning.md)
- [monitoring.md](monitoring.md)
- [log-retention-archival.md](log-retention-archival.md)
- [model-update-rollback.md](model-update-rollback.md)
- [patching.md](patching.md)
- [scaling.md](scaling.md)
- [ism/cs3-logs-lifecycle.json](ism/cs3-logs-lifecycle.json)

## Networking, security, and compliance

- [networking-architecture.md](networking-architecture.md)
- [firewall/README.md](firewall/README.md)
- [firewall/](firewall/)
- [mtls-certificate-pinning.md](mtls-certificate-pinning.md)
- [compliance-mapping.md](compliance-mapping.md)
- [cloud-native-guide.md](cloud-native-guide.md)

## Fleet and certificate operations

- [agent-fleet-management.md](agent-fleet-management.md)
- [certificate-rotation.md](certificate-rotation.md)

## Testing and resilience

- [testing/README.md](testing/README.md)
- [testing/load-test-scenarios.md](testing/load-test-scenarios.md)
- [testing/chaos-playbook.md](testing/chaos-playbook.md)
- [testing/multi-site-failover.md](testing/multi-site-failover.md)
- [testing/sla-baseline-template.md](testing/sla-baseline-template.md)

## Suggested reading order

1. [capacity-planning.md](capacity-planning.md)
2. [postgres-persistence.md](postgres-persistence.md)
3. [opensearch-cluster.md](opensearch-cluster.md)
4. [backup-restore.md](backup-restore.md)
5. [monitoring.md](monitoring.md)
6. [patching.md](patching.md)
7. [scaling.md](scaling.md)
