// /types/paymongo-webhook-extended.ts

import { Prisma } from '@prisma/client';

// Base webhook structure
export interface WebhookEvent {
  data: {
    id: string;
    type: 'event';
    attributes: {
      type: string;
      livemode: boolean;
      data: {
        id: string;
        type: string;
        attributes: CheckoutSessionWebhookData | PayMongoPaymentAttributes;
      };
      created_at: number;
      updated_at: number;
    };
  };
}

// Enhanced Checkout Session Data
export interface CheckoutSessionWebhookData {
  checkout_url?: string;
  reference_number?: string;
  status: 'active' | 'cancelled' | 'expired' | 'paid';
  line_items: Array<{
    currency: string;
    amount: number;
    name: string;
    quantity: number;
  }>;
  payment_intent: {
    id: string;
    type: 'payment_intent';
    attributes: PayMongoPaymentAttributes;
  } | null;
  payments?: Array<{
    id: string;
    type: 'payment';
    attributes: PayMongoPaymentAttributes;
  }>;
  customer_email?: string;
  billing?: {
    address?: {
      city?: string;
      country?: string;
      line1?: string;
      line2?: string;
      postal_code?: string;
      state?: string;
    };
    email?: string;
    name?: string;
    phone?: string;
  };
  metadata?: Record<string, string>;
  success_url: string;
  cancel_url: string;
  created_at: number;
  updated_at: number;
  client_key?: string;
}

// Enhanced Payment Attributes
export interface PayMongoPaymentAttributes {
  amount: number;
  currency: string;
  status: 'awaiting_payment_method' | 'awaiting_next_action' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  source?: PayMongoSource;
  payment_method?: {
    id: string;
    type: string;
    attributes: {
      type: 'card' | 'gcash' | 'grabpay' | 'paymaya' | 'maya' | 'bpi_online' | 'ubp_online' | 'bank_transfer' | 'paymongo_wallet';
      details?: {
        card?: PayMongoCardDetails;
        bank?: PayMongoBankDetails;
        ewallet?: PayMongoEwalletDetails;
      };
    };
  };
  billing?: {
    address?: {
      city?: string;
      country?: string;
      line1?: string;
      line2?: string;
      postal_code?: string;
      state?: string;
    };
    email?: string;
    name?: string;
    phone?: string;
  };
  metadata?: Record<string, string>;
  fee?: number;
  net_amount?: number;
  application_fee?: number;
  statement_descriptor?: string;
  description?: string;
  last_payment_error?: {
    code: string;
    detail: string;
    source: string;
  };
  next_action?: {
    type: string;
    redirect?: {
      url: string;
      return_url: string;
    };
  };
  client_key?: string;
  created_at: number;
  updated_at: number;
}

// Source details
export interface PayMongoSource {
  id: string;
  type: 'card' | 'gcash' | 'grabpay' | 'paymaya' | 'maya' | 'bpi_online' | 'ubp_online' | 'bank_transfer' | 'paymongo_wallet';
  brand?: string;
  country?: string;
  last4?: string;
  exp_month?: number;
  exp_year?: number;
  funding?: string;
}

// Card-specific details
export interface PayMongoCardDetails {
  last4: string;
  exp_month: number;
  exp_year: number;
  brand: string;
  country?: string;
  funding?: string;
  cvc_check?: 'pass' | 'fail' | 'unavailable';
  address_line1_check?: 'pass' | 'fail' | 'unavailable';
  address_postal_code_check?: 'pass' | 'fail' | 'unavailable';
}

// Bank details
export interface PayMongoBankDetails {
  bank_code: string;
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  reference?: string;
}

// E-wallet details
export interface PayMongoEwalletDetails {
  type: 'gcash' | 'grabpay' | 'paymaya' | 'maya';
  account_name?: string;
  account_number?: string;
  reference?: string;
}

// Updated to handle both payment intents and payments
export interface PayMongoPaymentObject {
  id: string;
  type: 'payment' | 'payment_intent';
  attributes: PayMongoPaymentAttributes;
}

// Keep the old interface for backward compatibility
export interface PayMongoPayment extends PayMongoPaymentObject {
  type: 'payment';
}

// Type guards
export function isWebhookEvent(obj: unknown): obj is WebhookEvent {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'data' in obj &&
    typeof obj.data === 'object' &&
    obj.data !== null &&
    'id' in obj.data &&
    'type' in obj.data &&
    'attributes' in obj.data
  );
}

export function isCheckoutSessionEvent(eventType: string): boolean {
  return eventType.startsWith('checkout_session.');
}

export function isPaymentIntentEvent(eventType: string): boolean {
  return eventType.startsWith('payment_intent.');
}

export function isSuccessfulPaymentEvent(eventType: string): boolean {
  return eventType === 'checkout_session.payment.paid';
}

export function isCheckoutSessionData(data: unknown): data is CheckoutSessionWebhookData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'line_items' in data &&
    Array.isArray((data as CheckoutSessionWebhookData).line_items) &&
    'success_url' in data &&
    'cancel_url' in data
  );
}

export function isPaymentIntentData(data: unknown): data is PayMongoPaymentAttributes {
  return (
    typeof data === 'object' &&
    data !== null &&
    'amount' in data &&
    'currency' in data &&
    'status' in data
  );
}

export function isCardSource(source: PayMongoSource): boolean {
  return source.type === 'card';
}

// Updated helper function - now returns PayMongoPaymentObject instead of PayMongoPayment
export function getPaymentIntentFromSession(sessionData: CheckoutSessionWebhookData): PayMongoPaymentObject | null {
  if (sessionData.payment_intent) {
    return {
      id: sessionData.payment_intent.id,
      type: 'payment_intent' as const,
      attributes: sessionData.payment_intent.attributes
    };
  }
  
  if (sessionData.payments && sessionData.payments.length > 0) {
    const payment = sessionData.payments[0];
    return {
      id: payment.id,
      type: 'payment' as const,
      attributes: payment.attributes
    };
  }
  
  return null;
}

export function getPaymentDetails(paymentData: PayMongoPaymentAttributes): PayMongoPaymentObject {
  return {
    id: '', // Will be set by caller
    type: 'payment',
    attributes: paymentData
  };
}

export function getSourceDetails(payment: PayMongoPaymentObject): PayMongoSource {
  const attributes = payment.attributes;
  
  // Try to get source from payment_method first
  if (attributes.payment_method?.attributes.details?.card) {
    const card = attributes.payment_method.attributes.details.card;
    return {
      id: attributes.payment_method.id,
      type: 'card',
      brand: card.brand,
      last4: card.last4,
      exp_month: card.exp_month,
      exp_year: card.exp_year,
      country: card.country,
      funding: card.funding
    };
  }
  
  // Fallback to source property
  if (attributes.source) {
    return attributes.source;
  }
  
  // Default fallback
  return {
    id: 'unknown',
    type: 'card'
  };
}

export function getLastPaymentError(paymentData: PayMongoPaymentAttributes): { code: string; detail: string } | null {
  return paymentData.last_payment_error || null;
}

export function getMetadataValue(metadata: Record<string, string> | undefined, key: string): string | undefined {
  return metadata?.[key];
}

export function calculateTotalFromLineItems(lineItems: CheckoutSessionWebhookData['line_items']): number {
  return lineItems.reduce((total, item) => total + (item.amount * item.quantity), 0);
}

export function getPaymentMethodForDB(source: PayMongoSource): 'CARD' | 'E_WALLET' | 'BANK_TRANSFER' | 'QR_CODE' {
  switch (source.type) {
    case 'card':
      return 'CARD';
    case 'gcash':
    case 'grabpay':
    case 'paymaya':
    case 'maya':
    case 'paymongo_wallet':
      return 'E_WALLET';
    case 'bpi_online':
    case 'ubp_online':
    case 'bank_transfer':
      return 'BANK_TRANSFER';
    default:
      return 'CARD';
  }
}

export function getPaymongoPaymentTypeForDB(source: PayMongoSource): 'CARD' | 'GCASH' | 'GRABPAY' | 'PAYMAYA' | 'MAYA' | 'BPI_ONLINE' | 'UBP_ONLINE' | 'BANK_TRANSFER' | 'PAYMONGO_WALLET' {
  switch (source.type) {
    case 'card':
      return 'CARD';
    case 'gcash':
      return 'GCASH';
    case 'grabpay':
      return 'GRABPAY';
    case 'paymaya':
      return 'PAYMAYA';
    case 'maya':
      return 'MAYA';
    case 'bpi_online':
      return 'BPI_ONLINE';
    case 'ubp_online':
      return 'UBP_ONLINE';
    case 'bank_transfer':
      return 'BANK_TRANSFER';
    case 'paymongo_wallet':
      return 'PAYMONGO_WALLET';
    default:
      return 'CARD';
  }
}

// Utility function to safely serialize for Prisma JSON
export function serializeForPrismaJson(data: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(data));
}