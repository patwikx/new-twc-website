"use client";

import { useTransition, useState, useMemo } from "react";
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
import {
  createPurchaseOrder,
  addPOItem,
} from "@/lib/inventory/purchase-order";
import {
  Loader2,
  FileText,
  Search,
  Warehouse,
  Building2,
  Calendar,
  Trash2,
} from "lucide-react";

interface StockItem {
  id: string;
  name: string;
  itemCode: string;
  supplierId: string | null;
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

interface PropertyOption {
  id: string;
  name: string;
}

interface PurchaseOrderFormProps {
  stockItems: StockItem[];
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  properties: PropertyOption[];
  userId: string;
  defaultPropertyId?: string;
}

interface POLineItem {
  stockItemId: string;
  quantity: string;
  unitCost: string;
}

export function PurchaseOrderForm({
  stockItems,
  suppliers,
  warehouses,
  properties,
  userId,
  defaultPropertyId,
}: PurchaseOrderFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [propertyId, setPropertyId] = useState(defaultPropertyId || "");
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [lineItems, setLineItems] = useState<Record<string, POLineItem>>({});

  // Filter items by selected supplier
  const availableItems = useMemo(() => {
    if (!supplierId) return stockItems;
    return stockItems.filter(
      (item) => item.supplierId === supplierId || !item.supplierId
    );
  }, [stockItems, supplierId]);

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

  // Filter warehouses by property
  const filteredWarehouses = useMemo(() => {
    return warehouses;
  }, [warehouses]);

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
          unitCost: "",
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
      const newLineItems: Record<string, POLineItem> = {};
      filteredItems.forEach((item) => {
        newLineItems[item.id] = lineItems[item.id] || {
          stockItemId: item.id,
          quantity: "",
          unitCost: "",
        };
      });
      setSelectedItems(newSelected);
      setLineItems(newLineItems);
    }
  };

  // Update line item
  const updateLineItem = (
    itemId: string,
    field: "quantity" | "unitCost",
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
  const totals = useMemo(() => {
    let subtotal = 0;
    selectedItems.forEach((itemId) => {
      const line = lineItems[itemId];
      if (line) {
        const qty = parseFloat(line.quantity) || 0;
        const cost = parseFloat(line.unitCost) || 0;
        subtotal += qty * cost;
      }
    });
    return { subtotal, total: subtotal };
  }, [selectedItems, lineItems]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!propertyId) {
      toast.error("Please select a property");
      return;
    }

    if (!supplierId) {
      toast.error("Please select a supplier");
      return;
    }

    if (!warehouseId) {
      toast.error("Please select a warehouse");
      return;
    }

    if (selectedItems.size === 0) {
      toast.error("Please select at least one item");
      return;
    }

    // Validate all selected items have valid quantities and costs
    const errors: string[] = [];
    const validItems: { stockItemId: string; quantity: number; unitCost: number }[] = [];

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
        validItems.push({
          stockItemId: itemId,
          quantity: qty,
          unitCost: cost,
        });
      }
    });

    if (errors.length > 0) {
      toast.error(errors.join("\n"));
      return;
    }

    startTransition(async () => {
      // Create the PO first
      const createResult = await createPurchaseOrder({
        propertyId,
        supplierId,
        warehouseId,
        expectedDate: expectedDate ? new Date(expectedDate) : undefined,
        notes: notes.trim() || undefined,
        createdById: userId,
      });

      if (createResult.error) {
        toast.error(createResult.error);
        return;
      }

      const poId = createResult.data?.id;
      if (!poId) {
        toast.error("Failed to create purchase order");
        return;
      }

      // Add items to the PO
      for (const item of validItems) {
        const addResult = await addPOItem({
          purchaseOrderId: poId,
          stockItemId: item.stockItemId,
          quantity: item.quantity,
          unitCost: item.unitCost,
        });

        if (addResult.error) {
          toast.error(`Failed to add item: ${addResult.error}`);
          // Continue with other items
        }
      }

      toast.success("Purchase order created successfully");
      router.push(`/admin/inventory/purchase-orders/${poId}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
            <FileText className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">
              New Purchase Order
            </h2>
            <p className="text-sm text-neutral-400">
              Create a purchase order to procure inventory from a supplier.
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
              `Create PO`
            )}
          </Button>
        </div>
      </div>

      {/* PO Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-neutral-900/30 rounded-lg border border-white/10">
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-widest">
            <Building2 className="h-3 w-3" />
            Property
          </Label>
          <Select value={propertyId} onValueChange={setPropertyId}>
            <SelectTrigger className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50">
              <SelectValue placeholder="Select property" />
            </SelectTrigger>
            <SelectContent>
              {properties.map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  {property.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-widest">
            Supplier
          </Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50">
              <SelectValue placeholder="Select supplier" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-widest">
            <Warehouse className="h-3 w-3" />
            Destination Warehouse
          </Label>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50">
              <SelectValue placeholder="Select warehouse" />
            </SelectTrigger>
            <SelectContent>
              {filteredWarehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-widest">
            <Calendar className="h-3 w-3" />
            Expected Delivery
          </Label>
          <Input
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
            className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50"
          />
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
              <TableHead className="text-neutral-400 w-32">Quantity</TableHead>
              <TableHead className="text-neutral-400 w-32">Unit Cost</TableHead>
              <TableHead className="text-neutral-400 w-32 text-right">
                Line Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map((item) => {
              const isSelected = selectedItems.has(item.id);
              const line = lineItems[item.id];
              const qty = parseFloat(line?.quantity || "0") || 0;
              const cost = parseFloat(line?.unitCost || "0") || 0;
              const lineTotal = qty * cost;

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
                  <TableCell className="text-right">
                    {isSelected && lineTotal > 0 ? (
                      <span className="text-sm text-orange-400 font-medium">
                        {formatCurrency(lineTotal)}
                      </span>
                    ) : (
                      <span className="text-sm text-neutral-500">—</span>
                    )}
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
            {selectedItems.size} item(s) selected
          </span>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs text-neutral-500 uppercase tracking-widest">
                Subtotal
              </p>
              <p className="text-lg text-white font-semibold">
                {formatCurrency(totals.subtotal)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-neutral-500 uppercase tracking-widest">
                Total
              </p>
              <p className="text-xl text-orange-400 font-bold">
                {formatCurrency(totals.total)}
              </p>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
