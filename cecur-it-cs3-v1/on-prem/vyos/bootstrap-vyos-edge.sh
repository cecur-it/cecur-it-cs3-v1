#!/usr/bin/env bash
# on-prem/vyos/bootstrap-vyos-edge.sh
#
# Idempotent wrapper that applies the zone-based VyOS firewall policy documented in
# deployment/operations/firewall/vyos-onprem.md, parameterized from a vars file instead
# of requiring hand-edited CIDRs/IPs inline.
#
# Usage:
#   bootstrap-vyos-edge.sh --vars <file.yml> [--dry-run] [--host <vyos-host>] [--user <ssh-user>]
#
# --dry-run prints the fully resolved VyOS "set ..." command list for review; nothing is
# sent to the device. Without --dry-run, the resolved commands are piped over SSH into
# `vbash -c "configure; <commands>; commit; save; exit"` on the target VyOS host.
#
# This script does not invent new firewall policy -- it mechanically substitutes the vars
# file's values into the same rule set published in vyos-onprem.md. Re-read that document
# before first use.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VARS_FILE=""
DRY_RUN="false"
HOST_OVERRIDE=""
USER_OVERRIDE=""

usage() {
  cat <<'EOF'
Usage: bootstrap-vyos-edge.sh --vars <file.yml> [--dry-run] [--host <vyos-host>] [--user <ssh-user>]

Options:
  --vars FILE     Path to a vyos-vars.yml file (see vyos-vars.example.yml). Required.
  --dry-run       Print the resolved VyOS command list instead of applying it.
  --host HOST     Override vyos_host from the vars file.
  --user USER     Override vyos_ssh_user from the vars file.
  -h, --help      Show this help text.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --vars) VARS_FILE="$2"; shift 2 ;;
    --dry-run) DRY_RUN="true"; shift ;;
    --host) HOST_OVERRIDE="$2"; shift 2 ;;
    --user) USER_OVERRIDE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

if [ -z "$VARS_FILE" ]; then
  echo "error: --vars <file.yml> is required" >&2
  usage
  exit 1
fi

if [ ! -f "$VARS_FILE" ]; then
  echo "error: vars file not found: $VARS_FILE" >&2
  exit 1
fi

if [ "$(basename "$VARS_FILE")" = "vyos-vars.example.yml" ]; then
  echo "error: refusing to run against the unmodified example file." >&2
  echo "       cp '$SCRIPT_DIR/vyos-vars.example.yml' '$SCRIPT_DIR/vyos-vars.yml' and edit it first." >&2
  exit 1
fi

# --- Minimal "key: value" YAML reader (no nesting/lists; matches repo's no-new-deps convention) ---
get_var() {
  local key="$1" default="${2:-}"
  local line
  line="$(grep -E "^[[:space:]]*${key}[[:space:]]*:" "$VARS_FILE" | head -n1 || true)"
  if [ -z "$line" ]; then
    if [ -n "$default" ]; then echo "$default"; return 0; fi
    echo "error: required key '$key' missing from $VARS_FILE" >&2
    exit 1
  fi
  line="${line#*:}"
  line="$(echo "$line" | sed -E 's/#.*$//' | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
  echo "$line"
}

VYOS_HOST="${HOST_OVERRIDE:-$(get_var vyos_host)}"
VYOS_USER="${USER_OVERRIDE:-$(get_var vyos_ssh_user admin)}"
IFACE_UPLINK="$(get_var iface_uplink eth0)"
IFACE_DMZ="$(get_var iface_dmz eth1)"
IFACE_INTERNAL="$(get_var iface_internal eth2)"
IFACE_DATA="$(get_var iface_data eth3)"
IFACE_MGMT="$(get_var iface_mgmt eth4)"

DMZ_CIDR="$(get_var dmz_cidr)"
INTERNAL_CIDR="$(get_var internal_cidr)"
DATA_CIDR="$(get_var data_cidr)"
MGMT_CIDR="$(get_var mgmt_cidr)"
FORWARDER_CIDR="$(get_var forwarder_cidr)"
ADMIN_VPN_CIDR="$(get_var admin_vpn_cidr)"

DMZ_PROXY_IP="$(get_var dmz_proxy_ip)"
DMZ_RELAY_IP="$(get_var dmz_relay_ip)"
CONSOLE_IP="$(get_var console_ip)"
OLLAMA_LB_IP="$(get_var ollama_lb_ip)"
POSTGRES_IP="$(get_var postgres_ip)"
OPENSEARCH_IP="$(get_var opensearch_ip)"
BASTION_IP="$(get_var bastion_ip)"
PKI_IP="$(get_var pki_services_ip)"

CONSOLE_PORT="$(get_var console_port 3000)"
POSTGRES_PORT="$(get_var postgres_port 5432)"
OPENSEARCH_PORT="$(get_var opensearch_port 9200)"
OLLAMA_PORT="$(get_var ollama_port 11434)"

# --- Resolved VyOS command list (mirrors deployment/operations/firewall/vyos-onprem.md) ---
read -r -d '' COMMANDS <<VYOSEOF || true
set firewall group network-group DMZ-NET network '${DMZ_CIDR}'
set firewall group network-group INTERNAL-NET network '${INTERNAL_CIDR}'
set firewall group network-group DATA-NET network '${DATA_CIDR}'
set firewall group network-group MGMT-NET network '${MGMT_CIDR}'
set firewall group network-group FORWARDER-NETS network '${FORWARDER_CIDR}'
set firewall group network-group ADMIN-VPN network '${ADMIN_VPN_CIDR}'

set firewall group address-group DMZ-PROXIES address '${DMZ_PROXY_IP}'
set firewall group address-group DMZ-PROXIES address '${DMZ_RELAY_IP}'
set firewall group address-group CS3-CONSOLE address '${CONSOLE_IP}'
set firewall group address-group OLLAMA-LB address '${OLLAMA_LB_IP}'
set firewall group address-group POSTGRES address '${POSTGRES_IP}'
set firewall group address-group OPENSEARCH address '${OPENSEARCH_IP}'
set firewall group address-group BASTION address '${BASTION_IP}'
set firewall group address-group PKI-SERVICES address '${PKI_IP}'

set firewall zone DMZ interface '${IFACE_DMZ}'
set firewall zone INTERNAL interface '${IFACE_INTERNAL}'
set firewall zone DATA interface '${IFACE_DATA}'
set firewall zone MGMT interface '${IFACE_MGMT}'
set firewall zone LOCAL from-interface '${IFACE_UPLINK}'

set firewall ipv4 name DMZ-TO-INTERNAL default-action 'drop'
set firewall ipv4 name DMZ-TO-INTERNAL rule 10 action 'accept'
set firewall ipv4 name DMZ-TO-INTERNAL rule 10 protocol 'tcp'
set firewall ipv4 name DMZ-TO-INTERNAL rule 10 source group address-group 'DMZ-PROXIES'
set firewall ipv4 name DMZ-TO-INTERNAL rule 10 destination group address-group 'CS3-CONSOLE'
set firewall ipv4 name DMZ-TO-INTERNAL rule 10 destination port '${CONSOLE_PORT}'
set firewall ipv4 name DMZ-TO-INTERNAL rule 10 description 'Reverse proxy or relay to console'
set firewall ipv4 name DMZ-TO-INTERNAL rule 100 action 'accept'
set firewall ipv4 name DMZ-TO-INTERNAL rule 100 state 'established,related'
set firewall ipv4 name DMZ-TO-INTERNAL rule 100 description 'Established/related reply from INTERNAL'

set firewall ipv4 name INTERNAL-TO-DMZ default-action 'drop'
set firewall ipv4 name INTERNAL-TO-DMZ rule 100 action 'accept'
set firewall ipv4 name INTERNAL-TO-DMZ rule 100 state 'established,related'
set firewall ipv4 name INTERNAL-TO-DMZ rule 100 description 'Established/related reply to DMZ'

set firewall ipv4 name INTERNAL-TO-DATA default-action 'drop'
set firewall ipv4 name INTERNAL-TO-DATA rule 10 action 'accept'
set firewall ipv4 name INTERNAL-TO-DATA rule 10 protocol 'tcp'
set firewall ipv4 name INTERNAL-TO-DATA rule 10 source group address-group 'CS3-CONSOLE'
set firewall ipv4 name INTERNAL-TO-DATA rule 10 destination group address-group 'POSTGRES'
set firewall ipv4 name INTERNAL-TO-DATA rule 10 destination port '${POSTGRES_PORT}'
set firewall ipv4 name INTERNAL-TO-DATA rule 10 description 'Console to Postgres'
set firewall ipv4 name INTERNAL-TO-DATA rule 20 action 'accept'
set firewall ipv4 name INTERNAL-TO-DATA rule 20 protocol 'tcp'
set firewall ipv4 name INTERNAL-TO-DATA rule 20 source group address-group 'CS3-CONSOLE'
set firewall ipv4 name INTERNAL-TO-DATA rule 20 destination group address-group 'OPENSEARCH'
set firewall ipv4 name INTERNAL-TO-DATA rule 20 destination port '${OPENSEARCH_PORT}'
set firewall ipv4 name INTERNAL-TO-DATA rule 20 description 'Console to OpenSearch'
set firewall ipv4 name INTERNAL-TO-DATA rule 100 action 'accept'
set firewall ipv4 name INTERNAL-TO-DATA rule 100 state 'established,related'
set firewall ipv4 name INTERNAL-TO-DATA rule 100 description 'Established/related reply from DATA'

set firewall ipv4 name DATA-TO-INTERNAL default-action 'drop'
set firewall ipv4 name DATA-TO-INTERNAL rule 100 action 'accept'
set firewall ipv4 name DATA-TO-INTERNAL rule 100 state 'established,related'
set firewall ipv4 name DATA-TO-INTERNAL rule 100 description 'Established/related reply to INTERNAL'

set firewall ipv4 name INTERNAL-TO-INTERNAL default-action 'drop'
set firewall ipv4 name INTERNAL-TO-INTERNAL rule 10 action 'accept'
set firewall ipv4 name INTERNAL-TO-INTERNAL rule 10 protocol 'tcp'
set firewall ipv4 name INTERNAL-TO-INTERNAL rule 10 source group address-group 'CS3-CONSOLE'
set firewall ipv4 name INTERNAL-TO-INTERNAL rule 10 destination group address-group 'OLLAMA-LB'
set firewall ipv4 name INTERNAL-TO-INTERNAL rule 10 destination port '${OLLAMA_PORT}'
set firewall ipv4 name INTERNAL-TO-INTERNAL rule 10 description 'Console to Ollama LB'
set firewall ipv4 name INTERNAL-TO-INTERNAL rule 100 action 'accept'
set firewall ipv4 name INTERNAL-TO-INTERNAL rule 100 state 'established,related'
set firewall ipv4 name INTERNAL-TO-INTERNAL rule 100 description 'Established/related reply within INTERNAL'

set firewall ipv4 name MGMT-TO-DMZ default-action 'drop'
set firewall ipv4 name MGMT-TO-DMZ rule 10 action 'accept'
set firewall ipv4 name MGMT-TO-DMZ rule 10 protocol 'tcp'
set firewall ipv4 name MGMT-TO-DMZ rule 10 source group network-group 'ADMIN-VPN'
set firewall ipv4 name MGMT-TO-DMZ rule 10 destination group address-group 'DMZ-PROXIES'
set firewall ipv4 name MGMT-TO-DMZ rule 10 destination port '443'
set firewall ipv4 name MGMT-TO-DMZ rule 10 description 'Admin UI/API via reverse proxy'
set firewall ipv4 name MGMT-TO-DMZ rule 100 action 'accept'
set firewall ipv4 name MGMT-TO-DMZ rule 100 state 'established,related'
set firewall ipv4 name MGMT-TO-DMZ rule 100 description 'Established/related reply from DMZ'

set firewall ipv4 name DMZ-TO-MGMT default-action 'drop'
set firewall ipv4 name DMZ-TO-MGMT rule 100 action 'accept'
set firewall ipv4 name DMZ-TO-MGMT rule 100 state 'established,related'
set firewall ipv4 name DMZ-TO-MGMT rule 100 description 'Established/related reply to MGMT'

set firewall ipv4 name MGMT-TO-INTERNAL default-action 'drop'
set firewall ipv4 name MGMT-TO-INTERNAL rule 10 action 'accept'
set firewall ipv4 name MGMT-TO-INTERNAL rule 10 protocol 'tcp'
set firewall ipv4 name MGMT-TO-INTERNAL rule 10 source group network-group 'ADMIN-VPN'
set firewall ipv4 name MGMT-TO-INTERNAL rule 10 destination group address-group 'CS3-CONSOLE'
set firewall ipv4 name MGMT-TO-INTERNAL rule 10 destination port '22,${CONSOLE_PORT}'
set firewall ipv4 name MGMT-TO-INTERNAL rule 10 description 'SSH and direct maintenance to console'
set firewall ipv4 name MGMT-TO-INTERNAL rule 100 action 'accept'
set firewall ipv4 name MGMT-TO-INTERNAL rule 100 state 'established,related'
set firewall ipv4 name MGMT-TO-INTERNAL rule 100 description 'Established/related reply from INTERNAL'

set firewall ipv4 name INTERNAL-TO-MGMT default-action 'drop'
set firewall ipv4 name INTERNAL-TO-MGMT rule 100 action 'accept'
set firewall ipv4 name INTERNAL-TO-MGMT rule 100 state 'established,related'
set firewall ipv4 name INTERNAL-TO-MGMT rule 100 description 'Established/related reply to MGMT'

set firewall ipv4 name MGMT-TO-DATA default-action 'drop'
set firewall ipv4 name MGMT-TO-DATA rule 10 action 'accept'
set firewall ipv4 name MGMT-TO-DATA rule 10 protocol 'tcp'
set firewall ipv4 name MGMT-TO-DATA rule 10 source group network-group 'ADMIN-VPN'
set firewall ipv4 name MGMT-TO-DATA rule 10 destination group address-group 'POSTGRES'
set firewall ipv4 name MGMT-TO-DATA rule 10 destination port '${POSTGRES_PORT}'
set firewall ipv4 name MGMT-TO-DATA rule 10 description 'DBA access to Postgres'
set firewall ipv4 name MGMT-TO-DATA rule 20 action 'accept'
set firewall ipv4 name MGMT-TO-DATA rule 20 protocol 'tcp'
set firewall ipv4 name MGMT-TO-DATA rule 20 source group network-group 'ADMIN-VPN'
set firewall ipv4 name MGMT-TO-DATA rule 20 destination group address-group 'OPENSEARCH'
set firewall ipv4 name MGMT-TO-DATA rule 20 destination port '${OPENSEARCH_PORT}'
set firewall ipv4 name MGMT-TO-DATA rule 20 description 'Admin access to OpenSearch'
set firewall ipv4 name MGMT-TO-DATA rule 100 action 'accept'
set firewall ipv4 name MGMT-TO-DATA rule 100 state 'established,related'
set firewall ipv4 name MGMT-TO-DATA rule 100 description 'Established/related reply from DATA'

set firewall ipv4 name DATA-TO-MGMT default-action 'drop'
set firewall ipv4 name DATA-TO-MGMT rule 100 action 'accept'
set firewall ipv4 name DATA-TO-MGMT rule 100 state 'established,related'
set firewall ipv4 name DATA-TO-MGMT rule 100 description 'Established/related reply to MGMT'

set firewall ipv4 name DMZ-LOCAL default-action 'drop'
set firewall ipv4 name DMZ-LOCAL rule 10 action 'accept'
set firewall ipv4 name DMZ-LOCAL rule 10 protocol 'tcp'
set firewall ipv4 name DMZ-LOCAL rule 10 source group network-group 'FORWARDER-NETS'
set firewall ipv4 name DMZ-LOCAL rule 10 destination port '443'
set firewall ipv4 name DMZ-LOCAL rule 10 description 'Forwarder traffic to reverse proxy'
set firewall ipv4 name DMZ-LOCAL rule 20 action 'accept'
set firewall ipv4 name DMZ-LOCAL rule 20 protocol 'tcp'
set firewall ipv4 name DMZ-LOCAL rule 20 source group network-group 'ADMIN-VPN'
set firewall ipv4 name DMZ-LOCAL rule 20 destination port '443'
set firewall ipv4 name DMZ-LOCAL rule 20 description 'Admin UI to reverse proxy'

set firewall ipv4 name INTERNAL-LOCAL default-action 'drop'
set firewall ipv4 name INTERNAL-LOCAL rule 10 action 'accept'
set firewall ipv4 name INTERNAL-LOCAL rule 10 protocol 'tcp'
set firewall ipv4 name INTERNAL-LOCAL rule 10 source group address-group 'DMZ-PROXIES'
set firewall ipv4 name INTERNAL-LOCAL rule 10 destination port '${CONSOLE_PORT}'
set firewall ipv4 name INTERNAL-LOCAL rule 10 description 'Reverse proxy to console service'

set firewall ipv4 name DATA-LOCAL default-action 'drop'
set firewall ipv4 name DATA-LOCAL rule 10 action 'accept'
set firewall ipv4 name DATA-LOCAL rule 10 protocol 'tcp'
set firewall ipv4 name DATA-LOCAL rule 10 source group address-group 'CS3-CONSOLE'
set firewall ipv4 name DATA-LOCAL rule 10 destination port '${POSTGRES_PORT}'
set firewall ipv4 name DATA-LOCAL rule 10 description 'Console to Postgres'
set firewall ipv4 name DATA-LOCAL rule 20 action 'accept'
set firewall ipv4 name DATA-LOCAL rule 20 protocol 'tcp'
set firewall ipv4 name DATA-LOCAL rule 20 source group address-group 'CS3-CONSOLE'
set firewall ipv4 name DATA-LOCAL rule 20 destination port '${OPENSEARCH_PORT}'
set firewall ipv4 name DATA-LOCAL rule 20 description 'Console to OpenSearch'

set firewall ipv4 name MGMT-LOCAL default-action 'drop'
set firewall ipv4 name MGMT-LOCAL rule 10 action 'accept'
set firewall ipv4 name MGMT-LOCAL rule 10 protocol 'tcp'
set firewall ipv4 name MGMT-LOCAL rule 10 source group network-group 'ADMIN-VPN'
set firewall ipv4 name MGMT-LOCAL rule 10 destination port '22,443,6443'
set firewall ipv4 name MGMT-LOCAL rule 10 description 'Bastion, Argo CD, Kubernetes API'
set firewall ipv4 name MGMT-LOCAL rule 20 action 'accept'
set firewall ipv4 name MGMT-LOCAL rule 20 protocol 'udp'
set firewall ipv4 name MGMT-LOCAL rule 20 source group network-group 'DMZ-NET'
set firewall ipv4 name MGMT-LOCAL rule 20 destination group address-group 'PKI-SERVICES'
set firewall ipv4 name MGMT-LOCAL rule 20 destination port '53,123'
set firewall ipv4 name MGMT-LOCAL rule 20 description 'DNS and NTP from DMZ'

set firewall zone DMZ from INTERNAL firewall name 'DMZ-TO-INTERNAL'
set firewall zone INTERNAL from DMZ firewall name 'INTERNAL-TO-DMZ'
set firewall zone DATA from INTERNAL firewall name 'DATA-TO-INTERNAL'
set firewall zone INTERNAL from DATA firewall name 'INTERNAL-TO-DATA'
set firewall zone DMZ from MGMT firewall name 'MGMT-TO-DMZ'
set firewall zone MGMT from DMZ firewall name 'DMZ-TO-MGMT'
set firewall zone INTERNAL from MGMT firewall name 'MGMT-TO-INTERNAL'
set firewall zone MGMT from INTERNAL firewall name 'INTERNAL-TO-MGMT'
set firewall zone DATA from MGMT firewall name 'MGMT-TO-DATA'
set firewall zone MGMT from DATA firewall name 'DATA-TO-MGMT'
set firewall zone LOCAL from DMZ firewall name 'DMZ-LOCAL'
set firewall zone LOCAL from INTERNAL firewall name 'INTERNAL-LOCAL'
set firewall zone LOCAL from DATA firewall name 'DATA-LOCAL'
set firewall zone LOCAL from MGMT firewall name 'MGMT-LOCAL'
VYOSEOF

if [ "$DRY_RUN" = "true" ]; then
  echo "# --- dry-run: resolved VyOS commands (uplink iface: ${IFACE_UPLINK}) ---"
  echo "# target: ${VYOS_USER}@${VYOS_HOST}"
  echo "$COMMANDS"
  echo "# --- end dry-run: no changes applied, no SSH connection made ---"
  exit 0
fi

echo "Applying VyOS firewall policy to ${VYOS_USER}@${VYOS_HOST} ..."
# Use a non-interactive configuration session that exits on error.
# SSH command failures propagate because vbash stops on config errors.
# shellcheck disable=SC2087 # COMMANDS must expand locally before being sent to SSH.
if ! ssh "${VYOS_USER}@${VYOS_HOST}" <<SSHEOF
set terminal length 0
configure
${COMMANDS}
commit || exit 1
save || exit 1
exit
SSHEOF
then
  echo "error: remote configuration failed" >&2
  exit 1
fi
echo "Done. Verify with: show firewall zone ; show firewall ipv4 name DMZ-TO-INTERNAL"
