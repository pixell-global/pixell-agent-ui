/**
 * Types for subscription reconciliation
 *
 * NOTE FOR AI AGENTS:
 * Stripe is the Single Source of Truth (SSoT) for all subscription data.
 * This reconciliation job ensures our database stays in sync with Stripe.
 *
 * Sync Flow:
 * 1. Primary: Webhooks update DB when Stripe events occur
 * 2. Backup: This Lambda runs weekly (Sundays 3am UTC) to catch any missed events
 * 3. On conflict: Stripe data ALWAYS overwrites database data
 */

export interface ReconciliationResult {
  totalOrganizations: number;
  synchronized: number;
  errors: number;
  skipped: number;
  details: ReconciliationDetail[];
}

export interface ReconciliationDetail {
  orgId: string;
  action: 'synced' | 'skipped' | 'error';
  changes?: SubscriptionChanges;
  error?: string;
}

export interface SubscriptionChanges {
  field: string;
  from: any;
  to: any;
}

export interface StripeSubscriptionData {
  subscriptionId: string;
  customerId: string;
  tier: 'free' | 'starter' | 'pro' | 'max';
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export interface DatabaseSubscriptionData {
  orgId: string;
  planTier: string | null;
  status: string | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean | null;
}
