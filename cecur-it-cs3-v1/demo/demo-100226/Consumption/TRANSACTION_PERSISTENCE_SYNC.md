# Recent Transaction & Firestore Persistence Sync Specification

## Overview

This specification details the payment processing workflow, database persistence model, and Firebase Firestore auditing mechanisms for enterprise subscription orders and AI credit pack purchases.

---

## Transaction Data Model

All payment events processed through the Enterprise Payment Gateway are validated and recorded in the Firebase Firestore `transactions` collection.

### Document Interface Schema
```typescript
export interface PricingTransaction {
  id: string;                      // Unique Transaction Reference (e.g. 'tx-20260830-1042')
  type: 'subscription' | 'ai_credits' | 'enterprise_quote';
  tierId: string;                  // Target Tier ID ('tier-1', 'tier-2', 'tier-3')
  tierName: string;                // Display Name of Purchased Tier
  amountUSD: number;               // Total USD Transaction Amount
  billingCycle: 'MONTHLY' | 'ANNUAL_PREPAID';
  aiCreditsPurchased: number;      // Quantity of AI Fuel Credits Included/Refilled
  paymentMethod: 'credit_card' | 'procurement_po' | 'ach_transfer';
  billingOrg: string;              // Purchasing Entity Name
  operatorEmail: string;           // Operator Identity Email
  operatorUsername: string;        // Active User Session Name
  operatorRole: string;            // User RBAC Role
  firebaseProjectId: string;       // Firebase Project Identifier
  firestoreDatabaseId: string;     // Firestore Database Instance ID
  firestoreDocId?: string;         // Generated Document Reference ID in Firestore
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  createdAt: string;               // ISO 8601 Timestamp
}
```

---

## Firestore Database Configuration

- **Collection Path**: `transactions/{docId}`
- **Database Scope**: `ai-studio-cecuritunifiedso-eac70f24-962a-4ae2-b704-6f0bce51392a`
- **Security Rule Enforcement**:
  ```protobuf
  match /transactions/{transactionId} {
    allow read: if request.auth != null;
    allow create: if request.auth != null && request.resource.data.status == 'COMPLETED';
    allow update, delete: if false; // Immutable Audit Trail
  }
  ```

---

## Billing & Audit Workflows

1. **Checkout Event Trigger**: Operator completes modal form in Enterprise Payment Gateway.
2. **Payment Authorization**: Validation of payment instrument (Credit Card / PO / ACH).
3. **Firestore Sync**: Automatic document insertion into `transactions` collection via `/api/cecur/transactions` endpoint using backend environment credentials (`FIREBASE_DATABASE_ID`, `FIREBASE_API_KEY`).
4. **Receipt Generation**: Transaction receipt generated with document ID, timestamp, and JSON download capability.
