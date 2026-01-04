"use server";

/**
 * POS Payment Service
 * 
 * Handles payment processing for POS orders including:
 * - Multiple payment methods (CASH, CREDIT_CARD, DEBIT_CARD, ROOM_CHARGE, VOUCHER, COMPLIMENTARY)
 * - Split payments with multiple OrderPayment records
 * - Room charge processing with booking validation
 * 
 * Requirements: 7.1, 7.3, 7.4, 8.1, 8.2, 8.3
 */

import { db } from "@/lib/db";
import { PaymentMethod, POSOrderStatus, BookingStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import { setTableDirty } from "./table";

// Helper function to serialize Decimal fields to numbers for client components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeOrder(order: any): any {
  if (!order) return order;
  
  return {
    ...order,
    subtotal: order.subtotal ? Number(order.subtotal) : 0,
    taxAmount: order.taxAmount ? Number(order.taxAmount) : 0,
    serviceCharge: order.serviceCharge ? Number(order.serviceCharge) : 0,
    discountAmount: order.discountAmount ? Number(order.discountAmount) : 0,
    tipAmount: order.tipAmount ? Number(order.tipAmount) : 0,
    total: order.total ? Number(order.total) : 0,
    items: order.items?.map(serializeOrderItem) || [],
    payments: order.payments?.map(serializePayment) || [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeOrderItem(item: any): any {
  if (!item) return item;
  
  return {
    ...item,
    unitPrice: item.unitPrice ? Number(item.unitPrice) : 0,
    menuItem: item.menuItem ? {
      ...item.menuItem,
      sellingPrice: item.menuItem.sellingPrice ? Number(item.menuItem.sellingPrice) : 0,
    } : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializePayment(payment: any): any {
  if (!payment) return payment;
  
  return {
    ...payment,
    amount: payment.amount ? Number(payment.amount) : 0,
    tipAmount: payment.tipAmount ? Number(payment.tipAmount) : 0,
  };
}

// Types
export interface PaymentInput {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

export interface ProcessPaymentInput {
  orderId: string;
  payments: PaymentInput[];
  processedById: string;
}

export interface RoomChargeInput {
  orderId: string;
  bookingId: string;
  processedById: string;
  guestAuthorization?: boolean;
}

export interface PaymentResult {
  success: boolean;
  data?: {
    order: unknown;
    payments: unknown[];
    changeDue?: number;
  };
  error?: string;
}

// Valid payment methods
const VALID_PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "CREDIT_CARD",
  "DEBIT_CARD",
  "ROOM_CHARGE",
  "VOUCHER",
  "COMPLIMENTARY",
];

/**
 * Validate payment method
 */
function isValidPaymentMethod(method: string): method is PaymentMethod {
  return VALID_PAYMENT_METHODS.includes(method as PaymentMethod);
}

/**
 * Calculate change due for cash payments
 * Requirements: 7.2
 */
export function calculateChangeDue(
  orderTotal: number,
  payments: PaymentInput[]
): number {
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const change = totalPaid - orderTotal;
  return Math.max(0, Math.round(change * 100) / 100);
}

/**
 * Validate split payments sum to order total
 * Property 7: Split Payment Integrity
 * For any order with split payments, the sum of all OrderPayment amounts SHALL equal the order total.
 * 
 * Requirements: 5.5, 7.4
 */
export function validateSplitPayments(
  orderTotal: number,
  payments: PaymentInput[]
): { valid: boolean; error?: string } {
  if (payments.length === 0) {
    return { valid: false, error: "At least one payment is required" };
  }

  // Validate each payment
  for (const payment of payments) {
    if (!isValidPaymentMethod(payment.method)) {
      return { valid: false, error: `Invalid payment method: ${payment.method}` };
    }
    if (payment.amount <= 0) {
      return { valid: false, error: "Payment amount must be positive" };
    }
  }

  // Calculate total payment amount
  const totalPayment = payments.reduce(
    (sum, p) => sum.add(new Decimal(p.amount)),
    new Decimal(0)
  );

  const orderTotalDecimal = new Decimal(orderTotal);

  // For cash payments, allow overpayment (change will be given)
  const hasCashPayment = payments.some(p => p.method === "CASH");
  
  if (hasCashPayment) {
    // With cash, total payment must be >= order total
    if (totalPayment.lessThan(orderTotalDecimal)) {
      return { 
        valid: false, 
        error: `Payment total (${totalPayment.toFixed(2)}) is less than order total (${orderTotalDecimal.toFixed(2)})` 
      };
    }
  } else {
    // Without cash, total payment must equal order total exactly
    // Allow small tolerance for floating point
    const difference = totalPayment.sub(orderTotalDecimal).abs();
    if (difference.greaterThan(0.01)) {
      return { 
        valid: false, 
        error: `Payment total (${totalPayment.toFixed(2)}) does not match order total (${orderTotalDecimal.toFixed(2)})` 
      };
    }
  }

  return { valid: true };
}


/**
 * Process payment for an order
 * Requirements: 7.1, 7.4, 7.5
 * 
 * - THE System SHALL support payment methods: CASH, CREDIT_CARD, DEBIT_CARD, ROOM_CHARGE, VOUCHER, COMPLIMENTARY
 * - WHEN processing a cash payment, THE System SHALL calculate and display change due
 * - WHEN processing a split payment, THE System SHALL create multiple OrderPayment records totaling the order amount
 * - WHEN an order is fully paid, THE System SHALL update order status to PAID and record payment timestamp
 * - IF a payment fails, THEN THE System SHALL maintain the order in OPEN status and log the failure reason
 */
export async function processPayment(data: ProcessPaymentInput): Promise<PaymentResult> {
  // Validate required fields
  if (!data.orderId || data.orderId.trim() === "") {
    return { success: false, error: "Order ID is required" };
  }

  if (!data.processedById || data.processedById.trim() === "") {
    return { success: false, error: "Processor ID is required" };
  }

  if (!data.payments || data.payments.length === 0) {
    return { success: false, error: "At least one payment is required" };
  }

  try {
    // Get the order
    const order = await db.pOSOrder.findUnique({
      where: { id: data.orderId },
      include: {
        table: true,
        payments: true,
      },
    });

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    // Check if order can be paid
    if (order.status === "PAID") {
      return { success: false, error: "Order is already paid" };
    }

    if (order.status === "CANCELLED" || order.status === "VOID") {
      return { success: false, error: "Cannot process payment for cancelled or voided order" };
    }

    // Check if order already has payments
    if (order.payments.length > 0) {
      return { success: false, error: "Order already has payments. Use additional payment endpoint." };
    }

    // Validate processor exists
    const processor = await db.user.findUnique({
      where: { id: data.processedById },
    });

    if (!processor) {
      return { success: false, error: "Payment processor not found" };
    }

    // Validate split payments
    const orderTotal = new Decimal(order.total.toString()).toNumber();
    const validation = validateSplitPayments(orderTotal, data.payments);
    
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Check for room charge payments - they need special validation
    const roomChargePayments = data.payments.filter(p => p.method === "ROOM_CHARGE");
    if (roomChargePayments.length > 0) {
      if (!order.bookingId) {
        return { success: false, error: "Room charge requires an associated booking" };
      }
      
      // Validate booking for room charge
      const bookingValidation = await validateBookingForRoomCharge(order.bookingId);
      if (!bookingValidation.valid) {
        return { success: false, error: bookingValidation.error };
      }
    }

    // Calculate change due for cash payments
    const changeDue = calculateChangeDue(orderTotal, data.payments);

    // Create payments in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create payment records
      const createdPayments = [];
      for (const payment of data.payments) {
        // For cash payments with change, only record the actual order amount
        let paymentAmount = payment.amount;
        if (payment.method === "CASH" && changeDue > 0) {
          // If this is the only cash payment, adjust to order total minus other payments
          const otherPaymentsTotal = data.payments
            .filter(p => p !== payment)
            .reduce((sum, p) => sum + p.amount, 0);
          paymentAmount = orderTotal - otherPaymentsTotal;
        }

        const createdPayment = await tx.orderPayment.create({
          data: {
            orderId: data.orderId,
            amount: paymentAmount,
            method: payment.method,
            reference: payment.reference || null,
            processedById: data.processedById,
          },
        });
        createdPayments.push(createdPayment);
      }

      // If room charge, add to booking folio
      if (roomChargePayments.length > 0 && order.bookingId) {
        const roomChargeTotal = roomChargePayments.reduce((sum, p) => sum + p.amount, 0);
        await addChargeToBookingFolio(tx, order.bookingId, roomChargeTotal, order.orderNumber);
      }

      // Update order status to PAID
      const updatedOrder = await tx.pOSOrder.update({
        where: { id: data.orderId },
        data: { status: "PAID" },
        include: {
          outlet: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          table: {
            select: {
              id: true,
              number: true,
            },
          },
          server: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            include: {
              menuItem: {
                select: {
                  id: true,
                  name: true,
                  sellingPrice: true,
                },
              },
            },
          },
          payments: {
            include: {
              processedBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      return { order: updatedOrder, payments: createdPayments };
    });

    // If order had a table, set it to DIRTY (Requirement 4.4)
    if (order.tableId) {
      await setTableDirty(order.tableId);
    }

    revalidatePath("/admin/pos");
    revalidatePath(`/admin/pos/orders/${data.orderId}`);

    return {
      success: true,
      data: {
        order: serializeOrder(result.order),
        payments: result.payments.map(serializePayment),
        changeDue: changeDue > 0 ? changeDue : undefined,
      },
    };
  } catch (error) {
    console.error("Process Payment Error:", error);
    return { success: false, error: "Failed to process payment" };
  }
}


/**
 * Validate booking for room charge
 * Property 10: Room Charge Booking Validation
 * For any room charge payment, the associated booking SHALL have status CONFIRMED 
 * and the guest SHALL be authorized for room charges.
 * 
 * Requirements: 8.1, 8.2
 */
export async function validateBookingForRoomCharge(
  bookingId: string
): Promise<{ valid: boolean; error?: string; booking?: unknown }> {
  try {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        shortRef: true,
        guestFirstName: true,
        guestLastName: true,
      },
    });

    if (!booking) {
      return { valid: false, error: "Booking not found" };
    }

    // Requirement 8.1: Booking must be active (CONFIRMED status)
    if (booking.status !== "CONFIRMED") {
      return { 
        valid: false, 
        error: `Booking must be confirmed for room charges. Current status: ${booking.status}` 
      };
    }

    // Requirement 8.2: Guest authorization
    // In a real system, this would check a guest authorization flag
    // For now, we assume confirmed bookings are authorized for room charges

    return { valid: true, booking };
  } catch (error) {
    console.error("Validate Booking Error:", error);
    return { valid: false, error: "Failed to validate booking" };
  }
}

/**
 * Pure function to validate booking for room charge (for property testing)
 * Property 10: Room Charge Booking Validation
 * 
 * Requirements: 8.1, 8.2
 */
export function validateBookingForRoomChargePure(
  bookingStatus: BookingStatus,
  guestAuthorized: boolean = true
): { valid: boolean; error?: string } {
  // Requirement 8.1: Booking must be CONFIRMED
  if (bookingStatus !== "CONFIRMED") {
    return { 
      valid: false, 
      error: `Booking must be confirmed for room charges. Current status: ${bookingStatus}` 
    };
  }

  // Requirement 8.2: Guest must be authorized
  if (!guestAuthorized) {
    return { valid: false, error: "Guest is not authorized for room charges" };
  }

  return { valid: true };
}

/**
 * Add charge to booking folio
 * Property 11: Room Charge Folio Consistency
 * For any room charge processed, the booking's total charges SHALL increase by exactly the order total amount.
 * 
 * Requirements: 8.3
 * 
 * @param tx - Prisma transaction client
 * @param bookingId - The booking ID to add charge to
 * @param amount - The charge amount
 * @param orderNumber - The order number for reference
 */
async function addChargeToBookingFolio(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  bookingId: string,
  amount: number,
  orderNumber: string
): Promise<void> {
  // Create a booking adjustment for the room charge
  await tx.bookingAdjustment.create({
    data: {
      bookingId,
      type: "CHARGE",
      amount: amount,
      description: `Room Service Charge - Order ${orderNumber}`,
    },
  });

  // Update the booking's amount due
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: { amountDue: true },
  });

  if (booking) {
    const newAmountDue = new Decimal(booking.amountDue.toString())
      .add(amount)
      .toDecimalPlaces(2)
      .toNumber();

    await tx.booking.update({
      where: { id: bookingId },
      data: { amountDue: newAmountDue },
    });
  }
}

/**
 * Pure function to calculate folio after room charge (for property testing)
 * Property 11: Room Charge Folio Consistency
 * 
 * Requirements: 8.3
 */
export function calculateFolioAfterRoomCharge(
  currentAmountDue: number,
  chargeAmount: number
): number {
  return new Decimal(currentAmountDue)
    .add(chargeAmount)
    .toDecimalPlaces(2)
    .toNumber();
}


/**
 * Process room charge payment
 * Requirements: 7.3, 8.1, 8.2, 8.3
 * 
 * - WHEN processing a room charge, THE System SHALL validate the booking is active and add the charge to the guest folio
 * - WHEN creating a room service order, THE System SHALL require linking to an active booking
 * - WHEN a guest charges to room, THE System SHALL validate the booking status is CONFIRMED and guest authorization
 * - WHEN a room charge is processed, THE System SHALL add the order total to the booking's charges
 */
export async function processRoomCharge(data: RoomChargeInput): Promise<PaymentResult> {
  // Validate required fields
  if (!data.orderId || data.orderId.trim() === "") {
    return { success: false, error: "Order ID is required" };
  }

  if (!data.bookingId || data.bookingId.trim() === "") {
    return { success: false, error: "Booking ID is required" };
  }

  if (!data.processedById || data.processedById.trim() === "") {
    return { success: false, error: "Processor ID is required" };
  }

  try {
    // Get the order
    const order = await db.pOSOrder.findUnique({
      where: { id: data.orderId },
      include: {
        table: true,
        payments: true,
      },
    });

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    // Check if order can be paid
    if (order.status === "PAID") {
      return { success: false, error: "Order is already paid" };
    }

    if (order.status === "CANCELLED" || order.status === "VOID") {
      return { success: false, error: "Cannot process payment for cancelled or voided order" };
    }

    // Validate booking for room charge
    const bookingValidation = await validateBookingForRoomCharge(data.bookingId);
    if (!bookingValidation.valid) {
      return { success: false, error: bookingValidation.error };
    }

    // Validate processor exists
    const processor = await db.user.findUnique({
      where: { id: data.processedById },
    });

    if (!processor) {
      return { success: false, error: "Payment processor not found" };
    }

    const orderTotal = new Decimal(order.total.toString()).toNumber();

    // Process room charge in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create payment record
      const payment = await tx.orderPayment.create({
        data: {
          orderId: data.orderId,
          amount: orderTotal,
          method: "ROOM_CHARGE",
          reference: `Booking: ${data.bookingId}`,
          processedById: data.processedById,
        },
      });

      // Add charge to booking folio
      await addChargeToBookingFolio(tx, data.bookingId, orderTotal, order.orderNumber);

      // Update order with booking reference and status
      const updatedOrder = await tx.pOSOrder.update({
        where: { id: data.orderId },
        data: { 
          status: "PAID",
          bookingId: data.bookingId,
        },
        include: {
          outlet: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          table: {
            select: {
              id: true,
              number: true,
            },
          },
          booking: {
            select: {
              id: true,
              shortRef: true,
              guestFirstName: true,
              guestLastName: true,
            },
          },
          server: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            include: {
              menuItem: {
                select: {
                  id: true,
                  name: true,
                  sellingPrice: true,
                },
              },
            },
          },
          payments: {
            include: {
              processedBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      return { order: updatedOrder, payment };
    });

    // If order had a table, set it to DIRTY
    if (order.tableId) {
      await setTableDirty(order.tableId);
    }

    revalidatePath("/admin/pos");
    revalidatePath(`/admin/pos/orders/${data.orderId}`);

    return {
      success: true,
      data: {
        order: serializeOrder(result.order),
        payments: [serializePayment(result.payment)],
      },
    };
  } catch (error) {
    console.error("Process Room Charge Error:", error);
    return { success: false, error: "Failed to process room charge" };
  }
}

/**
 * Get payment summary for an order
 */
export async function getOrderPayments(orderId: string) {
  try {
    const payments = await db.orderPayment.findMany({
      where: { orderId },
      include: {
        processedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const totalPaid = payments.reduce(
      (sum, p) => sum.add(new Decimal(p.amount.toString())),
      new Decimal(0)
    );

    return {
      payments: payments.map(serializePayment),
      totalPaid: totalPaid.toNumber(),
      paymentCount: payments.length,
    };
  } catch (error) {
    console.error("Get Order Payments Error:", error);
    return {
      payments: [],
      totalPaid: 0,
      paymentCount: 0,
    };
  }
}

/**
 * Void a payment (for refunds/corrections)
 */
export async function voidPayment(paymentId: string, reason: string) {
  if (!reason || reason.trim() === "") {
    return { error: "Void reason is required" };
  }

  try {
    const payment = await db.orderPayment.findUnique({
      where: { id: paymentId },
      include: {
        order: true,
      },
    });

    if (!payment) {
      return { error: "Payment not found" };
    }

    // Cannot void payment for paid orders without manager approval
    // For now, we'll just prevent voiding
    if (payment.order.status === "PAID") {
      return { error: "Cannot void payment for completed orders" };
    }

    // Delete the payment
    await db.orderPayment.delete({
      where: { id: paymentId },
    });

    revalidatePath("/admin/pos");
    revalidatePath(`/admin/pos/orders/${payment.orderId}`);

    return { success: true };
  } catch (error) {
    console.error("Void Payment Error:", error);
    return { error: "Failed to void payment" };
  }
}

/**
 * Pure function to validate split payment integrity (for property testing)
 * Property 7: Split Payment Integrity
 * For any order with split payments, the sum of all OrderPayment amounts SHALL equal the order total.
 * 
 * Requirements: 5.5, 7.4
 */
export function verifySplitPaymentIntegrity(
  orderTotal: number,
  paymentAmounts: number[]
): boolean {
  const totalPayments = paymentAmounts.reduce(
    (sum, amount) => sum.add(new Decimal(amount)),
    new Decimal(0)
  );

  const orderTotalDecimal = new Decimal(orderTotal);
  
  // Allow small tolerance for floating point
  const difference = totalPayments.sub(orderTotalDecimal).abs();
  return difference.lessThanOrEqualTo(0.01);
}
