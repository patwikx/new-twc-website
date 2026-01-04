"use client";

import { useTransition, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { receiveAgainstPO } from "@/lib/inventory/purchase-order";
import {
  Loader2,
  ArrowLeft,
  PackageOpen,
  FileText,
  Warehouse,
  Building2,
  CheckCircle,
} from "lucide-react";
import { POStatus } from "@prisma/client";
import { format } from "date-fns";

interface POItem {
  id: string;
  stockItemId: string;
  quantity: number;
  unitCost: number;
  receivedQty: number;
  stockItem: {
    id: string;
    name: string;
    itemCode: string;
    primaryUnit: {
      abbreviation: string;
    };
  };
}

interface POReceiveFormProps {
  purchaseOrder: {
    id: string;
    poNumber: string;
    status: POStatus;
    property: {
      id: string;
      name: string;
    };
    supplier: {
      id: string;
      name: string;
    };
    warehouse: {
      id: string;
      name: string;
    };
    items: POItem[];
  };
  userId: string;
}

interface ReceiveLineItem {
  stockItemId: string;
  quantity: string;
  batchNumber: string;
  expirationDate: string;
}

export function POReceiveForm({
  purchaseOrder,
  userId,
}: POReceiveFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<Record<string, ReceiveLineItem>>(
    () => {
      const initial: Record<string, ReceiveLineItem> = {};
      purchaseOrder.items.forEach((item) => {
        const remaining = Number(item.quantity) - Number(item.receivedQty);
        if (remaining > 0) {
          initial[item.stockItemId] = {
            stockItemId: item.stockItemId,
            quantity: remaining.toString(),
            batchNumber: "",
            expirationDate: "",
          };
        }
      });
      return initial;
    }
  );

  // Filter items that still need receiving
  const pendingItems = useMemo(() => {
    return purchaseOrder.items.filter((item) => {
      const remaining = Number(item.quantity) - Number(item.receivedQty);
      return remaining > 0;
    });
  }, [purchaseOrder.items]);

  const getRemainingQuantity = (item: POItem): number => {
    return Number(item.quantity) - Number(item.receivedQty);
  };

  const updateLineItem = (
    stockItemId: string,
    field: keyof ReceiveLineItem,
    value: string
  ) => {
    setLineItems((prev) => ({
      ...prev,
      [stockItemId]: {
        ...prev[stockItemId],
        [field]: value,
      },
    }));
  };

  const setMaxQuantity = (item: POItem) => {
    const remaining = getRemainingQuantity(item);
    updateLineItem(item.stockItemId, "quantity", remaining.toString());
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Build items to receive
    const itemsToReceive = Object.values(lineItems)
      .map((line) => {
        const qty = parseFloat(line.quantity);
        if (isNaN(qty) || qty <= 0) return null;

        return {
          stockItemId: line.stockItemId,
          quantity: qty,
          batchNumber: line.batchNumber.trim() || undefined,
          expirationDate: line.expirationDate
            ? new Date(line.expirationDate)
            : undefined,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (itemsToReceive.length === 0) {
      toast.error("Please enter quantities to receive");
      return;
    }

    // Validate quantities don't exceed remaining
    for (const receiveItem of itemsToReceive) {
      const poItem = purchaseOrder.items.find(
        (i) => i.stockItemId === receiveItem.stockItemId
      );
      if (!poItem) continue;

      const remaining = getRemainingQuantity(poItem);
      if (receiveItem.quantity > remaining) {
        toast.error(
          `${poItem.stockItem.name}: Cannot receive more than remaining (${remaining})`
        );
        return;
      }
    }

    startTransition(async () => {
      const result = await receiveAgainstPO({
        purchaseOrderId: purchaseOrder.id,
        receivedById: userId,
        notes: notes.trim() || undefined,
        items: itemsToReceive,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          result.data?.isFullyReceived
            ? "Purchase order fully received"
            : "Items received successfully"
        );
        router.push(`/admin/inventory/purchase-orders/${purchaseOrder.id}`);
        router.refresh();
      }
    });
  };

  if (pendingItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="h-16 w-16 bg-green-500/20 rounded-full flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="text-xl font-semibold text-white">
          All Items Received
        </h2>
        <p className="text-neutral-400">
          This purchase order has been fully received.
        </p>
        <Button
          onClick={() => router.back()}
          className="bg-orange-600 hover:bg-orange-700"
        >
          Back to Purchase Order
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => router.back()}
            className="text-neutral-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <PackageOpen className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                Receive Items
              </h2>
              <p className="text-sm text-orange-400 font-mono">
                {purchaseOrder.poNumber}
              </p>
            </div>
          </div>
        </div>
        <Button
          type="submit"
          disabled={isPending}
          className="bg-orange-600 hover:bg-orange-700 text-white min-w-[160px]"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Receiving...
            </>
          ) : (
            <>
              <PackageOpen className="mr-2 h-4 w-4" />
              Receive Items
            </>
          )}
        </Button>
      </div>

      {/* PO Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-neutral-900/30 rounded-lg border border-white/10">
        <div className="space-y-1">
          <Label className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-widest">
            <FileText className="h-3 w-3" />
            Supplier
          </Label>
          <p className="text-white font-medium">{purchaseOrder.supplier.name}</p>
        </div>
        <div className="space-y-1">
          <Label className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-widest">
            <Warehouse className="h-3 w-3" />
            Destination Warehouse
          </Label>
          <p className="text-white font-medium">{purchaseOrder.warehouse.name}</p>
        </div>
        <div className="space-y-1">
          <Label className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-widest">
            <Building2 className="h-3 w-3" />
            Property
          </Label>
          <p className="text-white font-medium">{purchaseOrder.property.name}</p>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label className="text-xs text-neutral-500 uppercase tracking-widest">
          Receipt Notes (Optional)
        </Label>
        <Textarea
          placeholder="Add any notes about this receipt..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 min-h-[80px]"
        />
      </div>

      {/* Items Table */}
      <div className="space-y-2">
        <Label className="text-xs text-neutral-500 uppercase tracking-widest">
          Items to Receive
        </Label>
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-neutral-400">Item</TableHead>
                <TableHead className="text-neutral-400 w-24">Ordered</TableHead>
                <TableHead className="text-neutral-400 w-24">Received</TableHead>
                <TableHead className="text-neutral-400 w-24">Remaining</TableHead>
                <TableHead className="text-neutral-400 w-32">Receive Qty</TableHead>
                <TableHead className="text-neutral-400 w-32">Batch #</TableHead>
                <TableHead className="text-neutral-400 w-36">Expiration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingItems.map((item) => {
                const remaining = getRemainingQuantity(item);
                const line = lineItems[item.stockItemId];

                return (
                  <TableRow key={item.id} className="border-white/10">
                    <TableCell>
                      <div>
                        <p className="text-white font-medium">
                          {item.stockItem.name}
                        </p>
                        <p className="text-xs text-neutral-500 font-mono">
                          {item.stockItem.itemCode}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-neutral-300">
                        {Number(item.quantity).toFixed(3)}{" "}
                        {item.stockItem.primaryUnit.abbreviation}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          Number(item.receivedQty) > 0
                            ? "text-green-400"
                            : "text-neutral-500"
                        }
                      >
                        {Number(item.receivedQty).toFixed(3)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-orange-400 font-medium">
                        {remaining.toFixed(3)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          max={remaining}
                          step="0.001"
                          value={line?.quantity || ""}
                          onChange={(e) =>
                            updateLineItem(
                              item.stockItemId,
                              "quantity",
                              e.target.value
                            )
                          }
                          className="h-8 w-20 bg-neutral-900/30 border-white/10"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setMaxQuantity(item)}
                          className="h-8 px-2 text-xs border-white/10"
                        >
                          Max
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        placeholder="Optional"
                        value={line?.batchNumber || ""}
                        onChange={(e) =>
                          updateLineItem(
                            item.stockItemId,
                            "batchNumber",
                            e.target.value
                          )
                        }
                        className="h-8 bg-neutral-900/30 border-white/10"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={line?.expirationDate || ""}
                        onChange={(e) =>
                          updateLineItem(
                            item.stockItemId,
                            "expirationDate",
                            e.target.value
                          )
                        }
                        className="h-8 bg-neutral-900/30 border-white/10"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Summary */}
      <div className="flex justify-between items-center p-4 bg-neutral-900/50 rounded-lg border border-white/10">
        <span className="text-neutral-400">
          {pendingItems.length} item(s) pending receipt
        </span>
        <Badge
          variant="outline"
          className="bg-orange-500/20 text-orange-400 border-orange-500/30"
        >
          Partial receiving supported
        </Badge>
      </div>
    </form>
  );
}
