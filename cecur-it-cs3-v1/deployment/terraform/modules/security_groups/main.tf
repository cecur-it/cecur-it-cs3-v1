# Per-tier security groups mirroring operations/firewall/cloud-security-groups.md.
# Flow: agents -> relay/LB (443, mTLS) -> console (3000) -> {ollama-lb (11434), postgres (5432), indexer (9200)}.
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.40" }
  }
}

variable "name" { type = string }
variable "vpc_id" { type = string }
variable "agent_cidrs" {
  description = "Endpoint networks allowed to reach the ingest relay (443)."
  type        = list(string)
}
variable "admin_cidrs" {
  description = "Analyst / admin networks allowed to reach the console UI (443)."
  type        = list(string)
}
variable "mgmt_cidrs" {
  description = "Bastion / management networks for SSH."
  type        = list(string)
  default     = []
}
variable "tags" {
  type    = map(string)
  default = {}
}

resource "aws_security_group" "relay" {
  name_prefix = "${var.name}-relay-"
  description = "Ingest relay / load balancer (DMZ)"
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name}-relay" })
  lifecycle { create_before_destroy = true }
}

resource "aws_security_group" "console" {
  name_prefix = "${var.name}-console-"
  description = "CS3 console (app tier)"
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name}-console" })
  lifecycle { create_before_destroy = true }
}

resource "aws_security_group" "ollama" {
  name_prefix = "${var.name}-ollama-"
  description = "Ollama nodes + LB (app tier, GPU)"
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name}-ollama" })
  lifecycle { create_before_destroy = true }
}

resource "aws_security_group" "postgres" {
  name_prefix = "${var.name}-postgres-"
  description = "PostgreSQL (data tier)"
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name}-postgres" })
  lifecycle { create_before_destroy = true }
}

resource "aws_security_group" "indexer" {
  name_prefix = "${var.name}-indexer-"
  description = "OpenSearch / Wazuh indexer (data tier)"
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name}-indexer" })
  lifecycle { create_before_destroy = true }
}

# --- relay: agents + analysts in over 443; to console only ---
resource "aws_vpc_security_group_ingress_rule" "relay_agents" {
  for_each          = toset(var.agent_cidrs)
  security_group_id = aws_security_group.relay.id
  description       = "Agent mTLS ingest"
  cidr_ipv4         = each.value
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "relay_admins" {
  for_each          = toset(var.admin_cidrs)
  security_group_id = aws_security_group.relay.id
  description       = "Analyst console access"
  cidr_ipv4         = each.value
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "relay_to_console" {
  security_group_id            = aws_security_group.relay.id
  description                  = "Relay to console"
  referenced_security_group_id = aws_security_group.console.id
  from_port                    = 3000
  to_port                      = 3000
  ip_protocol                  = "tcp"
}

# --- console ---
resource "aws_vpc_security_group_ingress_rule" "console_from_relay" {
  security_group_id            = aws_security_group.console.id
  description                  = "From relay"
  referenced_security_group_id = aws_security_group.relay.id
  from_port                    = 3000
  to_port                      = 3000
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "console_to_ollama" {
  security_group_id            = aws_security_group.console.id
  referenced_security_group_id = aws_security_group.ollama.id
  description                  = "Inference"
  from_port                    = 11434
  to_port                      = 11434
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "console_to_postgres" {
  security_group_id            = aws_security_group.console.id
  referenced_security_group_id = aws_security_group.postgres.id
  description                  = "Persistence"
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "console_to_indexer" {
  security_group_id            = aws_security_group.console.id
  referenced_security_group_id = aws_security_group.indexer.id
  description                  = "SIEM queries"
  from_port                    = 9200
  to_port                      = 9200
  ip_protocol                  = "tcp"
}

# --- ollama ---
resource "aws_vpc_security_group_ingress_rule" "ollama_from_console" {
  security_group_id            = aws_security_group.ollama.id
  referenced_security_group_id = aws_security_group.console.id
  description                  = "From console"
  from_port                    = 11434
  to_port                      = 11434
  ip_protocol                  = "tcp"
}

# --- postgres ---
resource "aws_vpc_security_group_ingress_rule" "postgres_from_console" {
  security_group_id            = aws_security_group.postgres.id
  referenced_security_group_id = aws_security_group.console.id
  description                  = "From console"
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

# --- indexer ---
resource "aws_vpc_security_group_ingress_rule" "indexer_from_console" {
  security_group_id            = aws_security_group.indexer.id
  referenced_security_group_id = aws_security_group.console.id
  description                  = "From console"
  from_port                    = 9200
  to_port                      = 9200
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "indexer_cluster" {
  security_group_id            = aws_security_group.indexer.id
  referenced_security_group_id = aws_security_group.indexer.id
  description                  = "Node-to-node transport"
  from_port                    = 9300
  to_port                      = 9300
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "indexer_cluster" {
  security_group_id            = aws_security_group.indexer.id
  referenced_security_group_id = aws_security_group.indexer.id
  description                  = "Node-to-node transport"
  from_port                    = 9300
  to_port                      = 9300
  ip_protocol                  = "tcp"
}

# --- management SSH to every tier (bastion CIDRs only) ---
resource "aws_vpc_security_group_ingress_rule" "ssh" {
  for_each = {
    for p in setproduct(["console", "ollama", "postgres", "indexer"], var.mgmt_cidrs) : "${p[0]}-${p[1]}" => { tier = p[0], cidr = p[1] }
  }
  security_group_id = { console = aws_security_group.console.id, ollama = aws_security_group.ollama.id, postgres = aws_security_group.postgres.id, indexer = aws_security_group.indexer.id }[each.value.tier]
  description       = "Management SSH"
  cidr_ipv4         = each.value.cidr
  from_port         = 22
  to_port           = 22
  ip_protocol       = "tcp"
}

output "ids" {
  value = {
    relay    = aws_security_group.relay.id
    console  = aws_security_group.console.id
    ollama   = aws_security_group.ollama.id
    postgres = aws_security_group.postgres.id
    indexer  = aws_security_group.indexer.id
  }
}
