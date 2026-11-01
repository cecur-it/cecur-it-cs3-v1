# Immutable, KMS-encrypted bucket for PostgreSQL base backups/WAL and OpenSearch snapshots.
# Object Lock (COMPLIANCE by default) gives WORM retention for audit-evidence (NIST AU-9, SEC 17a-4-style).
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.40" }
  }
}

variable "bucket_name" { type = string }
variable "retention_days" {
  type    = number
  default = 365
}
variable "lock_mode" {
  type    = string
  default = "COMPLIANCE"
  validation {
    condition     = contains(["COMPLIANCE", "GOVERNANCE"], var.lock_mode)
    error_message = "lock_mode must be COMPLIANCE or GOVERNANCE."
  }
}
variable "glacier_after_days" {
  type    = number
  default = 90
}
variable "tags" {
  type    = map(string)
  default = {}
}

resource "aws_kms_key" "backup" {
  description             = "CS3 backup encryption"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  tags                    = var.tags
}

resource "aws_kms_alias" "backup" {
  name          = "alias/${var.bucket_name}"
  target_key_id = aws_kms_key.backup.key_id
}

resource "aws_s3_bucket" "backup" {
  bucket              = var.bucket_name
  object_lock_enabled = true
  tags                = var.tags
}

resource "aws_s3_bucket_versioning" "backup" {
  bucket = aws_s3_bucket.backup.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_object_lock_configuration" "backup" {
  bucket = aws_s3_bucket.backup.id
  rule {
    default_retention {
      mode = var.lock_mode
      days = var.retention_days
    }
  }
  depends_on = [aws_s3_bucket_versioning.backup]
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backup" {
  bucket = aws_s3_bucket.backup.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.backup.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "backup" {
  bucket                  = aws_s3_bucket.backup.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "backup" {
  bucket = aws_s3_bucket.backup.id
  rule {
    id     = "tier-and-expire"
    status = "Enabled"
    filter {}
    transition {
      days          = var.glacier_after_days
      storage_class = "GLACIER"
    }
    expiration {
      days = var.retention_days + 30
    }
    noncurrent_version_expiration {
      noncurrent_days = var.retention_days + 30
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
  depends_on = [aws_s3_bucket_versioning.backup]
}

data "aws_iam_policy_document" "tls_only" {
  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.backup.arn, "${aws_s3_bucket.backup.arn}/*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "backup" {
  bucket = aws_s3_bucket.backup.id
  policy = data.aws_iam_policy_document.tls_only.json
}

output "bucket" { value = aws_s3_bucket.backup.bucket }
output "bucket_arn" { value = aws_s3_bucket.backup.arn }
output "kms_key_arn" { value = aws_kms_key.backup.arn }
