# Cloud security groups / NSGs / VPC firewall rules

Use these rules for the `cloud` profile. They assume the app tier runs in a private subnet/VNet/VPC, the user-facing endpoint is behind a managed load balancer/WAF, and managed data services are not internet-exposed.

> Terraform equivalents for the AWS path belong in `deployment/terraform/aws`.

## AWS reference design

### Security groups

| SG | Direction | Source / destination | Port / proto | Purpose |
|---|---|---|---|---|
| `cs3-alb-sg` | Inbound | `0.0.0.0/0`, `::/0` | 443/TCP | Analyst UI, fleet enrollment, ingest, SSE |
| `cs3-alb-sg` | Inbound | `0.0.0.0/0`, `::/0` | 80/TCP | Optional HTTP→HTTPS redirect only |
| `cs3-alb-sg` | Outbound | `cs3-app-sg` | 3000/TCP | Reverse proxy to console service |
| `cs3-app-sg` | Inbound | `cs3-alb-sg` | 3000/TCP | Console traffic from ALB / ingress only |
| `cs3-app-sg` | Inbound | `cs3-bastion-sg` | 22/TCP | Break-glass SSH to nodes/VMs only if required |
| `cs3-app-sg` | Outbound | `cs3-rds-sg` | 5432/TCP | Postgres |
| `cs3-app-sg` | Outbound | `cs3-os-sg` | 9200/TCP | OpenSearch / indexer |
| `cs3-app-sg` | Outbound | `0.0.0.0/0` | 443/TCP | IdP, OCI registry, package repo, hosted LLM APIs |
| `cs3-app-sg` | Outbound | VPC resolver | 53/TCP,UDP | DNS |
| `cs3-app-sg` | Outbound | NTP source | 123/UDP | Time sync |
| `cs3-rds-sg` | Inbound | `cs3-app-sg`, `cs3-bastion-sg` | 5432/TCP | App and DBA bastion only |
| `cs3-os-sg` | Inbound | `cs3-app-sg`, `cs3-bastion-sg` | 9200/TCP | App and admin maintenance only |
| `cs3-bastion-sg` | Inbound | Admin CIDR | 22/TCP | SSH bastion |
| `cs3-bastion-sg` | Outbound | Private subnets | 22/TCP, 443/TCP, 6443/TCP | Node admin, Argo CD, Kubernetes API |

### AWS-specific notes

- Terminate TLS at ALB/NLB + WAF, or at an ingress controller behind the load balancer.
- Put ECS/EKS worker nodes or VMs in private subnets; only the ALB/NLB subnets should be public.
- If the cloud deployment does **not** use hosted models, remove internet `443/TCP` egress to model providers and apply the on-prem inference pattern instead.

## Azure NSG mapping

| NSG | Direction | Source / destination | Port / proto | Purpose |
|---|---|---|---|---|
| `nsg-cs3-edge` | Inbound | Internet | 443/TCP | Application Gateway / ingress |
| `nsg-cs3-edge` | Inbound | Internet | 80/TCP | Optional redirect only |
| `nsg-cs3-edge` | Outbound | `nsg-cs3-app` | 3000/TCP | Reverse proxy to console |
| `nsg-cs3-app` | Inbound | `AzureLoadBalancer`, `nsg-cs3-edge` | 3000/TCP | App traffic |
| `nsg-cs3-app` | Outbound | `nsg-cs3-db` | 5432/TCP | Postgres |
| `nsg-cs3-app` | Outbound | `nsg-cs3-search` | 9200/TCP | OpenSearch |
| `nsg-cs3-app` | Outbound | Internet or private endpoints | 443/TCP | IdP, registries, hosted LLM APIs |
| `nsg-cs3-mgmt` | Inbound | Admin CIDR / ExpressRoute | 22/TCP, 443/TCP, 6443/TCP | Bastion, Argo CD, AKS API |
| `nsg-cs3-db` | Inbound | `nsg-cs3-app`, `nsg-cs3-mgmt` | 5432/TCP | App and admin only |
| `nsg-cs3-search` | Inbound | `nsg-cs3-app`, `nsg-cs3-mgmt` | 9200/TCP | App and admin only |

## GCP VPC firewall mapping

| Rule | Direction | Source / target | Port / proto | Purpose |
|---|---|---|---|---|
| `fw-cs3-edge-https` | Ingress | `0.0.0.0/0` → edge tag | 443/TCP | HTTPS to external load balancer / ingress |
| `fw-cs3-edge-http` | Ingress | `0.0.0.0/0` → edge tag | 80/TCP | Optional redirect only |
| `fw-cs3-edge-to-app` | Egress | edge tag → app tag | 3000/TCP | Reverse proxy to console |
| `fw-cs3-app-to-db` | Egress | app tag → db tag | 5432/TCP | Postgres |
| `fw-cs3-app-to-search` | Egress | app tag → search tag | 9200/TCP | OpenSearch |
| `fw-cs3-app-egress-https` | Egress | app tag → `0.0.0.0/0` | 443/TCP | IdP, registries, hosted LLM APIs |
| `fw-cs3-mgmt` | Ingress | Admin CIDR → mgmt tag | 22/TCP, 443/TCP, 6443/TCP | Bastion, Argo CD, GKE API |
| `fw-cs3-db-ingress` | Ingress | app tag, mgmt tag → db tag | 5432/TCP | App and DBA only |
| `fw-cs3-search-ingress` | Ingress | app tag, mgmt tag → search tag | 9200/TCP | App and admin only |

## Common hardening requirements

- Use private endpoints / service endpoints for managed database and search services when available.
- Pin all images by digest and restrict egress through NAT, firewall, or proxy allow-lists.
- Log accepted and denied flows for the edge and app tiers.
- Keep management-plane access (`22`, `443`, `6443`) behind VPN, ExpressRoute, Direct Connect, Cloud Interconnect, or an approved bastion.
