variable "region" {
  type    = string
  default = "us-gov-west-1"
}

variable "name" {
  description = "Resource name prefix."
  type        = string
  default     = "cs3"
}

variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

variable "azs" {
  description = "Availability zones (at least two for multi-AZ)."
  type        = list(string)
  default     = ["us-gov-west-1a", "us-gov-west-1b"]
  validation {
    condition     = length(var.azs) >= 2 && length(var.azs) <= 4
    error_message = "Provide 2-4 availability zones."
  }
}

variable "enable_nat" {
  description = "NAT for the app tier. Set false for airgap-style VPCs (no internet egress)."
  type        = bool
  default     = true
}

variable "agent_cidrs" {
  description = "Endpoint networks allowed to reach the ingest relay on 443 (never 0.0.0.0/0 in production)."
  type        = list(string)
  validation {
    condition     = !contains(var.agent_cidrs, "0.0.0.0/0")
    error_message = "agent_cidrs must not be 0.0.0.0/0."
  }
}

variable "admin_cidrs" {
  description = "Analyst networks allowed to reach the console on 443."
  type        = list(string)
  validation {
    condition     = !contains(var.admin_cidrs, "0.0.0.0/0")
    error_message = "admin_cidrs must not be 0.0.0.0/0."
  }
}

variable "mgmt_cidrs" {
  description = "Bastion CIDRs for SSH."
  type        = list(string)
  default     = []
}

variable "backup_bucket_name" {
  description = "Globally unique S3 bucket name for backups."
  type        = string
}

variable "backup_retention_days" {
  type    = number
  default = 365
}

variable "backup_lock_mode" {
  description = "S3 Object Lock mode. COMPLIANCE cannot be shortened or removed by anyone, including root."
  type        = string
  default     = "GOVERNANCE"
}

variable "tags" {
  type = map(string)
  default = {
    Application = "cecur-cs3"
    ManagedBy   = "opentofu"
  }
}
