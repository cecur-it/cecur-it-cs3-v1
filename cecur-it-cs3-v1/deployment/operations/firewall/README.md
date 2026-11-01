# Firewall templates

These files implement the network policy described in `../networking-architecture.md`.

## Which file to use

| Profile | Primary artifact | When to use it |
|---|---|---|
| `cloud` | `nftables-cloud-host.nft` + `cloud-security-groups.md` | Single VM / container host hardening and cloud network policy design. Prefer cloud-native controls first, then host nftables for defense in depth. |
| `onprem` | `nftables-onprem.nft` or `vyos-onprem.md` | Multi-segment on-prem deployment with a DMZ, internal app segment, data segment, and management segment. Use `vyos-onprem.md` when enforcing policy on a dedicated VyOS edge/router. |
| `airgap` | `nftables-airgap.nft` | Fully disconnected enclave. Same segmentation as on-prem plus a one-way-guard interface for controlled import/export. |

## Before enabling a template

1. Replace the interface names and addresses at the top of the file.
2. Load the rules in a maintenance window.
3. Validate syntax first:

```bash
nft -c -f deployment/operations/firewall/nftables-onprem.nft
nft -c -f deployment/operations/firewall/nftables-airgap.nft
nft -c -f deployment/operations/firewall/nftables-cloud-host.nft
```

4. Then load the chosen profile:

```bash
sudo nft -f deployment/operations/firewall/nftables-onprem.nft
```

## Policy intent

- Expose only `443/TCP` to analysts and forwarders.
- Keep `3000/TCP`, `5432/TCP`, `9200/TCP`, and `11434/TCP` east-west only.
- Allow SSH only from the management network or bastion.
- In `airgap`, deny routine internet egress and use the one-way guard for artifact import/export.
- Pair these templates with mTLS guidance in `../mtls-certificate-pinning.md`.
