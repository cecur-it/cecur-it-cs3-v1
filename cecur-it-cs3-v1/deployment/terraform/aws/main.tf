module "network" {
  source     = "../modules/network"
  name       = var.name
  cidr       = var.vpc_cidr
  azs        = var.azs
  enable_nat = var.enable_nat
  tags       = var.tags
}

module "security_groups" {
  source      = "../modules/security_groups"
  name        = var.name
  vpc_id      = module.network.vpc_id
  agent_cidrs = var.agent_cidrs
  admin_cidrs = var.admin_cidrs
  mgmt_cidrs  = var.mgmt_cidrs
  tags        = var.tags
}

module "backup_bucket" {
  source         = "../modules/backup_bucket"
  bucket_name    = var.backup_bucket_name
  retention_days = var.backup_retention_days
  lock_mode      = var.backup_lock_mode
  tags           = var.tags
}
