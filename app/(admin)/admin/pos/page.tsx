import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { OrderEntry } from "@/components/admin/pos/order-entry";
import { ShiftGate } from "@/components/admin/pos/shift-gate";

export const dynamic = "force-dynamic";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChefHat, Settings, Store } from "lucide-react";
import { POSHeaderClient } from "@/components/admin/pos/pos-header-client";

interface POSPageProps {
  searchParams: Promise<{
    outlet?: string;
  }>;
}

export default async function POSPage({ searchParams }: POSPageProps) {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  const params = await searchParams;

  // Get current property scope from cookie
  const cookieStore = await cookies();
  const currentScope = cookieStore.get("admin_property_scope")?.value || "ALL";

  // Get user role
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      role: true,
      userRole: {
        select: {
          name: true,
        },
      },
    },
  });

  const userRole = user?.userRole?.name || user?.role || "GUEST";

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

  // Get selected outlet (default to first outlet)
  const selectedOutletId = params.outlet || outlets[0]?.id;
  const selectedOutlet = outlets.find((o) => o.id === selectedOutletId);

  // Check if user has an open shift for this outlet
  const currentShift = selectedOutletId 
    ? await db.shift.findFirst({
        where: {
          cashierId: session.user.id!,
          outletId: selectedOutletId,
          status: "OPEN",
        },
        select: {
          id: true,
          outletId: true,
          type: true,
          startingCash: true,
          openedAt: true,
          outlet: {
            select: {
              name: true,
            },
          },
        },
      })
    : null;

  const currentShiftData = currentShift
    ? {
        id: currentShift.id,
        outletId: currentShift.outletId,
        outletName: currentShift.outlet.name,
        type: currentShift.type,
        startingCash: Number(currentShift.startingCash),
        openedAt: currentShift.openedAt,
      }
    : null;

  // Serialize to ensure no non-plain objects pass through (e.g. if Prisma Decimal leaks)
  const sanitizedShift = currentShiftData ? JSON.parse(JSON.stringify(currentShiftData)) : null;

  // Get available cashiers for handover (active users with CASHIER or ADMIN role, excluding current user)
  const availableCashiers = await db.user.findMany({
    where: {
      id: { not: session.user.id! },
      status: "ACTIVE",
      OR: [
        { role: "ADMIN" },
        { userRole: { name: { in: ["CASHIER", "ADMIN", "Super Admin"] } } },
      ],
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  // If no outlets, the ShiftGate will handle it
  if (outlets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Store className="h-16 w-16 text-neutral-600 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">No Sales Outlets</h2>
        <p className="text-neutral-400 mb-6 max-w-md">
          You need to create at least one sales outlet before you can use the POS system.
        </p>
        <Button asChild className="bg-orange-600 hover:bg-orange-700">
          <Link href="/admin/pos/outlets/new">
            <Settings className="h-4 w-4 mr-2" />
            Create Outlet
          </Link>
        </Button>
      </div>
    );
  }

  // Get tables for the selected outlet
  const tables = selectedOutlet
    ? await db.pOSTable.findMany({
        where: { outletId: selectedOutletId },
      include: {
          orders: {
            where: {
              status: {
                in: ["OPEN", "SENT_TO_KITCHEN", "IN_PROGRESS", "READY", "SERVED"],
              },
            },
            select: {
              id: true,
              orderNumber: true,
              status: true,
              total: true,
              createdAt: true,
              guestId: true,
              bookingId: true,
              notes: true,
              booking: {
                  select: {
                      guestFirstName: true,
                      guestLastName: true
                  }
              },
              items: {
                  include: {
                      menuItem: {
                          include: {
                              category: {
                                  select: {
                                      id: true,
                                      name: true,
                                      color: true,
                                      icon: true,
                                  },
                              },
                          },
                      },
                  },
              },
              server: {
                  select: { name: true }
              },
              subtotal: true,
              taxAmount: true,
              serviceCharge: true,
              discountAmount: true,
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { number: "asc" },
      })
    : [];

  // Get menu items for the property
  const menuItems = selectedOutlet
    ? await db.menuItem.findMany({
        where: {
          propertyId: selectedOutlet.property.id,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              color: true,
              icon: true,
            },
          },
        },
        orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      })
    : [];

  // Transform data for components
  const tableData = tables.map((table) => ({
    id: table.id,
    number: table.number,
    capacity: table.capacity,
    status: table.status,
    positionX: table.positionX,
    positionY: table.positionY,
    orders: table.orders.map((order) => {
        let customerName = null;
        if (order.booking) {
            customerName = `${order.booking.guestFirstName} ${order.booking.guestLastName}`;
        } else if (order.notes && order.notes.startsWith("Customer: ")) {
            // Extract name from "Customer: Name (Phone)"
            const namePart = order.notes.substring(10).split('(')[0].trim();
            customerName = namePart;
        }

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          total: Number(order.total),
          subtotal: Number(order.subtotal),
          taxAmount: Number(order.taxAmount),
          serviceCharge: Number(order.serviceCharge),
          discountAmount: Number(order.discountAmount),
          createdAt: order.createdAt,
          customerName,
          serverName: order.server?.name || null,
          items: order.items.map(item => ({
              id: item.id,
              menuItemId: item.menuItemId,
              menuItemName: item.menuItem.name,
              menuItemCategory: item.menuItem.category?.name || 'Uncategorized',
              quantity: item.quantity,
              unitPrice: Number(item.unitPrice),
              modifiers: item.modifiers,
              notes: item.notes,
              status: item.status,
              menuItemImage: item.menuItem.imageUrl
          }))
        };
    }),
  }));

  const menuItemData = menuItems.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    category: {
      id: item.category.id,
      name: item.category.name,
      color: item.category.color,
      icon: item.category.icon,
    },
    sellingPrice: Number(item.sellingPrice),
    isAvailable: item.isAvailable,
    unavailableReason: item.unavailableReason,
    imageUrl: item.imageUrl,
    availableServings: item.availableServings,
  }));

  // Fetch checked-in guests
  const checkedInBookings = selectedOutlet 
    ? await db.booking.findMany({
        where: {
            status: "CHECKED_IN",
            propertyId: selectedOutlet.property.id
        },
        select: {
            id: true,
            guestFirstName: true,
            guestLastName: true,
            items: {
                select: {
                    roomUnit: {
                        select: { number: true }
                    }
                }
            }
        }
    })
    : [];

  const checkedInGuests = checkedInBookings.map(b => ({
      id: b.id,
      name: `${b.guestFirstName} ${b.guestLastName}`,
      roomNumber: b.items.find(i => i.roomUnit)?.roomUnit?.number || "N/A"
  }));

  const outletList = outlets.map((o) => ({ id: o.id, name: o.name }));

  // Handle Outlet Switch (Server Action or basic navigation)
  // For page.tsx we use Link or simple router push via client component, or just basic form submission with GET
  // We can just use a simple client wrapper or a plain form since it's a server component page?
  // Actually, we can just use the previous Select component pattern which works if we assume client-side interactivity or use a client component wrapper.
  // The Select component from shadcn is client-side. We can't use `router` in RSC.
  // We will need to wrap the header or just use a form that submits on change, or rely on the previous implementation if it was client-side.
  // Wait, `POSPage` is an `async function` (Server Component). It cannot hold state or use router.
  // The previous implementation likely had a client component for the header or just the select. 
  // Let's use a simple <form> for now or re-use a client component if available.
  // Step 1120 showed `Select` imported from `@/components/ui/select`. This works in RSC? No, Select parts are client only usually.
  // If `Select` is used directly in RSC without "use client", it might fail if it uses context.
  // Let's assume we can use a small client component for the OutletSwitcher or just a standard HTML select for simplicity in this revert, 
  // OR better: use the `OutletSelector` artifact if one exists, or build a small one.
  // Actually, I'll just restore the layout structure first.
  
  return (
    <div className="space-y-4">
      {/* Header with Outlet Selector and Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white">Point of Sale</h1>
          
          <form className="flex items-center gap-2">
             {/* Simple Outlet Selector using native select for RSC compat or client component if we have one. 
                 Since I can't easily make a new file right now without more steps, I'll use a native select with a small script or standard navigation. 
                 Actually, I'll stick to a native select with `onchange="window.location.href..."` equivalents? No, that's ugly.
                 I'll use a Client Component for the switcher if I can found one, or embedded. 
                 Wait, the user wants me to REVERT. The original code had the outlet selector in `page.tsx`.
                 Let's look at step 1120 `page.tsx`. It imports `Select` etc.
                 I will assume `Select` works or I will use a Client Component wrapper if needed.
                 
                 Actually, looking at `page.tsx` imports in Step 1120: 
                 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
                 These are likely client components (use client directive in them). Consuming them in RSC is fine.
                 But `onChange` logic needs to be client side. 
                 The passed props for `onValueChange` need a client handler.
                 I can't define `handleOutletSwitch` in RSC.
                 So `POSPage` likely needs to be a Client Component OR use a separate Header component.
                 Checks Step 1120 `POSPage` code... It doesn't have "use client".
                 And it didn't have the header logic in Step 1120 (it was removed).
                 
                 In the "Before" state (Step 1073 and prior), `POSPage` might have been Client or had a `POSHeader` component.
                 I will create a small `POSHeader` client component to handle the navigation to avoid errors.
             */}
             <POSHeaderClient outlets={outlets} selectedOutletId={selectedOutletId} />
          </form>
        </div>

        <div className="flex items-center gap-2">
           <Button variant="outline" className="border-white/10 text-neutral-400 hover:text-white" asChild>
              <Link href="/admin/kitchen">
                 <ChefHat className="h-4 w-4 mr-2" />
                 Kitchen Display
              </Link>
           </Button>
           <Button variant="outline" className="border-white/10 text-neutral-400 hover:text-white" asChild>
              <Link href="/admin/outlets">
                 <Settings className="h-4 w-4 mr-2" />
                 Manage Outlets
              </Link>
           </Button>
        </div>
      </div>

      <ShiftGate
        outlets={outletList}
        selectedOutletId={selectedOutlet?.id}
        cashierId={session.user.id!}
        cashierName={session.user.name || "Staff"}
        userRole={userRole}
        currentShift={sanitizedShift}
        availableCashiers={availableCashiers}
      >
        <div className="space-y-4">
        {/* POS Interface */}
        {selectedOutlet ? (
          <OrderEntry
            outletId={selectedOutlet.id}
            outletName={selectedOutlet.name}
            tables={tableData}
            menuItems={menuItemData}
            serverId={session.user.id!}
            serverName={session.user.name || "Staff"}
          />
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <Store className="h-16 w-16 text-neutral-600 mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Select an Outlet</h2>
            <p className="text-neutral-400">
              Choose a sales outlet from the dropdown above to start taking orders.
            </p>
          </div>
        )}
        </div>
      </ShiftGate>
    </div>
  );
}

// Inline Client Component for Header navigation (since we are active in `page.tsx` and need client logic)
// We generally can't define component inside component but we can define it in the same file if "use client" is at top?
// But `POSPage` is async/server.
// I will create `components/admin/pos/pos-header.tsx` in a separate step and import it.
// For now I will comment this out and use a TODO, then immediately fix it.
// Or I can use a standard `<form action>` for GET request? 
// `<form action="/admin/pos" method="get"> <select name="outlet" onchange="this.form.submit()">` -> requires JS for auto submit.
// I will create `components/admin/pos/pos-header.tsx` NEXT.
// For this step, I'll put a placeholder or basic Links.


