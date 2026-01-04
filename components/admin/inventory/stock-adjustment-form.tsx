"use client";

import { useTransition, useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { adjustStock } from "@/lib/inventory/stock-movement";
import { Loader2, Warehouse, Search, Plus, Minus } from "lucide-react";

interface StockItem {
  id: string;
  name: string;
  itemCode: string;
  primaryUnit: {
    id: string;
    abbreviation: string;
  };
  stockLevels: {
    warehouseId: string;
    quantity: number;
    averageCost: number;
  }[];
}

interface WarehouseOption {
  id: string;
  name: string;
  type: string;
}

interface StockAdjustmentFormProps {
  stockItems: StockItem[];
  warehouses: WarehouseOption[];
  userId: string;
}

type AdjustmentType = "increase" | "decrease";

interface AdjustmentLineItem {
  stockItemId: string;
  adjustmentType: AdjustmentType;
  quantity: string;
  currentQuantity: number;
}

export function StockAdjustmentForm({
  stockItems,
  warehouses,
  userId,
}: StockAdjustmentFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [lineItems, setLineItems] = useState<Record<string, AdjustmentLineItem>>({});
  const [reason, setReason] = useState("");

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return stockItems;
    const query = searchQuery.toLowerCase();
    return stockItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.itemCode.toLowerCase().includes(query)
    );
  }, [stockItems, searchQuery]);

  // Reset selections when warehouse changes
  useEffect(() => {
    setSelectedItems(new Set());
    setLineItems({});
  }, [selectedWarehouseId]);

  // Get current quantity for an item in selected warehouse
  const getCurrentQuantity = (itemId: string): number => {
    const item = stockItems.find((i) => i.id === itemId);
    const stockLevel = item?.stockLevels.find(
      (sl) => sl.warehouseId === selectedWarehouseId
    );
    return stockLevel?.quantity ?? 0;
  };

  // Toggle item selection
  const toggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
      const newLineItems = { ...lineItems };
      delete newLineItems[itemId];
      setLineItems(newLineItems);
    } else {
      newSelected.add(itemId);
      const currentQty = getCurrentQuantity(itemId);
      setLineItems({
        ...lineItems,
        [itemId]: {
          stockItemId: itemId,
          adjustmentType: "increase",
          quantity: "",
          currentQuantity: currentQty,
        },
      });
    }
    setSelectedItems(newSelected);
  };

  // Select/deselect all visible items
  const toggleAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
      setLineItems({});
    } else {
      const newSelected = new Set(filteredItems.map((item) => item.id));
      const newLineItems: Record<string, AdjustmentLineItem> = {};
      filteredItems.forEach((item) => {
        const currentQty = getCurrentQuantity(item.id);
        newLineItems[item.id] = lineItems[item.id] || {
          stockItemId: item.id,
          adjustmentType: "increase",
          quantity: "",
          currentQuantity: currentQty,
        };
      });
      setSelectedItems(newSelected);
      setLineItems(newLineItems);
    }
  };

  // Update line item
  const updateLineItem = (
    itemId: string,
    field: keyof AdjustmentLineItem,
    value: string | AdjustmentType
  ) => {
    setLineItems({
      ...lineItems,
      [itemId]: {
        ...lineItems[itemId],
        [field]: value,
      },
    });
  };

  // Calculate new quantity after adjustment
  const getNewQuantity = (itemId: string): number => {
    const line = lineItems[itemId];
    if (!line) return 0;
    const qty = parseFloat(line.quantity) || 0;
    return line.adjustmentType === "increase"
      ? line.currentQuantity + qty
      : line.currentQuantity - qty;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedWarehouseId) {
      toast.error("Please select a warehouse");
      return;
    }

    if (selectedItems.size === 0) {
      toast.error("Please select at least one item to adjust");
      return;
    }

    if (!reason.trim()) {
      toast.error("Please provide a reason for the adjustment");
      return;
    }

    // Validate all selected items
    const errors: string[] = [];
    const validItems: AdjustmentLineItem[] = [];

    selectedItems.forEach((itemId) => {
      const line = lineItems[itemId];
      const item = stockItems.find((i) => i.id === itemId);
      const qty = parseFloat(line?.quantity || "");
      const newQty = getNewQuantity(itemId);

      if (isNaN(qty) || qty <= 0) {
        errors.push(`${item?.name}: Invalid quantity`);
      } else if (newQty < 0) {
        errors.push(`${item?.name}: Would result in negative stock`);
      } else {
        validItems.push(line);
      }
    });

    if (errors.length > 0) {
      toast.error(errors.join("\n"));
      return;
    }

    startTransition(async () => {
      let successCount = 0;
      let errorCount = 0;

      for (const line of validItems) {
        const qty = parseFloat(line.quantity);
        const adjustmentValue = line.adjustmentType === "increase" ? qty : -qty;

        const result = await adjustStock({
          stockItemId: line.stockItemId,
          warehouseId: selectedWarehouseId,
          quantity: adjustmentValue,
          reason: reason.trim(),
          createdById: userId,
        });

        if (result.error) {
          errorCount++;
          const item = stockItems.find((i) => i.id === line.stockItemId);
          toast.error(`${item?.name}: ${result.error}`);
        } else {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully adjusted ${successCount} item(s)`);
        setSelectedItems(new Set());
        setLineItems({});
        setReason("");
        router.refresh();
      }

      if (errorCount > 0) {
        toast.error(`Failed to adjust ${errorCount} item(s)`);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">
            Stock Adjustment
          </h2>
          <p className="text-sm text-neutral-400">
            Correct inventory counts for multiple items.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            type="button"
            onClick={() => router.back()}
            className="text-neutral-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending || selectedItems.size === 0}
            className="bg-orange-600 hover:bg-orange-700 text-white min-w-[140px]"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              `Adjust ${selectedItems.size} Item(s)`
            )}
          </Button>
        </div>
      </div>

      {/* Warehouse Selection & Search */}
      <div className="flex items-end gap-4">
        <div className="w-64 space-y-2">
          <Label className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-widest">
            <Warehouse className="h-3 w-3" />
            Warehouse
          </Label>
          <Select
            value={selectedWarehouseId}
            onValueChange={setSelectedWarehouseId}
          >
            <SelectTrigger className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50">
              <SelectValue placeholder="Select warehouse" />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        <div className="flex-1 space-y-2">
          <Label className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-widest">
            <Search className="h-3 w-3" />
            Search Items
          </Label>
          <Input
            placeholder="Search by name or item code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50"
          />
        </div>
      </div>

      {/* Items Table */}
      <div className="border border-white/10 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    filteredItems.length > 0 &&
                    selectedItems.size === filteredItems.length
                  }
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead className="text-neutral-400">Item</TableHead>
              <TableHead className="text-neutral-400 w-32">Current</TableHead>
              <TableHead className="text-neutral-400 w-32">Type</TableHead>
              <TableHead className="text-neutral-400 w-32">Quantity</TableHead>
              <TableHead className="text-neutral-400 w-32">New Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map((item) => {
              const isSelected = selectedItems.has(item.id);
              const line = lineItems[item.id];
              const currentQty = selectedWarehouseId
                ? getCurrentQuantity(item.id)
                : 0;
              const newQty = isSelected ? getNewQuantity(item.id) : currentQty;

              return (
                <TableRow
                  key={item.id}
                  className={`border-white/10 ${
                    isSelected ? "bg-orange-500/5" : ""
                  }`}
                >
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleItem(item.id)}
                      disabled={!selectedWarehouseId}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-white font-medium">{item.name}</p>
                      <p className="text-xs text-neutral-500 font-mono">
                        {item.itemCode} • {item.primaryUnit.abbreviation}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-neutral-300">
                      {currentQty.toFixed(3)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!isSelected}
                        onClick={() =>
                          updateLineItem(item.id, "adjustmentType", "increase")
                        }
                        className={`h-7 px-2 ${
                          line?.adjustmentType === "increase"
                            ? "bg-green-600 border-green-600 text-white hover:bg-green-700"
                            : "border-white/10 hover:bg-white/5"
                        } disabled:opacity-30`}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!isSelected}
                        onClick={() =>
                          updateLineItem(item.id, "adjustmentType", "decrease")
                        }
                        className={`h-7 px-2 ${
                          line?.adjustmentType === "decrease"
                            ? "bg-red-600 border-red-600 text-white hover:bg-red-700"
                            : "border-white/10 hover:bg-white/5"
                        } disabled:opacity-30`}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0.001"
                      step="0.001"
                      placeholder="0"
                      disabled={!isSelected}
                      value={line?.quantity || ""}
                      onChange={(e) =>
                        updateLineItem(item.id, "quantity", e.target.value)
                      }
                      className="h-8 bg-neutral-900/30 border-white/10 disabled:opacity-30"
                    />
                  </TableCell>
                  <TableCell>
                    <span
                      className={`font-medium ${
                        isSelected
                          ? newQty < 0
                            ? "text-red-400"
                            : newQty !== currentQty
                            ? "text-orange-400"
                            : "text-neutral-300"
                          : "text-neutral-600"
                      }`}
                    >
                      {newQty.toFixed(3)}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredItems.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-neutral-500 py-8"
                >
                  No items found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Reason Section */}
      {selectedItems.size > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-neutral-500 uppercase tracking-widest">
            Reason for Adjustment (Required)
          </Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Physical count correction, damaged goods write-off, inventory reconciliation..."
            required
            rows={2}
            className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 resize-none"
          />
          <p className="text-xs text-neutral-500">
            This reason will be applied to all selected adjustments.
          </p>
        </div>
      )}

      {/* Summary */}
      {selectedItems.size > 0 && (
        <div className="flex justify-between items-center p-4 bg-neutral-900/50 rounded-lg border border-white/10">
          <span className="text-neutral-400">
            {selectedItems.size} item(s) selected for adjustment
          </span>
          <span className="text-sm text-neutral-400">
            Warehouse:{" "}
            <span className="text-orange-400 font-medium">
              {warehouses.find((w) => w.id === selectedWarehouseId)?.name}
            </span>
          </span>
        </div>
      )}
    </form>
  );
}
