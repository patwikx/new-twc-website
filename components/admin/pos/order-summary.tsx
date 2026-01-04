"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Minus, Plus, Trash2, Send, CreditCard, Loader2 } from "lucide-react";
import { POSOrderStatus, MenuCategory } from "@prisma/client";
import { cn } from "@/lib/utils";

interface OrderItem {
  id: string;
  menuItemId: string;
  menuItemName: string;
  menuItemCategory: MenuCategory;
  quantity: number;
  unitPrice: number;
  modifiers: string | null;
  notes: string | null;
  status: string;
}

interface OrderSummaryProps {
  orderId: string | null;
  orderNumber: string | null;
  orderStatus: POSOrderStatus | null;
  tableName: string | null;
  serverName: string | null;
  items: OrderItem[];
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  discountAmount: number;
  total: number;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onSendToKitchen: () => void;
  onPayment: () => void;
  isLoading?: boolean;
}

const STATUS_COLORS: Record<POSOrderStatus, string> = {
  OPEN: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  SENT_TO_KITCHEN: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  IN_PROGRESS: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  READY: "bg-green-500/20 text-green-400 border-green-500/30",
  SERVED: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  PAID: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  CANCELLED: "bg-red-500/20 text-red-400 border-red-500/30",
  VOID: "bg-neutral-500/20 text-neutral-400 border-neutral-500/30",
};

export function OrderSummary({
  orderId,
  orderNumber,
  orderStatus,
  tableName,
  serverName,
  items,
  subtotal,
  taxAmount,
  serviceCharge,
  discountAmount,
  total,
  onQuantityChange,
  onRemoveItem,
  onSendToKitchen,
  onPayment,
  isLoading = false,
}: OrderSummaryProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const canModifyItems = orderStatus === "OPEN" || orderStatus === null;
  const canSendToKitchen = orderStatus === "OPEN" && items.length > 0;
  const canPay = orderStatus && ["OPEN", "SENT_TO_KITCHEN", "IN_PROGRESS", "READY", "SERVED"].includes(orderStatus);
  const pendingItems = items.filter((item) => item.status === "PENDING");
  const sentItems = items.filter((item) => item.status !== "PENDING");

  return (
    <Card className="flex flex-col h-full bg-neutral-900/50 border-white/10">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <div>
            {orderNumber ? (
              <h3 className="font-semibold text-white">Order #{orderNumber}</h3>
            ) : (
              <h3 className="font-semibold text-neutral-400">New Order</h3>
            )}
            {tableName && (
              <p className="text-sm text-neutral-400">Table {tableName}</p>
            )}
          </div>
          {orderStatus && (
            <Badge variant="outline" className={STATUS_COLORS[orderStatus]}>
              {orderStatus.replace("_", " ")}
            </Badge>
          )}
        </div>
        {serverName && (
          <p className="text-xs text-neutral-500">Server: {serverName}</p>
        )}
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-neutral-500 text-sm">No items added</p>
            <p className="text-neutral-600 text-xs mt-1">
              Select items from the menu
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Pending Items */}
            {pendingItems.length > 0 && (
              <div>
                {sentItems.length > 0 && (
                  <p className="text-xs text-neutral-500 uppercase tracking-widest mb-2">
                    Pending
                  </p>
                )}
                {pendingItems.map((item) => (
                  <OrderItemRow
                    key={item.id}
                    item={item}
                    canModify={canModifyItems}
                    onQuantityChange={onQuantityChange}
                    onRemove={onRemoveItem}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </div>
            )}

            {/* Sent Items */}
            {sentItems.length > 0 && (
              <div>
                {pendingItems.length > 0 && <Separator className="my-3 bg-white/10" />}
                <p className="text-xs text-neutral-500 uppercase tracking-widest mb-2">
                  Sent to Kitchen
                </p>
                {sentItems.map((item) => (
                  <OrderItemRow
                    key={item.id}
                    item={item}
                    canModify={false}
                    onQuantityChange={onQuantityChange}
                    onRemove={onRemoveItem}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="p-4 border-t border-white/10 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-neutral-400">Subtotal</span>
          <span className="text-white">{formatCurrency(subtotal)}</span>
        </div>
        {taxAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-neutral-400">Tax</span>
            <span className="text-white">{formatCurrency(taxAmount)}</span>
          </div>
        )}
        {serviceCharge > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-neutral-400">Service Charge</span>
            <span className="text-white">{formatCurrency(serviceCharge)}</span>
          </div>
        )}
        {discountAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-neutral-400">Discount</span>
            <span className="text-green-400">-{formatCurrency(discountAmount)}</span>
          </div>
        )}
        <Separator className="bg-white/10" />
        <div className="flex justify-between text-lg font-bold">
          <span className="text-white">Total</span>
          <span className="text-green-400">{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-white/10 space-y-2">
        {canSendToKitchen && pendingItems.length > 0 && (
          <Button
            className="w-full bg-orange-600 hover:bg-orange-700"
            onClick={onSendToKitchen}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send to Kitchen ({pendingItems.length})
          </Button>
        )}
        {canPay && (
          <Button
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={onPayment}
            disabled={isLoading || items.length === 0}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Pay {formatCurrency(total)}
          </Button>
        )}
      </div>
    </Card>
  );
}

interface OrderItemRowProps {
  item: OrderItem;
  canModify: boolean;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
  formatCurrency: (value: number) => string;
}

function OrderItemRow({
  item,
  canModify,
  onQuantityChange,
  onRemove,
  formatCurrency,
}: OrderItemRowProps) {
  const lineTotal = item.quantity * item.unitPrice;

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {item.menuItemName}
        </p>
        <p className="text-xs text-neutral-500">
          {formatCurrency(item.unitPrice)} each
        </p>
        {item.modifiers && (
          <p className="text-xs text-neutral-400 mt-0.5">{item.modifiers}</p>
        )}
        {item.notes && (
          <p className="text-xs text-orange-400 mt-0.5">{item.notes}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {canModify ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-neutral-400 hover:text-white"
              onClick={() => onQuantityChange(item.id, item.quantity - 1)}
              disabled={item.quantity <= 1}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-6 text-center text-sm text-white">
              {item.quantity}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-neutral-400 hover:text-white"
              onClick={() => onQuantityChange(item.id, item.quantity + 1)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <span className="text-sm text-neutral-400">×{item.quantity}</span>
        )}

        <span className="text-sm font-medium text-white w-20 text-right">
          {formatCurrency(lineTotal)}
        </span>

        {canModify && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-neutral-400 hover:text-red-400"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-neutral-900 border-white/10">
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Item</AlertDialogTitle>
                <AlertDialogDescription>
                  Remove {item.menuItemName} from the order?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-neutral-800 border-white/10">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onRemove(item.id)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
