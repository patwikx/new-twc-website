"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, Trash2, Send, Loader2, Sparkles, Ban } from "lucide-react";
import { POSOrderStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { OrderItem } from "./types";

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
  customerName?: string | null;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onSendToKitchen: () => void;
  onPayment?: () => void; // Optional for Order Taker
  onDiscount?: () => void; // Optional for Order Taker
  onVoidOrder?: () => void; // Optional for Order Taker
  onVoidItem?: (itemId: string, itemName: string, amount: number) => void; // Optional for Order Taker
  onAssignCustomer?: () => void;
  onSaveDraft?: () => void;
  isLoading?: boolean;
}

const STATUS_COLORS: Record<POSOrderStatus, string> = {
  OPEN: "bg-blue-500 text-blue-100",
  SENT_TO_KITCHEN: "bg-orange-500 text-orange-100",
  IN_PROGRESS: "bg-yellow-500 text-yellow-900",
  READY: "bg-green-500 text-green-100",
  SERVED: "bg-purple-500 text-purple-100",
  PAID: "bg-emerald-500 text-emerald-100",
  CANCELLED: "bg-red-500 text-red-100",
  VOID: "bg-neutral-500 text-neutral-100",
  CLOSED: "bg-gray-500 text-gray-100",
} as any;

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
  customerName,
  onQuantityChange,
  onRemoveItem,
  onSendToKitchen,
  onPayment,
  onDiscount,
  onVoidOrder,
  onVoidItem,
  onAssignCustomer,
  onSaveDraft,
  isLoading = false,
}: OrderSummaryProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const activeStatuses = ["OPEN", "SENT_TO_KITCHEN", "IN_PROGRESS", "READY", "SERVED"];
  const canModifyItems = !orderStatus || activeStatuses.includes(orderStatus);
  const canSendToKitchen = (!orderStatus || activeStatuses.includes(orderStatus)) && items.length > 0;
  const canPay = orderStatus && activeStatuses.includes(orderStatus);
  const canInteract = orderStatus && !["PAID", "CANCELLED", "VOID", "CLOSED"].includes(orderStatus);

  const pendingItems = items.filter((item) => item.status === "PENDING" || item.status === "OPEN"); 
  const sentItems = items.filter((item) => item.status !== "PENDING" && item.status !== "OPEN");

  return (
    <Card className="flex flex-col h-full bg-neutral-900 border-l border-white/5 shadow-none rounded-none">
      {/* Header - Compact */}
      <div className="px-3 py-2 border-b border-white/5 space-y-1.5">
        <div className="flex items-center justify-between">
            <div>
               <p className="text-[9px] uppercase text-neutral-500 font-semibold tracking-wider">Current Order</p>
                {orderNumber ? (
                  <div className="flex items-baseline gap-2">
                      <h3 className="font-mono text-lg text-white font-medium tracking-tight">#{orderNumber.split('-').pop()}</h3>
                      {orderStatus && (
                        <span className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded font-medium uppercase bg-opacity-10", 
                            STATUS_COLORS[orderStatus]?.replace("bg-", "bg-opacity-10 bg-").replace("border-", "border-opacity-0 ") || "text-neutral-400"
                        )}>
                            {orderStatus.replace("_", " ")}
                        </span>
                      )}
                  </div>
                ) : (
                  <h3 className="font-medium text-neutral-400 text-sm">New Order</h3>
                )}
            </div>
        </div>

        <div className="flex items-center justify-between text-xs bg-white/5 p-2 rounded-md border border-white/5">
            <div className="flex items-center gap-1.5">
                <span className="text-neutral-500">Table</span>
                <span className="text-white font-medium">{tableName || "—"}</span>
            </div>
            <div className="h-3 w-px bg-white/10 mx-2" />
            <div className="flex items-center gap-1.5">
                <span className="text-neutral-500">Guest</span>
                {customerName ? (
                    <span className="text-orange-400 font-medium truncate max-w-[100px]">{customerName}</span>
                ) : (
                    onAssignCustomer ? (
                        <button 
                            onClick={onAssignCustomer}
                            className="text-orange-400 hover:text-orange-300 hover:underline transition-colors"
                        >
                            + Add
                        </button>
                    ) : <span>—</span>
                )}
            </div>
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 text-neutral-500 space-y-3">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-neutral-600" />
            </div>
            <p className="text-sm">No items added yet</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {/* All items in a single list - pending items first, then sent items */}
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
            {sentItems.map((item) => (
                <OrderItemRow
                    key={item.id}
                    item={item}
                    canModify={false}
                    canVoid={!!onVoidItem && !["PAID", "CANCELLED", "VOID", "CLOSED", "VOIDED"].includes(item.status)}
                    onQuantityChange={onQuantityChange}
                    onRemove={onRemoveItem}
                    onVoid={onVoidItem}
                    formatCurrency={formatCurrency}
                />
            ))}
          </div>
        )}
      </div>

      {/* Footer Section */}
      <div className="bg-neutral-900 border-t border-white/10 p-4 space-y-4">
        {/* Breakdown */}
        <div className="space-y-1 text-sm">
            {taxAmount > 0 && (
                <div className="flex justify-between text-neutral-500">
                    <span>VAT</span>
                    <span>{formatCurrency(taxAmount)}</span>
                </div>
            )}
            {serviceCharge > 0 && (
                <div className="flex justify-between text-neutral-500">
                    <span>Service Charge</span>
                    <span>{formatCurrency(serviceCharge)}</span>
                </div>
            )}
            {discountAmount > 0 && (
                <div className="flex justify-between text-green-400">
                    <span>Discount</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                </div>
            )}
            <div className="flex justify-between items-end pt-2 mt-2 border-t border-white/5">
                <span className="text-neutral-400 font-medium">Total</span>
                <span className="text-2xl font-bold text-white">{formatCurrency(total)}</span>
            </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
             {/* Secondary Actions */}
            {canInteract && (onDiscount || onVoidOrder) && (
            <div className="grid grid-cols-2 gap-3">
                    {onDiscount && (
                    <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-10 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/5 rounded-md"
                        onClick={onDiscount}
                        disabled={isLoading || items.length === 0}
                    >
                        <Sparkles className="h-4 w-4 mr-2 opacity-50" />
                        Discount
                    </Button>
                    )}
                    {onVoidOrder && (
                    <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-10 bg-red-500/5 hover:bg-red-500/10 text-red-400 border border-red-500/10 rounded-md"
                        onClick={onVoidOrder}
                        disabled={isLoading || items.length === 0}
                    >
                        Void Order
                    </Button>
                    )}
            </div>
            )}

            {/* Primary Action */}
            {canSendToKitchen && pendingItems.length > 0 && (
                <div className="space-y-2">
                    <Button
                        size="lg"
                        className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-md"
                        onClick={onSendToKitchen}
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 mr-2" />}
                        Place Order ({pendingItems.length})
                    </Button>
                    
                    {onSaveDraft && (
                        <Button
                            variant="outline"
                            className="w-full h-12 border-white/10 text-neutral-400 hover:text-white hover:bg-white/5"
                            onClick={onSaveDraft}
                            disabled={isLoading}
                        >
                            Save as Draft
                        </Button>
                    )}
                </div>
            )}
            
            {canPay && onPayment && pendingItems.length === 0 && (
                <Button
                    size="lg"
                    className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md"
                    onClick={onPayment}
                    disabled={isLoading || items.length === 0}
                >
                    Pay {formatCurrency(total)}
                </Button>
            )}
        </div>
      </div>
    </Card>
  );
}

interface OrderItemRowProps {
  item: OrderItem;
  canModify: boolean;
  canVoid?: boolean;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
  onVoid?: (itemId: string, itemName: string, amount: number) => void;
  formatCurrency: (value: number) => string;
}

function OrderItemRow({
  item,
  canModify,
  canVoid,
  onQuantityChange,
  onRemove,
  onVoid,
  formatCurrency,
}: OrderItemRowProps) {
  const lineTotal = item.quantity * item.unitPrice;
  const isVoided = ["CANCELLED", "VOID", "VOIDED"].includes(item.status);

  return (
    <div className="flex gap-3 p-2 items-center hover:bg-white/5 transition-colors group relative border-b border-white/5 last:border-0">
       {/* 1. Image (Left) */}
       {item.menuItemImage ? (
           <div className="h-10 w-10 rounded-lg overflow-hidden bg-neutral-800 border border-white/5 flex-shrink-0">
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img 
                  src={item.menuItemImage} 
                  alt={item.menuItemName}
                  className="h-full w-full object-cover"
               />
           </div>
       ) : (
           <div className="h-10 w-10 rounded-lg bg-neutral-800/50 border border-white/5 flex items-center justify-center flex-shrink-0">
               <span className="text-xs text-neutral-600 font-medium">IMG</span>
           </div>
       )}

       {/* 2. Details (Center) */}
       <div className="flex-1 min-w-0 pr-2 flex flex-col justify-center">
            <div className="flex flex-col">
                <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col">
                        <span className={cn("text-sm font-semibold leading-tight", isVoided ? "text-neutral-500 line-through" : "text-white")}>
                            {item.menuItemName}
                        </span>
                        {isVoided && <span className="text-[10px] font-bold text-red-500 uppercase px-1.5 py-0.5 bg-red-500/10 rounded w-fit mt-1">Void</span>}
                    </div>
                </div>
                
                <div className="flex flex-col gap-0.5 mt-0.5">
                    <span className={cn("text-sm font-bold", isVoided ? "text-neutral-500 line-through" : "text-white")}>
                        {formatCurrency(lineTotal)}
                    </span>
                    <div className="text-xs text-neutral-500 font-medium">
                        {item.quantity > 1 && (
                            <span className="whitespace-nowrap bg-white/5 px-1.5 py-0.5 rounded text-[10px] text-neutral-400">
                                {item.quantity} x {formatCurrency(item.unitPrice)}
                            </span>
                        )}
                        {item.modifiers && (
                            <div className="mt-0.5">
                                <span className="text-neutral-400">{item.modifiers}</span>
                            </div>
                        )}
                    </div>
                </div>

                {item.notes && (
                    <div className="mt-1 text-xs text-orange-400/90 italic truncate">
                        "{item.notes}"
                    </div>
                )}
                
                {/* Inline Void Action */}
                {canVoid && onVoid && !isVoided && (
                     <button 
                         onClick={() => onVoid(item.id, item.menuItemName, lineTotal)}
                         className="text-[10px] uppercase font-bold text-red-400 hover:text-red-300 hover:underline flex items-center gap-1 mt-1 w-fit"
                     >
                         <Ban className="h-3 w-3" /> Void
                     </button>
                )}
            </div>
       </div>

       {/* 3. Actions (Right Side) */}
       <div className="flex items-center gap-2 pl-2">
            {/* Stepper */}
            <div className="flex items-center bg-neutral-800 rounded-lg border border-white/10 overflow-hidden h-8 shadow-sm shrink-0">
               {canModify ? (
                   <>
                    <button
                        className="h-full w-8 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-colors border-r border-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={() => onQuantityChange(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                    >
                        <Minus className="h-3 w-3" />
                    </button>
                    <div className="h-full w-7 flex items-center justify-center text-sm font-bold text-white bg-neutral-900/50">
                        {item.quantity}
                    </div>
                    <button
                        className="h-full w-8 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-colors border-l border-white/5"
                        onClick={() => onQuantityChange(item.id, item.quantity + 1)}
                    >
                        <Plus className="h-3 w-3" />
                    </button>
                   </>
               ) : (
                    <div className="h-full w-8 flex items-center justify-center text-sm font-bold text-white bg-neutral-800/50 px-2">
                        {item.quantity}
                    </div>
               )}
            </div>

            {/* Trash Button */}
            {canModify && (
                <button 
                    onClick={() => onRemove(item.id)}
                    className="h-10 w-10 flex-shrink-0 flex items-center justify-center text-neutral-500 hover:text-white hover:bg-red-500 rounded-lg transition-all border border-white/5 hover:border-red-500/50 bg-neutral-800/50"
                    title="Remove Item"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            )}
       </div>
    </div>
  );
}
