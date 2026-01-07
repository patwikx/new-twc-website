"use server";

import { db } from "@/lib/db";
import { POSOrderStatus, OrderItemStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import { setTableOccupied, setTableDirty } from "./table";
import { isValidOrderStatusTransition, isValidItemStatusTransition } from "./order-utils";
import { getPropertyContext, getPropertyFilter } from "@/lib/property-context";
import { updateMenuItemAvailability } from "@/lib/inventory/menu-availability";

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
export interface CreateOrderInput {
  outletId: string;
  serverId: string;
  tableId?: string;
  bookingId?: string;
  guestId?: string;
  notes?: string;
}

export interface AddOrderItemInput {
  orderId: string;
  menuItemId: string;
  quantity: number;
  modifiers?: string;
  notes?: string;
}

export interface OrderSearchQuery {
  outletId?: string;
  status?: POSOrderStatus;
  serverId?: string;
  tableId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

// Valid order statuses
const VALID_ORDER_STATUSES: POSOrderStatus[] = [
  "OPEN",
  "SENT_TO_KITCHEN",
  "IN_PROGRESS",
  "READY",
  "SERVED",
  "PAID",
  "CANCELLED",
  "VOID",
];

// Valid order item statuses
const VALID_ITEM_STATUSES: OrderItemStatus[] = [
  "PENDING",
  "SENT",
  "PREPARING",
  "READY",
  "SERVED",
  "CANCELLED",
];

/**
 * Generate a unique order number
 * Format: ORD-YYYYMMDD-XXXX (e.g., ORD-20260104-0001)
 * Requirements: 5.1
 */
async function generateOrderNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `ORD-${dateStr}-`;

  // Get the count of orders created today
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const todayOrderCount = await db.pOSOrder.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lt: endOfDay,
      },
    },
  });

  const sequenceNumber = (todayOrderCount + 1).toString().padStart(4, "0");
  return `${prefix}${sequenceNumber}`;
}

// ============================================================================
// Order CRUD Operations
// ============================================================================

/**
 * Create a new order
 * Requirements: 5.1, 13.2
 * 
 * - WHEN creating an order, THE System SHALL generate a unique order number and associate it with an outlet and server
 * - WHEN an order is created for a table, THE System SHALL automatically set the table status to OCCUPIED (Req 4.3)
 * - WHILE a shift is open, THE System SHALL associate all orders processed by that cashier with the shift (Req 13.2)
 * 
 * Property 19: Shift Order Association
 * For any order created while a cashier has an open shift, the order SHALL be associated with that shift.
 */
export async function createOrder(data: CreateOrderInput) {
  // Validate required fields
  if (!data.outletId || data.outletId.trim() === "") {
    return { error: "Outlet ID is required" };
  }

  if (!data.serverId || data.serverId.trim() === "") {
    return { error: "Server ID is required" };
  }

  try {
    // Check if outlet exists and is active
    const outlet = await db.salesOutlet.findUnique({
      where: { id: data.outletId },
      include: {
        property: {
          select: {
            id: true,
            taxRate: true,
            serviceChargeRate: true,
          },
        },
      },
    });

    if (!outlet) {
      return { error: "Sales outlet not found" };
    }

    if (!outlet.isActive) {
      return { error: "Cannot create orders for inactive outlets" };
    }

    // Check if server exists
    const server = await db.user.findUnique({
      where: { id: data.serverId },
    });

    if (!server) {
      return { error: "Server not found" };
    }

    // Requirement 13.2: Check if server has an open shift and associate order with it
    // Property 19: Shift Order Association
    const openShift = await db.shift.findFirst({
      where: {
        cashierId: data.serverId,
        status: "OPEN",
      },
      select: { id: true },
    });

    // Note: We don't require an open shift for order creation, but if one exists, we associate it
    // This allows flexibility for different operational modes
    const shiftId = openShift?.id || null;

    // If table is provided, validate it
    if (data.tableId) {
      const table = await db.pOSTable.findUnique({
        where: { id: data.tableId },
      });

      if (!table) {
        return { error: "Table not found" };
      }

      if (table.outletId !== data.outletId) {
        return { error: "Table does not belong to this outlet" };
      }

      // Check if table already has an active order
      const activeOrder = await db.pOSOrder.findFirst({
        where: {
          tableId: data.tableId,
          status: {
            in: ["OPEN", "SENT_TO_KITCHEN", "IN_PROGRESS", "READY", "SERVED"],
          },
        },
      });

      if (activeOrder) {
        return { error: "Table already has an active order" };
      }
    }

    // If booking is provided, validate it
    if (data.bookingId) {
      const booking = await db.booking.findUnique({
        where: { id: data.bookingId },
      });

      if (!booking) {
        return { error: "Booking not found" };
      }

      if (booking.status !== "CONFIRMED") {
        return { error: "Booking must be confirmed for room service orders" };
      }
    }

    // Generate unique order number
    const orderNumber = await generateOrderNumber();

    // Create the order with zero totals (will be calculated when items are added)
    // Property 19: Associate order with shift if server has an open shift
    const order = await db.pOSOrder.create({
      data: {
        orderNumber,
        outletId: data.outletId,
        serverId: data.serverId,
        tableId: data.tableId || null,
        bookingId: data.bookingId || null,
        guestId: data.guestId || null,
        shiftId: shiftId, // Associate with open shift (Requirement 13.2)
        notes: data.notes || null,
        status: "OPEN",
        subtotal: 0,
        taxAmount: 0,
        serviceCharge: 0,
        discountAmount: 0,
        tipAmount: 0,
        total: 0,
      },
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            type: true,
            propertyId: true,
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
        items: true,
      },
    });

    // If table is provided, set it to OCCUPIED (Requirement 4.3)
    if (data.tableId) {
      await setTableOccupied(data.tableId);
    }

    revalidatePath("/admin/pos");
    revalidatePath("/admin/pos/orders");
    return { success: true, data: serializeOrder(order) };
  } catch (error) {
    console.error("Create Order Error:", error);
    return { error: "Failed to create order" };
  }
}

/**
 * Get an order by ID
 */
export async function getOrderById(id: string) {
  try {
    const order = await db.pOSOrder.findUnique({
      where: { id },
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            type: true,
            propertyId: true,
            property: {
              select: {
                taxRate: true,
                serviceChargeRate: true,
              },
            },
          },
        },
        table: {
          select: {
            id: true,
            number: true,
            capacity: true,
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
                category: true,
                sellingPrice: true,
                imageUrl: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
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
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return order;
  } catch (error) {
    console.error("Get Order Error:", error);
    return null;
  }
}

/**
 * Get orders with optional filtering
 * Requirements: 1.1, 1.2
 * 
 * Property 1: Property Scope Filtering
 * For any data query executed while a user has a specific property selected,
 * all returned records SHALL belong to that property.
 */
export async function getOrders(query?: OrderSearchQuery) {
  try {
    const where: Prisma.POSOrderWhereInput = {};

    // Apply property context filtering through outlet relation (Requirements 1.1, 1.2)
    if (query?.outletId) {
      where.outletId = query.outletId;
    } else {
      // Get property filter from context and apply through outlet relation
      const propertyFilter = await getPropertyFilter();
      if (propertyFilter.propertyId) {
        where.outlet = { propertyId: propertyFilter.propertyId };
      }
    }

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.serverId) {
      where.serverId = query.serverId;
    }

    if (query?.tableId) {
      where.tableId = query.tableId;
    }

    if (query?.startDate || query?.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = query.startDate;
      }
      if (query.endDate) {
        where.createdAt.lte = query.endDate;
      }
    }

    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const [orders, total] = await Promise.all([
      db.pOSOrder.findMany({
        where,
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
          _count: {
            select: {
              items: true,
              payments: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.pOSOrder.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Get Orders Error:", error);
    return {
      orders: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    };
  }
}

// ============================================================================
// Order Item Operations
// ============================================================================

/**
 * Add an item to an order
 * Requirements: 5.2, 5.6
 * 
 * - WHEN adding items to an order, THE System SHALL validate menu item availability and calculate line totals
 * - IF a menu item is unavailable (86'd), THEN THE System SHALL prevent adding it to orders
 */
export async function addOrderItem(data: AddOrderItemInput) {
  // Validate required fields
  if (!data.orderId || data.orderId.trim() === "") {
    return { error: "Order ID is required" };
  }

  if (!data.menuItemId || data.menuItemId.trim() === "") {
    return { error: "Menu item ID is required" };
  }

  if (!data.quantity || data.quantity < 1) {
    return { error: "Quantity must be at least 1" };
  }

  try {
    // Get the order
    const order = await db.pOSOrder.findUnique({
      where: { id: data.orderId },
      include: {
        outlet: {
          select: {
            propertyId: true,
            property: {
              select: {
                taxRate: true,
                serviceChargeRate: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return { error: "Order not found" };
    }

    // Check if order can be modified
    // Allow adding items to any active order status (OPEN, SENT_TO_KITCHEN, IN_PROGRESS, READY, SERVED)
    // Only block if PAID, CANCELLED, or VOID
    if (["PAID", "CANCELLED", "VOID"].includes(order.status)) {
      return { error: `Cannot add items to order with status ${order.status}` };
    }
    
    // Legacy check just in case, but the above exclusion is better
    const allowedStatuses = ["OPEN", "SENT_TO_KITCHEN", "IN_PROGRESS", "READY", "SERVED"];
    if (!allowedStatuses.includes(order.status)) {
       // Only if we introduce new statuses that shouldn't allow adding
       return { error: `Cannot add items to order in its current status (${order.status})` };
    }

    // Get the menu item
    const menuItem = await db.menuItem.findUnique({
      where: { id: data.menuItemId },
    });

    if (!menuItem) {
      return { error: "Menu item not found" };
    }

    // Requirement 5.6: Check if menu item is available
    if (!menuItem.isAvailable) {
      return { 
        error: `Menu item "${menuItem.name}" is unavailable${menuItem.unavailableReason ? `: ${menuItem.unavailableReason}` : ""}` 
      };
    }

    // Check if menu item belongs to the same property
    if (menuItem.propertyId !== order.outlet.propertyId) {
      return { error: "Menu item does not belong to this property" };
    }

    // Create the order item
    const orderItem = await db.pOSOrderItem.create({
      data: {
        orderId: data.orderId,
        menuItemId: data.menuItemId,
        quantity: data.quantity,
        unitPrice: menuItem.sellingPrice,
        modifiers: data.modifiers || null,
        notes: data.notes || null,
        status: "PENDING",
      },
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
            category: true,
            sellingPrice: true,
            imageUrl: true,
          },
        },
      },
    });

    // Recalculate order totals
    await recalculateOrderTotals(data.orderId);

    // Update menu item availability in real-time
    // This recalculates available servings based on current stock
    const kitchenWarehouse = await db.warehouse.findFirst({
      where: {
        propertyId: order.outlet.propertyId,
        type: "KITCHEN",
        isActive: true,
      },
    });
    if (kitchenWarehouse) {
      // Fire and forget - don't block the order
      updateMenuItemAvailability(data.menuItemId, kitchenWarehouse.id).catch(console.error);
    }

    revalidatePath("/admin/pos");
    revalidatePath(`/admin/pos/orders/${data.orderId}`);
    return { success: true, data: serializeOrderItem(orderItem) };
  } catch (error) {
    console.error("Add Order Item Error:", error);
    return { error: "Failed to add item to order" };
  }
}

/**
 * Remove an item from an order
 * Requirements: 5.2
 */
export async function removeOrderItem(orderId: string, itemId: string) {
  try {
    // Get the order item
    const orderItem = await db.pOSOrderItem.findUnique({
      where: { id: itemId },
      include: {
        order: true,
      },
    });

    if (!orderItem) {
      return { error: "Order item not found" };
    }

    if (orderItem.orderId !== orderId) {
      return { error: "Item does not belong to this order" };
    }

    // Check if order can be modified - allow any active status
    const activeStatuses = ["OPEN", "SENT_TO_KITCHEN", "IN_PROGRESS", "READY", "SERVED"];
    if (!activeStatuses.includes(orderItem.order.status)) {
      return { error: `Cannot remove items from order with status ${orderItem.order.status}` };
    }

    // Check if item has been sent to kitchen
    if (orderItem.status !== "PENDING") {
      return { error: "Cannot remove item that has already been sent to kitchen" };
    }

    // Delete the order item
    await db.pOSOrderItem.delete({
      where: { id: itemId },
    });

    // Recalculate order totals
    await recalculateOrderTotals(orderId);

    revalidatePath("/admin/pos");
    revalidatePath(`/admin/pos/orders/${orderId}`);
    return { success: true };
  } catch (error) {
    console.error("Remove Order Item Error:", error);
    return { error: "Failed to remove item from order" };
  }
}

/**
 * Update order item quantity
 */
export async function updateOrderItemQuantity(
  orderId: string,
  itemId: string,
  quantity: number
) {
  if (quantity < 1) {
    return { error: "Quantity must be at least 1" };
  }

  try {
    // Get the order item
    const orderItem = await db.pOSOrderItem.findUnique({
      where: { id: itemId },
      include: {
        order: true,
      },
    });

    if (!orderItem) {
      return { error: "Order item not found" };
    }

    if (orderItem.orderId !== orderId) {
      return { error: "Item does not belong to this order" };
    }

    // Check if order can be modified - allow any active status
    const activeStatuses = ["OPEN", "SENT_TO_KITCHEN", "IN_PROGRESS", "READY", "SERVED"];
    if (!activeStatuses.includes(orderItem.order.status)) {
      return { error: `Cannot modify items in order with status ${orderItem.order.status}` };
    }

    // Check if item has been sent to kitchen
    if (orderItem.status !== "PENDING") {
      return { error: "Cannot modify item that has already been sent to kitchen" };
    }

    // Update the quantity
    const updatedItem = await db.pOSOrderItem.update({
      where: { id: itemId },
      data: { quantity },
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
            category: true,
            sellingPrice: true,
            imageUrl: true,
          },
        },
      },
    });

    // Recalculate order totals
    await recalculateOrderTotals(orderId);

    revalidatePath("/admin/pos");
    revalidatePath(`/admin/pos/orders/${orderId}`);
    return { success: true, data: serializeOrderItem(updatedItem) };
  } catch (error) {
    console.error("Update Order Item Quantity Error:", error);
    return { error: "Failed to update item quantity" };
  }
}

/**
 * Assign a customer to an order
 */
export async function assignCustomerToOrder(orderId: string, customer: {
  type: "WALKIN" | "HOTEL_GUEST";
  name: string;
  bookingId?: string;
  guestId?: string;
  phone?: string;
}) {
  try {
    const order = await db.pOSOrder.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return { error: "Order not found" };
    }

    const data: any = {};
    if (customer.type === "HOTEL_GUEST") {
        data.bookingId = customer.bookingId;
        data.guestId = customer.guestId;
        // Optionally append to notes if needed, or rely on booking relation
    } else {
        // Walk-in
        // We don't have a customerName field, so we'll append to notes if not there
        const notePrefix = "Customer: ";
        const newNote = `${notePrefix}${customer.name}${customer.phone ? ` (${customer.phone})` : ""}`;
        
        let notes = order.notes || "";
        // Remove existing customer note if any to avoid duplicates logic? 
        // For simplicity, just append or replace if matches pattern?
        // Let's just append for now or set it.
        // Simple approach: Prepend
        data.notes = order.notes ? `${newNote}\n${order.notes}` : newNote;
    }

    await db.pOSOrder.update({
        where: { id: orderId },
        data
    });

    revalidatePath("/admin/pos");
    return { success: true };
  } catch (error) {
    console.error("Assign Customer Error:", error);
    return { error: "Failed to assign customer" };
  }
}

// ============================================================================
// Order Total Calculation (Internal helper - will be expanded in 8.2)
// ============================================================================

/**
 * Recalculate order totals
 * This is an internal helper that will be expanded in task 8.2
 */
async function recalculateOrderTotals(orderId: string): Promise<void> {
  const order = await db.pOSOrder.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      outlet: {
        select: {
          property: {
            select: {
              taxRate: true,
              serviceChargeRate: true,
            },
          },
        },
      },
    },
  });

  if (!order) return;

  // Calculate subtotal from items
  const subtotal = order.items.reduce((sum, item) => {
    return sum.add(new Decimal(item.unitPrice.toString()).mul(item.quantity));
  }, new Decimal(0));

  // Get tax and service charge rates from property
  const taxRate = new Decimal(order.outlet.property.taxRate.toString());
  const serviceChargeRate = new Decimal(order.outlet.property.serviceChargeRate.toString());

  // Calculate tax and service charge
  const taxAmount = subtotal.mul(taxRate);
  const serviceCharge = subtotal.mul(serviceChargeRate);

  // Get current discount and tip
  const discountAmount = new Decimal(order.discountAmount.toString());
  const tipAmount = new Decimal(order.tipAmount.toString());

  // Calculate total: subtotal + tax + serviceCharge - discount + tip
  const total = subtotal.add(taxAmount).add(serviceCharge).sub(discountAmount).add(tipAmount);

  // Update the order
  await db.pOSOrder.update({
    where: { id: orderId },
    data: {
      subtotal: subtotal.toDecimalPlaces(2).toNumber(),
      taxAmount: taxAmount.toDecimalPlaces(2).toNumber(),
      serviceCharge: serviceCharge.toDecimalPlaces(2).toNumber(),
      total: total.toDecimalPlaces(2).toNumber(),
    },
  });
}

/**
 * Check if a menu item is available for ordering
 * Requirements: 5.6
 */
export async function isMenuItemAvailable(menuItemId: string): Promise<boolean> {
  try {
    const menuItem = await db.menuItem.findUnique({
      where: { id: menuItemId },
      select: { isAvailable: true },
    });

    return menuItem?.isAvailable ?? false;
  } catch (error) {
    console.error("Check Menu Item Available Error:", error);
    return false;
  }
}

/**
 * Get active orders for a table
 */
export async function getActiveOrdersForTable(tableId: string) {
  try {
    const orders = await db.pOSOrder.findMany({
      where: {
        tableId,
        status: {
          in: ["OPEN", "SENT_TO_KITCHEN", "IN_PROGRESS", "READY", "SERVED"],
        },
      },
      include: {
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
        server: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return orders;
  } catch (error) {
    console.error("Get Active Orders For Table Error:", error);
    return [];
  }
}

/**
 * Get open orders for an outlet
 */
export async function getOpenOrdersForOutlet(outletId: string) {
  try {
    const orders = await db.pOSOrder.findMany({
      where: {
        outletId,
        status: {
          in: ["OPEN", "SENT_TO_KITCHEN", "IN_PROGRESS", "READY", "SERVED"],
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
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return orders;
  } catch (error) {
    console.error("Get Open Orders For Outlet Error:", error);
    return [];
  }
}


// ============================================================================
// Order Calculations and Discounts
// Requirements: 5.2, 5.4
// ============================================================================

/**
 * Discount types supported by the system
 */
export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

export interface ApplyDiscountInput {
  orderId: string;
  discountType: DiscountType;
  value: number;
  reason?: string;
}

// OrderTotals is now imported from order-utils.ts via re-export

/**
 * Calculate order totals
 * Requirements: 5.2
 * 
 * Property 6: Order Total Calculation Consistency
 * For any order, the total SHALL equal subtotal + taxAmount + serviceCharge - discountAmount + tipAmount,
 * and subtotal SHALL equal the sum of (item.quantity × item.unitPrice) for all items.
 * 
 * @param orderId - The order ID to calculate totals for
 * @returns The calculated order totals
 */
export async function calculateOrderTotals(orderId: string): Promise<{ success: true; data: import("./order-utils").OrderTotals } | { error: string }> {
  try {
    const order = await db.pOSOrder.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        outlet: {
          select: {
            property: {
              select: {
                taxRate: true,
                serviceChargeRate: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return { error: "Order not found" };
    }

    // Calculate subtotal from items: sum of (quantity × unitPrice)
    const subtotal = order.items.reduce((sum, item) => {
      return sum.add(new Decimal(item.unitPrice.toString()).mul(item.quantity));
    }, new Decimal(0));

    // Get tax and service charge rates from property
    const taxRate = new Decimal(order.outlet.property.taxRate.toString());
    const serviceChargeRate = new Decimal(order.outlet.property.serviceChargeRate.toString());

    // Calculate tax and service charge on subtotal
    const taxAmount = subtotal.mul(taxRate);
    const serviceCharge = subtotal.mul(serviceChargeRate);

    // Get current discount and tip amounts
    const discountAmount = new Decimal(order.discountAmount.toString());
    const tipAmount = new Decimal(order.tipAmount.toString());

    // Property 6: total = subtotal + taxAmount + serviceCharge - discountAmount + tipAmount
    const total = subtotal.add(taxAmount).add(serviceCharge).sub(discountAmount).add(tipAmount);

    return {
      success: true,
      data: {
        subtotal: subtotal.toDecimalPlaces(2).toNumber(),
        taxAmount: taxAmount.toDecimalPlaces(2).toNumber(),
        serviceCharge: serviceCharge.toDecimalPlaces(2).toNumber(),
        discountAmount: discountAmount.toDecimalPlaces(2).toNumber(),
        tipAmount: tipAmount.toDecimalPlaces(2).toNumber(),
        total: total.toDecimalPlaces(2).toNumber(),
      },
    };
  } catch (error) {
    console.error("Calculate Order Totals Error:", error);
    return { error: "Failed to calculate order totals" };
  }
}

/**
 * Apply a discount to an order
 * Requirements: 5.4
 * 
 * - WHEN applying a discount to an order, THE System SHALL recalculate subtotal, tax, and total amounts
 * 
 * @param data - The discount input data
 * @returns The updated order with recalculated totals
 */
export async function applyDiscount(data: ApplyDiscountInput) {
  // Validate required fields
  if (!data.orderId || data.orderId.trim() === "") {
    return { error: "Order ID is required" };
  }

  if (!data.discountType) {
    return { error: "Discount type is required" };
  }

  if (data.value === undefined || data.value === null || data.value < 0) {
    return { error: "Discount value must be a non-negative number" };
  }

  if (!["PERCENTAGE", "FIXED_AMOUNT"].includes(data.discountType)) {
    return { error: "Invalid discount type. Must be PERCENTAGE or FIXED_AMOUNT" };
  }

  try {
    // Get the order with items
    const order = await db.pOSOrder.findUnique({
      where: { id: data.orderId },
      include: {
        items: true,
        outlet: {
          select: {
            property: {
              select: {
                taxRate: true,
                serviceChargeRate: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return { error: "Order not found" };
    }

    // Check if order can be modified
    if (!["OPEN", "SENT_TO_KITCHEN", "IN_PROGRESS", "READY", "SERVED"].includes(order.status)) {
      return { error: "Cannot apply discount to this order in its current status" };
    }

    // Calculate subtotal from items
    const subtotal = order.items.reduce((sum, item) => {
      return sum.add(new Decimal(item.unitPrice.toString()).mul(item.quantity));
    }, new Decimal(0));

    // Calculate discount amount based on type
    let discountAmount: Decimal;
    if (data.discountType === "PERCENTAGE") {
      // Validate percentage is between 0 and 100
      if (data.value > 100) {
        return { error: "Percentage discount cannot exceed 100%" };
      }
      discountAmount = subtotal.mul(data.value).div(100);
    } else {
      // Fixed amount discount
      discountAmount = new Decimal(data.value);
    }

    // Ensure discount doesn't exceed subtotal
    if (discountAmount.greaterThan(subtotal)) {
      return { error: "Discount amount cannot exceed order subtotal" };
    }

    // Get tax and service charge rates
    const taxRate = new Decimal(order.outlet.property.taxRate.toString());
    const serviceChargeRate = new Decimal(order.outlet.property.serviceChargeRate.toString());

    // Calculate tax and service charge on subtotal
    const taxAmount = subtotal.mul(taxRate);
    const serviceCharge = subtotal.mul(serviceChargeRate);

    // Get current tip amount
    const tipAmount = new Decimal(order.tipAmount.toString());

    // Calculate total: subtotal + taxAmount + serviceCharge - discountAmount + tipAmount
    const total = subtotal.add(taxAmount).add(serviceCharge).sub(discountAmount).add(tipAmount);

    // Update the order with new discount and recalculated totals
    const updatedOrder = await db.pOSOrder.update({
      where: { id: data.orderId },
      data: {
        subtotal: subtotal.toDecimalPlaces(2).toNumber(),
        taxAmount: taxAmount.toDecimalPlaces(2).toNumber(),
        serviceCharge: serviceCharge.toDecimalPlaces(2).toNumber(),
        discountAmount: discountAmount.toDecimalPlaces(2).toNumber(),
        total: total.toDecimalPlaces(2).toNumber(),
        notes: data.reason 
          ? `${order.notes ? order.notes + "\n" : ""}Discount applied: ${data.discountType} ${data.value}${data.discountType === "PERCENTAGE" ? "%" : ""} - ${data.reason}`
          : order.notes,
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
      },
    });

    revalidatePath("/admin/pos");
    revalidatePath(`/admin/pos/orders/${data.orderId}`);
    return { success: true, data: serializeOrder(updatedOrder) };
  } catch (error) {
    console.error("Apply Discount Error:", error);
    return { error: "Failed to apply discount" };
  }
}

/**
 * Remove discount from an order
 */
export async function removeDiscount(orderId: string) {
  try {
    const order = await db.pOSOrder.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        outlet: {
          select: {
            property: {
              select: {
                taxRate: true,
                serviceChargeRate: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return { error: "Order not found" };
    }

    // Check if order can be modified
    if (!["OPEN", "SENT_TO_KITCHEN", "IN_PROGRESS", "READY", "SERVED"].includes(order.status)) {
      return { error: "Cannot remove discount from this order in its current status" };
    }

    // Calculate subtotal from items
    const subtotal = order.items.reduce((sum, item) => {
      return sum.add(new Decimal(item.unitPrice.toString()).mul(item.quantity));
    }, new Decimal(0));

    // Get tax and service charge rates
    const taxRate = new Decimal(order.outlet.property.taxRate.toString());
    const serviceChargeRate = new Decimal(order.outlet.property.serviceChargeRate.toString());

    // Calculate tax and service charge
    const taxAmount = subtotal.mul(taxRate);
    const serviceCharge = subtotal.mul(serviceChargeRate);

    // Get current tip amount
    const tipAmount = new Decimal(order.tipAmount.toString());

    // Calculate total without discount
    const total = subtotal.add(taxAmount).add(serviceCharge).add(tipAmount);

    // Update the order
    const updatedOrder = await db.pOSOrder.update({
      where: { id: orderId },
      data: {
        subtotal: subtotal.toDecimalPlaces(2).toNumber(),
        taxAmount: taxAmount.toDecimalPlaces(2).toNumber(),
        serviceCharge: serviceCharge.toDecimalPlaces(2).toNumber(),
        discountAmount: 0,
        total: total.toDecimalPlaces(2).toNumber(),
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
      },
    });

    revalidatePath("/admin/pos");
    revalidatePath(`/admin/pos/orders/${orderId}`);
    return { success: true, data: serializeOrder(updatedOrder) };
  } catch (error) {
    console.error("Remove Discount Error:", error);
    return { error: "Failed to remove discount" };
  }
}

/**
 * Add tip to an order
 */
export async function addTip(orderId: string, tipAmount: number) {
  if (tipAmount < 0) {
    return { error: "Tip amount cannot be negative" };
  }

  try {
    const order = await db.pOSOrder.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        outlet: {
          select: {
            property: {
              select: {
                taxRate: true,
                serviceChargeRate: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return { error: "Order not found" };
    }

    // Check if order can be modified
    if (!["OPEN", "SENT_TO_KITCHEN", "IN_PROGRESS", "READY", "SERVED"].includes(order.status)) {
      return { error: "Cannot add tip to this order in its current status" };
    }

    // Calculate subtotal from items
    const subtotal = order.items.reduce((sum, item) => {
      return sum.add(new Decimal(item.unitPrice.toString()).mul(item.quantity));
    }, new Decimal(0));

    // Get tax and service charge rates
    const taxRate = new Decimal(order.outlet.property.taxRate.toString());
    const serviceChargeRate = new Decimal(order.outlet.property.serviceChargeRate.toString());

    // Calculate tax and service charge
    const taxAmount = subtotal.mul(taxRate);
    const serviceCharge = subtotal.mul(serviceChargeRate);

    // Get current discount
    const discountAmount = new Decimal(order.discountAmount.toString());
    const tip = new Decimal(tipAmount);

    // Calculate total
    const total = subtotal.add(taxAmount).add(serviceCharge).sub(discountAmount).add(tip);

    // Update the order
    const updatedOrder = await db.pOSOrder.update({
      where: { id: orderId },
      data: {
        tipAmount: tip.toDecimalPlaces(2).toNumber(),
        total: total.toDecimalPlaces(2).toNumber(),
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
      },
    });

    revalidatePath("/admin/pos");
    revalidatePath(`/admin/pos/orders/${orderId}`);
    return { success: true, data: serializeOrder(updatedOrder) };
  } catch (error) {
    console.error("Add Tip Error:", error);
    return { error: "Failed to add tip" };
  }
}

// Pure functions have been moved to order-utils.ts
// Import them directly from there: import { calculateOrderTotalsPure, verifyOrderTotals, isValidOrderStatusTransition, isValidItemStatusTransition, OrderTotals } from "./order-utils";


// ============================================================================
// Kitchen Routing and Order Status Management
// Requirements: 5.3, 6.1
// ============================================================================

/**
 * Send an order to the kitchen
 * Requirements: 5.3, 6.1
 * 
 * - WHEN an order is sent to kitchen, THE System SHALL update order status to SENT_TO_KITCHEN and route items to KDS
 * - WHEN an order is sent to kitchen, THE System SHALL display order items on the KDS grouped by preparation station
 */
export async function sendToKitchen(orderId: string) {
  // Import the validation function
  const { isValidOrderStatusTransition } = await import("./order-utils");
  
  try {
    // Get the order with items
    const order = await db.pOSOrder.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!order) {
      return { error: "Order not found" };
    }

    // Define active statuses that allow sending additional items
    const activeStatuses = ["OPEN", "SENT_TO_KITCHEN", "IN_PROGRESS", "READY", "SERVED"];
    
    // Block if order is closed/paid/cancelled/void
    if (!activeStatuses.includes(order.status)) {
      return { error: `Cannot send order to kitchen from status ${order.status}` };
    }

    // Check if order has items
    if (order.items.length === 0) {
      return { error: "Cannot send empty order to kitchen" };
    }

    // Check if there are pending items to send
    const pendingItems = order.items.filter(item => item.status === "PENDING");
    if (pendingItems.length === 0) {
      return { error: "No pending items to send to kitchen" };
    }

    const now = new Date();

    // Determine the new order status:
    // - For OPEN orders: transition to SENT_TO_KITCHEN
    // - For already-active orders: keep the current status (don't regress)
    const newOrderStatus = order.status === "OPEN" ? "SENT_TO_KITCHEN" : order.status;

    // Update order status and all pending items
    const [updatedOrder] = await db.$transaction([
      // Update order status (may be the same for active orders)
      db.pOSOrder.update({
        where: { id: orderId },
        data: { status: newOrderStatus },
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
                  category: true,
                  sellingPrice: true,
                },
              },
            },
          },
        },
      }),
      // Update all pending items to SENT
      db.pOSOrderItem.updateMany({
        where: {
          orderId,
          status: "PENDING",
        },
        data: {
          status: "SENT",
          sentToKitchenAt: now,
        },
      }),
    ]);

    revalidatePath("/admin/pos");
    revalidatePath("/admin/pos/kitchen");
    revalidatePath(`/admin/pos/orders/${orderId}`);
    return { success: true, data: serializeOrder(updatedOrder) };
  } catch (error) {
    console.error("Send To Kitchen Error:", error);
    return { error: "Failed to send order to kitchen" };
  }
}

/**
 * Update order status
 * Requirements: 5.3, 6.5, 7.5
 */
export async function updateOrderStatus(orderId: string, newStatus: POSOrderStatus) {
  // Validate status enum
  if (!VALID_ORDER_STATUSES.includes(newStatus)) {
    return { error: `Invalid order status: ${newStatus}` };
  }

  try {
    const order = await db.pOSOrder.findUnique({
      where: { id: orderId },
      include: {
        table: true,
      },
    });

    if (!order) {
      return { error: "Order not found" };
    }

    // Validate status transition
    if (!isValidOrderStatusTransition(order.status, newStatus)) {
      return { error: `Invalid status transition from ${order.status} to ${newStatus}` };
    }

    const updatedOrder = await db.pOSOrder.update({
      where: { id: orderId },
      data: { status: newStatus },
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
      },
    });

    // If order is PAID and has a table, set table to DIRTY (Requirement 4.4)
    if (newStatus === "PAID" && order.tableId) {
      await setTableDirty(order.tableId);
    }

    revalidatePath("/admin/pos");
    revalidatePath(`/admin/pos/orders/${orderId}`);
    return { success: true, data: serializeOrder(updatedOrder) };
  } catch (error) {
    console.error("Update Order Status Error:", error);
    return { error: "Failed to update order status" };
  }
}

/**
 * Update order item status
 * Requirements: 6.2, 6.3, 6.5
 */
export async function updateOrderItemStatus(
  orderId: string,
  itemId: string,
  newStatus: OrderItemStatus
) {
  // Validate status enum
  if (!VALID_ITEM_STATUSES.includes(newStatus)) {
    return { error: `Invalid item status: ${newStatus}` };
  }

  try {
    const orderItem = await db.pOSOrderItem.findUnique({
      where: { id: itemId },
      include: {
        order: true,
      },
    });

    if (!orderItem) {
      return { error: "Order item not found" };
    }

    if (orderItem.orderId !== orderId) {
      return { error: "Item does not belong to this order" };
    }

    // Validate status transition
    if (!isValidItemStatusTransition(orderItem.status, newStatus)) {
      return { error: `Invalid item status transition from ${orderItem.status} to ${newStatus}` };
    }

    const now = new Date();
    const updateData: Prisma.POSOrderItemUpdateInput = { status: newStatus };

    // Set timestamps based on status
    if (newStatus === "PREPARING") {
      updateData.preparedAt = now;
    } else if (newStatus === "SERVED") {
      updateData.servedAt = now;
    }

    const updatedItem = await db.pOSOrderItem.update({
      where: { id: itemId },
      data: updateData,
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
            category: true,
            sellingPrice: true,
          },
        },
      },
    });

    // Check if all items are ready - if so, update order status to READY
    if (newStatus === "READY") {
      const allItems = await db.pOSOrderItem.findMany({
        where: { orderId },
      });

      const allReady = allItems.every(
        item => item.status === "READY" || item.status === "SERVED" || item.status === "CANCELLED"
      );

      if (allReady) {
        await db.pOSOrder.update({
          where: { id: orderId },
          data: { status: "READY" },
        });
      }
    }

    revalidatePath("/admin/pos");
    revalidatePath("/admin/pos/kitchen");
    revalidatePath(`/admin/pos/orders/${orderId}`);
    return { success: true, data: serializeOrderItem(updatedItem) };
  } catch (error) {
    console.error("Update Order Item Status Error:", error);
    return { error: "Failed to update item status" };
  }
}

/**
 * Mark an order item as preparing
 * Requirements: 6.2
 * 
 * - WHEN a kitchen staff marks an item as preparing, THE System SHALL update the OrderItem status to PREPARING
 */
export async function markItemPreparing(orderId: string, itemId: string) {
  return updateOrderItemStatus(orderId, itemId, "PREPARING");
}

/**
 * Mark an order item as ready
 * Requirements: 6.3, 6.5
 * 
 * - WHEN a kitchen staff marks an item as ready, THE System SHALL update the OrderItem status to READY and notify the server
 * - WHEN all items in an order are ready, THE System SHALL update the order status to READY
 */
export async function markItemReady(orderId: string, itemId: string) {
  return updateOrderItemStatus(orderId, itemId, "READY");
}

/**
 * Mark an order item as served
 */
export async function markItemServed(orderId: string, itemId: string) {
  return updateOrderItemStatus(orderId, itemId, "SERVED");
}

/**
 * Cancel an order
 * Requirements: 5.3
 */
export async function cancelOrder(orderId: string, reason?: string) {
  try {
    const order = await db.pOSOrder.findUnique({
      where: { id: orderId },
      include: {
        table: true,
      },
    });

    if (!order) {
      return { error: "Order not found" };
    }

    // Validate status transition
    if (!isValidOrderStatusTransition(order.status, "CANCELLED")) {
      return { error: `Cannot cancel order in status ${order.status}` };
    }

    // Cancel the order and all its items
    const [updatedOrder] = await db.$transaction([
      db.pOSOrder.update({
        where: { id: orderId },
        data: {
          status: "CANCELLED",
          notes: reason ? `${order.notes ? order.notes + "\n" : ""}Cancelled: ${reason}` : order.notes,
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
          items: true,
        },
      }),
      db.pOSOrderItem.updateMany({
        where: {
          orderId,
          status: { notIn: ["SERVED", "CANCELLED"] },
        },
        data: { status: "CANCELLED" },
      }),
    ]);

    // If order had a table, set it to DIRTY for cleanup
    if (order.tableId) {
      await setTableDirty(order.tableId);
    }

    revalidatePath("/admin/pos");
    revalidatePath(`/admin/pos/orders/${orderId}`);
    return { success: true, data: serializeOrder(updatedOrder) };
  } catch (error) {
    console.error("Cancel Order Error:", error);
    return { error: "Failed to cancel order" };
  }
}

/**
 * Void an order (similar to cancel but for accounting purposes)
 */
export async function voidOrder(orderId: string, reason: string) {
  if (!reason || reason.trim() === "") {
    return { error: "Void reason is required" };
  }

  try {
    const order = await db.pOSOrder.findUnique({
      where: { id: orderId },
      include: {
        table: true,
      },
    });

    if (!order) {
      return { error: "Order not found" };
    }

    // Validate status transition
    if (!isValidOrderStatusTransition(order.status, "VOID")) {
      return { error: `Cannot void order in status ${order.status}` };
    }

    // Void the order and all its items
    const [updatedOrder] = await db.$transaction([
      db.pOSOrder.update({
        where: { id: orderId },
        data: {
          status: "VOID",
          notes: `${order.notes ? order.notes + "\n" : ""}Voided: ${reason}`,
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
          items: true,
        },
      }),
      db.pOSOrderItem.updateMany({
        where: {
          orderId,
          status: { notIn: ["SERVED", "CANCELLED"] },
        },
        data: { status: "CANCELLED" },
      }),
    ]);

    // If order had a table, set it to DIRTY for cleanup
    if (order.tableId) {
      await setTableDirty(order.tableId);
    }

    revalidatePath("/admin/pos");
    revalidatePath(`/admin/pos/orders/${orderId}`);
    return { success: true, data: serializeOrder(updatedOrder) };
  } catch (error) {
    console.error("Void Order Error:", error);
    return { error: "Failed to void order" };
  }
}

/**
 * Mark order as served
 * Requirements: 5.3
 */
export async function markOrderServed(orderId: string) {
  return updateOrderStatus(orderId, "SERVED");
}

/**
 * Get orders for kitchen display
 * Requirements: 6.1, 6.4
 * 
 * - WHEN an order is sent to kitchen, THE System SHALL display order items on the KDS grouped by preparation station
 * - THE System SHALL display order age and highlight orders exceeding target preparation time
 */
export async function getKitchenOrders(outletId: string) {
  try {
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

    // Calculate order age for each order
    const now = new Date();
    const ordersWithAge = orders.map(order => {
      const ageMs = now.getTime() - order.createdAt.getTime();
      const ageMinutes = Math.floor(ageMs / 60000);
      
      return {
        ...order,
        ageMinutes,
        isOverdue: ageMinutes > 15, // Orders over 15 minutes are considered overdue
      };
    });

    return ordersWithAge;
  } catch (error) {
    console.error("Get Kitchen Orders Error:", error);
    return [];
  }
}


// ============================================================================
// Shift Integration Functions
// Requirements: 13.2
// ============================================================================

/**
 * Create an order with strict shift requirement
 * This version requires an open shift for order processing
 * 
 * Requirements: 13.2
 * - Require open shift for order processing
 */
export async function createOrderWithShiftRequired(data: CreateOrderInput) {
  // Validate required fields
  if (!data.outletId || data.outletId.trim() === "") {
    return { error: "Outlet ID is required" };
  }

  if (!data.serverId || data.serverId.trim() === "") {
    return { error: "Server ID is required" };
  }

  try {
    // Check if server has an open shift - REQUIRED in this mode
    const openShift = await db.shift.findFirst({
      where: {
        cashierId: data.serverId,
        status: "OPEN",
      },
      select: { id: true, outletId: true },
    });

    if (!openShift) {
      return { error: "Server must have an open shift to create orders. Please open a shift first." };
    }

    // Verify the shift is for the same outlet
    if (openShift.outletId !== data.outletId) {
      return { error: "Server's open shift is for a different outlet. Please close the current shift and open one for this outlet." };
    }

    // Delegate to the regular createOrder function which will find and use the shift
    return createOrder(data);
  } catch (error) {
    console.error("Create Order With Shift Required Error:", error);
    return { error: "Failed to create order" };
  }
}
