# Provider Infrastructure Overhead & Unit Cost Analysis

## Overview

This document specifies the backend cost structure, cloud infrastructure allocation, and optimization strategies for maintaining multi-tenant tenant deployments within the CECUR-IT Unified SOC Console architecture.

---

## Provider Unit Cost Breakdown

| Component | Ingestion / Processing Scale | Provider Unit Cost (Est.) | Optimization Strategy |
| :--- | :--- | :--- | :--- |
| **CS3 Cloud Security Database** | 50M document reads, 10M writes / month | ≈ $20.00 – $45.00 / tenant/mo | Use in-memory worker caches for DHCP lease resolutions; write only normalized incident states to database. |
| **CS3 Cloud Application Service (API Backend)** | 4 vCPU, 8 GB RAM containerized workers | ≈ $35.00 – $70.00 / month | Stateless horizontal scaling with zero minimum instances during low-traffic windows. |
| **AI Fueling: CS3 Agent** | 10M input tokens, 2M output tokens / month | ≈ $2.50 – $7.00 / tenant/mo | Enforce strict JSON output schemas with low temperature (0.2) and prompt context caching. |
| **AI Fueling: CECUR-IT Agent** | Secondary fallback / deep code auditing (2M tokens) | ≈ $1.00 – $2.50 / tenant/mo | Route simple alert summaries to CS3 Agent; reserve CECUR-IT Agent for complex multi-file scripts. |
| **BigQuery / Cold Storage** | 1 TB historical logs / month | ≈ $20.00 – $30.00 / month | Daily partitioning with 90-day automatic transition to Coldline Cloud Storage. |
