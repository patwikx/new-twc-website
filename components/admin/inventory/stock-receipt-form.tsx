"use client";

import { useTransition, useState, useMemo } from "react";
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
import { receiveStock } from "@/lib/inventory/stock-movement";
import { Loader2, Package, Warehouse, Search } from "lucide-react";

interface StockItem {
  id: string;
  name: string;
  itemCode: string;
  primaryUnit: {
    id: string;
    abbreviation: string;
  };
}

interface WarehouseOption {
  id: string;
  name: string;
  type: string;
}

interface StockReceiptFormProps {
  stockItems: StockItem[];
  warehouses: WarehouseOption[];
  userId: string;
}

interface ReceiptLineItem {
  stockItemId: string;
  quantity: string;
  unitCost: string;
  batchNumber: string;
  expirationDate: string;
}

export function StockReceiptForm({
  stockItems,
  warehouses,
  userId,
}: StockReceiptFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [lineItems, setLineItems] = useState<Record<string, ReceiptLineItem>>({});

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

  // Toggle item selection
  const toggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
      // Remove line item data
      const newLineItems = { ...lineItems };
      delete newLineItems[itemId];
      setLineItems(newLineItems);
    } else {
      newSelected.add(itemId);
      // Initialize line item data
      setLineItems({
        ...lineItems,
        [itemId]: {
          stockItemId: itemId,
          quantity: "",
          unitCost: "",
          batchNumber: "",
          expirationDate: "",
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
      const newLineItems: Record<string, ReceiptLineItem> = {};
      filteredItems.forEach((item) => {
        newLineItems[item.id] = lineItems[item.id] || {
          stockItemId: item.id,
          quantity: "",
          unitCost: "",
          batchNumber: "",
          expirationDate: "",
        };
      });
      setSelectedItems(newSelected);
      setLineItems(newLineItems);
    }
  };

  // Update line item field
  const updateLineItem = (
    itemId: string,
    field: keyof ReceiptLineItem,
    value: string
  ) => {
    setLineItems({
      ...lineItems,
      [itemId]: {
        ...lineItems[itemId],
        [field]: value,
      },
    });
  };

  // Calculate totals
  const totalCost = useMemo(() => {
    return Array.from(selectedItems).reduce((sum, itemId) => {
      const line = lineItems[itemId];
      if (!line) return sum;
      const qty = parseFloat(line.quantity) || 0;
      const cost = parseFloat(line.unitCost) || 0;
      return sum + qty * cost;
    }, 0);
  }, [selectedItems, lineItems]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedWarehouseId) {
      toast.error("Please select a destination warehouse");
      return;
    }

    if (selectedItems.size === 0) {
      toast.error("Please select at least one item to receive");
      return;
    }

    // Validate all selected items have quantity and cost
    const errors: string[] = [];
    const validItems: ReceiptLineItem[] = [];

    selectedItems.forEach((itemId) => {
      const line = lineItems[itemId];
      const item = stockItems.find((i) => i.id === itemId);
      const qty = parseFloat(line?.quantity || "");
      const cost = parseFloat(line?.unitCost || "");

      if (isNaN(qty) || qty <= 0) {
        errors.push(`${item?.name}: Invalid quantity`);
      } else if (isNaN(cost) || cost < 0) {
        errors.push(`${item?.name}: Invalid unit cost`);
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
        const result = await receiveStock({
          stockItemId: line.stockItemId,
          warehouseId: selectedWarehouseId,
          quantity: parseFloat(line.quantity),
          unitCost: parseFloat(line.unitCost),
          batchNumber: line.batchNumber.trim() || undefined,
          expirationDate: line.expirationDate
            ? new Date(line.expirationDate)
            : undefined,
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
        toast.success(`Successfully received ${successCount} item(s)`);
        // Reset form
        setSelectedItems(new Set());
        setLineItems({});
        router.refresh();
      }

      if (errorCount > 0) {
        toast.error(`Failed to receive ${errorCount} item(s)`);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">
            Receive Stock
          </h2>
          <p className="text-sm text-neutral-400">
            Select multiple items to receive into inventory.
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
              `Receive ${selectedItems.size} Item(s)`
            )}
          </Button>
        </div>
      </div>

      {/* Warehouse Selection */}
      <div className="flex items-end gap-4">
        <div className="w-64 space-y-2">
          <Label className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-widest">
            <Warehouse className="h-3 w-3" />
            Destination Warehouse
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
            Total Cost
          </p>
          <p className="text-xl font-semibold text-orange-400">
            ₱{totalCost.toFixed(2)}
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
              <TableHead className="text-neutral-400 w-32">Quantity</TableHead>
              <TableHead className="text-neutral-400 w-32">Unit Cost</TableHead>
              <TableHead className="text-neutral-400 w-36">Batch No.</TableHead>
              <TableHead className="text-neutral-400 w-40">Expiration</TableHead>
              <TableHead className="text-neutral-400 text-right w-28">
                Line Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map((item) => {
              const isSelected = selectedItems.has(item.id);
              const line = lineItems[item.id];
              const lineTotal =
                isSelected && line
                  ? (parseFloat(line.quantity) || 0) *
                    (parseFloat(line.unitCost) || 0)
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
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      disabled={!isSelected}
                      value={line?.unitCost || ""}
                      onChange={(e) =>
                        updateLineItem(item.id, "unitCost", e.target.value)
                      }
                      className="h-8 bg-neutral-900/30 border-white/10 disabled:opacity-30"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="LOT-001"
                      disabled={!isSelected}
                      value={line?.batchNumber || ""}
                      onChange={(e) =>
                        updateLineItem(item.id, "batchNumber", e.target.value)
                      }
                      className="h-8 bg-neutral-900/30 border-white/10 disabled:opacity-30"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      disabled={!isSelected}
                      value={line?.expirationDate || ""}
                      onChange={(e) =>
                        updateLineItem(item.id, "expirationDate", e.target.value)
                      }
                      className="h-8 bg-neutral-900/30 border-white/10 disabled:opacity-30"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`font-medium ${
                        isSelected && lineTotal > 0
                          ? "text-orange-400"
                          : "text-neutral-600"
                      }`}
                    >
                      ₱{lineTotal.toFixed(2)}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredItems.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-neutral-500 py-8"
                >
                  No items found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      {selectedItems.size > 0 && (
        <div className="flex justify-between items-center p-4 bg-neutral-900/50 rounded-lg border border-white/10">
          <span className="text-neutral-400">
            {selectedItems.size} item(s) selected
          </span>
          <div className="text-right">
            <p className="text-sm text-neutral-400">Total Receipt Value</p>
            <p className="text-2xl font-bold text-orange-400">
              ₱{totalCost.toFixed(2)}
            </p>
          </div>
        </div>
      )}
    </form>
  );
}
