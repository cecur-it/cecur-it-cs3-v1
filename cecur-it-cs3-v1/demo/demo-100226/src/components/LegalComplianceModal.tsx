import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Shield,
  FileText,
  Lock,
  Scale,
  CheckCircle2,
  AlertTriangle,
  Search,
  Copy,
  Check,
  Download,
  Mail,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  BookOpen,
  Award,
  Terminal,
  Cpu,
} from 'lucide-react';
import {
  PRIVACY_POLICY,
  TERMS_OF_SERVICE,
  RULES_OF_ENGAGEMENT,
  NIST_800_53_REV5_GOVERNANCE,
  NIST_800_171_REV3_SPEC,
  SECURITY_PORTAL_DATA,
  LegalDocument,
  LegalSection,
} from '../data/legalLiterature';

export type LegalTabType = 'privacy' | 'terms' | 'roe' | 'nist53' | 'nist171' | 'security';

interface LegalComplianceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: LegalTabType;
}

export const LegalComplianceModal: React.FC<LegalComplianceModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'privacy',
}) => {
  const [activeTab, setActiveTab] = useState<LegalTabType>(initialTab || 'privacy');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Sync initial tab whenever modal opens or initialTab prop changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || 'privacy');
      setSearchQuery('');
    }
  }, [isOpen, initialTab]);

  // Safe document selection with guarantee of non-null fallback
  const currentDoc: LegalDocument = useMemo(() => {
    switch (activeTab) {
      case 'privacy':
        return PRIVACY_POLICY || { id: 'privacy-policy', title: 'Privacy Policy', subtitle: '', lastUpdated: '', version: '', badge: '', overview: '', sections: [] };
      case 'terms':
        return TERMS_OF_SERVICE || { id: 'terms-of-service', title: 'Terms of Service', subtitle: '', lastUpdated: '', version: '', badge: '', overview: '', sections: [] };
      case 'roe':
        return RULES_OF_ENGAGEMENT || { id: 'rules-of-engagement', title: 'Rules of Engagement', subtitle: '', lastUpdated: '', version: '', badge: '', overview: '', sections: [] };
      case 'nist53':
        return NIST_800_53_REV5_GOVERNANCE || { id: 'nist-800-53-rev5', title: 'NIST SP 800-53 Rev 5', subtitle: '', lastUpdated: '', version: '', badge: '', overview: '', sections: [] };
      case 'nist171':
        return NIST_800_171_REV3_SPEC || { id: 'nist-800-171-rev3', title: 'NIST SP 800-171 Rev 3', subtitle: '', lastUpdated: '', version: '', badge: '', overview: '', sections: [] };
      default:
        return PRIVACY_POLICY;
    }
  }, [activeTab]);

  // Filtered sections based on search query with full defensive guarding
  const filteredSections: LegalSection[] = useMemo(() => {
    if (!currentDoc || !Array.isArray(currentDoc.sections)) return [];
    if (!searchQuery.trim()) return currentDoc.sections;
    const q = searchQuery.toLowerCase();
    return currentDoc.sections.filter((sec) => {
      if (!sec) return false;
      const titleMatch = sec.title ? sec.title.toLowerCase().includes(q) : false;
      const numberMatch = sec.number ? sec.number.toLowerCase().includes(q) : false;
      const summaryMatch = sec.summary ? sec.summary.toLowerCase().includes(q) : false;
      const contentMatch = Array.isArray(sec.content)
        ? sec.content.some((c) => (c ? c.toLowerCase().includes(q) : false))
        : false;
      const tagMatch = Array.isArray(sec.complianceTags)
        ? sec.complianceTags.some((t) => (t ? t.toLowerCase().includes(q) : false))
        : false;
      return titleMatch || numberMatch || summaryMatch || contentMatch || tagMatch;
    });
  }, [currentDoc, searchQuery]);

  const handleCopySection = async (sec: LegalSection) => {
    try {
      const contentList = Array.isArray(sec.content) ? sec.content.join('\n\n') : '';
      const textToCopy = `${sec.number || ''}: ${sec.title || ''}\n\nSummary: ${sec.summary || ''}\n\n${contentList}`;
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      }
      setCopiedId(sec.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.warn('Unable to copy section text to clipboard:', err);
      setCopiedId(sec.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleExportFullDocument = async () => {
    try {
      if (activeTab === 'security') {
        const certs = SECURITY_PORTAL_DATA?.certifications || [];
        const secText = `CECUR-IT, Inc. — Security & Compliance Enclave\nVersion: v4.14.7\n\nCertifications:\n${certs
          .map((c) => `• ${c.code} (${c.authority}): ${c.status}\n  ${c.description}`)
          .join('\n\n')}`;
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(secText);
        }
      } else if (currentDoc) {
        const sectionsText = (currentDoc.sections || [])
          .map(
            (s) =>
              `----------------------------------------\n${s.number || ''}: ${s.title || ''}\nSummary: ${s.summary || ''}\n\n${(s.content || []).join(
                '\n'
              )}`
          )
          .join('\n\n');
        const fullText = `${currentDoc.title || ''}\n${currentDoc.subtitle || ''}\nVersion: ${currentDoc.version || ''} | Last Updated: ${currentDoc.lastUpdated || ''}\n\nOverview:\n${currentDoc.overview || ''}\n\n${sectionsText}\n\nGovernance Desk: compliance@cecur-it.io | security@cecur-it.io`;
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(fullText);
        }
      }
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    } catch (err) {
      console.warn('Unable to export document text to clipboard:', err);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="legal-compliance-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn font-sans"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl bg-[#060B12] border border-[#1A3959] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-[#FFFFFF]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0C1B2B] border-b border-[#1A3959]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#00E5FF]/15 border border-[#00E5FF]/40 text-[#00E5FF] flex items-center justify-center font-bold shadow-[0_0_12px_rgba(0,229,255,0.3)]">
              <Shield className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-extrabold text-sm sm:text-base text-[#FFFFFF] tracking-tight">
                  CECUR<span className="text-[#00E5FF]">-IT</span> Legal &amp; Governance Portal
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#12283E] text-[#00E5FF] border border-[#00E5FF]/40 uppercase tracking-widest hidden sm:inline">
                  CS3 DOCS
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] font-mono">
                Mormar Technology, Inc. &bull; Federal, DoD &amp; Commercial Enclaves
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#12283E] hover:bg-[#1A3959] text-[#94A3B8] hover:text-[#FFFFFF] transition-colors cursor-pointer border border-[#1A3959]"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Selection & Search Navigation Bar */}
        <div className="bg-[#0C1B2B]/90 border-b border-[#1A3959] px-6 py-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
            <button
              id="legal-tab-privacy"
              onClick={() => {
                setActiveTab('privacy');
                setSearchQuery('');
              }}
              className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'privacy'
                  ? 'bg-[#00E5FF] text-[#060B12] shadow-[0_0_12px_rgba(0,229,255,0.4)] font-bold'
                  : 'text-[#94A3B8] hover:text-[#FFFFFF] hover:bg-[#12283E]'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Privacy Policy</span>
            </button>

            <button
              id="legal-tab-terms"
              onClick={() => {
                setActiveTab('terms');
                setSearchQuery('');
              }}
              className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'terms'
                  ? 'bg-[#00E5FF] text-[#060B12] shadow-[0_0_12px_rgba(0,229,255,0.4)] font-bold'
                  : 'text-[#94A3B8] hover:text-[#FFFFFF] hover:bg-[#12283E]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Terms of Service</span>
            </button>

            <button
              id="legal-tab-roe"
              onClick={() => {
                setActiveTab('roe');
                setSearchQuery('');
              }}
              className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'roe'
                  ? 'bg-[#00E5FF] text-[#060B12] shadow-[0_0_12px_rgba(0,229,255,0.4)] font-bold'
                  : 'text-[#94A3B8] hover:text-[#FFFFFF] hover:bg-[#12283E]'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Rules of Engagement</span>
            </button>

            <button
              id="legal-tab-nist53"
              onClick={() => {
                setActiveTab('nist53');
                setSearchQuery('');
              }}
              className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'nist53'
                  ? 'bg-[#00E5FF] text-[#060B12] shadow-[0_0_12px_rgba(0,229,255,0.4)] font-bold'
                  : 'text-[#94A3B8] hover:text-[#FFFFFF] hover:bg-[#12283E]'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>NIST SP 800-53 Rev 5</span>
            </button>

            <button
              id="legal-tab-nist171"
              onClick={() => {
                setActiveTab('nist171');
                setSearchQuery('');
              }}
              className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'nist171'
                  ? 'bg-[#00E5FF] text-[#060B12] shadow-[0_0_12px_rgba(0,229,255,0.4)] font-bold'
                  : 'text-[#94A3B8] hover:text-[#FFFFFF] hover:bg-[#12283E]'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              <span>NIST SP 800-171 Rev 3 (CUI)</span>
            </button>

            <button
              id="legal-tab-security"
              onClick={() => {
                setActiveTab('security');
                setSearchQuery('');
              }}
              className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'security'
                  ? 'bg-[#00E5FF] text-[#060B12] shadow-[0_0_12px_rgba(0,229,255,0.4)] font-bold'
                  : 'text-[#94A3B8] hover:text-[#FFFFFF] hover:bg-[#12283E]'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Security &amp; GRC Portal</span>
            </button>
          </div>

          {/* Search Bar */}
          {activeTab !== 'security' && (
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#64748B]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clauses (e.g. SCADA, FIPS, AI)..."
                className="w-full bg-[#12283E] border border-[#1A3959] rounded px-2.5 py-1.5 pl-8 text-xs text-[#FFFFFF] placeholder-[#64748B] focus:outline-none focus:border-[#00E5FF] font-sans"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-[#64748B] hover:text-[#FFFFFF] text-xs cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal Main Content Surface */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeTab === 'security' ? (
            /* Security & FedRAMP Portal Tab */
            <div className="space-y-6">
              {/* Top Banner */}
              <div className="p-4 sm:p-5 rounded-lg bg-[#0C1B2B] border border-[#1A3959] border-l-4 border-l-[#00E5FF] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-[#00E5FF] uppercase tracking-wider">
                    {SECURITY_PORTAL_DATA.title}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#12283E] text-[#00FF66] border border-[#00FF66]/30">
                    100% 3PAO PASS RATE
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-display font-bold text-[#FFFFFF]">
                  {SECURITY_PORTAL_DATA.subtitle}
                </h3>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  CECUR-IT operates an independent security architecture and authorization practice. All CS3 platform sensors, forwarders, and cloud synchronization relays adhere to strict Federal and DoD cryptographic isolation boundaries.
                </p>
              </div>

              {/* Grid of Certifications */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {SECURITY_PORTAL_DATA.certifications.map((cert) => (
                  <div
                    key={cert.code}
                    className="p-4 rounded-lg bg-[#0C1B2B] border border-[#1A3959] flex flex-col justify-between space-y-3 hover:border-[#00E5FF]/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-mono font-bold text-[#00E5FF]">{cert.code}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#12283E] text-[#94A3B8] border border-[#1A3959]">
                          {cert.badge}
                        </span>
                      </div>
                      <div className="text-[11px] font-sans text-[#64748B] mb-2">{cert.authority}</div>
                      <div className="text-xs text-[#00FF66] font-mono font-semibold mb-2 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{cert.status}</span>
                      </div>
                      <p className="text-xs text-[#94A3B8] leading-relaxed font-sans">{cert.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cryptographic Standards */}
              <div className="p-4 rounded-lg bg-[#0C1B2B] border border-[#1A3959] space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#FFB300] uppercase">
                  <ShieldCheck className="w-4 h-4 text-[#FFB300]" />
                  <span>Verified Cryptographic &amp; Hardware Isolation Standards</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SECURITY_PORTAL_DATA.cryptographicStandards.map((item, idx) => (
                    <div key={idx} className="p-3 rounded bg-[#12283E] border border-[#1A3959] space-y-1">
                      <div className="text-xs font-bold text-[#FFFFFF]">{item.title}</div>
                      <div className="text-xs text-[#94A3B8] leading-snug">{item.detail}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact Inquiries Callout */}
              <div className="p-3.5 rounded bg-[#12283E] border border-[#1A3959] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="text-[#94A3B8]">
                  For complete 3PAO System Security Plans (SSPs) or SAR artifacts, contact our GRC clearing desk.
                </div>
                <a
                  href="mailto:compliance@cecur-it.io?subject=FedRAMP%20SSP%20Inquiry"
                  className="px-3.5 py-1.5 bg-[#00E5FF]/10 text-[#00E5FF] hover:bg-[#00E5FF]/20 border border-[#00E5FF]/40 rounded font-semibold font-mono whitespace-nowrap transition-colors"
                >
                  compliance@cecur-it.io →
                </a>
              </div>
            </div>
          ) : (
            /* Document Tabs: Privacy Policy, Terms of Service, or Rules of Engagement */
            <div className="space-y-6">
              {/* Document Overview Header */}
              <div className="p-4 sm:p-5 rounded-lg bg-[#0C1B2B] border border-[#1A3959] border-l-4 border-l-[#00E5FF] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#12283E] text-[#00E5FF] border border-[#00E5FF]/40 uppercase tracking-widest">
                    {currentDoc.badge || 'Official Policy'}
                  </span>
                  <div className="flex items-center gap-2 text-xs font-mono text-[#64748B]">
                    <span>Version: {currentDoc.version || 'v4.14.7'}</span>
                    <span>•</span>
                    <span>Last Updated: {currentDoc.lastUpdated || 'September 2026'}</span>
                  </div>
                </div>

                <h2 className="text-base sm:text-xl font-display font-bold text-[#FFFFFF] tracking-tight">
                  {currentDoc.title}
                </h2>
                {currentDoc.subtitle && (
                  <p className="text-xs text-[#00E5FF] font-mono">{currentDoc.subtitle}</p>
                )}

                {currentDoc.overview && (
                  <p className="text-xs text-[#94A3B8] leading-relaxed pt-1 border-t border-[#1A3959]/60 font-sans">
                    {currentDoc.overview}
                  </p>
                )}
              </div>

              {/* Sections Quick Jump Navigation */}
              {currentDoc.sections && currentDoc.sections.length > 0 && !searchQuery && (
                <div className="p-3 rounded-lg bg-[#0C1B2B] border border-[#1A3959]">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B] mb-2">
                    Quick Navigation Index
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {currentDoc.sections.map((s) => (
                      <a
                        key={s.id}
                        href={`#${s.id}`}
                        className="px-2 py-1 bg-[#12283E] hover:bg-[#1A3959] border border-[#1A3959] hover:border-[#00E5FF]/50 rounded text-[11px] font-mono text-[#94A3B8] hover:text-[#FFFFFF] transition-colors"
                      >
                        {s.number}: {s.title ? (s.title.split(' ')[0] || s.title) : ''}...
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Search Result Count */}
              {searchQuery && (
                <div className="text-xs text-[#94A3B8] font-mono flex items-center justify-between">
                  <span>
                    Showing {filteredSections.length} of {(currentDoc.sections || []).length} clauses matching "{searchQuery}"
                  </span>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-[#00E5FF] hover:underline cursor-pointer"
                  >
                    Clear Filter
                  </button>
                </div>
              )}

              {/* Sections List */}
              <div className="space-y-4">
                {filteredSections.map((sec) => (
                  <div
                    key={sec.id}
                    id={sec.id}
                    className="p-4 sm:p-5 rounded-lg bg-[#0C1B2B] border border-[#1A3959] hover:border-[#00E5FF]/40 transition-colors space-y-3 scroll-mt-24"
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-[#1A3959] pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-[#00E5FF]">{sec.number}</span>
                          <h3 className="text-sm sm:text-base font-display font-bold text-[#FFFFFF]">
                            {sec.title}
                          </h3>
                        </div>
                        {sec.summary && (
                          <p className="text-xs text-[#64748B] font-mono mt-0.5">{sec.summary}</p>
                        )}
                      </div>

                      <button
                        onClick={() => handleCopySection(sec)}
                        className="px-2.5 py-1 bg-[#12283E] hover:bg-[#1A3959] text-[#94A3B8] hover:text-[#FFFFFF] rounded border border-[#1A3959] text-[11px] font-mono flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                        title="Copy clause citation to clipboard"
                      >
                        {copiedId === sec.id ? (
                          <>
                            <Check className="w-3 h-3 text-[#00FF66]" />
                            <span className="text-[#00FF66]">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-[#64748B]" />
                            <span>Copy Clause</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Clause Paragraphs */}
                    <div className="space-y-2 text-xs text-[#94A3B8] leading-relaxed font-sans">
                      {Array.isArray(sec.content) &&
                        sec.content.map((p, pIdx) => (
                          <p key={pIdx} className="text-left">
                            {p}
                          </p>
                        ))}
                    </div>

                    {/* Subsections if any */}
                    {sec.subsections && sec.subsections.length > 0 && (
                      <div className="space-y-2 pt-2">
                        {sec.subsections.map((sub, sIdx) => (
                          <div key={sIdx} className="p-3 bg-[#12283E] border border-[#1A3959] rounded space-y-1.5">
                            <div className="text-xs font-bold text-[#FFFFFF]">{sub.title}</div>
                            <ul className="space-y-1 text-xs text-[#94A3B8]">
                              {sub.points &&
                                sub.points.map((pt, ptIdx) => (
                                  <li key={ptIdx} className="flex items-start gap-2">
                                    <span className="text-[#00E5FF]">•</span>
                                    <span>{pt}</span>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Compliance Tags */}
                    {sec.complianceTags && sec.complianceTags.length > 0 && (
                      <div className="pt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                        <span className="text-[#64748B]">Enforced Controls:</span>
                        {sec.complianceTags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="px-2 py-0.5 rounded bg-[#12283E] text-[#00E5FF] border border-[#00E5FF]/20"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Bar */}
        <div className="px-6 py-3.5 bg-[#0C1B2B] border-t border-[#1A3959] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#94A3B8]">
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="flex items-center gap-1 text-[#00FF66]">
              <CheckCircle2 className="w-3.5 h-3.5" /> FIPS 140-3 Cryptography
            </span>
            <span>&bull;</span>
            <span className="text-[#64748B]">NIST SP 800-53 Rev 5 Governance</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={handleExportFullDocument}
              className="px-3 py-1.5 bg-[#12283E] hover:bg-[#1A3959] text-[#FFFFFF] rounded border border-[#1A3959] font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {downloadSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#00FF66]" />
                  <span className="text-[#00FF66]">Full Document Copied!</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-[#00E5FF]" />
                  <span>Copy Complete Legal Text</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#00E5FF] text-[#060B12] font-bold rounded hover:bg-[#33EBFF] transition-colors cursor-pointer shadow-[0_0_12px_rgba(0,229,255,0.3)]"
            >
              Acknowledge &amp; Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

