import React, { useState } from 'react';
import { 
  Send, Copy, Check, ArrowUp, Building2, User, Phone, FileText, ArrowUpRight, ChevronDown, ChevronUp
} from 'lucide-react';

export const EngagementSection: React.FC = () => {
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [showCustomizer, setShowCustomizer] = useState(false);

  // Form State for dynamic briefing customization
  const [orgName, setOrgName] = useState('');
  const [sector, setSector] = useState('FinTech & Banking');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [securityStack, setSecurityStack] = useState('');
  const [painPoints, setPainPoints] = useState('');

  // Default Email Template with exact %0A URL encoding
  const buildMailtoUrl = () => {
    const org = orgName.trim() || '[Insert Organization Name]';
    const sect = sector.trim() || '[Insert Sector]';
    const contact = contactName.trim() || '[Insert Name]';
    const tel = phone.trim() || '[Insert Phone]';
    const stack = securityStack.trim() || '[Insert Existing Tools]';
    const pains = painPoints.trim() || '[Insert details regarding AML, Compliance, OT/IT gaps, etc.]';

    const subject = encodeURIComponent(`CS3 Platform Briefing Request - ${org}`);
    
    // Explicit %0A formatting for newline stability across all mail clients
    const bodyLines = [
      'Hello CECUR-IT Team,',
      '',
      'We are interested in a briefing for the CS3 (Consolidated Security Sensor Suite) platform.',
      '',
      'Please find our details below:',
      '',
      `Organization Name: ${org}`,
      `Sector (FinTech / Federal / Crypto / Critical Infra): ${sect}`,
      `Primary Contact: ${contact}`,
      `Phone Number: ${tel}`,
      '',
      `Current Security Stack (Optional): ${stack}`,
      `Specific Pain Points (Optional): ${pains}`,
      '',
      'Thank you,',
      contact
    ];

    const bodyEncoded = bodyLines.map(line => encodeURIComponent(line)).join('%0A');

    return `mailto:contact@cecur-it.io?subject=${subject}&body=${bodyEncoded}`;
  };

  const rawTemplate = `Hello CECUR-IT Team,

We are interested in a briefing for the CS3 (Consolidated Security Sensor Suite) platform.

Please find our details below:

Organization Name: [Insert Company/Agency Name]
Sector (FinTech / Federal / Crypto / Critical Infra): [Insert Sector]
Primary Contact: [Insert Name]
Phone Number: [Insert Phone]

Current Security Stack (Optional): [Insert Existing Tools]
Specific Pain Points (Optional): [Insert details regarding AML, Compliance, OT/IT gaps, etc.]

Thank you,
[Insert Name]`;

  const copyTemplateToClipboard = () => {
    navigator.clipboard.writeText(rawTemplate);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2500);
  };

  const copyEmailToClipboard = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const secondaryEmails = [
    { label: 'Partnerships', email: 'partners@cecur-it.io' },
    { label: 'Sales', email: 'sales@cecur-it.io' },
    { label: 'Security Intelligence', email: 'security@cecur-it.io' },
    { label: 'Compliance & Audit', email: 'compliance@cecur-it.io' },
    { label: 'Direct Operations', email: 'contact@cecur-it.io' },
  ];

  return (
    <section
      id="engagement"
      className="relative py-20 lg:py-28 border-b border-slate-800/80 bg-[#050914]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="mb-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-[#22d3ee] text-xs font-sans font-medium tracking-wide">
            <span>Pillar VI • Briefing Request &amp; Engagement</span>
          </div>
        </div>

        {/* Headline with CTA Button */}
        <div className="rounded-2xl bg-[#070e1b] border border-slate-800 p-8 sm:p-12 lg:p-14 shadow-2xl relative overflow-hidden mb-12">
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 lg:gap-12">
            
            {/* Left Area: Headline & Sub-text */}
            <div className="max-w-3xl space-y-4">
              <h2
                id="engagement-headline"
                className="text-3xl sm:text-4xl lg:text-5xl font-heading font-extrabold text-white tracking-tight leading-[1.18] text-left"
              >
                Bring the risk conversation to someone who has certified the system, not just scanned it.
              </h2>

              <p
                id="engagement-subtext"
                className="text-base sm:text-lg text-slate-300 font-sans leading-relaxed text-left"
              >
                Thirty-five years of experience, direct principal architect contact, and a battle-tested methodology for infrastructure that cannot afford downtime.
              </p>
            </div>

            {/* Right Area: Large [ REQUEST A BRIEFING ↗ ] Button */}
            <div className="shrink-0 flex flex-col items-start lg:items-end">
              <a
                id="contact-briefing-cta-btn"
                href={buildMailtoUrl()}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg text-sm sm:text-base font-semibold uppercase tracking-wider text-slate-950 bg-[#22d3ee] hover:bg-[#67e8f9] transition-all shadow-[0_0_30px_rgba(34,211,238,0.4)] hover:shadow-[0_0_40px_rgba(34,211,238,0.7)] active:scale-95 cursor-pointer whitespace-nowrap font-sans"
              >
                <span>Request a Briefing</span>
                <ArrowUpRight className="w-4 h-4" />
              </a>

              <div className="text-xs text-slate-400 mt-2.5 text-left lg:text-right font-sans">
                Direct Dispatch: <strong className="text-cyan-300 font-mono">contact@cecur-it.io</strong>
              </div>
            </div>

          </div>

          {/* Secondary Links Listed Below the Button Area */}
          <div className="mt-10 pt-8 border-t border-slate-800">
            <div className="text-xs font-sans uppercase font-semibold text-[#22d3ee] tracking-wider mb-4 text-left">
              Direct Practice &amp; Department Channels
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {secondaryEmails.map((item) => (
                <div
                  key={item.label}
                  className="p-3.5 rounded-xl bg-[#050914] border border-slate-800 hover:border-cyan-500/40 transition-all flex flex-col justify-between"
                >
                  <div className="text-xs font-sans text-slate-400 font-medium">
                    {item.label}
                  </div>
                  <div className="flex items-center justify-between mt-1.5 gap-1">
                    <a
                      href={`mailto:${item.email}`}
                      className="text-xs font-mono text-[#22d3ee] hover:underline truncate"
                    >
                      {item.email}
                    </a>
                    <button
                      onClick={() => copyEmailToClipboard(item.email)}
                      className="p-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0 cursor-pointer"
                      title={`Copy ${item.email}`}
                    >
                      {copiedEmail === item.email ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Optional Briefing Customizer Accordion */}
        <div className="mb-10">
          <div className="rounded-xl bg-[#070e1b] border border-slate-800 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCustomizer(!showCustomizer)}
              className="w-full p-5 sm:p-6 flex items-center justify-between text-left hover:bg-slate-900/40 transition-colors cursor-pointer"
            >
              <div>
                <h4 className="text-base sm:text-lg font-heading font-bold text-white">
                  Customize Briefing Request Parameters
                </h4>
                <p className="text-xs sm:text-sm text-slate-400 font-sans mt-0.5">
                  Pre-fill scope, sector, and tooling specs directly into your email client
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-sans font-medium text-[#22d3ee]">
                <span>{showCustomizer ? "Collapse Form" : "Open Customizer"}</span>
                {showCustomizer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showCustomizer && (
              <div className="p-6 sm:p-8 border-t border-slate-800 bg-[#050b16] animate-fadeIn">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  
                  {/* Left Column: Form */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-sans font-medium text-slate-300 mb-1.5 text-left">
                          Organization Name
                        </label>
                        <div className="relative">
                          <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                          <input
                            type="text"
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            placeholder="e.g. Apex Defense / Horizon Bank"
                            className="w-full bg-[#050914] border border-slate-700 rounded-lg px-3 py-2 pl-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#22d3ee] font-sans"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-sans font-medium text-slate-300 mb-1.5 text-left">
                          Operational Sector
                        </label>
                        <select
                          value={sector}
                          onChange={(e) => setSector(e.target.value)}
                          className="w-full bg-[#050914] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#22d3ee] font-sans"
                        >
                          <option value="FinTech & Banking">FinTech &amp; Banking</option>
                          <option value="Federal / DoD / GovCloud">Federal / DoD / GovCloud</option>
                          <option value="Cryptographic & Blockchain">Cryptographic &amp; Blockchain</option>
                          <option value="Critical Infrastructure (ICS/SCADA)">Critical Infrastructure (ICS/SCADA)</option>
                          <option value="Private / Hybrid Enterprise">Private / Hybrid Enterprise</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-sans font-medium text-slate-300 mb-1.5 text-left">
                          Primary Contact Name
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                          <input
                            type="text"
                            value={contactName}
                            onChange={(e) => setContactName(e.target.value)}
                            placeholder="e.g. Director J. Vance"
                            className="w-full bg-[#050914] border border-slate-700 rounded-lg px-3 py-2 pl-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#22d3ee] font-sans"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-sans font-medium text-slate-300 mb-1.5 text-left">
                          Phone Number
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                          <input
                            type="text"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="e.g. +1 (555) 019-2834"
                            className="w-full bg-[#050914] border border-slate-700 rounded-lg px-3 py-2 pl-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#22d3ee] font-sans"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-sans font-medium text-slate-300 mb-1.5 text-left">
                        Current Security Stack (Optional)
                      </label>
                      <input
                        type="text"
                        value={securityStack}
                        onChange={(e) => setSecurityStack(e.target.value)}
                        placeholder="e.g. Splunk, Palo Alto, CrowdStrike, Qubes, Nano-VM"
                        className="w-full bg-[#050914] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#22d3ee] font-sans"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-sans font-medium text-slate-300 mb-1.5 text-left">
                        Specific Objectives &amp; Vulnerability Areas (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={painPoints}
                        onChange={(e) => setPainPoints(e.target.value)}
                        placeholder="e.g. Real-time AML latency, FedRAMP High ATO timeline, Substation Modbus vulnerability"
                        className="w-full bg-[#050914] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#22d3ee] font-sans"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <a
                        href={buildMailtoUrl()}
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-950 bg-[#22d3ee] hover:bg-[#67e8f9] rounded-lg shadow transition-all cursor-pointer font-sans"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Launch Tailored Email</span>
                      </a>

                      <button
                        type="button"
                        onClick={copyTemplateToClipboard}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-sans font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-700 hover:border-slate-600 transition-all cursor-pointer"
                      >
                        {copiedTemplate ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Template Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Copy Email Template</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Template Preview Box */}
                  <div className="lg:col-span-5">
                    <div className="p-5 rounded-xl bg-[#070e1b] border border-slate-800">
                      <div className="flex items-center justify-between mb-3 text-xs text-slate-400 font-sans">
                        <span className="flex items-center gap-1.5 text-[#22d3ee] font-medium">
                          <FileText className="w-4 h-4" /> Official Briefing Template
                        </span>
                        <span className="text-slate-500 font-mono text-[10px]">RFC 2822</span>
                      </div>

                      <pre className="p-3.5 rounded-lg bg-[#050914] border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed whitespace-pre-wrap text-left">
                        {rawTemplate}
                      </pre>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>

        {/* Back to top row */}
        <div className="text-center">
          <button
            onClick={scrollToTop}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-sans uppercase font-medium text-slate-400 hover:text-[#22d3ee] bg-[#070e1b] border border-slate-800 hover:border-cyan-500/40 transition-all cursor-pointer"
          >
            <span>Back to Top</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </section>
  );
};
