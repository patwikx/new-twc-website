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

    const result = await db.$transaction(async (tx) => {
        // Validate order exists
        const order = await tx.pOSOrder.findUnique({
          where: { id: orderId },
          include: { items: true },
        });

        if (!order) {
          throw new Error("Order not found");
        }

        if (order.status === "CANCELLED") {
          throw new Error("Order is already cancelled/voided");
        }
        
        // Ownership / Permission Check
        // If user is not the server who created it, must be Admin/Manager
        // If requires approval (approvedById is set and different from user), assume UI handled validation of approver credential
        // But here we rely on approvedById being passed. 
        // ideally we check if `approvedById` exists and has role.
        
        // TODO: Strict role check if needed. For now assume if approvedById is passed, it was validated by UI (Manager PIN).
        
        // Create void record
        await tx.orderVoid.create({
          data: {
            orderId,
            // voidType: "ORDER", 
            reason,
            // reasonCode,
            originalAmount: order.total,
            voidedById: session.user.id!,
            approvedById: approvedById,
            // notes,
          },
        });

        // Update order status
        await tx.pOSOrder.update({
          where: { id: orderId },
          data: {
            status: "CANCELLED", // Standardizing on CANCELLED
            items: {
                updateMany: {
                    where: {},
                    data: { status: "CANCELLED" }
                }
            }
          },
        });
        
        return true;
    });

    revalidatePath(`/admin/pos`);
    return { success: true };
  } catch (error) {
    console.error("Error voiding order:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to void order" };
  }
}

/**
 * Void a specific item line
 */
export async function voidOrderItem(data: {
  orderId: string;
  itemId: string;
  quantity: number; // For partial voids
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
        const { orderId, itemId, reason, reasonCode, approvedById, notes } = data;
        
        const result = await db.$transaction(async (tx) => {
            const item = await tx.pOSOrderItem.findUnique({ 
                where: { id: itemId },
                include: { order: true } // Need order to check serverId if strict ownership
            });
            
            if (!item) {
                 throw new Error("Item not found");
            }
            
            // Validate Ownership: Only Item Creator (Server) or Admin/Manager can void
            // Item doesn't have `createdById` usually, but Order has `serverId`.
            // Check session user role.
            const userRole = session.user.role;
            const isManager = ["ADMIN", "MANAGER", "Super Admin"].includes(userRole);
            const isOwner = item.order.serverId === session.user.id;
            
            if (!isOwner && !isManager && !approvedById) {
                // If not owner and not manager, and no approver (PIN not used), fail.
                // But `approvedById` might be self if authorized.
                throw new Error("Unauthorized to void this item");
            }

            const amount = Number(item.unitPrice) * item.quantity; // Voiding full line for now

            // Create void record
            await tx.orderVoid.create({
                data: {
                    orderId,
                    // voidType: "ITEM",
                    itemId,
                    reason,
                    // reasonCode,
                    originalAmount: amount,
                    voidedById: session.user.id!,
                    approvedById,
                    // notes,
                },
            });

            // Update item status
            await tx.pOSOrderItem.update({ 
                where: { id: itemId },
                data: { status: "CANCELLED" } 
            });
            
            // Update order total
            await tx.pOSOrder.update({
                where: { id: orderId },
                data: {
                    total: { decrement: amount }
                }
            });
            
            return true;
        });

        revalidatePath(`/admin/pos`);
        return { success: true };

    } catch (error) {
        console.error("Error voiding item:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to void item" };
    }
}
