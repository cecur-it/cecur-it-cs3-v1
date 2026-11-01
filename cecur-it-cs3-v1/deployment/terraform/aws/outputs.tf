output "vpc_id" { value = module.network.vpc_id }
output "subnet_ids" { value = module.network.subnet_ids }
output "security_group_ids" { value = module.security_groups.ids }
output "backup_bucket" { value = module.backup_bucket.bucket }
output "backup_kms_key_arn" { value = module.backup_bucket.kms_key_arn }
