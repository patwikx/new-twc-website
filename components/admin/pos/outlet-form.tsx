"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createOutletAction, updateOutletAction } from "@/actions/admin/pos/outlets";
import { Loader2, Store, Building2, Warehouse, UtensilsCrossed, Wine, Coffee, Bed, Waves, Package } from "lucide-react";
import { OutletType } from "@prisma/client";

interface Property {
  id: string;
  name: string;
}

interface WarehouseOption {
  id: string;
  name: string;
  type: string;
}

interface OutletFormProps {
  outlet?: {
    id: string;
    name: string;
    type: OutletType;
    warehouseId: string;
    isActive: boolean;
    propertyId: string;
  };
  properties: Property[];
  warehouses: WarehouseOption[];
  isEditMode?: boolean;
  currentPropertyId?: string | null;
  currentPropertyName?: string;
}

const OUTLET_TYPE_OPTIONS: { value: OutletType; label: string; icon: React.ReactNode }[] = [
  { value: "RESTAURANT", label: "Restaurant", icon: <UtensilsCrossed className="h-4 w-4" /> },
  { value: "BAR", label: "Bar", icon: <Wine className="h-4 w-4" /> },
  { value: "ROOM_SERVICE", label: "Room Service", icon: <Bed className="h-4 w-4" /> },
  { value: "POOL_BAR", label: "Pool Bar", icon: <Waves className="h-4 w-4" /> },
  { value: "CAFE", label: "Café", icon: <Coffee className="h-4 w-4" /> },
  { value: "MINIBAR", label: "Minibar", icon: <Package className="h-4 w-4" /> },
];

export function OutletForm({
  outlet,
  properties,
  warehouses,
  isEditMode = false,
  currentPropertyId,
  currentPropertyName,
}: OutletFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    outlet?.propertyId ?? currentPropertyId ?? ""
  );
  const [selectedType, setSelectedType] = useState<OutletType>(
    outlet?.type ?? "RESTAURANT"
  );
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(
    outlet?.warehouseId ?? ""
  );

  // Determine if we should show property selector
  const showPropertySelector = !isEditMode && !currentPropertyId;

  // Filter warehouses by selected property
  const filteredWarehouses = warehouses.filter(
    (w) => !selectedPropertyId || warehouses.length === 0 || true // Show all warehouses for now, filtering happens server-side
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const name = formData.get("name") as string;

    if (!name.trim()) {
      toast.error("Outlet name is required");
      return;
    }

    if (!selectedPropertyId) {
      toast.error("Property is required");
      return;
    }

    if (!selectedWarehouseId) {
      toast.error("Warehouse is required");
      return;
    }

    // Add the select values to formData
    formData.set("propertyId", selectedPropertyId);
    formData.set("type", selectedType);
    formData.set("warehouseId", selectedWarehouseId);

    startTransition(async () => {
      let result;

      if (isEditMode && outlet?.id) {
        result = await updateOutletAction(outlet.id, formData);
      } else {
        result = await createOutletAction(formData);
      }

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isEditMode ? "Outlet updated" : "Outlet created");
        if (!isEditMode && result.data) {
          router.push(`/admin/pos/outlets/${result.data.id}`);
        }
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">
            {isEditMode ? "Outlet Details" : "Create New Outlet"}
          </h2>
          <p className="text-sm text-neutral-400">
            {isEditMode
              ? "Update sales outlet information."
              : "Add a new sales outlet to your property."}
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
              "Create Outlet"
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Basic Information */}
        <div className="space-y-6">
          <Label className="flex items-center gap-2 text-sm font-medium text-neutral-300 border-b border-white/10 pb-2">
            <Store className="h-4 w-4 text-orange-500" />
            Basic Information
          </Label>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="name"
                className="text-xs text-neutral-500 uppercase tracking-widest"
              >
                Outlet Name
              </Label>
              <Input
                id="name"
                name="name"
                defaultValue={outlet?.name}
                placeholder="e.g. Main Restaurant"
                required
                className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="type"
                className="text-xs text-neutral-500 uppercase tracking-widest"
              >
                Outlet Type
              </Label>
              <Select 
                value={selectedType}
                onValueChange={(value) => setSelectedType(value as OutletType)}
              >
                <SelectTrigger className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {OUTLET_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        {option.icon}
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-neutral-500">
                The type determines how the outlet is categorized and displayed.
              </p>
            </div>
          </div>
        </div>

        {/* Property & Warehouse */}
        <div className="space-y-6">
          <Label className="flex items-center gap-2 text-sm font-medium text-neutral-300 border-b border-white/10 pb-2">
            <Building2 className="h-4 w-4 text-orange-500" />
            Property & Warehouse
          </Label>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="propertyId"
                className="text-xs text-neutral-500 uppercase tracking-widest"
              >
                Property
              </Label>
              {showPropertySelector ? (
                <Select
                  value={selectedPropertyId}
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
                <div className="flex items-center gap-2 h-10 px-3 bg-neutral-900/30 border border-white/10 rounded-md">
                  <Building2 className="h-4 w-4 text-neutral-500" />
                  <span className="text-sm text-white">
                    {currentPropertyName || properties.find(p => p.id === selectedPropertyId)?.name || "Unknown Property"}
                  </span>
                </div>
              )}
              {isEditMode && (
                <p className="text-xs text-neutral-500">
                  Property cannot be changed after creation.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="warehouseId"
                className="text-xs text-neutral-500 uppercase tracking-widest"
              >
                Inventory Warehouse
              </Label>
              <Select
                value={selectedWarehouseId}
                onValueChange={setSelectedWarehouseId}
              >
                <SelectTrigger className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20">
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {filteredWarehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      <div className="flex items-center gap-2">
                        <Warehouse className="h-4 w-4 text-neutral-400" />
                        {warehouse.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-neutral-500">
                The warehouse used for inventory tracking and stock deductions.
              </p>
            </div>

            {isEditMode && outlet && (
              <div className="space-y-2">
                <Label className="text-xs text-neutral-500 uppercase tracking-widest">
                  Status
                </Label>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      outlet.isActive ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <span className="text-sm text-neutral-300">
                    {outlet.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-xs text-neutral-500">
                  Use the list page to change outlet status.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
