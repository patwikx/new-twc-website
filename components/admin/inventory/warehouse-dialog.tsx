"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createWarehouse, updateWarehouse } from "@/lib/inventory/warehouse";
import { Loader2, Warehouse, Building2 } from "lucide-react";
import { WarehouseType } from "@prisma/client";

interface Property {
  id: string;
  name: string;
}

interface WarehouseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse?: {
    id: string;
    name: string;
    type: WarehouseType;
    propertyId: string;
    isActive: boolean;
  };
  properties: Property[];
  defaultPropertyId?: string;
  showPropertySelector?: boolean;
}

const WAREHOUSE_TYPES: { value: WarehouseType; label: string; description: string }[] = [
  { value: "MAIN_STOCKROOM", label: "Main Stockroom", description: "Central storage for all inventory" },
  { value: "KITCHEN", label: "Kitchen", description: "Food and beverage preparation area" },
  { value: "HOUSEKEEPING", label: "Housekeeping", description: "Linens and cleaning supplies" },
  { value: "BAR", label: "Bar", description: "Beverage and bar supplies" },
  { value: "MINIBAR", label: "Minibar", description: "In-room minibar inventory" },
];

export function WarehouseDialog({
  open,
  onOpenChange,
  warehouse,
  properties,
  defaultPropertyId,
  showPropertySelector = true,
}: WarehouseDialogProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEditMode = !!warehouse;
  
  const [name, setName] = useState(warehouse?.name || "");
  const [selectedType, setSelectedType] = useState<WarehouseType>(warehouse?.type || "MAIN_STOCKROOM");
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    warehouse?.propertyId || defaultPropertyId || properties[0]?.id || ""
  );

  const selectedTypeInfo = WAREHOUSE_TYPES.find(t => t.value === selectedType);
  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Warehouse name is required");
      return;
    }

    startTransition(async () => {
      let result;

      if (isEditMode && warehouse?.id) {
        result = await updateWarehouse(warehouse.id, { name, type: selectedType });
      } else {
        result = await createWarehouse({ name, type: selectedType, propertyId: selectedPropertyId });
      }

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isEditMode ? "Warehouse updated" : "Warehouse created");
        onOpenChange(false);
        // Reset form for next use
        if (!isEditMode) {
          setName("");
          setSelectedType("MAIN_STOCKROOM");
        }
        router.refresh();
      }
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      setName(warehouse?.name || "");
      setSelectedType(warehouse?.type || "MAIN_STOCKROOM");
      setSelectedPropertyId(warehouse?.propertyId || defaultPropertyId || properties[0]?.id || "");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-neutral-900 border-white/10 sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Warehouse className="h-5 w-5 text-orange-500" />
              {isEditMode ? "Edit Warehouse" : "Create Warehouse"}
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              {isEditMode
                ? "Update warehouse information."
                : "Add a new inventory storage location."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Warehouse Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs text-neutral-500 uppercase tracking-widest">
                Warehouse Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main Kitchen Storage"
                required
                className="h-10 bg-neutral-900/50 border-white/10 focus:border-orange-500/50"
              />
            </div>

            {/* Warehouse Type */}
            <div className="space-y-2">
              <Label htmlFor="type" className="text-xs text-neutral-500 uppercase tracking-widest">
                Warehouse Type
              </Label>
              <Select value={selectedType} onValueChange={(v) => setSelectedType(v as WarehouseType)}>
                <SelectTrigger className="h-10 bg-neutral-900/50 border-white/10 focus:border-orange-500/50">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {WAREHOUSE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTypeInfo && (
                <p className="text-xs text-neutral-500">{selectedTypeInfo.description}</p>
              )}
            </div>

            {/* Property */}
            <div className="space-y-2">
              <Label htmlFor="propertyId" className="text-xs text-neutral-500 uppercase tracking-widest">
                Property
              </Label>
              {showPropertySelector && !isEditMode ? (
                <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                  <SelectTrigger className="h-10 bg-neutral-900/50 border-white/10 focus:border-orange-500/50">
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
                <div className="flex items-center gap-2 h-10 px-3 rounded-md bg-neutral-900/50 border border-white/10">
                  <Building2 className="h-4 w-4 text-neutral-500" />
                  <span className="text-sm text-white">
                    {selectedProperty?.name || "Unknown Property"}
                  </span>
                </div>
              )}
              {isEditMode && (
                <p className="text-xs text-neutral-500">Property cannot be changed after creation.</p>
              )}
            </div>

            {/* Status (Edit mode only) */}
            {isEditMode && warehouse && (
              <div className="space-y-2">
                <Label className="text-xs text-neutral-500 uppercase tracking-widest">Status</Label>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${warehouse.isActive ? "bg-green-500" : "bg-neutral-500"}`} />
                  <span className="text-sm text-neutral-300">
                    {warehouse.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-xs text-neutral-500">Use the list page to activate/deactivate warehouses.</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              className="text-neutral-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-orange-600 hover:bg-orange-700 text-white min-w-[120px]"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isEditMode ? (
                "Save Changes"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
