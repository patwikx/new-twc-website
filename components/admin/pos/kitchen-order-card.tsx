"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, CheckCircle, ChefHat, AlertTriangle, Loader2 } from "lucide-react";
import { OrderItemStatus, POSOrderStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useKitchenSocket } from "@/lib/socket";
import { markItemPreparing, markItemReady, markOrderReady } from "@/lib/pos/kitchen";

interface KitchenOrderItem {
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

interface KitchenOrderCardProps {
  outletId: string;
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

const ITEM_STATUS_COLORS: Record<OrderItemStatus, string> = {
  PENDING: "text-neutral-500",
  SENT: "text-blue-400",
  PREPARING: "text-orange-400",
  READY: "text-green-400",
  PICKED_UP: "text-purple-400",
  SERVED: "text-purple-400",
  CANCELLED: "text-red-400",
};

const ITEM_STATUS_BG: Record<OrderItemStatus, string> = {
  PENDING: "border-neutral-500/50",
  SENT: "border-blue-500/50",
  PREPARING: "border-orange-500/50",
  READY: "border-green-500/50",
  PICKED_UP: "border-purple-500/50",
  SERVED: "border-purple-500/50",
  CANCELLED: "border-red-500/50",
};

export function KitchenOrderCard({
  outletId,
  orderId,
  orderNumber,
  tableNumber,
  serverName,
  status,
  items,
  ageMinutes,
  isOverdue,
}: KitchenOrderCardProps) {
  const router = useRouter();
  const [loadingItemId, setLoadingItemId] = React.useState<string | null>(null);
  const [isMarkingAllReady, setIsMarkingAllReady] = React.useState(false);
  const { emitKitchenUpdate } = useKitchenSocket(outletId);

  const formatAge = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const handleStartPreparing = async (itemId: string) => {
    setLoadingItemId(itemId);
    try {
      const result = await markItemPreparing(itemId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Item marked as preparing");
        emitKitchenUpdate(orderId, "item_started", result.data);
        router.refresh();
      }
    } catch {
      toast.error("Failed to update item");
    } finally {
      setLoadingItemId(null);
    }
  };

  const handleMarkReady = async (itemId: string) => {
    setLoadingItemId(itemId);
    try {
      const result = await markItemReady(itemId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Item marked as ready");
        // Result.data includes order and table info due to recent backend change
        emitKitchenUpdate(orderId, "item_ready", result.data);
        router.refresh();
      }
    } catch {
      toast.error("Failed to update item");
    } finally {
      setLoadingItemId(null);
    }
  };

  const handleMarkAllReady = async () => {
    setIsMarkingAllReady(true);
    try {
      const result = await markOrderReady(orderId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("All items marked as ready");
        
        // Emit item_ready for each updated item so the Order Taker dialog appears
        if (result.data && Array.isArray(result.data)) {
            result.data.forEach((item: any) => {
                emitKitchenUpdate(orderId, "item_ready", item);
            });
        }

        emitKitchenUpdate(orderId, "order_ready", { orderId, orderNumber });
        router.refresh();
      }
    } catch {
      toast.error("Failed to update order");
    } finally {
      setIsMarkingAllReady(false);
    }
  };

  // Count items by status
  const sentCount = items.filter((i) => i.status === "SENT").length;
  const preparingCount = items.filter((i) => i.status === "PREPARING").length;
  const readyCount = items.filter((i) => i.status === "READY").length;

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all",
        isOverdue
          ? "border-red-500/50 bg-red-500/5"
          : "border-white/10 bg-neutral-900/50"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "px-4 py-3 flex items-center justify-between",
          isOverdue ? "bg-red-500/10" : "bg-neutral-800/50"
        )}
      >
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-white">#{orderNumber.split("-").pop()}</span>
              {tableNumber && (
                <Badge variant="outline" className="border-white/20 text-neutral-300">
                  Table {tableNumber}
                </Badge>
              )}
            </div>
            {serverName && (
              <p className="text-xs text-neutral-500">Server: {serverName}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-sm",
              isOverdue
                ? "bg-red-500/20 text-red-400"
                : ageMinutes > 10
                ? "bg-yellow-500/20 text-yellow-400"
                : "bg-neutral-700 text-neutral-300"
            )}
          >
            {isOverdue && <AlertTriangle className="h-3.5 w-3.5" />}
            <Clock className="h-3.5 w-3.5" />
            <span>{formatAge(ageMinutes)}</span>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="p-4 space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[auto_1fr_auto] gap-4 py-3 border-b border-dashed border-white/10 last:border-0 first:pt-0 last:pb-0"
          >
              {/* Quantity */}
              <div className="flex items-start justify-center pt-0.5 min-w-[2rem]">
                <span className={cn(
                  "text-xl font-bold font-mono",
                  item.status === 'READY' ? "text-green-400" :
                  item.status === 'PREPARING' ? "text-orange-400" :
                  "text-neutral-500"
                )}>
                  {item.quantity}x
                </span>
              </div>

              {/* Details */}
              <div className="flex flex-col min-w-0 gap-1">
                <span className={cn(
                  "font-medium text-base leading-snug break-words",
                   item.status === 'READY' ? "text-white" : "text-neutral-300"
                )}>
                  {item.menuItemName}
                </span>
                {item.modifiers && (
                  <p className="text-xs text-neutral-500 font-medium leading-tight">{item.modifiers}</p>
                )}
                {item.notes && (
                  <p className="text-xs text-red-400 mt-1 font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {item.notes}
                  </p>
                )}
              </div>

              {/* Status & Actions */}
              <div className="flex flex-col items-end gap-2">
                 {item.status === "READY" ? (
                   <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-[10px] font-bold tracking-wider uppercase border border-green-500/20 animate-pulse">
                      Pickup
                   </div>
                 ) : item.status === "PREPARING" ? (
                    <span className="text-[10px] font-bold tracking-wider uppercase text-orange-400/80">Prep</span>
                 ) : (
                    <span className="text-[10px] font-bold tracking-wider uppercase text-neutral-500">Queued</span>
                 )}

                {item.status === "SENT" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-white/5"
                    onClick={() => handleStartPreparing(item.id)}
                    disabled={loadingItemId === item.id}
                  >
                    {loadingItemId === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChefHat className="h-4 w-4" />
                    )}
                  </Button>
                )}
                {item.status === "PREPARING" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-3 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:text-green-300 border border-green-500/20 text-xs font-medium"
                    onClick={() => handleMarkReady(item.id)}
                    disabled={loadingItemId === item.id}
                  >
                    {loadingItemId === item.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Ready"
                    )}
                  </Button>
                )}
              </div>
            </div>
        ))}
      </div>

      {/* Footer */}
      <Separator className="bg-white/10" />
      <div className="px-4 py-3 flex items-center justify-between bg-neutral-800/30">
        <div className="flex items-center gap-4 text-xs text-neutral-500">
          {sentCount > 0 && <span>{sentCount} waiting</span>}
          {preparingCount > 0 && <span className="text-orange-400">{preparingCount} preparing</span>}
          {readyCount > 0 && <span className="text-green-400">{readyCount} ready</span>}
        </div>

        {(sentCount > 0 || preparingCount > 0) && (
          <Button
            size="sm"
            className="h-8 bg-green-600 hover:bg-green-700 ml-4"
            onClick={handleMarkAllReady}
            disabled={isMarkingAllReady}
          >
            {isMarkingAllReady ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                All Ready
              </>
            )}
          </Button>
        )}
      </div>
    </Card>
  );
}
