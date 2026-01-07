"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { ReadingType, PaymentMethod } from "@prisma/client";

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
    // Get shift with related data
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
      return { success: false, error: "Shift not found" };
    }

    if (shift.status !== "OPEN") {
      return { success: false, error: "Shift is already closed" };
    }

    // Calculate totals
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
      if (order.status !== "PAID") {
        continue;
      }
      
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

      // Sum discounts
      for (const discount of order.orderDiscounts) {
        discountCount++;
        discountTotal += Number(discount.amount);
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

    // Get next reading number
    const lastReading = await db.shiftReading.findFirst({
      where: { shiftId },
      orderBy: { readingNumber: "desc" },
    });
    const readingNumber = (lastReading?.readingNumber || 0) + 1;

    // Create the reading
    const reading = await db.shiftReading.create({
      data: {
        shiftId,
        type,
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
        generatedById: session.user.id,
      },
    });

    // Update shift X reading count if X reading
    if (type === ReadingType.X_READING) {
      await db.shift.update({
        where: { id: shiftId },
        data: {
          xReadingCount: { increment: 1 },
          lastXReadingAt: new Date(),
        },
      });
    }

    revalidatePath("/admin/pos");
    revalidatePath("/admin/pos/shifts");

    return {
      success: true,
      data: {
        readingId: reading.id,
        readingNumber,
        shiftId,
        generatedAt: reading.createdAt,
        cashierName: shift.cashier.name || "Unknown",
        outletName: shift.outlet.name,
        shiftStartedAt: shift.openedAt,
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
        expectedCash,
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

    // Get shift
    const shift = await db.shift.findUnique({
      where: { id: shiftId },
    });

    if (!shift) {
      return { success: false, error: "Shift not found" };
    }

    if (shift.status !== "OPEN") {
      return { success: false, error: "Shift is already closed" };
    }

    // Generate Z reading first
    const zReadingResult = await generateShiftReading(shiftId, ReadingType.Z_READING);
    
    if (!zReadingResult.success) {
      return { success: false, error: zReadingResult.error };
    }

    // Calculate expected cash
    const expectedCash = zReadingResult.data!.expectedCash;

    // Close the shift
    await db.shift.update({
      where: { id: shiftId },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        endingCash,
        expectedCash,
        variance,
        notes: notes || shift.notes,
        zReadingAt: new Date(),
      },
    });

    revalidatePath("/admin/pos");
    revalidatePath("/admin/pos/shifts");

    return { success: true };
  } catch (error) {
    console.error("Error closing shift:", error);
    return { success: false, error: "Failed to close shift" };
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

    // Get current shift
    const shift = await db.shift.findUnique({
      where: { id: shiftId },
      include: { outlet: true },
    });

    if (!shift) {
      return { success: false, error: "Shift not found" };
    }

    if (shift.status !== "OPEN") {
      return { success: false, error: "Shift is already closed" };
    }

    // Generate Z reading
    const zReadingResult = await generateShiftReading(shiftId, ReadingType.Z_READING);
    
    if (!zReadingResult.success) {
      return { success: false, error: zReadingResult.error };
    }

    const expectedCash = zReadingResult.data!.expectedCash;

    // Close current shift with handover info
    await db.shift.update({
      where: { id: shiftId },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        endingCash,
        expectedCash,
        variance,
        notes: notes || shift.notes,
        zReadingAt: new Date(),
        handoverToId,
        handoverNotes,
      },
    });

    // Open new shift for next cashier with ending cash as starting cash
    const newShift = await db.shift.create({
      data: {
        outletId: shift.outletId,
        cashierId: handoverToId,
        type: shift.type, // Same shift type (DAY/NIGHT)
        startingCash: endingCash, // Carry over the cash
        status: "OPEN",
        notes: `Handover from previous shift. ${handoverNotes || ""}`.trim(),
      },
    });

    revalidatePath("/admin/pos");
    revalidatePath("/admin/pos/shifts");

    return { success: true, newShiftId: newShift.id };
  } catch (error) {
    console.error("Error during handover:", error);
    return { success: false, error: "Failed to handover shift" };
  }
}

/**
 * Get shift readings history
 */
export async function getShiftReadings(shiftId: string) {
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
    generatedBy: r.generatedBy.name,
    createdAt: r.createdAt,
  }));
}

/**
 * Get shift summary for close wizard
 */
export async function getShiftSummary(shiftId: string) {
  const result = await generateShiftReading(shiftId, ReadingType.X_READING);
  
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to get shift summary");
  }

  // Don't actually save the X reading, just return the data
  // Delete the reading that was created
  await db.shiftReading.delete({
    where: { id: result.data.readingId },
  });

  // Decrement the X reading count
  await db.shift.update({
    where: { id: shiftId },
    data: {
      xReadingCount: { decrement: 1 },
    },
  });

  return {
    shiftId: result.data.shiftId,
    startingCash: result.data.startingCash,
    orderCount: result.data.orderCount,
    totalSales: result.data.totalSales,
    cashSales: result.data.cashSales,
    cardSales: result.data.cardSales,
    roomChargeSales: result.data.roomChargeSales,
    otherSales: result.data.otherSales,
    voidCount: result.data.voidCount,
    voidAmount: result.data.voidAmount,
    discountCount: result.data.discountCount,
    discountTotal: result.data.discountTotal,
    expectedCash: result.data.expectedCash,
  };
}
