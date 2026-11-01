import React, { useState } from 'react';
import {
  FileText,
  Download,
  Copy,
  Check,
  X,
  Printer,
  Sparkles,
  Share2,
  Code,
  Table,
  ShieldAlert,
} from 'lucide-react';
import {
  ExportFormat,
  HandlingClassification,
  ExportPayload,
  downloadFile,
  generateCSVString,
  printFormattedDocument,
} from '../../lib/exportUtils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: ExportPayload | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  payload,
}) => {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('EXECUTIVE_BRIEF');
  const [classification, setClassification] = useState<HandlingClassification>(
    payload?.defaultClassification || 'TLP:AMBER'
  );
  const [copied, setCopied] = useState(false);

  if (!isOpen || !payload) return null;

  const now = new Date();
  const reportId = `CECUR-${payload.category}-${now.getFullYear()}${(now.getMonth() + 1)
    .toString()
    .padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;

  const getBriefText = () => payload.briefText(classification, reportId);

  const getCSVText = () => {
    if (!payload.csvData) return '';
    const { headers, rows } = payload.csvData();
    return generateCSVString(headers, rows);
  };

  const getJSONText = () => {
    return JSON.stringify(payload.jsonData(), null, 2);
  };

  const getActiveContent = () => {
    switch (exportFormat) {
      case 'CSV_LEDGER':
        return getCSVText();
      case 'JSON_PACKAGE':
        return getJSONText();
      case 'EXECUTIVE_BRIEF':
      default:
        return getBriefText();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getActiveContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleDownload = () => {
    const content = getActiveContent();
    let extension = 'txt';
    let mimeType = 'text/plain';

    if (exportFormat === 'JSON_PACKAGE') {
      extension = 'json';
      mimeType = 'application/json';
    } else if (exportFormat === 'CSV_LEDGER') {
      extension = 'csv';
      mimeType = 'text/csv';
    } else {
      extension = 'md';
      mimeType = 'text/markdown';
    }

    downloadFile(content, `${reportId}.${extension}`, mimeType);
  };

  const handlePrint = () => {
    printFormattedDocument(payload.title, getBriefText(), classification);
  };

  return (
    <div
      id="unified-export-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1B32]/75 backdrop-blur-xs p-4"
    >
      <div
        id="unified-export-modal"
        className="bg-[var(--color-surface)] border border-[var(--color-border-card)] border-t-4 border-t-[var(--color-primary)] rounded-md w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border-card)] bg-[var(--color-surface-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-[var(--color-surface)] border border-[var(--color-border-card)] flex items-center justify-center text-[var(--color-primary)]">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-[var(--color-text-dark)] tracking-wide uppercase">
                  {payload.title}
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm bg-[var(--color-surface)] text-[var(--color-primary)] border border-[var(--color-border-card)]">
                  {classification}
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Export verified SOC reports, audit packages, SIEM ledgers, or executive briefs for stakeholders
              </p>
            </div>
          </div>

          <button
            id="close-unified-export-modal"
            onClick={onClose}
            className="p-1.5 rounded-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-dark)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[var(--color-surface)] border-b border-[var(--color-border-card)]">
          {/* Format Tabs */}
          <div className="flex items-center gap-1.5 bg-[var(--color-surface-subtle)] p-1 rounded-sm border border-[var(--color-border-card)]">
            <button
              id="export-tab-brief"
              onClick={() => setExportFormat('EXECUTIVE_BRIEF')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold transition-all cursor-pointer ${
                exportFormat === 'EXECUTIVE_BRIEF'
                  ? 'bg-[var(--color-primary)] text-white shadow-xs'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-dark)]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Executive Brief (Markdown)</span>
            </button>

            {payload.csvData && (
              <button
                id="export-tab-csv"
                onClick={() => setExportFormat('CSV_LEDGER')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold transition-all cursor-pointer ${
                  exportFormat === 'CSV_LEDGER'
                    ? 'bg-[var(--color-primary)] text-white shadow-xs'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-dark)]'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>CSV Spreadsheet Ledger</span>
              </button>
            )}

            <button
              id="export-tab-json"
              onClick={() => setExportFormat('JSON_PACKAGE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold transition-all cursor-pointer ${
                exportFormat === 'JSON_PACKAGE'
                  ? 'bg-[var(--color-primary)] text-white shadow-xs'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-dark)]'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>JSON Structured Data</span>
            </button>
          </div>

          {/* Classification Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)] font-bold">Handling:</span>
            <select
              id="export-classification-select"
              value={classification}
              onChange={(e: any) => setClassification(e.target.value as HandlingClassification)}
              className="text-xs bg-[var(--color-surface-subtle)] border border-[var(--color-border-card)] text-[var(--color-text-dark)] rounded-sm px-2.5 py-1.5 outline-none font-mono font-bold focus:border-[var(--color-primary)]"
            >
              <option value="TLP:AMBER">TLP:AMBER (Restricted Org)</option>
              <option value="TLP:RED">TLP:RED (Named Recipients Only)</option>
              <option value="TLP:GREEN">TLP:GREEN (Community Share)</option>
              <option value="RESTRICTED">RESTRICTED (SOC & Auditor Internal)</option>
              <option value="UNCLASSIFIED">UNCLASSIFIED (Public Release)</option>
            </select>
          </div>
        </div>

        {/* Document Preview Pane */}
        <div className="flex-1 p-4 overflow-y-auto bg-[#0A0B0E] font-mono text-xs text-slate-200 min-h-[260px] max-h-[460px]">
          <pre className="whitespace-pre-wrap leading-relaxed select-all">
            {getActiveContent()}
          </pre>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-[var(--color-border-card)] bg-[var(--color-surface-subtle)]">
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <Sparkles className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
            <span>Cryptographically sealed and ready for GRC, SIEM/SOAR ingestion, or executive review.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="export-print-btn"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-dark)] border border-[var(--color-border-card)] text-xs font-bold transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[var(--color-primary)]" />
              <span>Print / PDF</span>
            </button>

            <button
              id="export-copy-clipboard-btn"
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm text-xs font-bold transition-all cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-dark)] border border-[var(--color-border-card)]'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                  <span>Copy Content</span>
                </>
              )}
            </button>

            <button
              id="export-download-file-btn"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-sm bg-[var(--color-primary)] hover:bg-[#0070E0] text-white text-xs font-extrabold transition-all shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
