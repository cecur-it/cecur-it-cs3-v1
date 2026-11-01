terraform {
  required_version = ">= 1.6.0" # OpenTofu >= 1.6 and Terraform >= 1.6 are both supported

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.40"
    }
  }

  # Remote state with locking and encryption is strongly recommended; configure at init time:
  #   tofu init -backend-config=backend.hcl
  # backend "s3" {}
}

provider "aws" {
  region = var.region
  default_tags {
    tags = var.tags
  }
}
