import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { KitchenOrderCard } from "@/components/admin/pos/kitchen-order-card";
import { getKitchenOrders, getKitchenStats } from "@/lib/pos/kitchen";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle, ChefHat, CheckCircle } from "lucide-react";

interface KitchenPageProps {
  searchParams: Promise<{
    outlet?: string;
  }>;
}

export default async function KitchenDisplayPage({ searchParams }: KitchenPageProps) {
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
          name: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Get selected outlet (default to first outlet)
  const selectedOutletId = params.outlet || outlets[0]?.id;
  const selectedOutlet = outlets.find((o) => o.id === selectedOutletId);

  // Get kitchen orders for the selected outlet
  let kitchenOrders: Awaited<ReturnType<typeof getKitchenOrders>> = [];
  let stats = {
    totalOrders: 0,
    overdueOrders: 0,
    totalItems: 0,
    preparingItems: 0,
    sentItems: 0,
    avgAgeMinutes: 0,
  };

  if (selectedOutletId) {
    kitchenOrders = await getKitchenOrders(selectedOutletId);
    stats = await getKitchenStats(selectedOutletId);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kitchen Display</h1>
          <p className="text-muted-foreground">
            View and manage incoming orders for the kitchen
          </p>
        </div>

        {/* Outlet Selector */}
        <form>
          <Select name="outlet" defaultValue={selectedOutletId}>
            <SelectTrigger className="w-[250px] bg-neutral-900 border-white/10">
              <SelectValue placeholder="Select outlet" />
            </SelectTrigger>
            <SelectContent>
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
        </form>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-neutral-900/50 border border-white/10 rounded-lg">
          <div className="flex items-center gap-2 text-neutral-400 mb-1">
            <ChefHat className="h-4 w-4" />
            <span className="text-xs uppercase tracking-widest">Active Orders</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.totalOrders}</p>
        </div>

        <div className="p-4 bg-neutral-900/50 border border-white/10 rounded-lg">
          <div className="flex items-center gap-2 text-neutral-400 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-xs uppercase tracking-widest">Avg Wait</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.avgAgeMinutes}m</p>
        </div>

        <div className="p-4 bg-neutral-900/50 border border-white/10 rounded-lg">
          <div className="flex items-center gap-2 text-orange-400 mb-1">
            <ChefHat className="h-4 w-4" />
            <span className="text-xs uppercase tracking-widest">Preparing</span>
          </div>
          <p className="text-2xl font-bold text-orange-400">{stats.preparingItems}</p>
        </div>

        <div className="p-4 bg-neutral-900/50 border border-white/10 rounded-lg">
          <div className="flex items-center gap-2 text-red-400 mb-1">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs uppercase tracking-widest">Overdue</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{stats.overdueOrders}</p>
        </div>
      </div>

      {/* Orders Grid */}
      {!selectedOutlet ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ChefHat className="h-12 w-12 text-neutral-600 mb-4" />
          <p className="text-neutral-400">Select an outlet to view kitchen orders</p>
        </div>
      ) : kitchenOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
          <p className="text-neutral-400">No active orders in the kitchen</p>
          <p className="text-neutral-500 text-sm mt-1">
            Orders will appear here when sent from the POS
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kitchenOrders.map((order) => (
            <KitchenOrderCard
              key={order.orderId}
              orderId={order.orderId}
              orderNumber={order.orderNumber}
              tableNumber={order.tableNumber}
              serverName={order.serverName}
              status={order.status}
              items={order.items}
              createdAt={order.createdAt}
              ageMinutes={order.ageMinutes}
              isOverdue={order.isOverdue}
            />
          ))}
        </div>
      )}
    </div>
  );
}
