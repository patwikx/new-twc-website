"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { ReadingType, PaymentMethod, Prisma } from "@prisma/client";

interface GenerateReadingResult {
  success: boolean;
  error?: string;
  data?: {
    readingId: string;
    readingNumber: number;
    shiftId: string;
    generatedAt: Date;
    cashierName: string;
    outletName: string;
    shiftStartedAt: Date;
    orderCount: number;
    totalSales: number;
    cashSales: number;
    cardSales: number;
    roomChargeSales: number;
    otherSales: number;
    voidCount: number;
    voidAmount: number;
    discountCount: number;
    discountTotal: number;
    startingCash: number;
    expectedCash: number;
  };
}

/**
 * Helper: Calculate totals for a shift without side effects
 */
async function calculateShiftTotals(shiftId: string) {
  const shift = await db.shift.findUnique({
    where: { id: shiftId },
    include: {
      cashier: { select: { name: true } },
      outlet: { select: { name: true } },
      orders: {
        where: {
          status: { not: "CANCELLED" },
        },
        include: {
          payments: true,
          orderDiscounts: true,
          orderVoids: true,
        },
      },
    },
  });

  if (!shift) {
    throw new Error("Shift not found");
  }

  let orderCount = 0;
  let totalSales = 0;
  let cashSales = 0;
  let cardSales = 0;
  let roomChargeSales = 0;
  let otherSales = 0;
  let voidCount = 0;
  let voidAmount = 0;
  let discountCount = 0;
  let discountTotal = 0;

  for (const order of shift.orders) {
    // Only count PAID orders in sales
    if (order.status === "PAID") {
       orderCount++;
       // Sum payments by method
       for (const payment of order.payments) {
         const amount = Number(payment.amount);
         switch (payment.method) {
           case PaymentMethod.CASH:
             cashSales += amount;
             break;
           case PaymentMethod.CREDIT_CARD:
           case PaymentMethod.DEBIT_CARD:
             cardSales += amount;
             break;
           case PaymentMethod.ROOM_CHARGE:
             roomChargeSales += amount;
             break;
           default:
             otherSales += amount;
         }
       }
    }

    // Sum discounts (regardless of paid status? usually on paid or closed orders)
    // Assuming discounts apply to valid orders (not cancelled). 
    // If order is active/open, discounts exist.
    if (order.status !== "CANCELLED") {
        for (const discount of order.orderDiscounts) {
          discountCount++;
          discountTotal += Number(discount.amount);
        }
    }

    // Sum voids
    for (const orderVoid of order.orderVoids) {
      voidCount++;
      voidAmount += Number(orderVoid.originalAmount);
    }
  }

  // Total sales is the sum of all payment methods
  totalSales = cashSales + cardSales + roomChargeSales + otherSales;
  const startingCash = Number(shift.startingCash);
  const expectedCash = startingCash + cashSales;

  return {
    shift,
    orderCount,
    totalSales,
    cashSales,
    cardSales,
    roomChargeSales,
    otherSales,
    voidCount,
    voidAmount,
    discountCount,
    discountTotal,
    startingCash,
    expectedCash
  };
}

/**
 * Generate an X or Z reading for a shift
 */
export async function generateShiftReading(
  shiftId: string,
  type: ReadingType
): Promise<GenerateReadingResult> {
  const session = await auth();
  
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    // 1. Calculate
    const totals = await calculateShiftTotals(shiftId);
    
    if (totals.shift.status !== "OPEN" && type !== ReadingType.Z_READING) { 
        // Allow Z reading logic to call this even if theoretically closing logic is separate, 
        // but typically we generate reading WHILE open, then close.
        // If retrieving history, we use getShiftReadings.
        // If re-printing Z, we use existing reading.
    }

    // 2. Transaction: Create Reading + Update Shift (if X)
    const result = await db.$transaction(async (tx) => {
        // Get next reading number
        const lastReading = await tx.shiftReading.findFirst({
            where: { shiftId },
            orderBy: { readingNumber: "desc" },
        });
        const readingNumber = (lastReading?.readingNumber || 0) + 1;

        const reading = await tx.shiftReading.create({
            data: {
              shiftId,
              type,
              readingNumber,
              orderCount: totals.orderCount,
              totalSales: totals.totalSales,
              cashSales: totals.cashSales,
              cardSales: totals.cardSales,
              roomChargeSales: totals.roomChargeSales,
              otherSales: totals.otherSales,
              voidCount: totals.voidCount,
              voidAmount: totals.voidAmount,
              discountCount: totals.discountCount,
              discountTotal: totals.discountTotal,
              generatedById: session.user.id!,
            },
        });

        if (type === ReadingType.X_READING) {
             await tx.shift.update({
                where: { id: shiftId },
                data: {
                  xReadingCount: { increment: 1 },
                  lastXReadingAt: new Date(),
                },
             });
        }
        
        return reading;
    });

    revalidatePath("/admin/pos");
    revalidatePath("/admin/pos/shifts");

    return {
      success: true,
      data: {
        readingId: result.id,
        readingNumber: result.readingNumber,
        shiftId,
        generatedAt: result.createdAt,
        cashierName: totals.shift.cashier.name || "Unknown",
        outletName: totals.shift.outlet.name,
        shiftStartedAt: totals.shift.openedAt,
        orderCount: totals.orderCount,
        totalSales: totals.totalSales,
        cashSales: totals.cashSales,
        cardSales: totals.cardSales,
        roomChargeSales: totals.roomChargeSales,
        otherSales: totals.otherSales,
        voidCount: totals.voidCount,
        voidAmount: totals.voidAmount,
        discountCount: totals.discountCount,
        discountTotal: totals.discountTotal,
        startingCash: totals.startingCash,
        expectedCash: totals.expectedCash,
      },
    };
  } catch (error) {
    console.error("Error generating reading:", error);
    return { success: false, error: "Failed to generate reading" };
  }
}

/**
 * Generate X Reading (interim, does not close shift)
 */
export async function generateXReading(shiftId: string) {
  return generateShiftReading(shiftId, ReadingType.X_READING);
}

/**
 * Get shift summary for close wizard (NO DB WRITE)
 */
export async function getShiftSummary(shiftId: string) {
  try {
      const totals = await calculateShiftTotals(shiftId);
      
      return {
        shiftId: totals.shift.id,
        startingCash: totals.startingCash,
        orderCount: totals.orderCount,
        totalSales: totals.totalSales,
        cashSales: totals.cashSales,
        cardSales: totals.cardSales,
        roomChargeSales: totals.roomChargeSales,
        otherSales: totals.otherSales,
        voidCount: totals.voidCount,
        voidAmount: totals.voidAmount,
        discountCount: totals.discountCount,
        discountTotal: totals.discountTotal,
        expectedCash: totals.expectedCash,
      };
  } catch (error) {
      console.error("Error getting shift summary:", error);
      return null;
  }
}

/**
 * Close shift with Z Reading
 */
export async function closeShift(data: {
  shiftId: string;
  endingCash: number;
  variance: number;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const { shiftId, endingCash, variance, notes } = data;

    // Use transaction for Z reading + Close
    await db.$transaction(async (tx) => {
        // 1. Calculate logic (re-used inside transaction? Or call calculateShiftTotals first?)
        // Better to reproduce generateShiftReading logic INSIDE transaction to ensure consistency between reading and close
        // But calculateShiftTotals uses `db` not `tx`.
        // Ideally we pass `tx` to helper. But helper is simple read. 
        // Let's assume low concurrency risk or just read again inside.
        
        // Re-implement simplified read or trust `generateShiftReading`?
        // `generateShiftReading` is not tx-aware. 
        
        // Strategy: 
        // 1. Calculate totals (Read)
        // 2. Create Reading (Write)
        // 3. Close Shift (Write)
        // All in one transaction using `tx`.
        
        const shift = await tx.shift.findUnique({
            where: { id: shiftId },
            include: {
              cashier: { select: { name: true } },
              outlet: { select: { name: true } },
              orders: {
                where: { status: { not: "CANCELLED" } },
                include: { payments: true, orderDiscounts: true, orderVoids: true },
              },
            },
        });

        if (!shift) throw new Error("Shift not found");
        if (shift.status !== "OPEN") throw new Error("Shift is already closed");

        let orderCount = 0;
        let totalSales = 0;
        let cashSales = 0;
        let cardSales = 0;
        let roomChargeSales = 0;
        let otherSales = 0;
        let voidCount = 0;
        let voidAmount = 0;
        let discountCount = 0;
        let discountTotal = 0;

        for (const order of shift.orders) {
            if (order.status === "PAID") {
               orderCount++;
               for (const payment of order.payments) {
                 const amount = Number(payment.amount);
                 switch (payment.method) {
                   case PaymentMethod.CASH: cashSales += amount; break;
                   case PaymentMethod.CREDIT_CARD:
                   case PaymentMethod.DEBIT_CARD: cardSales += amount; break;
                   case PaymentMethod.ROOM_CHARGE: roomChargeSales += amount; break;
                   default: otherSales += amount;
                 }
               }
            }
            if (order.status !== "CANCELLED") {
                for (const discount of order.orderDiscounts) {
                  discountCount++;
                  discountTotal += Number(discount.amount);
                }
            }
            for (const orderVoid of order.orderVoids) {
              voidCount++;
              voidAmount += Number(orderVoid.originalAmount);
            }
        }
        totalSales = cashSales + cardSales + roomChargeSales + otherSales;
        const startingCash = Number(shift.startingCash);
        const expectedCash = startingCash + cashSales;

        // Verify variance (Ending - Expected)
        // If passed variance differs significantly, we might want to flag/error, but usually we prefer the Calculated expected vs User ending.
        // Frontend passed `variance`. We should trust `endingCash` from user and `expectedCash` from system.
        const calculatedVariance = endingCash - expectedCash;
        
        // Create Z Reading
        const lastReading = await tx.shiftReading.findFirst({
            where: { shiftId },
            orderBy: { readingNumber: "desc" },
        });
        const readingNumber = (lastReading?.readingNumber || 0) + 1;

        await tx.shiftReading.create({
            data: {
              shiftId,
              type: ReadingType.Z_READING,
              readingNumber,
              orderCount,
              totalSales,
              cashSales,
              cardSales,
              roomChargeSales,
              otherSales,
              voidCount,
              voidAmount,
              discountCount,
              discountTotal,
              generatedById: session.user.id!,
            },
        });

        // Close Shift
        await tx.shift.update({
            where: { id: shiftId },
            data: {
                status: "CLOSED",
                closedAt: new Date(),
                endingCash,
                expectedCash,
                variance: calculatedVariance, // Use calculated variance
                notes: notes || shift.notes,
                zReadingAt: new Date(),
            }
        });
    });

    revalidatePath("/admin/pos");
    revalidatePath("/admin/pos/shifts");

    return { success: true };
  } catch (error) {
    console.error("Error closing shift:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to close shift" };
  }
}

/**
 * Handover shift to another cashier
 */
export async function handoverShift(data: {
  shiftId: string;
  endingCash: number;
  variance: number;
  notes?: string;
  handoverToId: string;
  handoverNotes?: string;
}): Promise<{ success: boolean; error?: string; newShiftId?: string }> {
  const session = await auth();
  
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const { shiftId, endingCash, variance, notes, handoverToId, handoverNotes } = data;

    const result = await db.$transaction(async (tx) => {
        const shift = await tx.shift.findUnique({
            where: { id: shiftId },
            include: { outlet: true },
        });

        if (!shift) throw new Error("Shift not found");
        if (shift.status !== "OPEN") throw new Error("Shift is already closed");

        // We assume Handover also does a Z-Reading for the current cashier?
        // Yes, usage pattern implies Z-Reading.
        // Re-use logic or manual? Manual for safe Transaction scope.
        
        // ... (Similar calculation logic as CloseShift, omitted for brevity but should be here)
        // For efficiency, let's call `calculateShiftTotals` OUTSIDE if we accept slight gap, 
        // OR duplicate logic. Duplicate is safer for one atomic block.
        // I'll call the `closeShift` function internally? No, transactions don't nest well if closeShift uses db.$transaction
        // I will duplicate the calculation logic for Safety.
        
        // ... Calculation ...
        // (Simplified for this file write - normally I'd extract a logical helper that takes `tx`)
        // Assuming Calculate is same as above.
        
        const totals = await calculateShiftTotalsInternal(tx, shiftId); // Internal helper
        
        const calculatedVariance = endingCash - totals.expectedCash;

        const lastReading = await tx.shiftReading.findFirst({ where: { shiftId }, orderBy: { readingNumber: "desc" }});
        const readingNumber = (lastReading?.readingNumber || 0) + 1;

        await tx.shiftReading.create({
            data: {
              shiftId,
              type: ReadingType.Z_READING,
              readingNumber,
              orderCount: totals.orderCount,
              totalSales: totals.totalSales,
              cashSales: totals.cashSales,
              cardSales: totals.cardSales,
              roomChargeSales: totals.roomChargeSales,
              otherSales: totals.otherSales,
              voidCount: totals.voidCount,
              voidAmount: totals.voidAmount,
              discountCount: totals.discountCount,
              discountTotal: totals.discountTotal,
              generatedById: session.user.id!,
            },
        });

        await tx.shift.update({
            where: { id: shiftId },
            data: {
                status: "CLOSED",
                closedAt: new Date(),
                endingCash,
                expectedCash: totals.expectedCash,
                variance: calculatedVariance,
                notes: notes || shift.notes,
                zReadingAt: new Date(),
                handoverToId,
                handoverNotes,
            }
        });

        const newShift = await tx.shift.create({
            data: {
                outletId: shift.outletId,
                cashierId: handoverToId,
                type: shift.type,
                startingCash: endingCash,
                status: "OPEN",
                notes: `Handover from previous shift. ${handoverNotes || ""}`.trim(),
            },
        });
        
        return newShift;
    });

    revalidatePath("/admin/pos");
    revalidatePath("/admin/pos/shifts");

    return { success: true, newShiftId: result.id };
  } catch (error) {
    console.error("Error during handover:", error);
    return { success: false, error: "Failed to handover shift" };
  }
}

/**
 * Internal helper to calculate using a transaction client
 */
async function calculateShiftTotalsInternal(tx: Prisma.TransactionClient, shiftId: string) {
    const shift = await tx.shift.findUnique({
        where: { id: shiftId },
        include: {
          orders: {
            where: { status: { not: "CANCELLED" } },
            include: { payments: true, orderDiscounts: true, orderVoids: true },
          },
        },
    });

    // Guard against null shift
    if (!shift) {
        return { 
            orderCount: 0, totalSales: 0, cashSales: 0, cardSales: 0, 
            roomChargeSales: 0, otherSales: 0, voidCount: 0, voidAmount: 0, 
            discountCount: 0, discountTotal: 0, expectedCash: 0 
        };
    }

    let orderCount = 0; let totalSales = 0; let cashSales = 0; let cardSales = 0; let roomChargeSales = 0; let otherSales = 0;
    let voidCount = 0; let voidAmount = 0; let discountCount = 0; let discountTotal = 0;

    for (const order of shift.orders) {
        if (order.status === "PAID") {
           orderCount++;
           for (const payment of order.payments) {
             const amount = Number(payment.amount);
             switch (payment.method) {
               case "CASH": cashSales += amount; break;
               case "CREDIT_CARD": case "DEBIT_CARD": cardSales += amount; break;
               case "ROOM_CHARGE": roomChargeSales += amount; break;
               default: otherSales += amount;
             }
           }
        }
        for (const discount of order.orderDiscounts) { discountCount++; discountTotal += Number(discount.amount); }
        for (const orderVoid of order.orderVoids) { voidCount++; voidAmount += Number(orderVoid.originalAmount); }
    }
    totalSales = cashSales + cardSales + roomChargeSales + otherSales;
    const startingCash = Number(shift.startingCash ?? 0);
    const expectedCash = startingCash + cashSales;

    return { orderCount, totalSales, cashSales, cardSales, roomChargeSales, otherSales, voidCount, voidAmount, discountCount, discountTotal, expectedCash };
}

/**
 * Get shift readings history
 */
export async function getShiftReadings(shiftId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const readings = await db.shiftReading.findMany({
    where: { shiftId },
    include: {
      generatedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return readings.map((r) => ({
    id: r.id,
    type: r.type,
    readingNumber: r.readingNumber,
    orderCount: r.orderCount,
    totalSales: Number(r.totalSales),
    generatedBy: r.generatedBy?.name || "Unknown",
    createdAt: r.createdAt,
  }));
}
