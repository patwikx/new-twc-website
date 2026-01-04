"use server";

/**
 * Shift Management Service
 * 
 * Handles cashier shift operations including:
 * - Opening and closing shifts with cash reconciliation
 * - Calculating expected cash and variance
 * - Associating orders with shifts
 * - Generating shift reports
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */

import { db } from "@/lib/db";
import { ShiftStatus, PaymentMethod, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import { getPropertyFilter } from "@/lib/property-context";

// Types
export interface OpenShiftInput {
  outletId: string;
  cashierId: string;
  startingCash: number;
  notes?: string;
}

export interface CloseShiftInput {
  shiftId: string;
  endingCash: number;
  notes?: string;
}

export interface ShiftReport {
  shift: {
    id: string;
    outletId: string;
    cashierId: string;
    startingCash: number;
    endingCash: number | null;
    expectedCash: number | null;
    variance: number | null;
    status: ShiftStatus;
    openedAt: Date;
    closedAt: Date | null;
    notes: string | null;
  };
  outlet: {
    id: string;
    name: string;
  };
  cashier: {
    id: string;
    name: string | null;
  };
  transactions: {
    orderId: string;
    orderNumber: string;
    total: number;
    status: string;
    createdAt: Date;
  }[];
  paymentsByMethod: {
    method: PaymentMethod;
    count: number;
    total: number;
  }[];
  summary: {
    totalOrders: number;
    totalSales: number;
    cashPayments: number;
    cardPayments: number;
    roomCharges: number;
    otherPayments: number;
  };
}

// ============================================================================
// Shift Operations
// Requirements: 13.1, 13.3, 13.4
// ============================================================================

/**
 * Open a new shift for a cashier
 * Requirements: 13.1
 * 
 * - WHEN opening a shift, THE System SHALL record the outlet, cashier, and starting cash amount
 */
export async function openShift(data: OpenShiftInput) {
  // Validate required fields
  if (!data.outletId || data.outletId.trim() === "") {
    return { error: "Outlet ID is required" };
  }

  if (!data.cashierId || data.cashierId.trim() === "") {
    return { error: "Cashier ID is required" };
  }

  if (data.startingCash === undefined || data.startingCash === null || data.startingCash < 0) {
    return { error: "Starting cash must be a non-negative number" };
  }

  try {
    // Check if outlet exists and is active
    const outlet = await db.salesOutlet.findUnique({
      where: { id: data.outletId },
    });

    if (!outlet) {
      return { error: "Sales outlet not found" };
    }

    if (!outlet.isActive) {
      return { error: "Cannot open shift for inactive outlet" };
    }

    // Check if cashier exists
    const cashier = await db.user.findUnique({
      where: { id: data.cashierId },
    });

    if (!cashier) {
      return { error: "Cashier not found" };
    }

    // Check if cashier already has an open shift
    const existingOpenShift = await db.shift.findFirst({
      where: {
        cashierId: data.cashierId,
        status: "OPEN",
      },
    });

    if (existingOpenShift) {
      return { error: "Cashier already has an open shift. Please close it before opening a new one." };
    }

    // Create the shift
    const shift = await db.shift.create({
      data: {
        outletId: data.outletId,
        cashierId: data.cashierId,
        startingCash: data.startingCash,
        status: "OPEN",
        notes: data.notes || null,
      },
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        cashier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    revalidatePath("/admin/pos");
    revalidatePath("/admin/pos/shifts");
    return { success: true, data: shift };
  } catch (error) {
    console.error("Open Shift Error:", error);
    return { error: "Failed to open shift" };
  }
}

/**
 * Close a shift with cash reconciliation
 * Requirements: 13.3, 13.4
 * 
 * - WHEN closing a shift, THE System SHALL require ending cash count and calculate expected cash
 * - WHEN a shift is closed, THE System SHALL calculate variance between expected and actual cash
 * 
 * Property 18: Shift Cash Variance Calculation
 * For any closed shift, the variance SHALL equal endingCash - expectedCash,
 * where expectedCash equals startingCash plus all cash payments minus cash refunds during the shift.
 */
export async function closeShift(data: CloseShiftInput) {
  // Validate required fields
  if (!data.shiftId || data.shiftId.trim() === "") {
    return { error: "Shift ID is required" };
  }

  if (data.endingCash === undefined || data.endingCash === null || data.endingCash < 0) {
    return { error: "Ending cash must be a non-negative number" };
  }

  try {
    // Get the shift with orders and payments
    const shift = await db.shift.findUnique({
      where: { id: data.shiftId },
      include: {
        orders: {
          include: {
            payments: true,
          },
        },
      },
    });

    if (!shift) {
      return { error: "Shift not found" };
    }

    if (shift.status === "CLOSED") {
      return { error: "Shift is already closed" };
    }

    // Calculate expected cash using pure function
    const cashPayments = shift.orders.flatMap(order => 
      order.payments
        .filter(p => p.method === "CASH")
        .map(p => new Decimal(p.amount.toString()).toNumber())
    );

    const expectedCash = calculateExpectedCashPure(
      new Decimal(shift.startingCash.toString()).toNumber(),
      cashPayments,
      [] // No refunds in current model
    );

    // Calculate variance
    const variance = calculateVariancePure(data.endingCash, expectedCash);

    // Update the shift
    const updatedShift = await db.shift.update({
      where: { id: data.shiftId },
      data: {
        endingCash: data.endingCash,
        expectedCash: expectedCash,
        variance: variance,
        status: "CLOSED",
        closedAt: new Date(),
        notes: data.notes 
          ? `${shift.notes ? shift.notes + "\n" : ""}${data.notes}`
          : shift.notes,
      },
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        cashier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    revalidatePath("/admin/pos");
    revalidatePath("/admin/pos/shifts");
    return { success: true, data: updatedShift };
  } catch (error) {
    console.error("Close Shift Error:", error);
    return { error: "Failed to close shift" };
  }
}

/**
 * Get the current open shift for a cashier
 * Requirements: 13.2
 */
export async function getCurrentShift(cashierId: string) {
  try {
    const shift = await db.shift.findFirst({
      where: {
        cashierId,
        status: "OPEN",
      },
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        cashier: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    return shift;
  } catch (error) {
    console.error("Get Current Shift Error:", error);
    return null;
  }
}

/**
 * Get a shift by ID
 */
export async function getShiftById(shiftId: string) {
  try {
    const shift = await db.shift.findUnique({
      where: { id: shiftId },
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        cashier: {
          select: {
            id: true,
            name: true,
          },
        },
        orders: {
          include: {
            payments: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return shift;
  } catch (error) {
    console.error("Get Shift By ID Error:", error);
    return null;
  }
}

/**
 * Get shifts for an outlet with optional filtering
 * Requirements: 1.1, 1.2
 * 
 * Property 1: Property Scope Filtering
 * For any data query executed while a user has a specific property selected,
 * all returned records SHALL belong to that property.
 */
export async function getShifts(query?: {
  outletId?: string;
  cashierId?: string;
  status?: ShiftStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}) {
  try {
    const where: Prisma.ShiftWhereInput = {};

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

    if (query?.cashierId) {
      where.cashierId = query.cashierId;
    }

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.startDate || query?.endDate) {
      where.openedAt = {};
      if (query.startDate) {
        where.openedAt.gte = query.startDate;
      }
      if (query.endDate) {
        where.openedAt.lte = query.endDate;
      }
    }

    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [shifts, total] = await Promise.all([
      db.shift.findMany({
        where,
        include: {
          outlet: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          cashier: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              orders: true,
            },
          },
        },
        orderBy: { openedAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.shift.count({ where }),
    ]);

    return {
      shifts,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Get Shifts Error:", error);
    return {
      shifts: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    };
  }
}

// ============================================================================
// Shift Report Generation
// Requirements: 13.5
// ============================================================================

/**
 * Generate a shift report
 * Requirements: 13.5
 * 
 * - THE System SHALL generate a shift report showing all transactions, payments by method, and variance
 */
export async function getShiftReport(shiftId: string): Promise<{ success: true; data: ShiftReport } | { error: string }> {
  try {
    const shift = await db.shift.findUnique({
      where: { id: shiftId },
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
          },
        },
        cashier: {
          select: {
            id: true,
            name: true,
          },
        },
        orders: {
          include: {
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
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!shift) {
      return { error: "Shift not found" };
    }

    // Build transactions list
    const transactions = shift.orders.map(order => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: new Decimal(order.total.toString()).toNumber(),
      status: order.status,
      createdAt: order.createdAt,
    }));

    // Calculate payments by method
    const paymentsByMethodMap = new Map<PaymentMethod, { count: number; total: Decimal }>();
    
    for (const order of shift.orders) {
      for (const payment of order.payments) {
        const existing = paymentsByMethodMap.get(payment.method) || { count: 0, total: new Decimal(0) };
        paymentsByMethodMap.set(payment.method, {
          count: existing.count + 1,
          total: existing.total.add(new Decimal(payment.amount.toString())),
        });
      }
    }

    const paymentsByMethod = Array.from(paymentsByMethodMap.entries()).map(([method, data]) => ({
      method,
      count: data.count,
      total: data.total.toDecimalPlaces(2).toNumber(),
    }));

    // Calculate summary
    const totalOrders = shift.orders.length;
    const totalSales = shift.orders
      .filter(o => o.status === "PAID")
      .reduce((sum, o) => sum.add(new Decimal(o.total.toString())), new Decimal(0))
      .toDecimalPlaces(2)
      .toNumber();

    const cashPayments = paymentsByMethodMap.get("CASH")?.total.toNumber() || 0;
    const cardPayments = (paymentsByMethodMap.get("CREDIT_CARD")?.total.toNumber() || 0) +
                         (paymentsByMethodMap.get("DEBIT_CARD")?.total.toNumber() || 0);
    const roomCharges = paymentsByMethodMap.get("ROOM_CHARGE")?.total.toNumber() || 0;
    const otherPayments = (paymentsByMethodMap.get("VOUCHER")?.total.toNumber() || 0) +
                          (paymentsByMethodMap.get("COMPLIMENTARY")?.total.toNumber() || 0);

    const report: ShiftReport = {
      shift: {
        id: shift.id,
        outletId: shift.outletId,
        cashierId: shift.cashierId,
        startingCash: new Decimal(shift.startingCash.toString()).toNumber(),
        endingCash: shift.endingCash ? new Decimal(shift.endingCash.toString()).toNumber() : null,
        expectedCash: shift.expectedCash ? new Decimal(shift.expectedCash.toString()).toNumber() : null,
        variance: shift.variance ? new Decimal(shift.variance.toString()).toNumber() : null,
        status: shift.status,
        openedAt: shift.openedAt,
        closedAt: shift.closedAt,
        notes: shift.notes,
      },
      outlet: shift.outlet,
      cashier: shift.cashier,
      transactions,
      paymentsByMethod,
      summary: {
        totalOrders,
        totalSales,
        cashPayments,
        cardPayments,
        roomCharges,
        otherPayments,
      },
    };

    return { success: true, data: report };
  } catch (error) {
    console.error("Get Shift Report Error:", error);
    return { error: "Failed to generate shift report" };
  }
}

// Import pure functions from utils for internal use
import { calculateExpectedCashPure, calculateVariancePure } from "./shift-utils";

/**
 * Check if a cashier has an open shift (for order processing validation)
 * Property 19: Shift Order Association
 * 
 * Requirements: 13.2
 */
export async function hasOpenShift(cashierId: string): Promise<boolean> {
  try {
    const shift = await db.shift.findFirst({
      where: {
        cashierId,
        status: "OPEN",
      },
      select: { id: true },
    });
    
    return shift !== null;
  } catch (error) {
    console.error("Has Open Shift Error:", error);
    return false;
  }
}

/**
 * Get the open shift ID for a cashier
 * Property 19: Shift Order Association
 * 
 * Requirements: 13.2
 */
export async function getOpenShiftId(cashierId: string): Promise<string | null> {
  try {
    const shift = await db.shift.findFirst({
      where: {
        cashierId,
        status: "OPEN",
      },
      select: { id: true },
    });
    
    return shift?.id || null;
  } catch (error) {
    console.error("Get Open Shift ID Error:", error);
    return null;
  }
}
