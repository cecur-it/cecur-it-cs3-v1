# VyOS edge bootstrap

This folder turns the manual command block in
[`deployment/operations/firewall/vyos-onprem.md`](../../deployment/operations/firewall/vyos-onprem.md)
into a parameterized, idempotent, dry-run-capable script. It does not define a new firewall
policy — the zone model (DMZ / INTERNAL / DATA / MGMT), rule set, and port list are identical to
that document; only the CIDRs/IPs are templated from a vars file.

## Files

- `vyos-vars.example.yml` — the per-site addressing model. Copy to `vyos-vars.yml` and fill in
  your site's values before running the script.
- `bootstrap-vyos-edge.sh` — reads the vars file, resolves the full `set firewall ...` /
  `set zone-policy ...` command list, and either prints it (`--dry-run`) or applies it over SSH
  to the VyOS device, finishing with a single `commit` + `save`.

## Usage

```bash
cp vyos-vars.example.yml vyos-vars.yml
$EDITOR vyos-vars.yml                 # replace every CIDR/IP for your site

./bootstrap-vyos-edge.sh --vars vyos-vars.yml --dry-run   # review the resolved commands first
./bootstrap-vyos-edge.sh --vars vyos-vars.yml             # apply + commit + save
```

The script refuses to run against the unmodified `vyos-vars.example.yml` file, and requires SSH
access to the VyOS host with a user capable of `configure` / `commit` / `save`.

## When this does not apply

If your site's edge/firewall is not VyOS, this folder is not relevant — use the nftables
templates in `deployment/operations/firewall/` instead (profiles for `onprem`, `airgap`, and
cloud security groups via `deployment/terraform/`).

## Air-gap note

For the `airgap` profile, `vyos-onprem.md` already documents removing internet-bound rules and
adding a one-way guard interface/zone; `vyos-vars.yml` does not currently model that interface, so
air-gapped sites should apply this script's output as a starting point and hand-add the guard zone
per `vyos-onprem.md`'s "Air-gap adaptation" section.
