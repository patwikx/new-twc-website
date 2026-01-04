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
  PENDING: "bg-neutral-500/20 text-neutral-400 border-neutral-500/30",
  SENT: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  PREPARING: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  READY: "bg-green-500/20 text-green-400 border-green-500/30",
  SERVED: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  CANCELLED: "bg-red-500/20 text-red-400 border-red-500/30",
};

export function KitchenOrderCard({
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
            className={cn(
              "flex items-start justify-between p-3 rounded-lg",
              item.status === "READY"
                ? "bg-green-500/10 border border-green-500/20"
                : item.status === "PREPARING"
                ? "bg-orange-500/10 border border-orange-500/20"
                : "bg-neutral-800/50 border border-white/5"
            )}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">{item.quantity}×</span>
                <span className="font-medium text-white">{item.menuItemName}</span>
                <Badge
                  variant="outline"
                  className={cn("text-xs", ITEM_STATUS_COLORS[item.status])}
                >
                  {item.status}
                </Badge>
              </div>
              {item.modifiers && (
                <p className="text-sm text-neutral-400 mt-1">{item.modifiers}</p>
              )}
              {item.notes && (
                <p className="text-sm text-orange-400 mt-1 font-medium">
                  ⚠️ {item.notes}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 ml-4">
              {item.status === "SENT" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-orange-500/30 text-orange-400 hover:bg-orange-500/20"
                  onClick={() => handleStartPreparing(item.id)}
                  disabled={loadingItemId === item.id}
                >
                  {loadingItemId === item.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <ChefHat className="h-4 w-4 mr-1" />
                      Start
                    </>
                  )}
                </Button>
              )}
              {item.status === "PREPARING" && (
                <Button
                  size="sm"
                  className="h-8 bg-green-600 hover:bg-green-700"
                  onClick={() => handleMarkReady(item.id)}
                  disabled={loadingItemId === item.id}
                >
                  {loadingItemId === item.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Ready
                    </>
                  )}
                </Button>
              )}
              {item.status === "READY" && (
                <CheckCircle className="h-5 w-5 text-green-400" />
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
            className="h-8 bg-green-600 hover:bg-green-700"
            onClick={handleMarkAllReady}
            disabled={isMarkingAllReady}
          >
            {isMarkingAllReady ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-1" />
            )}
            All Ready
          </Button>
        )}
      </div>
    </Card>
  );
}
