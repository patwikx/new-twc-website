"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

/**
 * Void an entire order
 */
export async function voidOrder(data: {
  orderId: string;
  reason: string;
  reasonCode: string;
  approvedById: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const { orderId, reason, reasonCode, approvedById, notes } = data;

    // Validate order exists
    const order = await db.pOSOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    if (order.status === "CANCELLED" || order.status === "VOIDED") {
      return { success: false, error: "Order is already cancelled/voided" };
    }

    // Create void record
    await db.orderVoid.create({
      data: {
        orderId,
        // voidType: "ORDER", // Not in schema
        reason,
        // reasonCode, // Not in schema
        originalAmount: order.total,
        voidedById: session.user.id,
        approvedById,
        // notes, // Not in schema
      },
    });

    // Update order status
    await db.pOSOrder.update({
      where: { id: orderId },
      data: {
        status: "CANCELLED", // Use CANCELLED instead of VOIDED
        // Do we reset total? Or keep it for record but mark status?
        // Usually voided orders keep their total but aren't counted in sales due to status
        // But for consistency we might zero it out or keep it. 
        // Let's keep total but status VOIDED implies 0 revenue.
        items: {
            updateMany: {
                where: {},
                data: { status: "CANCELLED" } // Use CANCELLED instead of VOIDED
            }
        }
      },
    });

    revalidatePath(`/admin/pos`);
    return { success: true };
  } catch (error) {
    console.error("Error voiding order:", error);
    return { success: false, error: "Failed to void order" };
  }
}

/**
 * Void a specific item line
 */
export async function voidOrderItem(data: {
  orderId: string;
  itemId: string;
  quantity: number; // For partial voids (not yet in schema but good to have API)
  reason: string;
  reasonCode: string;
  approvedById: string;
  notes?: string;
}) {
    // Schema doesn't support partial voids on OrderItem easily without splitting the item
    // For now we'll assume we void the entire line item
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Not authenticated" };
    }

    try {
        const { orderId, itemId, reason, reasonCode, approvedById, notes } = data;
        
        const item = await db.pOSOrderItem.findUnique({ // Fix model name
            where: { id: itemId }
        });
        
        if (!item) {
             return { success: false, error: "Item not found" };
        }
        
        const amount = Number(item.unitPrice) * item.quantity;

        // Create void record
        await db.orderVoid.create({
            data: {
                orderId,
                // voidType: "ITEM", // Not in schema
                itemId,
                reason,
                // reasonCode, // Not in schema
                originalAmount: amount,
                voidedById: session.user.id,
                approvedById,
                // notes, // Not in schema
            },
        });

        // Update item status
        await db.pOSOrderItem.update({ // Fix model name
            where: { id: itemId },
            data: { status: "CANCELLED" } // Use CANCELLED instead of VOIDED
        });
        
        // Update order total
        await db.pOSOrder.update({
            where: { id: orderId },
            data: {
                total: { decrement: amount }
            }
        });

        revalidatePath(`/admin/pos`);
        return { success: true };

    } catch (error) {
        console.error("Error voiding item:", error);
        return { success: false, error: "Failed to void item" };
    }
}
