# Provider Infrastructure Overhead & Unit Cost Analysis

## Overview

This document specifies the backend cost structure, cloud infrastructure allocation, and optimization strategies for maintaining multi-tenant tenant deployments within the CECUR-IT Unified SOC Console architecture.

---

## Provider Unit Cost Breakdown

| Component | Ingestion / Processing Scale | Provider Unit Cost (Est.) | Optimization Strategy |
| :--- | :--- | :--- | :--- |
| **CS3 Cloud Security Firestore** | 50M document reads, 10M writes / month | ≈ $20.00 – $45.00 / tenant/mo | Use in-memory worker caches for DHCP lease resolutions; write only normalized incident states to Firestore. |
| **CS3 Cloud Application Service (API Backend)** | 4 vCPU, 8 GB RAM containerized workers | ≈ $35.00 – $70.00 / month | Stateless horizontal scaling with zero minimum instances during low-traffic windows. |
| **AI Fueling: CS3 Agent** | 10M input tokens, 2M output tokens / month | ≈ $2.50 – $7.00 / tenant/mo | Enforce strict JSON output schemas with low temperature (0.2) and prompt context caching. |
| **AI Fueling: CECUR-IT Agent** | Secondary fallback / deep code auditing (2M tokens) | ≈ $1.00 – $2.50 / tenant/mo | Route simple alert summaries to CS3 Agent; reserve CECUR-IT Agent for complex multi-file scripts. |
| **BigQuery / Cold Storage** | 1 TB historical logs / month | ≈ $20.00 – $30.00 / month | Daily partitioning with 90-day automatic transition to Coldline Cloud Storage. |

---

## Architectural Cost Optimization Principles

### 1. Firestore Read & Write Mitigation
- **DHCP Lease Resolution**: In-memory LRU cache stores IP-to-Hostname mappings to prevent redundant database queries during packet inspection.
- **Batching & Buffering**: Ingested log streams are aggregated in memory for up to 5 seconds before batch-writing normalized incident documents.

### 2. Container Compute Sizing
- Server instances operate on Cloud Run containerized infrastructure.
- Automatic scaling scales instances to zero during low-traffic periods while maintaining sub-second cold starts.

### 3. AI Token Metering & Gas Fees
- Base rate: **$0.05 per overage transaction** beyond included tier allowances.
- Annual retainers receive a **20% discount** on prepaid AI fuel packs.
- Context Caching reduces input token cost by up to 75% for repeated SOC system prompts and playbook definitions.
