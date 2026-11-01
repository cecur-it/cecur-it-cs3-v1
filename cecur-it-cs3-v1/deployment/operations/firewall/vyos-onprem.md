# VyOS zone-based firewall (on-prem)

The commands below implement the segmented on-prem design from `../networking-architecture.md` on a dedicated VyOS router/firewall.

## Assumptions

- `eth0` = uplink / remote forwarder side feeding the DMZ
- `eth1` = DMZ
- `eth2` = INTERNAL app segment
- `eth3` = DATA segment
- `eth4` = MGMT segment
- Replace the example CIDRs and host IPs before committing.

## Addressing model used in the rules

| Segment | CIDR | Key hosts |
|---|---|---|
| DMZ | `10.20.10.0/24` | reverse proxy `10.20.10.10`, relay `10.20.10.20` |
| INTERNAL | `10.20.20.0/24` | console `10.20.20.10`, Ollama LB `10.20.20.20` |
| DATA | `10.20.30.0/24` | Postgres `10.20.30.10`, OpenSearch `10.20.30.20` |
| MGMT | `10.20.40.0/24` | bastion `10.20.40.10`, Argo CD `10.20.40.20`, DNS/NTP/PKI `10.20.40.53` |
| Forwarders / branch relay source | `10.50.0.0/16` | endpoint and site subnets |
| Admin VPN source | `10.60.0.0/24` | admin workstations |

## VyOS commands

```bash
configure

set firewall group network-group DMZ-NET network '10.20.10.0/24'
set firewall group network-group INTERNAL-NET network '10.20.20.0/24'
set firewall group network-group DATA-NET network '10.20.30.0/24'
set firewall group network-group MGMT-NET network '10.20.40.0/24'
set firewall group network-group FORWARDER-NETS network '10.50.0.0/16'
set firewall group network-group ADMIN-VPN network '10.60.0.0/24'

set firewall group address-group DMZ-PROXIES address '10.20.10.10'
set firewall group address-group DMZ-PROXIES address '10.20.10.20'
set firewall group address-group CS3-CONSOLE address '10.20.20.10'
set firewall group address-group OLLAMA-LB address '10.20.20.20'
set firewall group address-group POSTGRES address '10.20.30.10'
set firewall group address-group OPENSEARCH address '10.20.30.20'
set firewall group address-group BASTION address '10.20.40.10'
set firewall group address-group PKI-SERVICES address '10.20.40.53'

set zone-policy zone DMZ interface 'eth1'
set zone-policy zone INTERNAL interface 'eth2'
set zone-policy zone DATA interface 'eth3'
set zone-policy zone MGMT interface 'eth4'

set firewall name DMZ-TO-INTERNAL default-action 'drop'
set firewall name DMZ-TO-INTERNAL rule 10 action 'accept'
set firewall name DMZ-TO-INTERNAL rule 10 protocol 'tcp'
set firewall name DMZ-TO-INTERNAL rule 10 source group address-group 'DMZ-PROXIES'
set firewall name DMZ-TO-INTERNAL rule 10 destination group address-group 'CS3-CONSOLE'
set firewall name DMZ-TO-INTERNAL rule 10 destination port '3000'
set firewall name DMZ-TO-INTERNAL rule 10 description 'Reverse proxy or relay to console'

set firewall name INTERNAL-TO-DATA default-action 'drop'
set firewall name INTERNAL-TO-DATA rule 10 action 'accept'
set firewall name INTERNAL-TO-DATA rule 10 protocol 'tcp'
set firewall name INTERNAL-TO-DATA rule 10 source group address-group 'CS3-CONSOLE'
set firewall name INTERNAL-TO-DATA rule 10 destination group address-group 'POSTGRES'
set firewall name INTERNAL-TO-DATA rule 10 destination port '5432'
set firewall name INTERNAL-TO-DATA rule 10 description 'Console to Postgres'
set firewall name INTERNAL-TO-DATA rule 20 action 'accept'
set firewall name INTERNAL-TO-DATA rule 20 protocol 'tcp'
set firewall name INTERNAL-TO-DATA rule 20 source group address-group 'CS3-CONSOLE'
set firewall name INTERNAL-TO-DATA rule 20 destination group address-group 'OPENSEARCH'
set firewall name INTERNAL-TO-DATA rule 20 destination port '9200'
set firewall name INTERNAL-TO-DATA rule 20 description 'Console to OpenSearch'

set firewall name INTERNAL-TO-INTERNAL default-action 'drop'
set firewall name INTERNAL-TO-INTERNAL rule 10 action 'accept'
set firewall name INTERNAL-TO-INTERNAL rule 10 protocol 'tcp'
set firewall name INTERNAL-TO-INTERNAL rule 10 source group address-group 'CS3-CONSOLE'
set firewall name INTERNAL-TO-INTERNAL rule 10 destination group address-group 'OLLAMA-LB'
set firewall name INTERNAL-TO-INTERNAL rule 10 destination port '11434'
set firewall name INTERNAL-TO-INTERNAL rule 10 description 'Console to Ollama LB'

set firewall name MGMT-TO-DMZ default-action 'drop'
set firewall name MGMT-TO-DMZ rule 10 action 'accept'
set firewall name MGMT-TO-DMZ rule 10 protocol 'tcp'
set firewall name MGMT-TO-DMZ rule 10 source group network-group 'ADMIN-VPN'
set firewall name MGMT-TO-DMZ rule 10 destination group address-group 'DMZ-PROXIES'
set firewall name MGMT-TO-DMZ rule 10 destination port '443'
set firewall name MGMT-TO-DMZ rule 10 description 'Admin UI/API via reverse proxy'

set firewall name MGMT-TO-INTERNAL default-action 'drop'
set firewall name MGMT-TO-INTERNAL rule 10 action 'accept'
set firewall name MGMT-TO-INTERNAL rule 10 protocol 'tcp'
set firewall name MGMT-TO-INTERNAL rule 10 source group network-group 'ADMIN-VPN'
set firewall name MGMT-TO-INTERNAL rule 10 destination group address-group 'CS3-CONSOLE'
set firewall name MGMT-TO-INTERNAL rule 10 destination port '22,3000'
set firewall name MGMT-TO-INTERNAL rule 10 description 'SSH and direct maintenance to console'

set firewall name MGMT-TO-DATA default-action 'drop'
set firewall name MGMT-TO-DATA rule 10 action 'accept'
set firewall name MGMT-TO-DATA rule 10 protocol 'tcp'
set firewall name MGMT-TO-DATA rule 10 source group network-group 'ADMIN-VPN'
set firewall name MGMT-TO-DATA rule 10 destination group address-group 'POSTGRES'
set firewall name MGMT-TO-DATA rule 10 destination port '5432'
set firewall name MGMT-TO-DATA rule 10 description 'DBA access to Postgres'
set firewall name MGMT-TO-DATA rule 20 action 'accept'
set firewall name MGMT-TO-DATA rule 20 protocol 'tcp'
set firewall name MGMT-TO-DATA rule 20 source group network-group 'ADMIN-VPN'
set firewall name MGMT-TO-DATA rule 20 destination group address-group 'OPENSEARCH'
set firewall name MGMT-TO-DATA rule 20 destination port '9200'
set firewall name MGMT-TO-DATA rule 20 description 'Admin access to OpenSearch'

set firewall name DMZ-LOCAL default-action 'drop'
set firewall name DMZ-LOCAL rule 10 action 'accept'
set firewall name DMZ-LOCAL rule 10 protocol 'tcp'
set firewall name DMZ-LOCAL rule 10 source group network-group 'FORWARDER-NETS'
set firewall name DMZ-LOCAL rule 10 destination port '443'
set firewall name DMZ-LOCAL rule 10 description 'Forwarder traffic to reverse proxy'
set firewall name DMZ-LOCAL rule 20 action 'accept'
set firewall name DMZ-LOCAL rule 20 protocol 'tcp'
set firewall name DMZ-LOCAL rule 20 source group network-group 'ADMIN-VPN'
set firewall name DMZ-LOCAL rule 20 destination port '443'
set firewall name DMZ-LOCAL rule 20 description 'Admin UI to reverse proxy'

set firewall name INTERNAL-LOCAL default-action 'drop'
set firewall name INTERNAL-LOCAL rule 10 action 'accept'
set firewall name INTERNAL-LOCAL rule 10 protocol 'tcp'
set firewall name INTERNAL-LOCAL rule 10 source group address-group 'DMZ-PROXIES'
set firewall name INTERNAL-LOCAL rule 10 destination port '3000'
set firewall name INTERNAL-LOCAL rule 10 description 'Reverse proxy to console service'

set firewall name DATA-LOCAL default-action 'drop'
set firewall name DATA-LOCAL rule 10 action 'accept'
set firewall name DATA-LOCAL rule 10 protocol 'tcp'
set firewall name DATA-LOCAL rule 10 source group address-group 'CS3-CONSOLE'
set firewall name DATA-LOCAL rule 10 destination port '5432'
set firewall name DATA-LOCAL rule 10 description 'Console to Postgres'
set firewall name DATA-LOCAL rule 20 action 'accept'
set firewall name DATA-LOCAL rule 20 protocol 'tcp'
set firewall name DATA-LOCAL rule 20 source group address-group 'CS3-CONSOLE'
set firewall name DATA-LOCAL rule 20 destination port '9200'
set firewall name DATA-LOCAL rule 20 description 'Console to OpenSearch'

set firewall name MGMT-LOCAL default-action 'drop'
set firewall name MGMT-LOCAL rule 10 action 'accept'
set firewall name MGMT-LOCAL rule 10 protocol 'tcp'
set firewall name MGMT-LOCAL rule 10 source group network-group 'ADMIN-VPN'
set firewall name MGMT-LOCAL rule 10 destination port '22,443,6443'
set firewall name MGMT-LOCAL rule 10 description 'Bastion, Argo CD, Kubernetes API'
set firewall name MGMT-LOCAL rule 20 action 'accept'
set firewall name MGMT-LOCAL rule 20 protocol 'udp'
set firewall name MGMT-LOCAL rule 20 source group network-group 'DMZ-NET'
set firewall name MGMT-LOCAL rule 20 destination group address-group 'PKI-SERVICES'
set firewall name MGMT-LOCAL rule 20 destination port '53,123'
set firewall name MGMT-LOCAL rule 20 description 'DNS and NTP from DMZ'

set zone-policy zone DMZ from INTERNAL firewall name 'INTERNAL-TO-INTERNAL'
set zone-policy zone INTERNAL from DMZ firewall name 'DMZ-TO-INTERNAL'
set zone-policy zone DATA from INTERNAL firewall name 'INTERNAL-TO-DATA'
set zone-policy zone DMZ from MGMT firewall name 'MGMT-TO-DMZ'
set zone-policy zone INTERNAL from MGMT firewall name 'MGMT-TO-INTERNAL'
set zone-policy zone DATA from MGMT firewall name 'MGMT-TO-DATA'
set zone-policy zone DMZ local-zone firewall name 'DMZ-LOCAL'
set zone-policy zone INTERNAL local-zone firewall name 'INTERNAL-LOCAL'
set zone-policy zone DATA local-zone firewall name 'DATA-LOCAL'
set zone-policy zone MGMT local-zone firewall name 'MGMT-LOCAL'

commit
save
exit
```

## Verification

```bash
show zone-policy
show firewall name DMZ-TO-INTERNAL
show firewall name INTERNAL-TO-DATA
show log | match firewall
```

## Air-gap adaptation

For the `airgap` profile, keep the same zone design but remove internet-bound rules entirely and add a dedicated interface/zone for the one-way guard. Use `nftables-airgap.nft` as the definitive rule set for that posture.
