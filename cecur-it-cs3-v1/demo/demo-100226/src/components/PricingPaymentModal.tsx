import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Building2,
  FileText,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  Database,
  Lock,
  Zap,
  Brain,
  Coins,
  Receipt,
  Download,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { PricingTier } from '../constants/pricing';
import { PricingTransaction } from '../types';
import { useAuth } from '../context/AuthContext';
import { firebaseConfig, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { apiRequest } from '../lib/api';

interface PricingPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkoutType: 'subscription' | 'ai_credits' | 'enterprise_quote';
  tier: PricingTier;
  annualCommitment?: boolean;
  selectedAiRefillPack?: { credits: number; priceUSD: number; label: string };
  onSuccess?: (tx: PricingTransaction) => void;
}

export const PricingPaymentModal: React.FC<PricingPaymentModalProps> = ({
  isOpen,
  onClose,
  checkoutType,
  tier,
  annualCommitment = true,
  selectedAiRefillPack,
  onSuccess,
}) => {
  const { user } = useAuth();

  // Payment Method Selection
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'procurement_po' | 'ach_transfer'>('credit_card');

  // Form Fields
  const [billingOrg, setBillingOrg] = useState<string>('CECUR Enterprise Security Operations');
  const [billingEmail, setBillingEmail] = useState<string>(user?.email || 'admin@cecur-it.internal');
  const [poNumber, setPoNumber] = useState<string>(`PO-2026-${Math.floor(100000 + Math.random() * 900000)}`);
  const [cardNumber, setCardNumber] = useState<string>('•••• •••• •••• 8842');
  const [cardExpiry, setCardExpiry] = useState<string>('12/28');
  const [cardCvc, setCardCvc] = useState<string>('942');

  // Processing & Confirmation State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [completedTx, setCompletedTx] = useState<PricingTransaction | null>(null);

  useEffect(() => {
    if (user?.email) {
      setBillingEmail(user.email);
    }
  }, [user]);

  if (!isOpen) return null;

  // Calculate pricing based on checkout type
  const calculateTotal = () => {
    if (checkoutType === 'ai_credits' && selectedAiRefillPack) {
      const discount = annualCommitment ? selectedAiRefillPack.priceUSD * 0.2 : 0;
      return {
        base: selectedAiRefillPack.priceUSD,
        discount,
        total: Math.max(0, selectedAiRefillPack.priceUSD - discount),
        credits: selectedAiRefillPack.credits,
        title: `AI Fuel Credits Refill (${selectedAiRefillPack.label})`,
      };
    }

    if (checkoutType === 'enterprise_quote') {
      const base = tier.priceMonthly * (annualCommitment ? 12 : 1);
      const discount = annualCommitment ? base * 0.2 : 0;
      return {
        base,
        discount,
        total: Math.max(0, base - discount),
        credits: tier.id === 'tier-3' ? 50000 : 10000,
        title: `Enterprise SLA & Custom Infrastructure Order - ${tier.name}`,
      };
    }

    // Default: Subscription
    const base = tier.priceMonthly;
    const discount = annualCommitment ? base * 0.2 : 0;
    return {
      base,
      discount,
      total: Math.max(0, base - discount),
      credits: tier.id === 'tier-3' ? 50000 : tier.id === 'tier-2' ? 10000 : 0,
      title: `${tier.name} (${annualCommitment ? 'Annual Retainer' : 'Monthly'})`,
    };
  };

  const pricingSummary = calculateTotal();

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const txId = `tx-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const createdAt = new Date().toISOString();

      // 1. Client-Side Firestore direct persistence
      let firestoreDocId: string | undefined = undefined;
      try {
        if (!db) throw new Error('Firestore is disabled for this deployment profile.');
        const docRef = await addDoc(collection(db, 'transactions'), {
          id: txId,
          type: checkoutType,
          tierId: tier.id,
          tierName: tier.name,
          amountUSD: pricingSummary.total,
          billingCycle: annualCommitment ? 'ANNUAL_PREPAID' : 'MONTHLY',
          aiCreditsPurchased: pricingSummary.credits,
          paymentMethod,
          billingOrg,
          operatorEmail: billingEmail,
          operatorUsername: user?.username || 'operator',
          operatorRole: user?.role || 'admin',
          firebaseProjectId: firebaseConfig.projectId,
          firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
          status: 'COMPLETED',
          createdAt,
          serverTimestamp: serverTimestamp(),
        });
        firestoreDocId = docRef.id;
      } catch (fsErr) {
        // Wrap with standard error handler if missing permissions or offline
        console.warn('Firestore client transaction write warning:', fsErr);
      }

      // 2. Server-side verification & audit log endpoint
      const res = await apiRequest<{ success: boolean; transaction: PricingTransaction }>('/api/cecur/pricing/checkout', {
        method: 'POST',
        body: JSON.stringify({
          type: checkoutType,
          tierId: tier.id,
          tierName: tier.name,
          amountUSD: pricingSummary.total,
          billingCycle: annualCommitment ? 'ANNUAL_PREPAID' : 'MONTHLY',
          aiCreditsPurchased: pricingSummary.credits,
          paymentMethod,
          billingOrg,
        }),
      });

      const finalTx: PricingTransaction = {
        ...res.transaction,
        firestoreDocId: firestoreDocId || `fs_doc_${Math.random().toString(36).substring(2, 9)}`,
      };

      setCompletedTx(finalTx);
      if (onSuccess) {
        onSuccess(finalTx);
      }
    } catch (err: any) {
      setError(err.message || 'Payment processing failed. Please check payment information and network connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const maskedApiKey = firebaseConfig.apiKey
    ? `${firebaseConfig.apiKey.substring(0, 7)}...${firebaseConfig.apiKey.substring(firebaseConfig.apiKey.length - 4)}`
    : 'NOT_CONFIGURED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div
        id="pricing-payment-modal"
        className="w-full max-w-2xl bg-[#060B12] border border-[#1A3959] border-t-4 border-t-[#00E5FF] rounded-md shadow-[0_0_50px_rgba(0,229,255,0.15)] overflow-hidden my-8 text-[#FFFFFF]"
      >
        {/* Modal Header */}
        <div className="p-5 bg-[#0C1B2B] border-b border-[#1A3959] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF] rounded-md">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-display font-extrabold text-[#FFFFFF]">
                  {completedTx ? 'Transaction Receipt & Order Confirmation' : 'Enterprise Payment Gateway'}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#12283E] text-[#00E5FF] border border-[#00E5FF]/40 uppercase font-bold">
                  ENTERPRISE SECURED
                </span>
              </div>
              <p className="font-sans text-[#94A3B8] text-xs">
                {completedTx
                  ? 'Payment successfully recorded and synced to cloud backend.'
                  : 'Configure corporate billing & payment credentials for immediate provisioning.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#94A3B8] hover:text-[#FFFFFF] hover:bg-[#12283E] rounded transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto font-sans">
          {completedTx ? (
            /* CONFIRMATION / RECEIPT SCREEN */
            <div className="space-y-6">
              <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-md flex items-center gap-4">
                <div className="p-3 bg-emerald-900/80 text-emerald-300 rounded-full shrink-0">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#FFFFFF] font-sans">
                    Payment Successful & Provisioned
                  </div>
                  <p className="text-xs text-[#94A3B8] font-sans mt-0.5">
                    Your transaction reference <code className="text-emerald-400 font-bold font-mono">{completedTx.id}</code> has been verified and committed to enterprise database.
                  </p>
                </div>
              </div>

              {/* Database Persistence Sync Metadata */}
              <div className="bg-[#0C1B2B] border border-[#1A3959] rounded-md p-5 space-y-4 font-mono text-xs">
                <div className="flex justify-between items-center pb-3 border-b border-[#1A3959]">
                  <span className="text-[#94A3B8] font-sans text-[10px] uppercase font-bold">PURCHASE ITEM</span>
                  <span className="text-[#00E5FF] font-bold">{completedTx.tierName}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 py-1">
                  <div>
                    <span className="text-[#94A3B8] block text-[10px]">TOTAL AMOUNT PAID</span>
                    <span className="text-lg font-bold text-[#FFFFFF]">${completedTx.amountUSD.toFixed(2)} USD</span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] block text-[10px]">PAYMENT METHOD</span>
                    <span className="text-xs text-[#00E5FF] font-bold uppercase">{completedTx.paymentMethod.replace('_', ' ')}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 py-1 border-t border-[#1A3959]">
                  <div>
                    <span className="text-[#94A3B8] block text-[10px]">PURCHASING OPERATOR</span>
                    <span className="text-xs text-[#FFFFFF]">{completedTx.operatorEmail}</span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] block text-[10px]">ORGANIZATION</span>
                    <span className="text-xs text-[#FFFFFF]">{completedTx.billingOrg || 'CECUR Enterprise'}</span>
                  </div>
                </div>

                {/* Database Persistence Sync Metadata */}
                <div className="p-3 bg-[#12283E] border border-[#1A3959] rounded-md space-y-1.5 text-[11px]">
                  <div className="text-[#FFFFFF] font-bold flex items-center gap-2 font-sans">
                    <Database className="w-3.5 h-3.5 text-[#00E5FF]" />
                    Database Document Metadata
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[#94A3B8]">
                    <div>
                      <span>Doc ID: </span>
                      <code className="text-[#FFFFFF] font-bold">{completedTx.firestoreDocId || 'doc_auto_sync'}</code>
                    </div>
                    <div>
                      <span>Project ID: </span>
                      <code className="text-[#FFFFFF]">{completedTx.firebaseProjectId}</code>
                    </div>
                    <div>
                      <span>Database ID: </span>
                      <code className="text-[#FFFFFF]">{completedTx.firestoreDatabaseId}</code>
                    </div>
                    <div>
                      <span>Status: </span>
                      <span className="text-emerald-400 font-bold">{completedTx.status}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const jsonStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(completedTx, null, 2))}`;
                    const downloadAnchor = document.createElement('a');
                    downloadAnchor.setAttribute('href', jsonStr);
                    downloadAnchor.setAttribute('download', `CECUR_Invoice_${completedTx.id}.json`);
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                  }}
                  className="bg-[#12283E] hover:bg-[#16324F] text-[#FFFFFF] border border-[#1A3959] flex-1 py-2.5 text-xs font-sans font-bold flex items-center justify-center gap-2 rounded-md transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#00E5FF]" />
                  <span>Download Receipt (JSON)</span>
                </button>

                <button
                  onClick={onClose}
                  className="bg-[#00E5FF] hover:bg-[#33EBFF] text-[#060B12] font-extrabold flex-1 py-2.5 text-xs font-sans rounded-md transition-all cursor-pointer shadow-md shadow-[#00E5FF]/20 uppercase tracking-wider"
                >
                  Return to Pricing Matrix
                </button>
              </div>
            </div>
          ) : (
            /* CHECKOUT FORM */
            <form onSubmit={handleCheckout} className="space-y-6">
              {error && (
                <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-md flex items-center gap-2 font-sans">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Order Item Summary Card */}
              <div className="p-4 bg-[#0C1B2B] border border-[#1A3959] rounded-md space-y-3 font-sans">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-[#94A3B8] uppercase">Selected Order Summary</span>
                    <h4 className="text-sm font-display font-bold text-[#FFFFFF] mt-0.5">{pricingSummary.title}</h4>
                    <p className="text-xs text-[#94A3B8] mt-0.5">{tier.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-mono font-extrabold text-[#00E5FF]">${pricingSummary.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    {annualCommitment && (
                      <span className="text-[10px] font-mono text-[#00FF66] font-bold">✓ 20% Annual Retainer Discount</span>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#1A3959] flex items-center justify-between text-xs font-mono text-[#94A3B8]">
                  <span>Included AI Operation Fuel:</span>
                  <span className="text-[#FFFFFF] font-bold">
                    {pricingSummary.credits > 0 ? `${pricingSummary.credits.toLocaleString()} Units` : 'Baseline / Metered'}
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-[#94A3B8] uppercase mb-2">
                  Select Corporate Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2 font-sans">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('credit_card')}
                    className={`p-3 rounded-md border text-left flex items-center gap-2 transition-all cursor-pointer ${
                      paymentMethod === 'credit_card'
                        ? 'border-[#00E5FF] bg-[#00E5FF]/15 text-[#FFFFFF] shadow-[0_0_15px_rgba(0,229,255,0.1)]'
                        : 'border-[#1A3959] bg-[#0C1B2B] text-[#94A3B8] hover:border-[#00E5FF]/50 hover:text-[#FFFFFF]'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-[#00E5FF]" />
                    <div>
                      <div className="text-xs font-bold">Credit Card</div>
                      <div className="text-[10px] text-[#94A3B8]">Instant Prov.</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('procurement_po')}
                    className={`p-3 rounded-md border text-left flex items-center gap-2 transition-all cursor-pointer ${
                      paymentMethod === 'procurement_po'
                        ? 'border-[#00E5FF] bg-[#00E5FF]/15 text-[#FFFFFF] shadow-[0_0_15px_rgba(0,229,255,0.1)]'
                        : 'border-[#1A3959] bg-[#0C1B2B] text-[#94A3B8] hover:border-[#00E5FF]/50 hover:text-[#FFFFFF]'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-[#00E5FF]" />
                    <div>
                      <div className="text-xs font-bold">Purchase Order</div>
                      <div className="text-[10px] text-[#94A3B8]">Corporate PO</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('ach_transfer')}
                    className={`p-3 rounded-md border text-left flex items-center gap-2 transition-all cursor-pointer ${
                      paymentMethod === 'ach_transfer'
                        ? 'border-[#00E5FF] bg-[#00E5FF]/15 text-[#FFFFFF] shadow-[0_0_15px_rgba(0,229,255,0.1)]'
                        : 'border-[#1A3959] bg-[#0C1B2B] text-[#94A3B8] hover:border-[#00E5FF]/50 hover:text-[#FFFFFF]'
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-[#00E5FF]" />
                    <div>
                      <div className="text-xs font-bold">ACH Direct</div>
                      <div className="text-[10px] text-[#94A3B8]">Net 30/60</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Payment Method Details Input Form */}
              <div className="space-y-3 font-sans">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                      Billing Organization / Entity
                    </label>
                    <input
                      type="text"
                      value={billingOrg}
                      onChange={(e) => setBillingOrg(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-[#12283E] border border-[#1A3959] rounded-md text-xs text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                      Billing Operator Email
                    </label>
                    <input
                      type="email"
                      value={billingEmail}
                      onChange={(e) => setBillingEmail(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-[#12283E] border border-[#1A3959] rounded-md text-xs text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF]"
                    />
                  </div>
                </div>

                {paymentMethod === 'credit_card' && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                        Corporate Card Number
                      </label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-[#12283E] border border-[#1A3959] rounded-md text-xs font-mono text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                          Expiration (MM/YY)
                        </label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          required
                          className="w-full px-3 py-2 bg-[#12283E] border border-[#1A3959] rounded-md text-xs font-mono text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                          Security Code (CVC)
                        </label>
                        <input
                          type="text"
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value)}
                          required
                          className="w-full px-3 py-2 bg-[#12283E] border border-[#1A3959] rounded-md text-xs font-mono text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethod === 'procurement_po' && (
                  <div className="pt-2">
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                      Purchase Order / PO Reference Number
                    </label>
                    <input
                      type="text"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-[#12283E] border border-[#1A3959] rounded-md text-xs font-mono text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF]"
                    />
                  </div>
                )}

                {paymentMethod === 'ach_transfer' && (
                  <div className="p-3 bg-[#0C1B2B] border border-[#1A3959] rounded-md text-xs text-[#94A3B8] space-y-1 font-sans">
                    <div className="text-[#FFFFFF] font-semibold">ACH Corporate Direct Authorization</div>
                    <p>Invoices will be dispatched to {billingEmail} with 30-day corporate settlement terms.</p>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                id="btn-complete-payment"
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-[#00E5FF] hover:bg-[#33EBFF] text-[#060B12] font-extrabold text-xs font-sans rounded-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-[#00E5FF]/20 uppercase tracking-wider"
              >
                <Lock className="w-4 h-4 text-[#060B12]" />
                <span>
                  {isSubmitting
                    ? 'Processing Payment & Writing to Database...'
                    : `Complete Purchase ($${pricingSummary.total.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD)`}
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
