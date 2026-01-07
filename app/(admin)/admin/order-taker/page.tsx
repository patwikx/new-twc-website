import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { OrderTakerTerminal } from "@/components/admin/order-taker/order-taker-terminal";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Store, ShieldAlert, ChefHat } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const dynamic = "force-dynamic";

// Allowed roles for Order Taker
const ALLOWED_ROLES = ["WAITER", "Super Admin", "ADMIN"];

interface OrderTakerPageProps {
  searchParams: Promise<{
    outlet?: string;
  }>;
}

export default async function OrderTakerPage({ searchParams }: OrderTakerPageProps) {
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

  // Check if user has permission to access Order Taker
  if (!ALLOWED_ROLES.includes(userRole)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Card className="bg-neutral-900/50 border-white/10 max-w-md">
          <CardHeader>
            <div className="mx-auto mb-4">
              <ShieldAlert className="h-12 w-12 text-red-400" />
            </div>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don&apos;t have permission to access the Order Taker.
              This feature is only available for waiters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full border-white/10">
              <Link href="/admin">Return to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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

  // If no outlets
  if (outlets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Store className="h-16 w-16 text-neutral-600 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">No Sales Outlets</h2>
        <p className="text-neutral-400 mb-6 max-w-md">
          There are no active sales outlets configured. Please contact an administrator.
        </p>
      </div>
    );
  }

  // Get selected outlet (default to first outlet)
  const selectedOutletId = params.outlet || outlets[0]?.id;
  const selectedOutlet = outlets.find((o) => o.id === selectedOutletId);

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
                  guestLastName: true,
                },
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
                select: { name: true },
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
        const namePart = order.notes.substring(10).split("(")[0].trim();
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
        items: order.items.map((item) => ({
          id: item.id,
          menuItemId: item.menuItemId,
          menuItemName: item.menuItem.name,
          menuItemCategory: item.menuItem.category?.name || "Uncategorized",
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          modifiers: item.modifiers,
          notes: item.notes,
          status: item.status,
          menuItemImage: item.menuItem.imageUrl,
        })),
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
          propertyId: selectedOutlet.property.id,
        },
        select: {
          id: true,
          shortRef: true,
          userId: true,
          guestFirstName: true,
          guestLastName: true,
          items: {
            select: {
              checkIn: true,
              checkOut: true,
              roomUnit: {
                select: { number: true },
              },
            },
          },
        },
      })
    : [];

  const checkedInGuests = checkedInBookings.map((b) => ({
    bookingId: b.id,
    bookingRef: b.shortRef,
    guestId: b.userId || b.id,
    guestName: `${b.guestFirstName} ${b.guestLastName}`,
    roomNumber: b.items.find((i) => i.roomUnit)?.roomUnit?.number || "N/A",
    checkIn: b.items[0]?.checkIn || new Date(),
    checkOut: b.items[0]?.checkOut || new Date(),
  }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white">Order Taker</h1>
          {selectedOutlet && (
            <span className="text-neutral-400">
              {selectedOutlet.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-white/10 text-neutral-400 hover:text-white"
            asChild
          >
            <Link href="/admin/pos/kitchen">
              <ChefHat className="h-4 w-4 mr-2" />
              Kitchen Display
            </Link>
          </Button>
        </div>
      </div>

      {/* Order Taker Interface */}
      {selectedOutlet ? (
        <OrderTakerTerminal
          outletId={selectedOutlet.id}
          outletName={selectedOutlet.name}
          tables={tableData}
          menuItems={menuItemData}
          serverId={session.user.id!}
          serverName={session.user.name || "Waiter"}
          checkedInGuests={checkedInGuests}
        />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <Store className="h-16 w-16 text-neutral-600 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Select an Outlet</h2>
          <p className="text-neutral-400">
            Choose a sales outlet to start taking orders.
          </p>
        </div>
      )}
    </div>
  );
}
