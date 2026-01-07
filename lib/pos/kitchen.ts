"use server";

import { db } from "@/lib/db";
import { POSOrderStatus, OrderItemStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

// ============================================================================
// Kitchen Display Service
// Requirements: 6.1, 6.2, 6.3, 6.5
// ============================================================================

/**
 * Kitchen order item interface for KDS display
 */
export interface KitchenOrderItem {
  id: string;
  menuItemId: string;
  menuItemName: string;
  category: string;
  quantity: number;
  modifiers: string | null;
  notes: string | null;
  status: OrderItemStatus;
  sentToKitchenAt: Date | null;
  preparedAt: Date | null;
  ageMinutes: number;
}

/**
 * Kitchen order interface for KDS display
 */
export interface KitchenOrder {
  orderId: string;
  orderNumber: string;
  tableNumber: string | null;
  serverName: string | null;
  status: POSOrderStatus;
  items: KitchenOrderItem[];
  createdAt: Date;
  ageMinutes: number;
  isOverdue: boolean;
}

/**
 * Configuration for kitchen display
 */
export interface KitchenConfig {
  targetPrepTimeMinutes: number; // Default: 15 minutes
  warningThresholdMinutes: number; // Default: 10 minutes
}

const DEFAULT_KITCHEN_CONFIG: KitchenConfig = {
  targetPrepTimeMinutes: 15,
  warningThresholdMinutes: 10,
};

/**
 * Calculate age in minutes from a given date
 */
function calculateAgeMinutes(fromDate: Date): number {
  const now = new Date();
  const ageMs = now.getTime() - fromDate.getTime();
  return Math.floor(ageMs / 60000);
}

/**
 * Get orders for kitchen display
 * Requirements: 6.1, 6.4
 * 
 * - WHEN an order is sent to kitchen, THE System SHALL display order items on the KDS grouped by preparation station
 * - THE System SHALL display order age and highlight orders exceeding target preparation time
 * 
 * @param outletId - The outlet ID to get kitchen orders for
 * @param config - Optional kitchen configuration
 * @returns Array of kitchen orders with calculated age and overdue status
 */
export async function getKitchenOrders(
  outletId: string,
  config: KitchenConfig = DEFAULT_KITCHEN_CONFIG
): Promise<KitchenOrder[]> {
  try {
    // Validate outlet ID
    if (!outletId || outletId.trim() === "") {
      return [];
    }

    // Get orders that are in kitchen-relevant statuses
    const orders = await db.pOSOrder.findMany({
      where: {
        outletId,
        status: {
          in: ["SENT_TO_KITCHEN", "IN_PROGRESS"],
        },
      },
      include: {
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
          where: {
            status: {
              in: ["SENT", "PREPARING"],
            },
          },
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                category: true,
              },
            },
          },
          orderBy: { sentToKitchenAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Transform orders into kitchen display format
    const kitchenOrders: KitchenOrder[] = orders.map(order => {
      const orderAgeMinutes = calculateAgeMinutes(order.createdAt);
      
      // Transform items with age calculation
      const kitchenItems: KitchenOrderItem[] = order.items.map(item => {
        const itemAgeMinutes = item.sentToKitchenAt 
          ? calculateAgeMinutes(item.sentToKitchenAt)
          : orderAgeMinutes;

        return {
          id: item.id,
          menuItemId: item.menuItemId,
          menuItemName: item.menuItem.name,
          category: typeof item.menuItem.category === 'string' ? item.menuItem.category : item.menuItem.category.name,
          quantity: item.quantity,
          modifiers: item.modifiers,
          notes: item.notes,
          status: item.status,
          sentToKitchenAt: item.sentToKitchenAt,
          preparedAt: item.preparedAt,
          ageMinutes: itemAgeMinutes,
        };
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        tableNumber: order.table?.number ?? null,
        serverName: order.server?.name ?? null,
        status: order.status,
        items: kitchenItems,
        createdAt: order.createdAt,
        ageMinutes: orderAgeMinutes,
        isOverdue: orderAgeMinutes > config.targetPrepTimeMinutes,
      };
    });

    return kitchenOrders;
  } catch (error) {
    console.error("Get Kitchen Orders Error:", error);
    return [];
  }
}

/**
 * Get kitchen orders grouped by category/station
 * Requirements: 6.1
 * 
 * - WHEN an order is sent to kitchen, THE System SHALL display order items on the KDS grouped by preparation station
 * 
 * @param outletId - The outlet ID to get kitchen orders for
 * @returns Kitchen orders grouped by menu category
 */
export async function getKitchenOrdersByStation(outletId: string): Promise<Record<string, KitchenOrder[]>> {
  const orders = await getKitchenOrders(outletId);
  
  // Group orders by the primary category of their items
  const groupedOrders: Record<string, KitchenOrder[]> = {};
  
  for (const order of orders) {
    // Get unique categories from order items
    const categories = [...new Set(order.items.map(item => item.category))];
    
    for (const category of categories) {
      if (!groupedOrders[category]) {
        groupedOrders[category] = [];
      }
      
      // Create a filtered version of the order with only items from this category
      const filteredOrder: KitchenOrder = {
        ...order,
        items: order.items.filter(item => item.category === category),
      };
      
      // Only add if there are items in this category
      if (filteredOrder.items.length > 0) {
        groupedOrders[category].push(filteredOrder);
      }
    }
  }
  
  return groupedOrders;
}

/**
 * Mark an order item as preparing
 * Requirements: 6.2
 * 
 * - WHEN a kitchen staff marks an item as preparing, THE System SHALL update the OrderItem status to PREPARING
 * 
 * @param itemId - The order item ID to mark as preparing
 * @returns The updated order item or error
 */
export async function markItemPreparing(itemId: string) {
  // Validate item ID
  if (!itemId || itemId.trim() === "") {
    return { error: "Item ID is required" };
  }

  try {
    // Get the order item
    const orderItem = await db.pOSOrderItem.findUnique({
      where: { id: itemId },
      include: {
        order: {
          select: {
            id: true,
            status: true,
            outletId: true,
          },
        },
      },
    });

    if (!orderItem) {
      return { error: "Order item not found" };
    }

    // Validate current status - can only mark as preparing from SENT status
    if (orderItem.status !== "SENT") {
      return { 
        error: `Cannot mark item as preparing from status ${orderItem.status}. Item must be in SENT status.` 
      };
    }

    const now = new Date();

    // Update the item status
    const updatedItem = await db.pOSOrderItem.update({
      where: { id: itemId },
      data: {
        status: "PREPARING",
        preparedAt: now,
      },
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
      },
    });

    // Update order status to IN_PROGRESS if it's still SENT_TO_KITCHEN
    if (orderItem.order.status === "SENT_TO_KITCHEN") {
      await db.pOSOrder.update({
        where: { id: orderItem.order.id },
        data: { status: "IN_PROGRESS" },
      });
    }

    revalidatePath("/admin/pos/kitchen");
    revalidatePath(`/admin/pos/orders/${orderItem.order.id}`);
    
    // Serialize Decimal to Number for client components
    return { 
      success: true, 
      data: {
        ...updatedItem,
        unitPrice: Number(updatedItem.unitPrice),
      }
    };
  } catch (error) {
    console.error("Mark Item Preparing Error:", error);
    return { error: "Failed to mark item as preparing" };
  }
}

/**
 * Mark an order item as ready
 * Requirements: 6.3, 6.5
 * 
 * - WHEN a kitchen staff marks an item as ready, THE System SHALL update the OrderItem status to READY and notify the server
 * - WHEN all items in an order are ready, THE System SHALL update the order status to READY
 * 
 * @param itemId - The order item ID to mark as ready
 * @returns The updated order item or error
 */
export async function markItemReady(itemId: string) {
  // Validate item ID
  if (!itemId || itemId.trim() === "") {
    return { error: "Item ID is required" };
  }

  try {
    // Get the order item
    const orderItem = await db.pOSOrderItem.findUnique({
      where: { id: itemId },
      include: {
        order: {
          select: {
            id: true,
            status: true,
            outletId: true,
          },
        },
      },
    });

    if (!orderItem) {
      return { error: "Order item not found" };
    }

    // Validate current status - can only mark as ready from PREPARING status
    if (orderItem.status !== "PREPARING") {
      return { 
        error: `Cannot mark item as ready from status ${orderItem.status}. Item must be in PREPARING status.` 
      };
    }

    // Update the item status
    const updatedItem = await db.pOSOrderItem.update({
      where: { id: itemId },
      data: {
        status: "READY",
      },
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
      },
    });

    // Check if all items in the order are ready (or served/cancelled)
    // Requirements: 6.5 - WHEN all items in an order are ready, THE System SHALL update the order status to READY
    const allOrderItems = await db.pOSOrderItem.findMany({
      where: { orderId: orderItem.order.id },
      select: { status: true },
    });

    const allItemsReady = allOrderItems.every(
      item => item.status === "READY" || item.status === "SERVED" || item.status === "CANCELLED"
    );

    if (allItemsReady) {
      await db.pOSOrder.update({
        where: { id: orderItem.order.id },
        data: { status: "READY" },
      });
    }

    revalidatePath("/admin/pos/kitchen");
    revalidatePath(`/admin/pos/orders/${orderItem.order.id}`);
    
    // Serialize Decimal to Number for client components
    return { 
      success: true, 
      data: {
        ...updatedItem,
        unitPrice: Number(updatedItem.unitPrice),
      }
    };
  } catch (error) {
    console.error("Mark Item Ready Error:", error);
    return { error: "Failed to mark item as ready" };
  }
}

/**
 * Mark all items in an order as ready
 * Requirements: 6.5
 * 
 * @param orderId - The order ID to mark all items as ready
 * @returns Success or error
 */
export async function markOrderReady(orderId: string) {
  // Validate order ID
  if (!orderId || orderId.trim() === "") {
    return { error: "Order ID is required" };
  }

  try {
    // Get the order with items
    const order = await db.pOSOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          where: {
            status: {
              in: ["SENT", "PREPARING"],
            },
          },
        },
      },
    });

    if (!order) {
      return { error: "Order not found" };
    }

    // Check if order is in a valid status
    if (!["SENT_TO_KITCHEN", "IN_PROGRESS"].includes(order.status)) {
      return { error: `Cannot mark order as ready from status ${order.status}` };
    }

    // Check if there are items to mark as ready
    if (order.items.length === 0) {
      return { error: "No items to mark as ready" };
    }

    // Update all items to READY and order status to READY
    await db.$transaction([
      db.pOSOrderItem.updateMany({
        where: {
          orderId,
          status: { in: ["SENT", "PREPARING"] },
        },
        data: { status: "READY" },
      }),
      db.pOSOrder.update({
        where: { id: orderId },
        data: { status: "READY" },
      }),
    ]);

    revalidatePath("/admin/pos/kitchen");
    revalidatePath(`/admin/pos/orders/${orderId}`);
    
    return { success: true };
  } catch (error) {
    console.error("Mark Order Ready Error:", error);
    return { error: "Failed to mark order as ready" };
  }
}

/**
 * Get kitchen statistics for an outlet
 * 
 * @param outletId - The outlet ID to get statistics for
 * @returns Kitchen statistics including pending orders, average prep time, etc.
 */
export async function getKitchenStats(outletId: string) {
  try {
    const orders = await getKitchenOrders(outletId);
    
    const totalOrders = orders.length;
    const overdueOrders = orders.filter(o => o.isOverdue).length;
    const totalItems = orders.reduce((sum, o) => sum + o.items.length, 0);
    const preparingItems = orders.reduce(
      (sum, o) => sum + o.items.filter(i => i.status === "PREPARING").length, 
      0
    );
    const sentItems = orders.reduce(
      (sum, o) => sum + o.items.filter(i => i.status === "SENT").length, 
      0
    );
    
    // Calculate average order age
    const avgAgeMinutes = totalOrders > 0
      ? Math.round(orders.reduce((sum, o) => sum + o.ageMinutes, 0) / totalOrders)
      : 0;

    return {
      totalOrders,
      overdueOrders,
      totalItems,
      preparingItems,
      sentItems,
      avgAgeMinutes,
    };
  } catch (error) {
    console.error("Get Kitchen Stats Error:", error);
    return {
      totalOrders: 0,
      overdueOrders: 0,
      totalItems: 0,
      preparingItems: 0,
      sentItems: 0,
      avgAgeMinutes: 0,
    };
  }
}

/**
 * Get overdue orders for an outlet
 * Requirements: 6.4
 * 
 * - THE System SHALL display order age and highlight orders exceeding target preparation time
 * 
 * @param outletId - The outlet ID to get overdue orders for
 * @param thresholdMinutes - Optional threshold in minutes (default: 15)
 * @returns Array of overdue kitchen orders
 */
export async function getOverdueOrders(
  outletId: string,
  thresholdMinutes: number = 15
): Promise<KitchenOrder[]> {
  const orders = await getKitchenOrders(outletId, {
    targetPrepTimeMinutes: thresholdMinutes,
    warningThresholdMinutes: thresholdMinutes - 5,
  });
  
  return orders.filter(order => order.isOverdue);
}

/**
 * Bump an order (move it to the front of the queue)
 * This is a common kitchen operation to prioritize certain orders
 * 
 * @param orderId - The order ID to bump
 * @returns Success or error
 */
export async function bumpOrder(orderId: string) {
  // Validate order ID
  if (!orderId || orderId.trim() === "") {
    return { error: "Order ID is required" };
  }

  try {
    // Get the order
    const order = await db.pOSOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        outletId: true,
        notes: true,
      },
    });

    if (!order) {
      return { error: "Order not found" };
    }

    // Check if order is in kitchen
    if (!["SENT_TO_KITCHEN", "IN_PROGRESS"].includes(order.status)) {
      return { error: "Order is not in kitchen" };
    }

    // Update the order's notes to indicate it was bumped
    // Note: In a production system, you might want a separate "priority" field
    const bumpNote = `[BUMPED at ${new Date().toISOString()}]`;
    const updatedNotes = order.notes ? `${order.notes}\n${bumpNote}` : bumpNote;

    await db.pOSOrder.update({
      where: { id: orderId },
      data: {
        notes: updatedNotes,
      },
    });

    revalidatePath("/admin/pos/kitchen");
    
    return { success: true };
  } catch (error) {
    console.error("Bump Order Error:", error);
    return { error: "Failed to bump order" };
  }
}

/**
 * Cancel a kitchen item
 * 
 * @param itemId - The order item ID to cancel
 * @param reason - Optional reason for cancellation
 * @returns Success or error
 */
export async function cancelKitchenItem(itemId: string, reason?: string) {
  // Validate item ID
  if (!itemId || itemId.trim() === "") {
    return { error: "Item ID is required" };
  }

  try {
    // Get the order item
    const orderItem = await db.pOSOrderItem.findUnique({
      where: { id: itemId },
      include: {
        order: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!orderItem) {
      return { error: "Order item not found" };
    }

    // Can only cancel items that haven't been served
    if (orderItem.status === "SERVED") {
      return { error: "Cannot cancel item that has already been served" };
    }

    if (orderItem.status === "CANCELLED") {
      return { error: "Item is already cancelled" };
    }

    // Update the item status
    const updatedItem = await db.pOSOrderItem.update({
      where: { id: itemId },
      data: {
        status: "CANCELLED",
        notes: reason 
          ? `${orderItem.notes ? orderItem.notes + "\n" : ""}Cancelled: ${reason}`
          : orderItem.notes,
      },
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
      },
    });

    revalidatePath("/admin/pos/kitchen");
    revalidatePath(`/admin/pos/orders/${orderItem.order.id}`);
    
    // Serialize Decimal to Number for client components
    return { 
      success: true, 
      data: {
        ...updatedItem,
        unitPrice: Number(updatedItem.unitPrice),
      }
    };
  } catch (error) {
    console.error("Cancel Kitchen Item Error:", error);
    return { error: "Failed to cancel item" };
  }
}
