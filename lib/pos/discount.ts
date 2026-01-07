"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

/**
 * Verify manager PIN for approvals
 */
export async function verifyManagerPin(pin: string) {
  // In a real app, this would check against a hashed PIN in the clear
  // For now, we'll assume any user with MANAGER or ADMIN role has a PIN
  // And we'll use a hardcoded PIN "1234" or check if the PIN matches their "employeeId" or something similar
  
  // TODO: Implement proper PIN verification against user record
  // For prototype: we'll check if the PIN is "1234" or "9999" and return the current user if they are a manager
  // OR we find a user with this PIN
  
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  // Temporary: Check if current user is manager/admin
  const currentUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true, userRole: { select: { name: true } } },
  });

  const role = currentUser?.userRole?.name || currentUser?.role;
  const isManager = ["MANAGER", "ADMIN"].includes(role || "");

  if (isManager && (pin === "1234" || pin === "9999")) {
    return {
      success: true,
      managerId: currentUser!.id,
      managerName: currentUser!.name || "Manager",
    };
  }

  // Also allow searching for a manager by PIN if we store it (we don't yet in schema)
  // return { success: false, error: "Invalid PIN" };
  
  // Mock success for development if PIN is 1234
  if (pin === "1234") {
    return {
      success: true,
      managerId: "mock-manager-id",
      managerName: "Admin User",
    };
  }

  return { success: false, error: "Invalid PIN" };
}

/**
 * Apply discount to an order
 */
export async function applyOrderDiscount(data: {
  orderId: string;
  discountTypeId: string;
  amount: number;
  percentage: number;
  idNumber?: string;
  approvedById?: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const { orderId, discountTypeId, amount, percentage, idNumber, approvedById, notes } = data;

    // Validate order exists and is open
    const order = await db.pOSOrder.findUnique({
      where: { id: orderId },
      include: { orderDiscounts: true },
    });

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    if (order.status !== "OPEN" && order.status !== "IN_PROGRESS" && order.status !== "SENT_TO_KITCHEN") {
      return { success: false, error: "Cannot discount a closed or cancelled order" };
    }

    // Create the discount record
    await db.orderDiscount.create({
      data: {
        orderId,
        discountTypeId,
        amount,
        percentage, // Convert decimal to float if needed or store as is
        idNumber,
        // appliedById: session.user.id, // Removed as it's not in schema
        approvedById,
        notes,
      },
    });

    // Update the order total
    // We need to re-calculate taxes and totals based on the new discount
    // This logic should ideally be shared or robust
    
    // For now, we assume frontend sends the correct amount, or we re-calculate
    // Let's just update the total by subtracting the discount amount for now
    // In a real system, you'd recalculate everything from lines up
    
    await db.pOSOrder.update({
      where: { id: orderId },
      data: {
        total: {
          decrement: amount,
        },
      },
    });

    revalidatePath(`/admin/pos`);
    return { success: true };
  } catch (error) {
    console.error("Error applying discount:", error);
    return { success: false, error: "Failed to apply discount" };
  }
}

/**
 * Get available discount types
 */
export async function getDiscountTypes(propertyId: string) {
  const discountTypes = await db.discountType.findMany({
    where: {
      propertyId,
      isActive: true,
    },
    orderBy: { name: "asc" },
  });

  // Convert Prisma Decimal types to plain numbers for frontend compatibility
  return discountTypes.map((dt) => ({
    id: dt.id,
    code: dt.code,
    name: dt.name,
    description: dt.description,
    percentage: Number(dt.percentage),
    requiresId: dt.requiresId,
    requiresApproval: dt.requiresApproval,
    maxAmount: dt.maxAmount ? Number(dt.maxAmount) : null,
  }));
}
