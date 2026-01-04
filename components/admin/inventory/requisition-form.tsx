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
import { createRequisition } from "@/lib/inventory/requisition";
import { Loader2, ArrowRight, Warehouse, Search, ClipboardList } from "lucide-react";

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

interface RequisitionFormProps {
  stockItems: StockItem[];
  warehouses: WarehouseOption[];
  userId: string;
}

interface RequisitionLineItem {
  stockItemId: string;
  quantity: string;
  availableQuantity: number;
}

export function RequisitionForm({
  stockItems,
  warehouses,
  userId,
}: RequisitionFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [requestingWarehouseId, setRequestingWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [lineItems, setLineItems] = useState<Record<string, RequisitionLineItem>>({});

  // Filter items that have stock in source warehouse
  const availableItems = useMemo(() => {
    if (!sourceWarehouseId) return stockItems;
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

  // Requesting warehouses (exclude source)
  const requestingWarehouses = useMemo(() => {
    return warehouses.filter((w) => w.id !== sourceWarehouseId);
  }, [warehouses, sourceWarehouseId]);

  // Reset selections when source warehouse changes
  useEffect(() => {
    setSelectedItems(new Set());
    setLineItems({});
    if (requestingWarehouseId === sourceWarehouseId) {
      setRequestingWarehouseId("");
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
      const newLineItems: Record<string, RequisitionLineItem> = {};
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!sourceWarehouseId) {
      toast.error("Please select a source warehouse");
      return;
    }

    if (!requestingWarehouseId) {
      toast.error("Please select a requesting warehouse");
      return;
    }

    if (selectedItems.size === 0) {
      toast.error("Please select at least one item to request");
      return;
    }

    // Validate all selected items have valid quantities
    const errors: string[] = [];
    const validItems: { stockItemId: string; requestedQuantity: number }[] = [];

    selectedItems.forEach((itemId) => {
      const line = lineItems[itemId];
      const item = stockItems.find((i) => i.id === itemId);
      const qty = parseFloat(line?.quantity || "");

      if (isNaN(qty) || qty <= 0) {
        errors.push(`${item?.name}: Invalid quantity`);
      } else {
        validItems.push({
          stockItemId: itemId,
          requestedQuantity: qty,
        });
      }
    });

    if (errors.length > 0) {
      toast.error(errors.join("\n"));
      return;
    }

    startTransition(async () => {
      const result = await createRequisition({
        sourceWarehouseId,
        requestingWarehouseId,
        requestedById: userId,
        notes: notes.trim() || undefined,
        items: validItems,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Requisition created successfully");
        router.push("/admin/inventory/requisitions");
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">
              New Requisition
            </h2>
            <p className="text-sm text-neutral-400">
              Request stock items from another warehouse.
            </p>
          </div>
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
            className="bg-orange-600 hover:bg-orange-700 text-white min-w-[160px]"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              `Create Requisition`
            )}
          </Button>
        </div>
      </div>

      {/* Warehouse Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-neutral-900/30 rounded-lg border border-white/10">
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-widest">
            <Warehouse className="h-3 w-3" />
            Source Warehouse (From)
          </Label>
          <Select
            value={sourceWarehouseId}
            onValueChange={setSourceWarehouseId}
          >
            <SelectTrigger className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50">
              <SelectValue placeholder="Select source warehouse" />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-neutral-500">
            The warehouse that will supply the items
          </p>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-widest">
            <Warehouse className="h-3 w-3" />
            Requesting Warehouse (To)
          </Label>
          <Select
            value={requestingWarehouseId}
            onValueChange={setRequestingWarehouseId}
            disabled={!sourceWarehouseId}
          >
            <SelectTrigger className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50">
              <SelectValue placeholder="Select requesting warehouse" />
            </SelectTrigger>
            <SelectContent>
              {requestingWarehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-neutral-500">
            The warehouse requesting the items
          </p>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label className="text-xs text-neutral-500 uppercase tracking-widest">
          Notes (Optional)
        </Label>
        <Textarea
          placeholder="Add any notes or special instructions..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 min-h-[80px]"
        />
      </div>

      {/* Search */}
      <div className="space-y-2">
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
                  disabled={filteredItems.length === 0}
                />
              </TableHead>
              <TableHead className="text-neutral-400">Item</TableHead>
              <TableHead className="text-neutral-400 w-32">
                Available in Source
              </TableHead>
              <TableHead className="text-neutral-400 w-40">
                Request Qty
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map((item) => {
              const isSelected = selectedItems.has(item.id);
              const line = lineItems[item.id];
              const available = sourceWarehouseId ? getAvailableQuantity(item.id) : 0;

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
                    {sourceWarehouseId ? (
                      <span className={`text-sm ${available > 0 ? "text-green-400" : "text-neutral-500"}`}>
                        {available.toFixed(3)} {item.primaryUnit.abbreviation}
                      </span>
                    ) : (
                      <span className="text-sm text-neutral-500">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0.001"
                      step="0.001"
                      placeholder="0"
                      disabled={!isSelected}
                      value={line?.quantity || ""}
                      onChange={(e) => updateQuantity(item.id, e.target.value)}
                      className="h-8 bg-neutral-900/30 border-white/10 disabled:opacity-30"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredItems.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-neutral-500 py-8"
                >
                  {searchQuery
                    ? "No items match your search"
                    : "No stock items available"}
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
            {selectedItems.size} item(s) selected for requisition
          </span>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-neutral-400">
              {warehouses.find((w) => w.id === sourceWarehouseId)?.name || "Select source"}
            </span>
            <ArrowRight className="h-4 w-4 text-orange-500" />
            <span className="text-orange-400 font-medium">
              {warehouses.find((w) => w.id === requestingWarehouseId)?.name ||
                "Select destination"}
            </span>
          </div>
        </div>
      )}
    </form>
  );
}
