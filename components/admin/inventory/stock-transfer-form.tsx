"use client";

import { useTransition, useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { transferStock } from "@/lib/inventory/stock-movement";
import { Loader2, ArrowRight, Warehouse, Search } from "lucide-react";

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
  }[];
}

interface WarehouseOption {
  id: string;
  name: string;
  type: string;
}

interface StockTransferFormProps {
  stockItems: StockItem[];
  warehouses: WarehouseOption[];
  userId: string;
}

interface TransferLineItem {
  stockItemId: string;
  quantity: string;
  availableQuantity: number;
}

export function StockTransferForm({
  stockItems,
  warehouses,
  userId,
}: StockTransferFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [lineItems, setLineItems] = useState<Record<string, TransferLineItem>>({});

  // Filter items that have stock in source warehouse
  const availableItems = useMemo(() => {
    if (!sourceWarehouseId) return [];
    return stockItems.filter((item) =>
      item.stockLevels.some(
        (sl) => sl.warehouseId === sourceWarehouseId && sl.quantity > 0
      )
    );
  }, [stockItems, sourceWarehouseId]);

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

  // Destination warehouses (exclude source)
  const destinationWarehouses = useMemo(() => {
    return warehouses.filter((w) => w.id !== sourceWarehouseId);
  }, [warehouses, sourceWarehouseId]);

  // Reset selections when source warehouse changes
  useEffect(() => {
    setSelectedItems(new Set());
    setLineItems({});
    if (destinationWarehouseId === sourceWarehouseId) {
      setDestinationWarehouseId("");
    }
  }, [sourceWarehouseId]);

  // Get available quantity for an item in source warehouse
  const getAvailableQuantity = (itemId: string): number => {
    const item = stockItems.find((i) => i.id === itemId);
    const stockLevel = item?.stockLevels.find(
      (sl) => sl.warehouseId === sourceWarehouseId
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
      const availableQty = getAvailableQuantity(itemId);
      setLineItems({
        ...lineItems,
        [itemId]: {
          stockItemId: itemId,
          quantity: "",
          availableQuantity: availableQty,
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
      const newLineItems: Record<string, TransferLineItem> = {};
      filteredItems.forEach((item) => {
        const availableQty = getAvailableQuantity(item.id);
        newLineItems[item.id] = lineItems[item.id] || {
          stockItemId: item.id,
          quantity: "",
          availableQuantity: availableQty,
        };
      });
      setSelectedItems(newSelected);
      setLineItems(newLineItems);
    }
  };

  // Update line item quantity
  const updateQuantity = (itemId: string, value: string) => {
    setLineItems({
      ...lineItems,
      [itemId]: {
        ...lineItems[itemId],
        quantity: value,
      },
    });
  };

  // Set quantity to percentage of available
  const setPercentage = (itemId: string, percent: number) => {
    const available = lineItems[itemId]?.availableQuantity ?? 0;
    const qty = (available * percent).toFixed(3);
    updateQuantity(itemId, qty);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!sourceWarehouseId) {
      toast.error("Please select a source warehouse");
      return;
    }

    if (!destinationWarehouseId) {
      toast.error("Please select a destination warehouse");
      return;
    }

    if (selectedItems.size === 0) {
      toast.error("Please select at least one item to transfer");
      return;
    }

    // Validate all selected items have valid quantities
    const errors: string[] = [];
    const validItems: TransferLineItem[] = [];

    selectedItems.forEach((itemId) => {
      const line = lineItems[itemId];
      const item = stockItems.find((i) => i.id === itemId);
      const qty = parseFloat(line?.quantity || "");

      if (isNaN(qty) || qty <= 0) {
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
        const result = await transferStock({
          stockItemId: line.stockItemId,
          sourceWarehouseId,
          destinationWarehouseId,
          quantity: parseFloat(line.quantity),
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
        toast.success(`Successfully transferred ${successCount} item(s)`);
        setSelectedItems(new Set());
        setLineItems({});
        router.refresh();
      }

      if (errorCount > 0) {
        toast.error(`Failed to transfer ${errorCount} item(s)`);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">
            Transfer Stock
          </h2>
          <p className="text-sm text-neutral-400">
            Move multiple items between warehouses.
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
              `Transfer ${selectedItems.size} Item(s)`
            )}
          </Button>
        </div>
      </div>

      {/* Warehouse Selection */}
      <div className="flex items-end gap-4">
        <div className="w-64 space-y-2">
          <Label className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-widest">
            <Warehouse className="h-3 w-3" />
            Source Warehouse
          </Label>
          <Select
            value={sourceWarehouseId}
            onValueChange={setSourceWarehouseId}
          >
            <SelectTrigger className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50">
              <SelectValue placeholder="Select source" />
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

        <div className="flex items-center justify-center pb-2">
          <ArrowRight className="h-6 w-6 text-orange-500" />
        </div>

        <div className="w-64 space-y-2">
          <Label className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-widest">
            <Warehouse className="h-3 w-3" />
            Destination Warehouse
          </Label>
          <Select
            value={destinationWarehouseId}
            onValueChange={setDestinationWarehouseId}
            disabled={!sourceWarehouseId}
          >
            <SelectTrigger className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50">
              <SelectValue placeholder="Select destination" />
            </SelectTrigger>
            <SelectContent>
              {destinationWarehouses.map((warehouse) => (
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
            disabled={!sourceWarehouseId}
            className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50"
          />
        </div>
      </div>

      {/* Items Table */}
      {sourceWarehouseId && (
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
                    disabled={filteredItems.length === 0}
                  />
                </TableHead>
                <TableHead className="text-neutral-400">Item</TableHead>
                <TableHead className="text-neutral-400 w-32">Available</TableHead>
                <TableHead className="text-neutral-400 w-40">
                  Transfer Qty
                </TableHead>
                <TableHead className="text-neutral-400 w-48">
                  Quick Fill
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => {
                const isSelected = selectedItems.has(item.id);
                const line = lineItems[item.id];
                const available = getAvailableQuantity(item.id);

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
                        {available.toFixed(3)} {item.primaryUnit.abbreviation}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0.001"
                        step="0.001"
                        max={available}
                        placeholder="0"
                        disabled={!isSelected}
                        value={line?.quantity || ""}
                        onChange={(e) => updateQuantity(item.id, e.target.value)}
                        className="h-8 bg-neutral-900/30 border-white/10 disabled:opacity-30"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {[0.25, 0.5, 0.75, 1].map((pct) => (
                          <Button
                            key={pct}
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!isSelected}
                            onClick={() => setPercentage(item.id, pct)}
                            className="h-7 px-2 text-xs border-white/10 hover:bg-white/5 disabled:opacity-30"
                          >
                            {pct === 1 ? "All" : `${pct * 100}%`}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredItems.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-neutral-500 py-8"
                  >
                    {sourceWarehouseId
                      ? "No items with stock in this warehouse"
                      : "Select a source warehouse to see available items"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Summary */}
      {selectedItems.size > 0 && (
        <div className="flex justify-between items-center p-4 bg-neutral-900/50 rounded-lg border border-white/10">
          <span className="text-neutral-400">
            {selectedItems.size} item(s) selected for transfer
          </span>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-neutral-400">
              {warehouses.find((w) => w.id === sourceWarehouseId)?.name}
            </span>
            <ArrowRight className="h-4 w-4 text-orange-500" />
            <span className="text-orange-400 font-medium">
              {warehouses.find((w) => w.id === destinationWarehouseId)?.name ||
                "Select destination"}
            </span>
          </div>
        </div>
      )}
    </form>
  );
}
