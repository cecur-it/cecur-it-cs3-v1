{{- define "cs3.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "cs3.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "cs3.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/name: {{ include "cs3.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
cs3.cecur-it.io/profile: {{ .Values.global.profile | quote }}
{{- end -}}

{{- define "cs3.selector" -}}
app.kubernetes.io/name: {{ include "cs3.name" .root }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{- define "cs3.image" -}}
{{- $reg := .root.Values.global.imageRegistry -}}
{{- $tag := default .root.Chart.AppVersion .img.tag -}}
{{- if .img.digest -}}
{{- printf "%s%s@%s" (ternary (printf "%s/" $reg) "" (ne $reg "")) .img.repository .img.digest -}}
{{- else -}}
{{- printf "%s%s:%s" (ternary (printf "%s/" $reg) "" (ne $reg "")) .img.repository $tag -}}
{{- end -}}
{{- end -}}

{{- define "cs3.secretName" -}}
{{- default (printf "%s-credentials" (include "cs3.fullname" .)) .Values.secrets.existingSecret -}}
{{- end -}}

{{- define "cs3.pgHost" -}}
{{- if .Values.postgres.enabled -}}{{ include "cs3.fullname" . }}-postgres{{- else -}}{{ required "postgres.external.host is required when postgres.enabled=false" .Values.postgres.external.host }}{{- end -}}
{{- end -}}

{{- define "cs3.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}{{ default (include "cs3.fullname" .) .Values.serviceAccount.name }}{{- else -}}{{ default "default" .Values.serviceAccount.name }}{{- end -}}
{{- end -}}

{{- define "cs3.keep" -}}
{{- /* returns plaintext of existing key or a fresh random value */ -}}
{{- if hasKey .data .key }}{{ index .data .key | b64dec }}{{ else }}{{ randAlphaNum 48 }}{{ end -}}
{{- end -}}

{{- define "cs3.ollamaLbConf" -}}
{{- $name := printf "%s-ollama" (include "cs3.fullname" .) -}}
worker_processes auto;
events { worker_connections 4096; }
http {
  resolver kube-dns.kube-system.svc.cluster.local valid=10s ipv6=off;
  upstream ollama_pool {
    least_conn;
{{- range $i := until (int .Values.ollama.replicas) }}
    server {{ $name }}-{{ $i }}.{{ $name }}.{{ $.Release.Namespace }}.svc.cluster.local:11434 max_fails=2 fail_timeout=15s;
{{- end }}
    keepalive 32;
  }
  limit_conn_zone $server_name zone=ollama_total:1m;
  server {
    listen 11434;
    location = /healthz { return 200 "ok\n"; }
    location / {
      limit_conn ollama_total {{ .Values.ollamaLb.maxConnections }};
      limit_conn_status 503;
      proxy_pass http://ollama_pool;
      proxy_http_version 1.1;
      proxy_set_header Connection "";
      proxy_buffering off;
      proxy_request_buffering off;
      proxy_connect_timeout 3s;
      proxy_read_timeout 600s;
      proxy_next_upstream error timeout http_502 http_503;
      proxy_next_upstream_tries 2;
    }
  }
}
{{- end -}}
