import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { OrderEntry } from "@/components/admin/pos/order-entry";
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

  // If no outlets, show setup message
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
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          sellingPrice: true,
          isAvailable: true,
          unavailableReason: true,
        },
        orderBy: [{ category: "asc" }, { name: "asc" }],
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
    orders: table.orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: Number(order.total),
      createdAt: order.createdAt,
    })),
  }));

  const menuItemData = menuItems.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    sellingPrice: Number(item.sellingPrice),
    isAvailable: item.isAvailable,
    unavailableReason: item.unavailableReason,
  }));

  return (
    <div className="space-y-4">
      {/* Header with outlet selector and navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white">Point of Sale</h1>
          <form className="flex items-center gap-2">
            <Select name="outlet" defaultValue={selectedOutletId}>
              <SelectTrigger className="w-[250px] bg-neutral-900 border-white/10">
                <SelectValue placeholder="Select outlet" />
              </SelectTrigger>
              <SelectContent className="bg-neutral-900 border-white/10">
                {outlets.map((outlet) => (
                  <SelectItem key={outlet.id} value={outlet.id}>
                    {outlet.name}
                    {currentScope === "ALL" && (
                      <span className="text-neutral-500 ml-2">
                        ({outlet.property.name})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" variant="secondary" size="sm">
              Switch
            </Button>
          </form>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="border-white/10">
            <Link href="/admin/pos/kitchen">
              <ChefHat className="h-4 w-4 mr-2" />
              Kitchen Display
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="border-white/10">
            <Link href="/admin/pos/outlets">
              <Settings className="h-4 w-4 mr-2" />
              Manage Outlets
            </Link>
          </Button>
        </div>
      </div>

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
  );
}
