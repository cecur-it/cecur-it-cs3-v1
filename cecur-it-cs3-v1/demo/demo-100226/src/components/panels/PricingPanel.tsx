import React, { useState } from 'react';
import {
  Coins,
  Shield,
  Zap,
  CheckCircle2,
  Calculator,
  ChevronDown,
  ChevronUp,
  Brain,
  Database,
  Layers,
  Percent,
  Clock,
  TrendingDown,
  FileCheck2,
  ArrowUpRight,
  Info,
  HelpCircle,
  CreditCard,
} from 'lucide-react';
import {
  PRICING_TIERS,
  AI_METERING_CONFIG,
  PLATFORM_VALUE_PROPOSITION,
  PricingTier,
} from '../../constants/pricing';
import { PricingPaymentModal } from '../PricingPaymentModal';
import { PricingTransaction } from '../../types';

export const PricingPanel: React.FC = () => {
  // Calculator State
  const [selectedTierId, setSelectedTierId] = useState<string>('tier-2');
  const [monthlyTxCount, setMonthlyTxCount] = useState<number>(15000);
  const [annualCommitment, setAnnualCommitment] = useState<boolean>(true);

  // Payment Modal States
  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false);
  const [checkoutType, setCheckoutType] = useState<'subscription' | 'ai_credits' | 'enterprise_quote'>('subscription');
  const [checkoutTier, setCheckoutTier] = useState<PricingTier>(PRICING_TIERS[1]);
  const [selectedRefillPack, setSelectedRefillPack] = useState<{ credits: number; priceUSD: number; label: string } | undefined>(undefined);

  // Completed Transactions History State (Persisted internally)
  const [, setRecentTransactions] = useState<PricingTransaction[]>([
    {
      id: 'tx-20260830-1042',
      type: 'subscription',
      tierId: 'tier-2',
      tierName: 'Enterprise XDR Clearance (Tier 2)',
      amountUSD: 4999.00,
      billingCycle: 'ANNUAL_PREPAID',
      aiCreditsPurchased: 10000,
      paymentMethod: 'credit_card',
      billingOrg: 'CECUR Enterprise SOC',
      operatorEmail: 'admin@cecur-it.internal',
      operatorUsername: 'admin',
      operatorRole: 'admin',
      firebaseProjectId: 'cecur-it-cs3',
      firestoreDatabaseId: 'ai-studio-cecuritunifiedso-eac70f24-962a-4ae2-b704-6f0bce51392a',
      firestoreDocId: 'fs_doc_8a92f1042',
      status: 'COMPLETED',
      createdAt: '2026-08-30T14:22:10.000Z',
    },
  ]);

  // Selected Tier Reference
  const selectedTier = PRICING_TIERS.find((t) => t.id === selectedTierId) || PRICING_TIERS[1];

  // AI Refill Packs Definitions
  const AI_REFILL_PACKS = [
    { credits: 5000, priceUSD: 250, label: '5,000 AI Credits ($250)' },
    { credits: 25000, priceUSD: 1000, label: '25,000 AI Credits ($1,000)' },
    { credits: 100000, priceUSD: 3500, label: '100,000 AI Credits ($3,500)' },
  ];

  const handleOpenSubscriptionCheckout = (tier: PricingTier) => {
    setCheckoutType('subscription');
    setCheckoutTier(tier);
    setSelectedRefillPack(undefined);
    setPaymentModalOpen(true);
  };

  const handleOpenAiCreditsCheckout = (pack: { credits: number; priceUSD: number; label: string }) => {
    setCheckoutType('ai_credits');
    setCheckoutTier(selectedTier);
    setSelectedRefillPack(pack);
    setPaymentModalOpen(true);
  };

  const handleOpenEnterpriseQuoteCheckout = () => {
    setCheckoutType('enterprise_quote');
    setCheckoutTier(selectedTier);
    setSelectedRefillPack(undefined);
    setPaymentModalOpen(true);
  };

  const handleTransactionSuccess = (tx: PricingTransaction) => {
    setRecentTransactions((prev) => [tx, ...prev]);
  };

  // Calculation Logic
  const calculateCosts = () => {
    const baseCost = selectedTier.priceMonthly;

    // AI Fuel Credits Included
    let includedQuota = 0;
    if (selectedTier.id === 'tier-2') {
      includedQuota = AI_METERING_CONFIG.tier2IncludedQuota;
    } else if (selectedTier.id === 'tier-3') {
      includedQuota = AI_METERING_CONFIG.tier3IncludedQuota;
    } else {
      // Tier 1 has 0 base credits
      includedQuota = 0;
    }

    const overageTx = Math.max(0, monthlyTxCount - includedQuota);
    const rawOverageCost = overageTx * AI_METERING_CONFIG.overageRatePerTx;

    // Discount applies to prepaid/metered AI fuel packs
    const discountAmount = annualCommitment ? rawOverageCost * AI_METERING_CONFIG.annualRetainerDiscount : 0;
    const netOverageCost = Math.max(0, rawOverageCost - discountAmount);

    const totalEstimatedMonthly = baseCost + netOverageCost;

    return {
      baseCost,
      includedQuota,
      overageTx,
      rawOverageCost,
      discountAmount,
      netOverageCost,
      totalEstimatedMonthly,
    };
  };

  const costs = calculateCosts();

  return (
    <div id="pricing-panel-container" className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-[1240px] mx-auto font-sans">
      {/* 1. TOP HEADER & VALUE PROPOSITION BANNER */}
      <div className="bg-[#0C1B2B] border border-[#1A3959] border-t-2 border-t-[#00E5FF] rounded-md p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="absolute -top-12 -right-12 w-80 h-80 bg-[#00E5FF]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00E5FF]/10 border border-[#00E5FF]/30 rounded-full text-[10px] font-mono font-bold text-[#00E5FF] uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
              ECONOMICS & CONSUMPTION METERING
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[#FFFFFF] tracking-tight">
              Enterprise Tiered Pricing & AI 'Gas Fees' Metering
            </h1>
            <p className="text-sm text-[#94A3B8] max-w-3xl leading-relaxed font-sans">
              Consolidate physical OT telemetry, host SIEM, insider threat, and safe offensive recon into a predictable cost model with zero hidden fees. Metered AI triage protects SaaS margins while delivering enterprise scale.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#12283E] p-3.5 rounded-md border border-[#1A3959] shrink-0">
            <div className="p-3 bg-[#0C1B2B] rounded-md border border-[#1A3959] hover:border-[#00E5FF]/40 transition-colors text-center">
              <div className="text-[10px] font-mono font-bold text-[#94A3B8] uppercase">MTTD Benchmark</div>
              <div className="text-lg font-mono font-bold text-[#00FF66]">{PLATFORM_VALUE_PROPOSITION.cecurMTTD}</div>
              <div className="text-[10px] text-[#00FF66] font-mono">(-{PLATFORM_VALUE_PROPOSITION.mttdReduction})</div>
            </div>

            <div className="p-3 bg-[#0C1B2B] rounded-md border border-[#1A3959] hover:border-[#00E5FF]/40 transition-colors text-center">
              <div className="text-[10px] font-mono font-bold text-[#94A3B8] uppercase">MTTR SOAR</div>
              <div className="text-lg font-mono font-bold text-[#00E5FF]">{PLATFORM_VALUE_PROPOSITION.cecurMTTR}</div>
              <div className="text-[10px] text-[#94A3B8] font-mono">Automated Playbooks</div>
            </div>

            <div className="p-3 bg-[#0C1B2B] rounded-md border border-[#1A3959] hover:border-[#00E5FF]/40 transition-colors text-center">
              <div className="text-[10px] font-mono font-bold text-[#94A3B8] uppercase">AI Metered Rate</div>
              <div className="text-lg font-mono font-bold text-[#00E5FF]">${AI_METERING_CONFIG.overageRatePerTx.toFixed(2)}</div>
              <div className="text-[10px] text-[#94A3B8] font-mono">Per Transaction</div>
            </div>

            <div className="p-3 bg-[#0C1B2B] rounded-md border border-[#1A3959] hover:border-[#00E5FF]/40 transition-colors text-center">
              <div className="text-[10px] font-mono font-bold text-[#94A3B8] uppercase">Annual Discount</div>
              <div className="text-lg font-mono font-bold text-[#00FF66]">20% OFF</div>
              <div className="text-[10px] text-[#00FF66] font-mono">Prepaid AI Fuel</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. THREE ENTERPRISE PRICING TIERS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono font-bold text-[#00E5FF] uppercase tracking-widest">
              SUBSCRIPTION CLEARANCE TIERS
            </div>
            <h2 className="text-xl font-display font-extrabold text-[#FFFFFF]">
              Enterprise Tiered Pricing Structure
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Select the optimal operational clearance and fleet scale for your critical infrastructure.
            </p>
          </div>
          <span className="text-[10px] font-mono text-[#627D98] hidden sm:inline">
            Source: Section 6. Tiered RBAC/RBAM & Pricing
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PRICING_TIERS.map((tier) => {
            const isSelected = selectedTierId === tier.id;
            return (
              <div
                key={tier.id}
                id={`pricing-tier-card-${tier.id}`}
                className={`bg-[#0C1B2B] flex flex-col justify-between relative overflow-hidden transition-all p-6 rounded-md shadow-lg ${
                  tier.popular
                    ? 'border-2 border-[#00E5FF] shadow-[0_0_30px_rgba(0,229,255,0.12)]'
                    : 'border border-[#1A3959] hover:border-[#00E5FF]/50'
                }`}
              >
                {tier.popular && (
                  <div className="bg-gradient-to-r from-[#0A84FF] to-[#00E5FF] text-[#060B12] text-[10px] font-mono font-extrabold uppercase tracking-widest py-1.5 px-3 text-center -mx-6 -mt-6 mb-5 shadow-sm">
                    Most Popular for Enterprise XDR
                  </div>
                )}

                <div className="space-y-5 flex-1">
                  {/* Tier Badge & Name */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded border ${tier.badgeColor}`}>
                        {tier.badge}
                      </span>
                      <h3 className="text-lg font-display font-bold text-[#FFFFFF] mt-2">
                        {tier.name}
                      </h3>
                    </div>
                  </div>

                  {/* Pricing Display */}
                  <div className="pb-4 border-b border-[#1A3959]">
                    <div className="text-3xl font-mono font-extrabold text-[#FFFFFF] tracking-tight">
                      {tier.priceDisplay}
                    </div>
                    <div className="text-xs font-mono text-[#00E5FF] font-bold mt-1.5 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 shrink-0 text-[#00E5FF]" />
                      <span>{tier.scope}</span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-[#94A3B8] leading-relaxed font-sans">
                    {tier.description}
                  </p>

                  {/* AI Credits Callout */}
                  <div className="p-3 bg-[#12283E] border border-[#1A3959] rounded-md text-xs font-mono space-y-1">
                    <div className="text-[10px] font-mono font-bold text-[#00E5FF] uppercase tracking-wider flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5 text-[#00E5FF]" />
                      Included AI Quota
                    </div>
                    <div className="text-[#FFFFFF] font-bold">{tier.aiCreditsDisplay}</div>
                  </div>

                  {/* Bulleted Feature List */}
                  <div className="space-y-2.5">
                    <div className="text-[10px] font-mono font-bold text-[#627D98] uppercase tracking-wider">
                      Included Platform Capabilities
                    </div>
                    <ul className="space-y-2 text-xs text-[#94A3B8] font-sans">
                      {tier.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[#00E5FF] shrink-0 mt-0.5" />
                          <span className="text-[#FFFFFF]">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-5 mt-5 border-t border-[#1A3959] space-y-2">
                  <button
                    id={`btn-checkout-tier-${tier.id}`}
                    onClick={() => handleOpenSubscriptionCheckout(tier)}
                    className={`w-full py-2.5 px-4 font-extrabold text-xs font-sans rounded transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider ${
                      tier.popular
                        ? 'bg-[#00E5FF] hover:bg-[#33EBFF] text-[#060B12] shadow-md shadow-[#00E5FF]/20'
                        : tier.id === 'tier-3'
                        ? 'bg-[#0A84FF] hover:bg-[#0070E0] text-white shadow-md border border-[#00E5FF]/30'
                        : 'bg-[#12283E] hover:bg-[#16324F] text-[#FFFFFF] border border-[#1A3959] hover:border-[#00E5FF]/50'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Subscribe to {tier.name.split(' ')[0]} Now</span>
                  </button>

                  <button
                    id={`btn-select-tier-${tier.id}`}
                    onClick={() => setSelectedTierId(tier.id)}
                    className={`w-full py-2 px-3 rounded font-bold text-[11px] font-mono transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#00E5FF]/10 border border-[#00E5FF] text-[#00E5FF]'
                        : 'bg-[#0C1B2B] border border-[#1A3959] text-[#94A3B8] hover:bg-[#12283E] hover:text-[#FFFFFF]'
                    }`}
                  >
                    <Calculator className="w-3.5 h-3.5 inline mr-1" />
                    <span>{isSelected ? '✓ Loaded in Estimator Below' : 'Load Tier into Estimator'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. DYNAMIC "AI FUEL" METERING & "GAS FEES" ESTIMATOR */}
      <div className="bg-[#0C1B2B] border border-[#1A3959] border-t-2 border-t-[#00E5FF] rounded-md p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1A3959]">
          <div>
            <div className="text-[10px] font-mono font-bold text-[#00E5FF] uppercase tracking-widest">
              ESTIMATION ENGINE
            </div>
            <h2 className="text-xl font-display font-extrabold text-[#FFFFFF] flex items-center gap-2">
              Dynamic "AI Fuel" & "Gas Fees" Cost Estimator
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Estimate monthly SaaS expenditure based on metered AI incident triages and remediation script generation.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#12283E] border border-[#00E5FF]/30 text-[#00E5FF] rounded-md text-xs font-mono font-bold">
            <Brain className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span>Quota + $0.05 / Overage Tx</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls Column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Tier Selector */}
            <div>
              <label className="block text-[10px] font-mono font-bold text-[#94A3B8] uppercase mb-2">
                1. Selected Enterprise Subscription Tier
              </label>
              <div className="grid grid-cols-3 gap-2">
                {PRICING_TIERS.map((t) => (
                  <button
                    key={t.id}
                    id={`estimator-toggle-tier-${t.id}`}
                    onClick={() => setSelectedTierId(t.id)}
                    className={`p-3 rounded-md border text-left transition-all cursor-pointer ${
                      selectedTierId === t.id
                        ? 'border-[#00E5FF] bg-[#00E5FF]/15 text-[#FFFFFF] shadow-[0_0_15px_rgba(0,229,255,0.1)]'
                        : 'border-[#1A3959] bg-[#12283E] text-[#94A3B8] hover:border-[#00E5FF]/40 hover:text-[#FFFFFF]'
                    }`}
                  >
                    <div className="text-[10px] font-mono text-[#00E5FF] font-bold uppercase">{t.badge.split('•')[0]}</div>
                    <div className="text-xs font-display font-bold truncate text-[#FFFFFF]">{t.name.split(' ')[0]}</div>
                    <div className="text-xs font-mono font-bold text-[#FFFFFF] mt-1">{t.priceDisplay}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Slider for Monthly AI Transactions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono font-bold text-[#94A3B8] uppercase">
                  2. Estimated Monthly AI Operations / Transactions
                </label>
                <span className="text-xs font-mono font-bold text-[#00E5FF] bg-[#12283E] px-2.5 py-1 rounded border border-[#00E5FF]/30">
                  {monthlyTxCount.toLocaleString()} Transactions / mo
                </span>
              </div>

              <input
                id="estimator-tx-slider"
                type="range"
                min={0}
                max={100000}
                step={1000}
                value={monthlyTxCount}
                onChange={(e) => setMonthlyTxCount(Number(e.target.value))}
                className="w-full h-2 bg-[#12283E] rounded-lg appearance-none cursor-pointer accent-[#00E5FF] border border-[#1A3959]"
              />
              <div className="flex justify-between text-[10px] font-mono text-[#627D98]">
                <span>0 Tx</span>
                <span>10k (Tier 2)</span>
                <span>50k (Tier 3)</span>
                <span>100k Tx</span>
              </div>

              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-[10px] font-mono font-bold text-[#94A3B8] uppercase">Presets:</span>
                {[5000, 10000, 25000, 50000, 75000, 100000].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setMonthlyTxCount(preset)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono border transition-all cursor-pointer ${
                      monthlyTxCount === preset
                        ? 'bg-[#00E5FF] border-[#00E5FF] text-[#060B12] font-bold shadow-xs'
                        : 'bg-[#12283E] border-[#1A3959] text-[#94A3B8] hover:border-[#00E5FF]/40 hover:text-[#FFFFFF]'
                    }`}
                  >
                    {(preset / 1000).toFixed(0)}k Tx
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Annual Retainer Commitment Toggle */}
            <div className="p-4 bg-[#12283E] border border-[#1A3959] rounded-md flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-bold text-[#FFFFFF] flex items-center gap-2 font-display">
                  <Percent className="w-4 h-4 text-[#00E5FF]" />
                  Annual Compliance Retainer Commitment
                </div>
                <p className="text-[11px] text-[#94A3B8] font-sans">
                  Commit to an annual retainer to receive a <strong className="text-[#00FF66]">20% discount</strong> on prepaid AI fuel packs and overage units.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  id="estimator-annual-toggle"
                  type="checkbox"
                  checked={annualCommitment}
                  onChange={(e) => setAnnualCommitment(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#0C1B2B] border border-[#1A3959] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[#00E5FF] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#00E5FF] after:border-[#1A3959] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0A84FF]"></div>
              </label>
            </div>

            {/* Explanatory Architecture Note & AI Fuel Refill Packs */}
            <div className="space-y-3 font-sans">
              <div className="p-4 bg-[#12283E] border border-[#1A3959] rounded-md text-xs space-y-1.5">
                <div className="text-[#FFFFFF] font-bold flex items-center gap-1.5 font-display">
                  <Info className="w-4 h-4 text-[#00E5FF] shrink-0" />
                  AI Fueling & "Gas Fees" Metering Logic
                </div>
                <p className="text-[#94A3B8] text-[11px] leading-relaxed">
                  To prevent unbounded LLM inference consumption from eroding SaaS margins, each tier receives a monthly quota of AI Fuel Units (e.g., Tier 2 receives <strong className="text-[#FFFFFF]">10,000 Units</strong>, where 1 Unit = 1 Incident Triage or 1 Remediation Script Generation). Additional operations beyond quota are billed at <strong className="text-[#00E5FF] font-semibold">$0.05 per transaction</strong> or drawn from a prepaid enterprise token wallet.
                </p>
              </div>

              {/* AI Fuel Refill Packs */}
              <div className="p-4 bg-[#12283E] border border-[#1A3959] rounded-md space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-[#00E5FF] uppercase tracking-wider flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-[#00E5FF]" />
                    Instant AI Fuel Credits Refill Packs
                  </span>
                  <span className="text-[10px] font-mono text-[#00FF66] font-bold">PREPAID DISCOUNTS</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {AI_REFILL_PACKS.map((pack, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleOpenAiCreditsCheckout(pack)}
                      className="p-3 bg-[#0C1B2B] hover:bg-[#16324F] border border-[#1A3959] hover:border-[#00E5FF] rounded-md text-left transition-all cursor-pointer group shadow-xs"
                    >
                      <div className="text-xs font-display font-bold text-[#FFFFFF] group-hover:text-[#00E5FF]">
                        {pack.credits.toLocaleString()} AI Fuel
                      </div>
                      <div className="text-xs font-mono font-bold text-[#00E5FF] mt-0.5">
                        ${pack.priceUSD} USD
                      </div>
                      <div className="text-[10px] text-[#94A3B8] group-hover:text-[#BAE3FF] font-mono mt-1 flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-[#00E5FF]" />
                        <span>Pay & Refill</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Calculation Summary Breakdown Column */}
          <div className="lg:col-span-5 bg-[#12283E] border border-[#1A3959] rounded-md p-5 flex flex-col justify-between space-y-6 shadow-md">
            <div className="space-y-4">
              <div className="pb-3 border-b border-[#1A3959] flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-[#00E5FF] uppercase tracking-wider">
                  Monthly Cost Breakdown
                </span>
                <span className="text-[10px] font-mono bg-[#0C1B2B] text-[#94A3B8] px-2 py-0.5 rounded border border-[#1A3959] font-bold">
                  ESTIMATED BILL
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                {/* Base Subscription Cost */}
                <div className="flex items-center justify-between py-1">
                  <span className="text-[#94A3B8]">Base Tier Subscription ({selectedTier.name.split(' ')[0]})</span>
                  <span className="text-[#FFFFFF] font-bold">${costs.baseCost.toLocaleString()}</span>
                </div>

                {/* Included AI Quota */}
                <div className="flex items-center justify-between py-1 text-[#94A3B8]">
                  <span>Included AI Quota</span>
                  <span className="text-[#00E5FF] font-bold">
                    {costs.includedQuota > 0 ? `${costs.includedQuota.toLocaleString()} Units` : 'Baseline / Metered (0 Units)'}
                  </span>
                </div>

                {/* Overage Tx Count */}
                <div className="flex items-center justify-between py-1 text-[#94A3B8]">
                  <span>Metered Overage Tx ({monthlyTxCount.toLocaleString()} - {costs.includedQuota.toLocaleString()})</span>
                  <span className="text-[#FFFFFF] font-bold">{costs.overageTx.toLocaleString()} Tx</span>
                </div>

                {/* Raw Overage Cost */}
                {costs.overageTx > 0 && (
                  <div className="flex items-center justify-between py-1 text-[#94A3B8]">
                    <span>Overage Billing ($0.05 / Tx)</span>
                    <span className="text-[#FFFFFF] font-bold">${costs.rawOverageCost.toFixed(2)}</span>
                  </div>
                )}

                {/* Discount */}
                {annualCommitment && costs.discountAmount > 0 && (
                  <div className="flex items-center justify-between py-1 text-[#00FF66] bg-[#0C1B2B] px-2.5 py-1 rounded border border-[#00FF66]/30">
                    <span>Annual Retainer Discount (20%)</span>
                    <span className="font-bold">-${costs.discountAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-[#1A3959]" />

                {/* Net Total */}
                <div className="p-4 bg-[#0C1B2B] border border-[#00E5FF]/40 rounded-md space-y-1 shadow-[0_0_20px_rgba(0,229,255,0.08)]">
                  <div className="text-[10px] font-mono font-bold text-[#94A3B8] uppercase">Estimated Monthly Invoice</div>
                  <div className="text-2xl sm:text-3xl font-bold font-mono text-[#00E5FF]">
                    ${costs.totalEstimatedMonthly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span className="text-xs text-[#94A3B8] font-normal"> / mo</span>
                  </div>
                  {annualCommitment && (
                    <div className="text-[10px] font-mono text-[#00FF66] font-bold">
                      ✓ Includes 20% annual retainer discount on prepaid AI fuel packs
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#1A3959] space-y-2">
              <button
                id="btn-generate-enterprise-quote"
                onClick={handleOpenEnterpriseQuoteCheckout}
                className="w-full py-3 bg-[#00E5FF] hover:bg-[#33EBFF] text-[#060B12] font-extrabold text-xs rounded transition-all flex items-center justify-center gap-2 cursor-pointer font-sans shadow-lg shadow-[#00E5FF]/20 uppercase tracking-wider"
              >
                <FileCheck2 className="w-4 h-4 text-[#060B12]" />
                <span>Generate Official Enterprise Quote / Order</span>
              </button>
              <p className="text-[10px] font-mono text-[#627D98] text-center">
                All pricing backed by SOC SLA & CS3 Cloud Security persistence
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RENDER PAYMENT MODAL */}
      <PricingPaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        checkoutType={checkoutType}
        tier={checkoutTier}
        annualCommitment={annualCommitment}
        selectedAiRefillPack={selectedRefillPack}
        onSuccess={handleTransactionSuccess}
      />
    </div>
  );
};

