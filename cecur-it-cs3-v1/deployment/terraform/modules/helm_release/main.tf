# Installs the CS3 Helm chart with a profile values file (cloud | onprem | airgap).
# The caller configures the helm and kubernetes providers; this module stays provider-config free.
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    helm       = { source = "hashicorp/helm", version = "~> 2.12" }
    kubernetes = { source = "hashicorp/kubernetes", version = ">= 2.27" }
  }
}

variable "profile" {
  type = string
  validation {
    condition     = contains(["cloud", "onprem", "airgap"], var.profile)
    error_message = "profile must be cloud, onprem or airgap."
  }
}
variable "chart_path" {
  type    = string
  default = "../../helm/cs3"
}
variable "namespace" {
  type    = string
  default = "cs3"
}
variable "existing_secret" {
  description = "Name of a pre-created Secret with the CS3 credentials (recommended; keeps secrets out of state)."
  type        = string
  default     = "cs3-credentials"
}
variable "set_values" {
  description = "Extra non-secret chart overrides."
  type        = map(string)
  default     = {}
}

resource "kubernetes_namespace_v1" "cs3" {
  metadata {
    name = var.namespace
    labels = {
      "pod-security.kubernetes.io/enforce" = "restricted"
    }
  }
}

resource "helm_release" "cs3" {
  name            = "cs3"
  namespace       = kubernetes_namespace_v1.cs3.metadata[0].name
  chart           = var.chart_path
  values          = [file("${var.chart_path}/values-${var.profile}.yaml")]
  atomic          = true
  wait            = true
  timeout         = 900
  cleanup_on_fail = true

  set {
    name  = "secrets.existingSecret"
    value = var.existing_secret
  }

  dynamic "set" {
    for_each = var.set_values
    content {
      name  = set.key
      value = set.value
    }
  }
}
