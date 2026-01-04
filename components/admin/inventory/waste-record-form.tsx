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
import { recordWaste } from "@/lib/inventory/waste";
import { WasteType } from "@prisma/client";
import { Loader2, Warehouse, Search, Trash2 } from "lucide-react";

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

interface BatchOption {
  id: string;
  batchNumber: string;
  quantity: number;
  unitCost: number;
  expirationDate: Date | null;
  stockItemId: string;
  warehouseId: string;
}

interface WasteRecordFormProps {
  stockItems: StockItem[];
  warehouses: WarehouseOption[];
  batches: BatchOption[];
  userId: string;
}

const WASTE_TYPES: { value: WasteType; label: string }[] = [
  { value: "SPOILAGE", label: "Spoilage" },
  { value: "EXPIRED", label: "Expired" },
  { value: "DAMAGED", label: "Damaged" },
  { value: "OVERPRODUCTION", label: "Overproduction" },
  { value: "PREPARATION_WASTE", label: "Preparation Waste" },
];

interface WasteLineItem {
  stockItemId: string;
  wasteType: WasteType | "";
  quantity: string;
  batchId: string;
  availableQuantity: number;
  unitCost: number;
}

export function WasteRecordForm({
  stockItems,
  warehouses,
  batches,
  userId,
}: WasteRecordFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [lineItems, setLineItems] = useState<Record<string, WasteLineItem>>({});
  const [reason, setReason] = useState("");

  // Filter items that have stock in selected warehouse
  const availableItems = useMemo(() => {
    if (!selectedWarehouseId) return stockItems;
    return stockItems.filter((item) =>
      item.stockLevels.some(
        (sl) => sl.warehouseId === selectedWarehouseId && sl.quantity > 0
      )
    );
  }, [stockItems, selectedWarehouseId]);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return availableItems;
    const query = searchQuery.toLowerCase();
    return availableItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.itemCode.toLowerCase().includes(query)
    );
  }, [availableItems, searchQuery]);

  // Reset selections when warehouse changes
  useEffect(() => {
    setSelectedItems(new Set());
    setLineItems({});
  }, [selectedWarehouseId]);

  // Get available quantity for an item
  const getAvailableQuantity = (itemId: string): number => {
    const item = stockItems.find((i) => i.id === itemId);
    const stockLevel = item?.stockLevels.find(
      (sl) => sl.warehouseId === selectedWarehouseId
    );
    return stockLevel?.quantity ?? 0;
  };

  // Get unit cost for an item
  const getUnitCost = (itemId: string): number => {
    const item = stockItems.find((i) => i.id === itemId);
    const stockLevel = item?.stockLevels.find(
      (sl) => sl.warehouseId === selectedWarehouseId
    );
    return stockLevel?.averageCost ?? 0;
  };

  // Get batches for an item in selected warehouse
  const getItemBatches = (itemId: string): BatchOption[] => {
    return batches.filter(
      (b) =>
        b.stockItemId === itemId &&
        b.warehouseId === selectedWarehouseId &&
        b.quantity > 0
    );
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
      const availableQty = getAvailableQuantity(itemId);
      const unitCost = getUnitCost(itemId);
      setLineItems({
        ...lineItems,
        [itemId]: {
          stockItemId: itemId,
          wasteType: "",
          quantity: "",
          batchId: "",
          availableQuantity: availableQty,
          unitCost: unitCost,
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
      const newLineItems: Record<string, WasteLineItem> = {};
      filteredItems.forEach((item) => {
        const availableQty = getAvailableQuantity(item.id);
        const unitCost = getUnitCost(item.id);
        newLineItems[item.id] = lineItems[item.id] || {
          stockItemId: item.id,
          wasteType: "",
          quantity: "",
          batchId: "",
          availableQuantity: availableQty,
          unitCost: unitCost,
        };
      });
      setSelectedItems(newSelected);
      setLineItems(newLineItems);
    }
  };

  // Update line item
  const updateLineItem = (
    itemId: string,
    field: keyof WasteLineItem,
    value: string
  ) => {
    const newLineItems = { ...lineItems };
    newLineItems[itemId] = {
      ...newLineItems[itemId],
      [field]: value,
    };

    // If batch changed, update unit cost
    if (field === "batchId" && value) {
      const batch = batches.find((b) => b.id === value);
      if (batch) {
        newLineItems[itemId].unitCost = batch.unitCost;
        newLineItems[itemId].availableQuantity = batch.quantity;
      }
    } else if (field === "batchId" && !value) {
      // Reset to stock level values
      newLineItems[itemId].unitCost = getUnitCost(itemId);
      newLineItems[itemId].availableQuantity = getAvailableQuantity(itemId);
    }

    setLineItems(newLineItems);
  };

  // Calculate total waste cost
  const totalWasteCost = useMemo(() => {
    return Array.from(selectedItems).reduce((sum, itemId) => {
      const line = lineItems[itemId];
      if (!line) return sum;
      const qty = parseFloat(line.quantity) || 0;
      return sum + qty * line.unitCost;
    }, 0);
  }, [selectedItems, lineItems]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedWarehouseId) {
      toast.error("Please select a warehouse");
      return;
    }

    if (selectedItems.size === 0) {
      toast.error("Please select at least one item");
      return;
    }

    // Validate all selected items
    const errors: string[] = [];
    const validItems: WasteLineItem[] = [];

    selectedItems.forEach((itemId) => {
      const line = lineItems[itemId];
      const item = stockItems.find((i) => i.id === itemId);
      const qty = parseFloat(line?.quantity || "");

      if (!line?.wasteType) {
        errors.push(`${item?.name}: Select waste type`);
      } else if (isNaN(qty) || qty <= 0) {
        errors.push(`${item?.name}: Invalid quantity`);
      } else if (qty > line.availableQuantity) {
        errors.push(
          `${item?.name}: Exceeds available (${line.availableQuantity.toFixed(3)})`
        );
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
        const result = await recordWaste({
          stockItemId: line.stockItemId,
          warehouseId: selectedWarehouseId,
          wasteType: line.wasteType as WasteType,
          quantity: parseFloat(line.quantity),
          batchId: line.batchId || undefined,
          reason: reason.trim() || undefined,
          recordedById: userId,
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
        toast.success(`Successfully recorded waste for ${successCount} item(s)`);
        setSelectedItems(new Set());
        setLineItems({});
        setReason("");
        router.refresh();
      }

      if (errorCount > 0) {
        toast.error(`Failed to record waste for ${errorCount} item(s)`);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">
            Record Waste
          </h2>
          <p className="text-sm text-neutral-400">
            Track spoilage, expired items, and other inventory losses.
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
              `Record ${selectedItems.size} Item(s)`
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

        {/* Total */}
        <div className="text-right">
          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">
            Total Waste Cost
          </p>
          <p className="text-xl font-semibold text-red-400">
            ₱{totalWasteCost.toFixed(2)}
          </p>
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
              <TableHead className="text-neutral-400 w-40">Waste Type</TableHead>
              <TableHead className="text-neutral-400 w-32">Quantity</TableHead>
              <TableHead className="text-neutral-400 w-40">Batch</TableHead>
              <TableHead className="text-neutral-400 text-right w-28">
                Cost
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map((item) => {
              const isSelected = selectedItems.has(item.id);
              const line = lineItems[item.id];
              const itemBatches = getItemBatches(item.id);
              const available = selectedWarehouseId
                ? getAvailableQuantity(item.id)
                : 0;
              const lineCost =
                isSelected && line
                  ? (parseFloat(line.quantity) || 0) * line.unitCost
                  : 0;

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
                      disabled={!selectedWarehouseId || available === 0}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-white font-medium">{item.name}</p>
                      <p className="text-xs text-neutral-500 font-mono">
                        {item.itemCode} • {available.toFixed(3)}{" "}
                        {item.primaryUnit.abbreviation} available
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={line?.wasteType || ""}
                      onValueChange={(value) =>
                        updateLineItem(item.id, "wasteType", value)
                      }
                      disabled={!isSelected}
                    >
                      <SelectTrigger className="h-8 bg-neutral-900/30 border-white/10 disabled:opacity-30">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {WASTE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    {itemBatches.length > 0 ? (
                      <Select
                        value={line?.batchId || ""}
                        onValueChange={(value) =>
                          updateLineItem(item.id, "batchId", value)
                        }
                        disabled={!isSelected}
                      >
                        <SelectTrigger className="h-8 bg-neutral-900/30 border-white/10 disabled:opacity-30">
                          <SelectValue placeholder="Optional" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">No batch</SelectItem>
                          {itemBatches.map((batch) => (
                            <SelectItem key={batch.id} value={batch.id}>
                              {batch.batchNumber} ({batch.quantity.toFixed(1)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-neutral-500">
                        No batches
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`font-medium ${
                        isSelected && lineCost > 0
                          ? "text-red-400"
                          : "text-neutral-600"
                      }`}
                    >
                      ₱{lineCost.toFixed(2)}
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
                  {selectedWarehouseId
                    ? "No items with stock in this warehouse"
                    : "Select a warehouse to see available items"}
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
            Notes (Optional)
          </Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Found during morning inspection, improper storage..."
            rows={2}
            className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 resize-none"
          />
        </div>
      )}

      {/* Summary */}
      {selectedItems.size > 0 && (
        <div className="flex justify-between items-center p-4 bg-neutral-900/50 rounded-lg border border-white/10">
          <span className="text-neutral-400">
            {selectedItems.size} item(s) selected
          </span>
          <div className="text-right">
            <p className="text-sm text-neutral-400">Total Waste Value</p>
            <p className="text-2xl font-bold text-red-400">
              ₱{totalWasteCost.toFixed(2)}
            </p>
          </div>
        </div>
      )}
    </form>
  );
}
