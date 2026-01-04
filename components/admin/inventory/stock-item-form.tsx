"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createStockItem, updateStockItem, setParLevel, deleteParLevel } from "@/lib/inventory/stock-item";
import { Loader2, Package, Building2, Truck, Ruler, AlertTriangle, Plus, Trash2, Hash } from "lucide-react";

interface Property {
  id: string;
  name: string;
}

interface UnitOfMeasure {
  id: string;
  name: string;
  abbreviation: string;
}

interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
}

interface Warehouse {
  id: string;
  name: string;
  type: string;
}

interface StockCategory {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
}

interface ParLevel {
  warehouseId: string;
  parLevel: number;
}

interface StockItemFormProps {
  stockItem?: {
    id: string;
    itemCode: string;
    name: string;
    sku: string | null;
    categoryId: string;
    category: StockCategory;
    primaryUnitId: string;
    isConsignment: boolean;
    supplierId: string | null;
    isActive: boolean;
    propertyId: string;
  };
  parLevels?: {
    warehouseId: string;
    parLevel: number;
    warehouse: {
      id: string;
      name: string;
      type: string;
    };
  }[];
  properties: Property[];
  categories: StockCategory[];
  units: UnitOfMeasure[];
  suppliers: Supplier[];
  warehouses: Warehouse[];
  isEditMode?: boolean;
  currentPropertyId?: string | null;
  currentPropertyName?: string;
}

export function StockItemForm({
  stockItem,
  parLevels: initialParLevels = [],
  properties,
  categories,
  units,
  suppliers,
  warehouses,
  isEditMode = false,
  currentPropertyId,
  currentPropertyName,
}: StockItemFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  
  const [isConsignment, setIsConsignment] = useState(stockItem?.isConsignment ?? false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(stockItem?.categoryId ?? "");
  // Use currentPropertyId if provided (from property switcher), otherwise fall back to stockItem's property or empty
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    stockItem?.propertyId ?? currentPropertyId ?? ""
  );
  const [parLevelEntries, setParLevelEntries] = useState<ParLevel[]>(
    initialParLevels.map(pl => ({ warehouseId: pl.warehouseId, parLevel: Number(pl.parLevel) }))
  );
  const [newParWarehouseId, setNewParWarehouseId] = useState("");
  const [newParLevel, setNewParLevel] = useState("");

  // Determine if we should show property selector
  // Only show if: not in edit mode AND no current property is set (i.e., "ALL" properties view)
  const showPropertySelector = !isEditMode && !currentPropertyId;

  // Get the selected category for description display
  const selectedCategory = categories.find(c => c.id === selectedCategoryId);

  // Get warehouses that don't have par levels set yet
  const availableWarehouses = warehouses.filter(
    w => !parLevelEntries.some(pl => pl.warehouseId === w.id)
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const name = formData.get("name") as string;
    const sku = formData.get("sku") as string;
    const categoryId = formData.get("categoryId") as string;
    const primaryUnitId = formData.get("primaryUnitId") as string;
    const propertyId = formData.get("propertyId") as string;
    const supplierId = formData.get("supplierId") as string;

    startTransition(async () => {
      let result;

      if (isEditMode && stockItem?.id) {
        result = await updateStockItem(stockItem.id, {
          name,
          sku: sku || null,
          categoryId,
          primaryUnitId,
          isConsignment,
          supplierId: isConsignment ? supplierId : null,
        });
      } else {
        result = await createStockItem({
          name,
          sku: sku || undefined,
          categoryId,
          primaryUnitId,
          propertyId,
          isConsignment,
          supplierId: isConsignment ? supplierId : undefined,
        });
      }

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isEditMode ? "Stock item updated" : "Stock item created");
        if (!isEditMode && result.data) {
          router.push(`/admin/inventory/items/${result.data.id}`);
        }
        router.refresh();
      }
    });
  };

  const handleAddParLevel = async () => {
    if (!newParWarehouseId || !newParLevel || !stockItem?.id) return;

    const parLevelValue = parseFloat(newParLevel);
    if (isNaN(parLevelValue) || parLevelValue < 0) {
      toast.error("Please enter a valid par level");
      return;
    }

    startTransition(async () => {
      const result = await setParLevel({
        stockItemId: stockItem.id,
        warehouseId: newParWarehouseId,
        parLevel: parLevelValue,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Par level added");
        setParLevelEntries([...parLevelEntries, { warehouseId: newParWarehouseId, parLevel: parLevelValue }]);
        setNewParWarehouseId("");
        setNewParLevel("");
        router.refresh();
      }
    });
  };

  const handleRemoveParLevel = async (warehouseId: string) => {
    if (!stockItem?.id) return;

    startTransition(async () => {
      const result = await deleteParLevel(stockItem.id, warehouseId);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Par level removed");
        setParLevelEntries(parLevelEntries.filter(pl => pl.warehouseId !== warehouseId));
        router.refresh();
      }
    });
  };

  const getWarehouseName = (warehouseId: string) => {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    return warehouse?.name ?? "Unknown";
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">
            {isEditMode ? "Stock Item Details" : "Create New Stock Item"}
          </h2>
          <p className="text-sm text-neutral-400">
            {isEditMode
              ? "Update stock item information and par levels."
              : "Add a new item to your inventory catalog."}
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
            disabled={isPending}
            className="bg-orange-600 hover:bg-orange-700 text-white min-w-[140px]"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : isEditMode ? (
              "Save Changes"
            ) : (
              "Create Item"
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Basic Information */}
        <div className="space-y-6">
          <Label className="flex items-center gap-2 text-sm font-medium text-neutral-300 border-b border-white/10 pb-2">
            <Package className="h-4 w-4 text-orange-500" />
            Basic Information
          </Label>

          <div className="space-y-4">
            {/* Item Code - Read-only, auto-generated */}
            {isEditMode && stockItem && (
              <div className="space-y-2">
                <Label className="text-xs text-neutral-500 uppercase tracking-widest">
                  Item Code
                </Label>
                <div className="flex items-center gap-2 h-10 px-3 bg-neutral-900/30 border border-white/10 rounded-md">
                  <Hash className="h-4 w-4 text-neutral-500" />
                  <span className="text-sm text-white font-mono">{stockItem.itemCode}</span>
                </div>
                <p className="text-xs text-neutral-500">
                  Auto-generated unique identifier.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label
                htmlFor="name"
                className="text-xs text-neutral-500 uppercase tracking-widest"
              >
                Item Name
              </Label>
              <Input
                id="name"
                name="name"
                defaultValue={stockItem?.name}
                placeholder="e.g. All-Purpose Flour"
                required
                className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="sku"
                className="text-xs text-neutral-500 uppercase tracking-widest"
              >
                SKU (Optional)
              </Label>
              <Input
                id="sku"
                name="sku"
                defaultValue={stockItem?.sku ?? ""}
                placeholder="e.g. ING-FLOUR-001"
                className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20"
              />
              <p className="text-xs text-neutral-500">
                Optional manual identifier for this item.
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="categoryId"
                className="text-xs text-neutral-500 uppercase tracking-widest"
              >
                Category
              </Label>
              <Select 
                name="categoryId" 
                defaultValue={stockItem?.categoryId}
                onValueChange={setSelectedCategoryId}
              >
                <SelectTrigger className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCategory?.description && (
                <p className="text-xs text-neutral-500">
                  {selectedCategory.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Unit & Property */}
        <div className="space-y-6">
          <Label className="flex items-center gap-2 text-sm font-medium text-neutral-300 border-b border-white/10 pb-2">
            <Ruler className="h-4 w-4 text-orange-500" />
            Unit & Property
          </Label>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="primaryUnitId"
                className="text-xs text-neutral-500 uppercase tracking-widest"
              >
                Primary Unit of Measure
              </Label>
              <Select name="primaryUnitId" defaultValue={stockItem?.primaryUnitId}>
                <SelectTrigger className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name} ({unit.abbreviation})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="propertyId"
                className="text-xs text-neutral-500 uppercase tracking-widest"
              >
                Property
              </Label>
              {showPropertySelector ? (
                // Show dropdown when no property is scoped (ALL properties view)
                <Select
                  name="propertyId"
                  defaultValue={selectedPropertyId}
                  onValueChange={setSelectedPropertyId}
                >
                  <SelectTrigger className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20">
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
              ) : (
                // Show read-only display when property is scoped or in edit mode
                <>
                  <input type="hidden" name="propertyId" value={selectedPropertyId} />
                  <div className="flex items-center gap-2 h-10 px-3 bg-neutral-900/30 border border-white/10 rounded-md">
                    <Building2 className="h-4 w-4 text-neutral-500" />
                    <span className="text-sm text-white">
                      {currentPropertyName || properties.find(p => p.id === selectedPropertyId)?.name || "Unknown Property"}
                    </span>
                  </div>
                  {isEditMode && (
                    <p className="text-xs text-neutral-500">
                      Property cannot be changed after creation.
                    </p>
                  )}
                  {!isEditMode && currentPropertyId && (
                    <p className="text-xs text-neutral-500">
                      Item will be created for the currently selected property.
                    </p>
                  )}
                </>
              )}
            </div>

            {isEditMode && stockItem && (
              <div className="space-y-2">
                <Label className="text-xs text-neutral-500 uppercase tracking-widest">
                  Status
                </Label>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      stockItem.isActive ? "bg-green-500" : "bg-neutral-500"
                    }`}
                  />
                  <span className="text-sm text-neutral-300">
                    {stockItem.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-xs text-neutral-500">
                  Use the list page to activate/deactivate items.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Consignment Section */}
      <div className="space-y-6">
        <Label className="flex items-center gap-2 text-sm font-medium text-neutral-300 border-b border-white/10 pb-2">
          <Truck className="h-4 w-4 text-orange-500" />
          Consignment Settings
        </Label>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-neutral-900/30 rounded-lg border border-white/10">
            <div className="space-y-0.5">
              <Label htmlFor="isConsignment" className="text-sm text-white">
                Consignment Item
              </Label>
              <p className="text-xs text-neutral-500">
                Enable if this item is provided by a supplier on consignment terms.
              </p>
            </div>
            <Switch
              id="isConsignment"
              checked={isConsignment}
              onCheckedChange={setIsConsignment}
            />
          </div>

          {isConsignment && (
            <div className="space-y-2">
              <Label
                htmlFor="supplierId"
                className="text-xs text-neutral-500 uppercase tracking-widest"
              >
                Supplier
              </Label>
              <Select name="supplierId" defaultValue={stockItem?.supplierId ?? undefined}>
                <SelectTrigger className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20">
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
              <p className="text-xs text-neutral-500">
                Required for consignment items. Payment is due to supplier upon sale.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Par Levels Section - Only show in edit mode */}
      {isEditMode && stockItem && (
        <div className="space-y-6">
          <Label className="flex items-center gap-2 text-sm font-medium text-neutral-300 border-b border-white/10 pb-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Par Levels (Reorder Points)
          </Label>

          <p className="text-sm text-neutral-400">
            Set minimum stock levels per warehouse. Alerts will be generated when stock falls below these levels.
          </p>

          {/* Existing Par Levels */}
          {parLevelEntries.length > 0 && (
            <div className="space-y-2">
              {parLevelEntries.map((entry) => (
                <div
                  key={entry.warehouseId}
                  className="flex items-center justify-between p-3 bg-neutral-900/30 rounded-lg border border-white/10"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-neutral-500" />
                    <span className="text-sm text-white">
                      {getWarehouseName(entry.warehouseId)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-orange-400 font-medium">
                      {entry.parLevel} {units.find(u => u.id === stockItem.primaryUnitId)?.abbreviation}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-neutral-400 hover:text-red-400 hover:bg-red-900/10"
                      onClick={() => handleRemoveParLevel(entry.warehouseId)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add New Par Level */}
          {availableWarehouses.length > 0 && (
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <Label className="text-xs text-neutral-500 uppercase tracking-widest">
                  Warehouse
                </Label>
                <Select value={newParWarehouseId} onValueChange={setNewParWarehouseId}>
                  <SelectTrigger className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableWarehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-32 space-y-2">
                <Label className="text-xs text-neutral-500 uppercase tracking-widest">
                  Par Level
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newParLevel}
                  onChange={(e) => setNewParLevel(e.target.value)}
                  placeholder="0"
                  className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 border-white/10 hover:bg-white/5"
                onClick={handleAddParLevel}
                disabled={isPending || !newParWarehouseId || !newParLevel}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}

          {availableWarehouses.length === 0 && parLevelEntries.length > 0 && (
            <p className="text-xs text-neutral-500">
              Par levels have been set for all available warehouses.
            </p>
          )}
        </div>
      )}
    </form>
  );
}
