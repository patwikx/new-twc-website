"use server";

import { 
  PayMongoResponse, 
  CheckoutSessionAttributes,
  LineItem,
  PaymentMethodType 
} from "@/types/paymongo-types";

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY!;
const PAYMONGO_BASE_URL = "https://api.paymongo.com/v1";

interface CreateCheckoutParams {
  bookingId: string;
  bookingNumber: string;
  amount: number; // In PHP (not centavos)
  description: string;
  customerEmail: string;
  customerName: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export async function createPayMongoCheckoutSession(
  params: CreateCheckoutParams
): Promise<{ checkoutUrl: string; sessionId: string } | { error: string }> {
  try {
    const lineItems: LineItem[] = [
      {
        currency: "PHP",
        amount: Math.round(params.amount * 100), // Convert to centavos
        description: params.description,
        name: `Booking ${params.bookingNumber}`,
        quantity: 1,
      },
    ];

    const paymentMethods: PaymentMethodType[] = [
      "card",
      "gcash",
      "paymaya",
      "grab_pay",
    ];

    const requestBody = {
      data: {
        attributes: {
          line_items: lineItems,
          payment_method_types: paymentMethods,
          reference_number: params.bookingNumber,
          customer_email: params.customerEmail,
          description: params.description,
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          success_url: params.successUrl,
          cancel_url: params.cancelUrl,
          billing: {
            name: params.customerName,
            email: params.customerEmail,
          },
          metadata: {
            booking_id: params.bookingId,
            booking_number: params.bookingNumber,
            ...params.metadata,
          },
        },
      },
    };

    const response = await fetch(`${PAYMONGO_BASE_URL}/checkout_sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ":").toString("base64")}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("PayMongo API Error:", errorData);
      return { error: errorData.errors?.[0]?.detail || "Failed to create checkout session" };
    }

    const data: PayMongoResponse<CheckoutSessionAttributes> = await response.json();
    
    return {
      checkoutUrl: data.data.attributes.checkout_url,
      sessionId: data.data.id,
    };
  } catch (error) {
    console.error("PayMongo checkout creation error:", error);
    return { error: "An unexpected error occurred while creating checkout session" };
  }
}

export async function getCheckoutSession(sessionId: string) {
  try {
    const response = await fetch(`${PAYMONGO_BASE_URL}/checkout_sessions/${sessionId}`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ":").toString("base64")}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: PayMongoResponse<CheckoutSessionAttributes> = await response.json();
    return data.data;
  } catch (error) {
    console.error("Error fetching checkout session:", error);
    return null;
  }
}
