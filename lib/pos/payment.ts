"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { PaymentMethod, POSOrderStatus } from "@prisma/client";
import { auth } from "@/auth";

export interface ProcessPaymentInput {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
}

export async function processPayment(data: ProcessPaymentInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Unauthorized" };
    }

    const order = await db.pOSOrder.findUnique({
      where: { id: data.orderId },
      include: { 
        payments: true,
        items: true,
        outlet: true,
      }
    });

    if (!order) {
      return { error: "Order not found" };
    }

    if (order.status === "PAID" || order.status === "CANCELLED" || order.status === "VOID") {
      return { error: `Order is already ${order.status}` };
    }

    // Handle Room Charge specific logic
    if (data.method === "ROOM_CHARGE") {
        if (!order.bookingId) {
            return { error: "No hotel guest assigned for Room Charge" };
        }

        // Create Booking Adjustment (Charge)
        await db.bookingAdjustment.create({
            data: {
                bookingId: order.bookingId,
                type: "CHARGE", // Add to bill
                amount: data.amount,
                description: `POS Order #${order.orderNumber.split('-').pop()} - ${order.outlet.name}`,
                createdById: session.user.id
            }
        });
    }

    // Serialize Decimal amounts for calculation
    const currentTotalPaid = order.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const orderTotal = Number(order.total);
    const remainingBalance = orderTotal - currentTotalPaid;

    // Validate payment amount (allow overpayment for cash, but logically handle it)
    if (data.amount <= 0) {
      return { error: "Invalid payment amount" };
    }

    // Create Payment Record
    const payment = await db.orderPayment.create({
      data: {
        orderId: data.orderId,
        amount: data.amount,
        method: data.method,
        reference: data.reference,
        processedById: session.user.id,
      }
    });

    // Check if fully paid
    const newTotalPaid = currentTotalPaid + data.amount;
    const isFullyPaid = newTotalPaid >= (orderTotal - 0.01); // 0.01 tolerance

    let updatedOrder = order;

    if (isFullyPaid) {
      updatedOrder = await db.pOSOrder.update({
        where: { id: data.orderId },
        data: {
          status: "PAID"
        },
        include: {
            payments: true,
            items: true,
            outlet: true
        }
      });
      
      // Release table if occupied
      if (order.tableId) {
        await db.pOSTable.update({
            where: { id: order.tableId },
            data: { status: "DIRTY" } // Mark as Dirty after payment/leaving
        });
      }
    }

    revalidatePath("/admin/pos");
    revalidatePath(`/admin/pos/orders/${data.orderId}`);

    return { 
        success: true, 
        isFullyPaid, 
        change: Math.max(0, newTotalPaid - orderTotal) 
    };

  } catch (error) {
    console.error("Process Payment Error:", error);
    return { error: "Failed to process payment" };
  }
}
