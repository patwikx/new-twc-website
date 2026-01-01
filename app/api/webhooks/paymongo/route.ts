import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { sendBookingConfirmationEmail } from '@/lib/mail';
import { 
  WebhookEvent, 
  CheckoutSessionWebhookData, 
  isWebhookEvent,
  isCheckoutSessionEvent,
  isPaymentIntentEvent,
  isSuccessfulPaymentEvent,
  isCheckoutSessionData,
  isPaymentIntentData,
  getPaymentIntentFromSession,
  getPaymentDetails,
  getSourceDetails,
  getLastPaymentError,
  getMetadataValue,
  calculateTotalFromLineItems,
  getPaymentMethodForDB,
  getPaymongoPaymentTypeForDB,
  isCardSource,
  serializeForPrismaJson
} from '@/types/paymongo-webhook-extended';

interface WebhookResponse {
  received: boolean;
  processed?: boolean;
  error?: string;
}

// Helper function to get IP address
function getClientIP(req: NextRequest, headersList: Headers): string {
  return (
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headersList.get('x-real-ip') ||
    'unknown'
  );
}

// Signature verification function
function verifyPaymongoSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  try {
    const parts = signatureHeader.split(',');
    const timestamp = parts.find(part => part.startsWith('t='))?.split('=')[1];
    const testSignature = parts.find(part => part.startsWith('te='))?.split('=')[1];
    const liveSignature = parts.find(part => part.startsWith('li='))?.split('=')[1];

    if (!timestamp || !(testSignature || liveSignature)) {
      console.error('Signature header is missing required parts (t, te, or li).');
      return false;
    }
    
    const signatureToVerify = liveSignature || testSignature;
    
    if (!signatureToVerify) {
        console.error('No valid signature found in header.');
        return false;
    }

    const signedPayload = `${timestamp}.${rawBody}`;

    const expectedSignature = crypto
      .createHmac('sha256', secret) 
      .update(signedPayload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signatureToVerify),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('An error occurred during signature verification:', error);
    return false;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<WebhookResponse>> {
  let webhookEventRecord: { id: string } | null = null;
  
  try {
    console.log('🔔 Webhook received at:', new Date().toISOString());
    
    const payload = await req.text();
    const headersList = await headers();
    const signature = headersList.get('paymongo-signature');
    
    console.log('📝 Payload length:', payload.length);
    console.log('🔐 Signature present:', !!signature);
    console.log('🔑 Webhook secret configured:', !!process.env.PAYMONGO_WEBHOOK_SECRET);
    
    if (!signature || !process.env.PAYMONGO_WEBHOOK_SECRET) {
      console.error('❌ Webhook Error: Missing signature or secret.');
      return NextResponse.json({ received: false, error: 'Configuration error' }, { status: 400 });
    }

    const isValid = verifyPaymongoSignature(payload, signature, process.env.PAYMONGO_WEBHOOK_SECRET);
    console.log('✅ Signature valid:', isValid);
    
    if (!isValid) {
      console.error('❌ Invalid webhook signature received.');
      return NextResponse.json({ received: false, error: 'Invalid signature' }, { status: 401 });
    }

    const ipAddress = getClientIP(req, headersList);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const userAgent = headersList.get('user-agent');
    const parsedEvent: unknown = JSON.parse(payload);
    
    if (!isWebhookEvent(parsedEvent)) {
      console.error('Invalid webhook event structure.');
      return NextResponse.json({ received: false, error: 'Invalid event structure' }, { status: 400 });
    }

    const event: WebhookEvent = parsedEvent;
    const eventType = event.data.attributes.type;
    const resourceId = event.data.attributes.data.id;
    
    console.log('✅ Received VALID webhook event:', eventType, 'for resource:', resourceId);

    // Check if we already processed this webhook event
    const existingWebhookEvent = await prisma.payMongoWebhookEvent.findUnique({
      where: { eventId: event.data.id }
    });

    if (existingWebhookEvent && existingWebhookEvent.processed) {
      console.log('Webhook event already processed:', event.data.id);
      return NextResponse.json({ received: true, processed: true });
    }

    const headersObject: Record<string, string> = {};
    headersList.forEach((value, key) => { headersObject[key] = value; });

    // Create or update webhook event record using your schema
    webhookEventRecord = await prisma.payMongoWebhookEvent.create({
      data: {
        eventId: event.data.id,
        eventType: eventType,
        paymentIntentId: resourceId,
        processed: false,
        rawPayload: serializeForPrismaJson(event)
      }
    });

    if (!webhookEventRecord) {
      throw new Error("Failed to create webhook event record");
    }
    
    let processed = false;
    
    if (isCheckoutSessionEvent(eventType)) {
      if (isSuccessfulPaymentEvent(eventType)) {
        await handleCheckoutSessionSuccess(event, webhookEventRecord.id);
        processed = true;
      } else if (eventType === 'checkout_session.payment.failed') {
        await handleCheckoutSessionFailed(event, webhookEventRecord.id);
        processed = true;
      }
    } else if (isPaymentIntentEvent(eventType)) {
        await handlePaymentIntentSuccess(event, webhookEventRecord.id);
        processed = true;
    } else {
      console.log('Unhandled webhook event type:', eventType);
    }

    // Update webhook event status
    await prisma.payMongoWebhookEvent.update({
      where: { id: webhookEventRecord.id },
      data: {
        processedAt: new Date(),
        processed: processed
      }
    });

    return NextResponse.json({ received: true, processed });
    
  } catch (error) {
    console.error('Fatal webhook processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (webhookEventRecord) {
      await prisma.payMongoWebhookEvent.update({
        where: { id: webhookEventRecord.id },
        data: { 
          processed: false,
          processingError: errorMessage 
        }
      }).catch((updateError: unknown) => console.error('Failed to update webhook record to failed status:', updateError));
    }
    
    return NextResponse.json({ received: true, processed: false, error: errorMessage }, { status: 500 });
  }
}

async function handleCheckoutSessionSuccess(event: WebhookEvent, webhookEventId: string): Promise<void> {
  try {
    const checkoutSessionId = event.data.attributes.data.id;
    const sessionData = event.data.attributes.data.attributes;
    
    if (!isCheckoutSessionData(sessionData)) {
      throw new Error('Invalid checkout session data structure in webhook.');
    }
    
    const typedSessionData: CheckoutSessionWebhookData = sessionData;
    console.log('Processing successful checkout session payment:', checkoutSessionId);
    
    // Get booking ID from metadata
    const bookingId = getMetadataValue(typedSessionData.metadata, 'booking_id');
    if (!bookingId) {
      throw new Error('No booking_id found in checkout session metadata.');
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { 
        room: true,
        property: true,
        items: true
      }
    });

    if (!booking) {
      throw new Error(`Booking not found: ${bookingId}`);
    }

    const paymentIntent = getPaymentIntentFromSession(typedSessionData);
    const paymentIntentId = paymentIntent?.id;
    const totalAmount = calculateTotalFromLineItems(typedSessionData.line_items) / 100;
    
    // Check if payment already exists
    let payment = await prisma.payment.findFirst({
      where: {
        bookingId: booking.id,
        paymongoPaymentIntentId: paymentIntentId || checkoutSessionId
      }
    });

    if (!payment) {
      // Create new payment record
      payment = await prisma.payment.create({
        data: {
          bookingId: booking.id,
          amount: totalAmount,
          currency: typedSessionData.line_items[0]?.currency?.toUpperCase() || 'PHP',
          paymentMethod: 'CREDIT_CARD',
          paymentProvider: 'paymongo',
          paymongoPaymentIntentId: paymentIntentId || checkoutSessionId,
          paymongoCheckoutUrl: typedSessionData.checkout_url,
          paymongoClientKey: typedSessionData.client_key,
          status: 'PENDING',
          description: `Payment for booking ${booking.shortRef}`,
          metadata: serializeForPrismaJson({
            checkout_session_id: checkoutSessionId,
            line_items: typedSessionData.line_items,
            booking_number: booking.shortRef
          })
        }
      });
    }

    // Prepare payment update data
    const updateData: {
      status: 'PAID';
      paidAt: Date;
      metadata?: Prisma.InputJsonValue;
      paymentMethod?: 'CREDIT_CARD' | 'GCASH' | 'PAYMAYA' | 'GRAB_PAY';
      transactionId?: string;
    } = {
      status: 'PAID',
      paidAt: new Date(),
      metadata: serializeForPrismaJson({
        ...((payment.metadata as Record<string, unknown>) || {}),
        webhook_event_id: webhookEventId,
        processed_at: new Date().toISOString()
      })
    };

    // Process payment intent details if available
    if (paymentIntent && isPaymentIntentData(paymentIntent.attributes)) {
      const paymentDetails = getPaymentDetails(paymentIntent.attributes);
      
      if (paymentDetails) {
        const source = getSourceDetails(paymentDetails);
        const paymentMethod = getPaymentMethodForDB(source);
        
        // Map payment method
        if (paymentMethod === 'CARD') {
          updateData.paymentMethod = 'CREDIT_CARD';
        } else if (paymentMethod === 'E_WALLET') {
          const sourceType = source?.type?.toLowerCase();
          if (sourceType === 'gcash') updateData.paymentMethod = 'GCASH';
          else if (sourceType === 'paymaya') updateData.paymentMethod = 'PAYMAYA';
          else if (sourceType === 'grab_pay') updateData.paymentMethod = 'GRAB_PAY';
        }
        
        updateData.transactionId = paymentIntent.id;
        
        // Update payment with source details
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            paymongoPaymentMethodId: paymentIntent.attributes.payment_method?.id,
            paymongoSourceId: paymentIntent.attributes.source?.id,
            referenceNumber: paymentIntent.attributes.source?.id
          }
        });
      }
    }

    // Update the payment
    await prisma.payment.update({
      where: { id: payment.id },
      data: updateData
    });

    // Update booking status and payment tracking
    const amountPaid = Number(booking.amountPaid) + totalAmount;
    const amountDue = Number(booking.totalAmount) - amountPaid;
    
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        amountPaid: amountPaid,
        amountDue: amountDue,
        paymentStatus: amountDue <= 0 ? 'PAID' : 'PARTIALLY_PAID',
        status: amountDue <= 0 ? 'CONFIRMED' : 'PENDING'
      }
    });
    
    console.log(`✅ Payment confirmed for booking ${booking.shortRef}`);

    // Send confirmation email to guest
    if (amountDue <= 0) {
      try {
        const firstItem = booking.items[0];
        const checkIn = firstItem ? new Date(firstItem.checkIn).toLocaleDateString('en-US', { 
          weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
        }) : 'N/A';
        const checkOut = firstItem ? new Date(firstItem.checkOut).toLocaleDateString('en-US', { 
          weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
        }) : 'N/A';
        
        await sendBookingConfirmationEmail({
          email: booking.guestEmail,
          ref: booking.shortRef,
          propertyName: booking.property?.name || 'Tropicana Hotel',
          checkIn,
          checkOut,
          amount: `PHP ${Number(booking.totalAmount).toLocaleString()}`,
          guestName: `${booking.guestFirstName} ${booking.guestLastName}`
        });
        
        console.log(`📧 Confirmation email sent to ${booking.guestEmail}`);
      } catch (emailError) {
        // Log but don't fail the webhook if email fails
        console.error('Failed to send confirmation email:', emailError);
      }
    }
    
  } catch (error) {
    console.error('Error in handleCheckoutSessionSuccess:', error);
    throw error;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function handleCheckoutSessionFailed(event: WebhookEvent, webhookEventId: string): Promise<void> {
  try {
    const sessionData = event.data.attributes.data.attributes;
    
    if (!isCheckoutSessionData(sessionData)) {
      throw new Error('Invalid checkout session data structure for a failed event.');
    }
    
    const typedSessionData: CheckoutSessionWebhookData = sessionData;
    
    const bookingId = getMetadataValue(typedSessionData.metadata, 'booking_id');
    if (!bookingId) {
      throw new Error('No booking_id found for a failed event.');
    }

    const paymentIntent = getPaymentIntentFromSession(typedSessionData);
    let failureMessage = 'Unknown reason';
    
    if (paymentIntent && isPaymentIntentData(paymentIntent.attributes)) {
      const lastError = getLastPaymentError(paymentIntent.attributes);
      if (lastError) {
        failureMessage = lastError.detail || 'Payment failed';
      }
    }

    // Find and update existing payment
    const payment = await prisma.payment.findFirst({
      where: {
        bookingId: bookingId,
        paymongoPaymentIntentId: event.data.attributes.data.id
      }
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: failureMessage
        }
      });
    }
    
    // Update booking
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        paymentStatus: 'FAILED',
        status: 'CANCELLED'
      }
    });
    
    console.log(`Booking ${bookingId} cancelled due to payment failure.`);
    
  } catch (error) {
    console.error('Error in handleCheckoutSessionFailed:', error);
    throw error;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function handlePaymentIntentSuccess(event: WebhookEvent, webhookEventId: string): Promise<void> {
  console.log("Handling successful payment intent...");
  
  try {
    const paymentIntentData = event.data.attributes.data.attributes;
    
    if (!isPaymentIntentData(paymentIntentData)) {
      throw new Error('Invalid payment intent data structure.');
    }

    const paymentIntentId = event.data.attributes.data.id;
    
    // Find existing payment by PayMongo payment intent ID
    const payment = await prisma.payment.findFirst({
      where: { paymongoPaymentIntentId: paymentIntentId },
      include: { booking: true }
    });

    if (payment) {
      // Update payment status
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          paidAt: new Date()
        }
      });

      // Update booking payment tracking
      const amountPaid = Number(payment.booking.amountPaid) + Number(payment.amount);
      const amountDue = Number(payment.booking.totalAmount) - amountPaid;
      
      await prisma.booking.update({
        where: { id: payment.bookingId },
        data: {
          amountPaid: amountPaid,
          amountDue: amountDue,
          paymentStatus: amountDue <= 0 ? 'PAID' : 'PARTIALLY_PAID',
          status: amountDue <= 0 ? 'CONFIRMED' : 'PENDING'
        }
      });
    }
    
  } catch (error) {
    console.error('Error in handlePaymentIntentSuccess:', error);
    throw error;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function handlePaymentIntentFailed(event: WebhookEvent, webhookEventId: string): Promise<void> {
    console.log("Handling failed payment intent...");
    
    try {
      const paymentIntentId = event.data.attributes.data.id;
      
      // Find existing payment
      const payment = await prisma.payment.findFirst({
        where: { paymongoPaymentIntentId: paymentIntentId }
      });

      if (payment) {
        // Update payment status
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            failureReason: 'Payment intent failed'
          }
        });

        // Update corresponding booking
        await prisma.booking.update({
          where: { id: payment.bookingId },
          data: {
            paymentStatus: 'FAILED',
            status: 'CANCELLED'
          }
        });
      }
      
    } catch (error) {
      console.error('Error in handlePaymentIntentFailed:', error);
      throw error;
    }
}