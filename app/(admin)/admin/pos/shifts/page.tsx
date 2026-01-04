import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ShiftsPageClient } from "./shifts-page-client";

export default async function ShiftsPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  // Get current property scope from cookie
  const cookieStore = await cookies();
  const currentScope = cookieStore.get("admin_property_scope")?.value || "ALL";

  // Get outlets for the current property scope
  const outlets = await db.salesOutlet.findMany({
    where: {
      isActive: true,
      ...(currentScope !== "ALL" ? { propertyId: currentScope } : {}),
    },
    select: {
      id: true,
      name: true,
      type: true,
      property: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Get shifts for the current property scope
  const shifts = await db.shift.findMany({
    where: {
      outlet: {
        ...(currentScope !== "ALL" ? { propertyId: currentScope } : {}),
      },
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
    orderBy: { openedAt: "desc" },
    take: 100,
  });

  // Transform data for the client component
  const shiftData = shifts.map((shift) => ({
    id: shift.id,
    outletId: shift.outletId,
    outletName: shift.outlet.name,
    cashierId: shift.cashierId,
    cashierName: shift.cashier.name,
    startingCash: Number(shift.startingCash),
    endingCash: shift.endingCash ? Number(shift.endingCash) : null,
    expectedCash: shift.expectedCash ? Number(shift.expectedCash) : null,
    variance: shift.variance ? Number(shift.variance) : null,
    status: shift.status,
    openedAt: shift.openedAt,
    closedAt: shift.closedAt,
    orderCount: shift._count.orders,
  }));

  const outletData = outlets.map((outlet) => ({
    id: outlet.id,
    name: outlet.name,
  }));

  // Check if current user has an open shift
  const currentUserShift = await db.shift.findFirst({
    where: {
      cashierId: session.user.id!,
      status: "OPEN",
    },
    include: {
      outlet: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const currentShiftData = currentUserShift
    ? {
        id: currentUserShift.id,
        outletId: currentUserShift.outletId,
        outletName: currentUserShift.outlet.name,
        startingCash: Number(currentUserShift.startingCash),
        openedAt: currentUserShift.openedAt,
      }
    : null;

  return (
    <ShiftsPageClient
      shifts={shiftData}
      outlets={outletData}
      currentUserId={session.user.id!}
      currentUserName={session.user.name || "Staff"}
      currentShift={currentShiftData}
    />
  );
}
