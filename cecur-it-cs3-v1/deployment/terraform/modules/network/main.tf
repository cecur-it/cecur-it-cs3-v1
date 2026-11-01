# Three-tier network: dmz (public: relay/LB), app (console, Ollama), data (PostgreSQL, OpenSearch).
# Only the dmz tier has a route to the internet gateway; app egress goes through NAT (or none when airgap).
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.40" }
  }
}

variable "name" { type = string }
variable "cidr" { type = string }
variable "azs" { type = list(string) }
variable "enable_nat" {
  type    = bool
  default = true
}
variable "flow_log_retention_days" {
  type    = number
  default = 365
}
variable "tags" {
  type    = map(string)
  default = {}
}

locals {
  tiers = ["dmz", "app", "data"]
  subnets = merge([
    for ti, tier in local.tiers : {
      for ai, az in var.azs : "${tier}-${az}" => {
        tier = tier
        az   = az
        cidr = cidrsubnet(var.cidr, 4, ti * 4 + ai)
      }
    }
  ]...)
}

resource "aws_vpc" "this" {
  cidr_block           = var.cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = merge(var.tags, { Name = var.name })
}

resource "aws_subnet" "this" {
  for_each                = local.subnets
  vpc_id                  = aws_vpc.this.id
  availability_zone       = each.value.az
  cidr_block              = each.value.cidr
  map_public_ip_on_launch = false
  tags                    = merge(var.tags, { Name = "${var.name}-${each.key}", Tier = each.value.tier })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = merge(var.tags, { Name = var.name })
}

resource "aws_eip" "nat" {
  count  = var.enable_nat ? 1 : 0
  domain = "vpc"
  tags   = merge(var.tags, { Name = "${var.name}-nat" })
}

resource "aws_nat_gateway" "this" {
  count         = var.enable_nat ? 1 : 0
  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.this["dmz-${var.azs[0]}"].id
  tags          = merge(var.tags, { Name = var.name })
  depends_on    = [aws_internet_gateway.this]
}

resource "aws_route_table" "dmz" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
  tags = merge(var.tags, { Name = "${var.name}-dmz" })
}

resource "aws_route_table" "app" {
  vpc_id = aws_vpc.this.id
  dynamic "route" {
    for_each = var.enable_nat ? [1] : []
    content {
      cidr_block     = "0.0.0.0/0"
      nat_gateway_id = aws_nat_gateway.this[0].id
    }
  }
  tags = merge(var.tags, { Name = "${var.name}-app" })
}

# Data tier: no default route at all (no internet, no NAT).
resource "aws_route_table" "data" {
  vpc_id = aws_vpc.this.id
  tags   = merge(var.tags, { Name = "${var.name}-data" })
}

resource "aws_route_table_association" "this" {
  for_each       = local.subnets
  subnet_id      = aws_subnet.this[each.key].id
  route_table_id = { dmz = aws_route_table.dmz.id, app = aws_route_table.app.id, data = aws_route_table.data.id }[each.value.tier]
}

# Flow logs (NIST AU-2 / SC-7 evidence)
resource "aws_cloudwatch_log_group" "flow" {
  name              = "/cs3/${var.name}/vpc-flow"
  retention_in_days = var.flow_log_retention_days
  tags              = var.tags
}

data "aws_iam_policy_document" "flow_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["vpc-flow-logs.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "flow" {
  name               = "${var.name}-vpc-flow"
  assume_role_policy = data.aws_iam_policy_document.flow_assume.json
  tags               = var.tags
}

data "aws_iam_policy_document" "flow_write" {
  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"]
    resources = ["${aws_cloudwatch_log_group.flow.arn}:*"]
  }
}

resource "aws_iam_role_policy" "flow" {
  role   = aws_iam_role.flow.id
  policy = data.aws_iam_policy_document.flow_write.json
}

resource "aws_flow_log" "this" {
  vpc_id          = aws_vpc.this.id
  traffic_type    = "ALL"
  log_destination = aws_cloudwatch_log_group.flow.arn
  iam_role_arn    = aws_iam_role.flow.arn
  tags            = var.tags
}

output "vpc_id" { value = aws_vpc.this.id }
output "vpc_cidr" { value = aws_vpc.this.cidr_block }
output "subnet_ids" {
  value = { for tier in local.tiers : tier => [for k, v in local.subnets : aws_subnet.this[k].id if v.tier == tier] }
}
