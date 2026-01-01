// types/paymongo.ts - Comprehensive PayMongo TypeScript types

// Base PayMongo API types
export interface PayMongoResource<T = Record<string, unknown>> {
  id: string;
  type: string;
  attributes: T;
}

export interface PayMongoResponse<T = Record<string, unknown>> {
  data: PayMongoResource<T>;
}

export interface PayMongoListResponse<T = Record<string, unknown>> {
  data: PayMongoResource<T>[];
  has_more: boolean;
}

export interface PayMongoError {
  code: string;
  detail: string;
  source?: {
    pointer: string;
    parameter: string;
  };
}

export interface PayMongoErrorResponse {
  errors: PayMongoError[];
}

// Checkout Session types
export interface CheckoutSessionAttributes {
  cancel_url: string;
  checkout_url: string;
  success_url: string;
  line_items: LineItem[];
  payment_method_types: PaymentMethodType[];
  reference_number?: string;
  customer_email?: string;
  description?: string;
  send_email_receipt?: boolean;
  show_description?: boolean;
  show_line_items?: boolean;
  billing?: BillingDetails;
  metadata?: Record<string, string>;
  status: CheckoutSessionStatus;
  created_at: number;
  updated_at: number;
}

export interface LineItem {
  currency: string;
  amount: number;
  description: string;
  name: string;
  quantity: number;
  images?: string[];
}

export interface BillingDetails {
  name: string;
  email: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
}

export type PaymentMethodType = 
  | 'card'
  | 'paymaya'
  | 'gcash'
  | 'grab_pay'
  | 'billease'
  | 'dob'
  | 'dob_ubp'
  | 'brankas_bdo'
  | 'brankas_landbank'
  | 'brankas_metrobank'
  | 'brankas_bpi'
  | 'qrph';

export type CheckoutSessionStatus = 
  | 'active'
  | 'paid' 
  | 'expired'
  | 'cancelled';

// Payment Intent types
export interface PaymentIntentAttributes {
  amount: number;
  currency: string;
  description?: string;
  statement_descriptor?: string;
  status: PaymentIntentStatus;
  client_key: string;
  capture_type?: 'automatic' | 'manual';
  payment_method_allowed: PaymentMethodType[];
  payments?: PaymentResource[];
  metadata?: Record<string, string>;
  created_at: number;
  updated_at: number;
}

export type PaymentIntentStatus = 
  | 'awaiting_payment_method'
  | 'awaiting_next_action'
  | 'processing'
  | 'succeeded'
  | 'cancelled'
  | 'requires_payment_method';

export interface PaymentResource {
  id: string;
  type: string;
  attributes: PaymentAttributes;
}

export interface PaymentAttributes {
  access_url?: string;
  amount: number;
  balance_transaction_id?: string;
  billing?: BillingDetails;
  currency: string;
  description?: string;
  disputed: boolean;
  external_reference_number?: string;
  fee: number;
  foreign_fee: number;
  livemode: boolean;
  net_amount: number;
  origin: string;
  payment_intent_id?: string;
  payout?: string;
  source: PaymentSource;
  statement_descriptor?: string;
  status: PaymentStatus;
  tax_amount?: number;
  refunds?: RefundResource[];
  taxes?: TaxResource[];
  available_at: number;
  created_at: number;
  credited_at?: number;
  paid_at?: number;
  updated_at: number;
}

export type PaymentStatus = 
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'chargeback'
  | 'refunded'
  | 'partially_refunded';

export interface PaymentSource {
  id: string;
  type: PaymentMethodType;
  attributes: PaymentSourceAttributes;
}

interface PaymentSourceAttributes {
  brand?: string;
  country?: string;
  last4?: string;
  exp_month?: number;
  exp_year?: number;
}

export interface RefundResource {
  id: string;
  type: string;
  attributes: RefundAttributes;
}

export interface RefundAttributes {
  amount: number;
  currency: string;
  notes?: string;
  payment_id: string;
  reason: RefundReason;
  status: RefundStatus;
  created_at: number;
  updated_at: number;
}

export type RefundReason = 
  | 'duplicate'
  | 'fraudulent'
  | 'requested_by_customer'
  | 'others';

export type RefundStatus = 
  | 'pending'
  | 'succeeded'
  | 'failed';

export interface TaxResource {
  id: string;
  type: string;
  attributes: TaxAttributes;
}

export interface TaxAttributes {
  amount: number;
  currency: string;
  inclusive: boolean;
  name: string;
  type: string;
  value: string;
}

// Webhook types
export interface WebhookEvent {
  data: PayMongoResource<WebhookEventAttributes>;
}

export interface WebhookEventAttributes {
  type: WebhookEventType;
  livemode: boolean;
  data: PayMongoResource<CheckoutSessionWebhookData | PaymentIntentWebhookData | PaymentWebhookData>;
  previous_data?: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}

export type WebhookEventType = 
  | 'checkout_session.payment.paid'
  | 'checkout_session.payment.failed'
  | 'payment_intent.payment.paid'
  | 'payment_intent.payment.failed'
  | 'payment.paid'
  | 'payment.failed'
  | 'payment.refunded'
  | 'refund.created'
  | 'refund.updated';

// Corrected empty interfaces to type aliases to resolve ESLint errors
export type CheckoutSessionWebhookData = CheckoutSessionAttributes;
export type PaymentIntentWebhookData = PaymentIntentAttributes;
export type PaymentWebhookData = PaymentAttributes;

// Request/Input types for creating resources
export interface CreateCheckoutSessionRequest {
  line_items: LineItem[];
  payment_method_types: PaymentMethodType[];
  reference_number?: string;
  customer_email?: string;
  description?: string;
  send_email_receipt?: boolean;
  show_description?: boolean;
  show_line_items?: boolean;
  billing?: BillingDetails;
  metadata?: Record<string, string>;
}

export interface CreatePaymentIntentRequest {
  amount: number;
  currency: string;
  description?: string;
  statement_descriptor?: string;
  capture_type?: 'automatic' | 'manual';
  payment_method_allowed?: PaymentMethodType[];
  metadata?: Record<string, string>;
}

export interface CreatePaymentMethodRequest {
  type: PaymentMethodType;
  details: PaymentMethodDetails;
  billing?: BillingDetails;
  metadata?: Record<string, string>;
}

export type PaymentMethodDetails = 
  | CardDetails
  | EWalletDetails
  | OnlineBankingDetails
  | OverTheCounterDetails;

export interface CardDetails {
  card_number: string;
  exp_month: number;
  exp_year: number;
  cvc: string;
}

export interface EWalletDetails {
  phone?: string;
  email?: string;
}

export interface OnlineBankingDetails {
  bank_code?: string;
}

export interface OverTheCounterDetails {
  phone?: string;
  email?: string;
}

// Utility types for application
export interface ReservationPaymentData {
  reservationId: string;
  confirmationNumber: string;
  guestName: string;
  guestEmail: string;
  amount: number;
  description: string;
  metadata: Record<string, string>;
}

export interface PaymentResult {
  success: boolean;
  paymentSessionId?: string;
  checkoutUrl?: string;
  error?: string;
  reservationId: string;
}

// Type guards
export function isWebhookEvent(data: unknown): data is WebhookEvent {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const event = data as Record<string, unknown>;
  
  return (
    typeof event.data === 'object' &&
    event.data !== null &&
    typeof (event.data as Record<string, unknown>).id === 'string' &&
    typeof (event.data as Record<string, unknown>).type === 'string' &&
    typeof (event.data as Record<string, unknown>).attributes === 'object'
  );
}

export function isCheckoutSessionEvent(eventType: string): boolean {
  return eventType.startsWith('checkout_session.');
}

export function isPaymentIntentEvent(eventType: string): boolean {
  return eventType.startsWith('payment_intent.');
}

export function isPaymentEvent(eventType: string): boolean {
  return eventType.startsWith('payment.') && !eventType.startsWith('payment_intent.');
}

export function isSuccessfulPaymentEvent(eventType: string): boolean {
  return (
    eventType === 'checkout_session.payment.paid' ||
    eventType === 'payment_intent.payment.paid' ||
    eventType === 'payment.paid'
  );
}
