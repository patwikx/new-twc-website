"use client";

import { useTransition, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { receiveConsignment } from "@/lib/inventory/consignment";
import { Loader2, Package, Warehouse, Search, Truck } from "lucide-react";

interface StockItem {
  id: string;
  name: string;
  itemCode: string;
  supplierId: string;
  primaryUnit: {
    id: string;
    abbreviation: string;
  };
}

interface SupplierOption {
  id: string;
  name: string;
  contactName: string | null;
}

interface WarehouseOption {
  id: string;
  name: string;
  type: string;
}

interface ConsignmentReceiptFormProps {
  stockItems: StockItem[];
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  userId: string;
}

interface ReceiptLineItem {
  stockItemId: string;
  quantity: string;
  sellingPrice: string;
  supplierCost: string;
}

export function ConsignmentReceiptForm({
  stockItems,
  suppliers,
  warehouses,
  userId,
}: ConsignmentReceiptFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [lineItems, setLineItems] = useState<Record<string, ReceiptLineItem>>({});

  // Filter items based on selected supplier and search
  const filteredItems = useMemo(() => {
    let items = stockItems;
    
    // Filter by supplier
    if (selectedSupplierId) {
      items = items.filter((item) => item.supplierId === selectedSupplierId);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.itemCode.toLowerCase().includes(query)
      );
    }
    
    return items;
  }, [stockItems, selectedSupplierId, searchQuery]);

  // Reset selections when supplier changes
  const handleSupplierChange = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    setSelectedItems(new Set());
    setLineItems({});
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
      setLineItems({
        ...lineItems,
        [itemId]: {
          stockItemId: itemId,
          quantity: "",
          sellingPrice: "",
          supplierCost: "",
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
          sellingPrice: "",
          supplierCost: "",
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
  const { totalSupplierCost, totalSellingValue } = useMemo(() => {
    let supplierCost = 0;
    let sellingValue = 0;
    
    Array.from(selectedItems).forEach((itemId) => {
      const line = lineItems[itemId];
      if (!line) return;
      const qty = parseFloat(line.quantity) || 0;
      const cost = parseFloat(line.supplierCost) || 0;
      const price = parseFloat(line.sellingPrice) || 0;
      supplierCost += qty * cost;
      sellingValue += qty * price;
    });
    
    return { totalSupplierCost: supplierCost, totalSellingValue: sellingValue };
  }, [selectedItems, lineItems]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedSupplierId) {
      toast.error("Please select a supplier");
      return;
    }

    if (!selectedWarehouseId) {
      toast.error("Please select a destination warehouse");
      return;
    }

    if (selectedItems.size === 0) {
      toast.error("Please select at least one item to receive");
      return;
    }

    // Validate all selected items have required fields
    const errors: string[] = [];
    const validItems: {
      stockItemId: string;
      quantity: number;
      sellingPrice: number;
      supplierCost: number;
    }[] = [];

    selectedItems.forEach((itemId) => {
      const line = lineItems[itemId];
      const item = stockItems.find((i) => i.id === itemId);
      const qty = parseFloat(line?.quantity || "");
      const price = parseFloat(line?.sellingPrice || "");
      const cost = parseFloat(line?.supplierCost || "");

      if (isNaN(qty) || qty <= 0) {
        errors.push(`${item?.name}: Invalid quantity`);
      } else if (isNaN(price) || price <= 0) {
        errors.push(`${item?.name}: Invalid selling price`);
      } else if (isNaN(cost) || cost < 0) {
        errors.push(`${item?.name}: Invalid supplier cost`);
      } else {
        validItems.push({
          stockItemId: itemId,
          quantity: qty,
          sellingPrice: price,
          supplierCost: cost,
        });
      }
    });

    if (errors.length > 0) {
      toast.error(errors.join("\n"));
      return;
    }

    startTransition(async () => {
      const result = await receiveConsignment({
        supplierId: selectedSupplierId,
        warehouseId: selectedWarehouseId,
        receivedById: userId,
        items: validItems,
        notes: notes.trim() || undefined,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Successfully received ${validItems.length} consignment item(s)`);
        // Reset form
        setSelectedItems(new Set());
        setLineItems({});
        setNotes("");
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">
            Receive Consignment Stock
          </h2>
          <p className="text-sm text-neutral-400">
            Receive consignment items from suppliers into inventory.
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

      {/* Selection Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Supplier Selection */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-widest">
            <Truck className="h-3 w-3" />
            Supplier
          </Label>
          <Select
            value={selectedSupplierId}
            onValueChange={handleSupplierChange}
          >
            <SelectTrigger className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50">
              <SelectValue placeholder="Select supplier" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                  {supplier.contactName && (
                    <span className="text-neutral-500 ml-2">
                      ({supplier.contactName})
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Warehouse Selection */}
        <div className="space-y-2">
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
            disabled={!selectedSupplierId}
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label className="text-xs text-neutral-500 uppercase tracking-widest">
          Notes (Optional)
        </Label>
        <Textarea
          placeholder="Add any notes about this consignment receipt..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 min-h-[80px]"
        />
      </div>

      {/* Items Table */}
      {selectedSupplierId ? (
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
                <TableHead className="text-neutral-400 w-28">Quantity</TableHead>
                <TableHead className="text-neutral-400 w-32">Supplier Cost</TableHead>
                <TableHead className="text-neutral-400 w-32">Selling Price</TableHead>
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
                      (parseFloat(line.supplierCost) || 0)
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
                        value={line?.supplierCost || ""}
                        onChange={(e) =>
                          updateLineItem(item.id, "supplierCost", e.target.value)
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
                        value={line?.sellingPrice || ""}
                        onChange={(e) =>
                          updateLineItem(item.id, "sellingPrice", e.target.value)
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
                    colSpan={6}
                    className="text-center text-neutral-500 py-8"
                  >
                    {selectedSupplierId
                      ? "No consignment items found for this supplier"
                      : "Select a supplier to view items"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="border border-white/10 rounded-lg p-8 text-center">
          <Package className="h-12 w-12 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400">
            Select a supplier to view their consignment items
          </p>
        </div>
      )}

      {/* Summary */}
      {selectedItems.size > 0 && (
        <div className="flex justify-between items-center p-4 bg-neutral-900/50 rounded-lg border border-white/10">
          <span className="text-neutral-400">
            {selectedItems.size} item(s) selected
          </span>
          <div className="flex gap-8">
            <div className="text-right">
              <p className="text-sm text-neutral-400">Supplier Cost</p>
              <p className="text-xl font-bold text-neutral-300">
                ₱{totalSupplierCost.toFixed(2)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-neutral-400">Selling Value</p>
              <p className="text-xl font-bold text-orange-400">
                ₱{totalSellingValue.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
