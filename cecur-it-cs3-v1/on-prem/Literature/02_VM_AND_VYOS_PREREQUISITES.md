# 02. VM & VyOS Prerequisites

## 1. VM sizing

Reuse the root README's hardware tables — they already cover both the console host and the model
host:

- **Console / API host sizing**: see root [`README.md` §3](../../README.md#3-hardware--prerequisite-sizing)
  and §3.1 for OS, disk, and network baselines. For an on-prem fleet of 1,000+ endpoints, plan for
  the console, Postgres, and OpenSearch indexer as separate hosts/VMs (or at minimum separate disks)
  — see §6.4.3 "Scaling & Performance" and `deployment/operations/capacity-planning.md`.
- **Model host sizing** (only relevant if local LLM inference is part of this on-prem deployment):
  the Gemma-4 / Nemotron-3-Nano VRAM/RAM table in root `README.md` §3 applies unchanged; on-prem
  deployments almost always pick Path B (local Ollama) since hosted-model keys are rejected by
  `bin/preflight-check.sh`.
- **Indexer host**: `deployment/operations/opensearch-cluster.md` has cluster-sizing guidance for the
  OpenSearch/Wazuh Indexer that the durability fix in `server-extensions/` writes to.

## 2. Network segmentation reference

The full segmentation design (DMZ, internal, data, management planes; cross-domain transfer) is
authored once, in [`deployment/operations/networking-architecture.md`](../../deployment/operations/networking-architecture.md).
`on-prem/` does not re-derive this design — it only adds a script that *applies* it to a VyOS edge
device.

## 3. VyOS as the on-prem edge/firewall

VyOS is already a first-class target in this repository, not something this plan invents:
[`deployment/operations/firewall/vyos-onprem.md`](../../deployment/operations/firewall/vyos-onprem.md)
contains a complete zone-based VyOS firewall configuration (DMZ / internal / data / mgmt zones) with
concrete `set firewall ...` commands, aligned with `networking-architecture.md`.

What this directory adds on top of that reference document:

- **`vyos/bootstrap-vyos-edge.sh`** — parameterizes the manual command block from `vyos-onprem.md`
  into a vars file (`vyos/vyos-vars.example.yml`) so an operator never hand-edits CIDRs/IPs inline.
  It supports `--dry-run` (prints the resolved `set ...` command list for review) and is idempotent
  (safe to re-run; VyOS `set` commands are naturally idempotent, and the script only `commit`/`save`s
  once at the end).
- **`vyos/vyos-vars.example.yml`** — the per-site addressing model: DMZ/internal/data/mgmt CIDRs, the
  console/API host IP, the OpenSearch indexer host IP, the admin/management source ranges allowed to
  reach VyOS's own mgmt plane, and the forwarder subnet(s) allowed to reach the ingest port.

### Prerequisites before running `bootstrap-vyos-edge.sh`

1. VyOS 1.4+ (or your organization's supported LTS rolling release) already installed and reachable
   over SSH from the host running this script, with an account capable of `configure`/`commit`/`save`.
2. A completed `vyos-vars.yml` (copy from `vyos-vars.example.yml`) with every placeholder CIDR/IP
   replaced for your site. The script refuses to run against the unmodified example file.
3. A maintenance window — the script performs a single `commit` + `save` at the end of its run; while
   individual `set` commands are safe to re-apply, the final commit does briefly reload the firewall
   ruleset.
4. Read `deployment/operations/firewall/vyos-onprem.md` once in full before first use, so the
   zone model (DMZ/internal/data/mgmt) is understood before it is automated.

## 4. Non-VyOS edges

If your site's edge/firewall is not VyOS, use the nftables templates instead:
`deployment/operations/firewall/` (profiles for `onprem`, `airgap`, and cloud security groups via
`deployment/terraform/`). `on-prem/vyos/` is specific to VyOS; it does not apply to other platforms.
