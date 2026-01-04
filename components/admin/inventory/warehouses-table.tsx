"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Pencil,
  Search,
  Warehouse,
  Power,
  PowerOff,
  Package,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { WarehouseType } from "@prisma/client";
import { deactivateWarehouse, reactivateWarehouse } from "@/lib/inventory/warehouse";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { WarehouseDialog } from "./warehouse-dialog";

interface WarehouseData {
  id: string;
  name: string;
  type: WarehouseType;
  isActive: boolean;
  propertyId: string;
  propertyName: string;
  totalItems: number;
  totalValue: number;
  batchCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Property {
  id: string;
  name: string;
}

interface WarehousesTableProps {
  warehouses: WarehouseData[];
  properties: Property[];
  currentScope: string;
}

const WAREHOUSE_TYPE_LABELS: Record<WarehouseType, string> = {
  MAIN_STOCKROOM: "Main Stockroom",
  KITCHEN: "Kitchen",
  HOUSEKEEPING: "Housekeeping",
  BAR: "Bar",
  MINIBAR: "Minibar",
};

const WAREHOUSE_TYPE_COLORS: Record<WarehouseType, string> = {
  MAIN_STOCKROOM: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  KITCHEN: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  HOUSEKEEPING: "bg-green-500/20 text-green-400 border-green-500/30",
  BAR: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  MINIBAR: "bg-pink-500/20 text-pink-400 border-pink-500/30",
};

export function WarehousesTable({ warehouses, properties, currentScope }: WarehousesTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [propertyFilter, setPropertyFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [isLoading, setIsLoading] = React.useState<string | null>(null);
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingWarehouse, setEditingWarehouse] = React.useState<WarehouseData | undefined>(undefined);

  // Get default property ID from current scope
  const defaultPropertyId = currentScope !== "ALL" ? currentScope : properties[0]?.id;

  const handleCreateNew = () => {
    setEditingWarehouse(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (warehouse: WarehouseData) => {
    setEditingWarehouse(warehouse);
    setDialogOpen(true);
  };

  // Only show property filter when viewing ALL properties
  const showPropertyFilter = currentScope === "ALL" && properties.length > 0;

  // Filter warehouses based on search and filters
  const filteredWarehouses = React.useMemo(() => {
    let result = warehouses;

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        (warehouse) =>
          warehouse.name.toLowerCase().includes(lowerQuery) ||
          warehouse.propertyName.toLowerCase().includes(lowerQuery)
      );
    }

    if (propertyFilter !== "all") {
      result = result.filter((warehouse) => warehouse.propertyId === propertyFilter);
    }

    if (typeFilter !== "all") {
      result = result.filter((warehouse) => warehouse.type === typeFilter);
    }

    if (statusFilter !== "all") {
      const isActive = statusFilter === "active";
      result = result.filter((warehouse) => warehouse.isActive === isActive);
    }

    return result;
  }, [warehouses, searchQuery, propertyFilter, typeFilter, statusFilter]);

  const handleToggleStatus = async (warehouse: WarehouseData) => {
    setIsLoading(warehouse.id);
    try {
      const result = warehouse.isActive
        ? await deactivateWarehouse(warehouse.id)
        : await reactivateWarehouse(warehouse.id);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          warehouse.isActive
            ? "Warehouse deactivated successfully"
            : "Warehouse reactivated successfully"
        );
        router.refresh();
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsLoading(null);
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setPropertyFilter("all");
    setTypeFilter("all");
    setStatusFilter("all");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="w-full space-y-4">
      {/* Filters Row */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex flex-1 flex-wrap items-center gap-2 w-full">
          {/* Search */}
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search warehouses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-neutral-900 border-white/10"
            />
          </div>

          {/* Property Filter - Only show when viewing ALL properties */}
          {showPropertyFilter && (
            <Select value={propertyFilter} onValueChange={setPropertyFilter}>
              <SelectTrigger className="w-[180px] bg-neutral-900 border-white/10">
                <SelectValue placeholder="All Properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Type Filter */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px] bg-neutral-900 border-white/10">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(WAREHOUSE_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] bg-neutral-900 border-white/10">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={resetFilters}
          >
            Reset
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleCreateNew}
            size="sm"
            className="h-9 gap-1 bg-orange-600 hover:bg-orange-700 text-white rounded-none uppercase tracking-widest text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Add Warehouse
            </span>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-white/10 bg-neutral-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-neutral-900/50">
              <TableHead className="w-[250px] pl-4 uppercase tracking-widest text-xs font-medium text-neutral-400">
                Warehouse
              </TableHead>
              {showPropertyFilter && (
                <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                  Property
                </TableHead>
              )}
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Type
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Items
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Total Value
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Status
              </TableHead>
              <TableHead className="text-right pr-4 uppercase tracking-widest text-xs font-medium text-neutral-400">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredWarehouses.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={showPropertyFilter ? 7 : 6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No warehouses found.
                </TableCell>
              </TableRow>
            ) : (
              filteredWarehouses.map((warehouse) => (
                <TableRow
                  key={warehouse.id}
                  className="border-white/10 hover:bg-white/5"
                >
                  <TableCell className="pl-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-neutral-800 rounded-md flex items-center justify-center">
                        <Warehouse className="h-5 w-5 text-neutral-400" />
                      </div>
                      <span className="font-medium text-sm text-white">
                        {warehouse.name}
                      </span>
                    </div>
                  </TableCell>
                  {showPropertyFilter && (
                    <TableCell>
                      <span className="text-sm text-neutral-300">
                        {warehouse.propertyName}
                      </span>
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={WAREHOUSE_TYPE_COLORS[warehouse.type]}
                    >
                      {WAREHOUSE_TYPE_LABELS[warehouse.type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-neutral-400">
                      <Package className="h-3.5 w-3.5" />
                      {warehouse.totalItems}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium text-green-400">
                      {formatCurrency(warehouse.totalValue)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        warehouse.isActive
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : "bg-neutral-500/20 text-neutral-400 border-neutral-500/30"
                      }
                    >
                      {warehouse.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-white/10"
                      >
                        <Link href={`/admin/inventory/warehouses/${warehouse.id}`}>
                          <Eye className="h-3.5 w-3.5" />
                          <span className="sr-only">View Details</span>
                        </Link>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-white/10"
                        onClick={() => handleEdit(warehouse)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit</span>
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${
                              warehouse.isActive
                                ? "text-neutral-400 hover:text-red-400 hover:bg-red-900/10"
                                : "text-neutral-400 hover:text-green-400 hover:bg-green-900/10"
                            }`}
                            disabled={isLoading === warehouse.id}
                          >
                            {warehouse.isActive ? (
                              <PowerOff className="h-3.5 w-3.5" />
                            ) : (
                              <Power className="h-3.5 w-3.5" />
                            )}
                            <span className="sr-only">
                              {warehouse.isActive ? "Deactivate" : "Reactivate"}
                            </span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-neutral-900 border-white/10">
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {warehouse.isActive
                                ? "Deactivate Warehouse"
                                : "Reactivate Warehouse"}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {warehouse.isActive
                                ? `Are you sure you want to deactivate "${warehouse.name}"? This will hide it from active selections but preserve all historical data.`
                                : `Are you sure you want to reactivate "${warehouse.name}"? This will make it available for use again.`}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-neutral-800 border-white/10 hover:bg-neutral-700">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleToggleStatus(warehouse)}
                              className={
                                warehouse.isActive
                                  ? "bg-red-600 hover:bg-red-700"
                                  : "bg-green-600 hover:bg-green-700"
                              }
                            >
                              {warehouse.isActive ? "Deactivate" : "Reactivate"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground">
        Showing <strong>{filteredWarehouses.length}</strong> of{" "}
        <strong>{warehouses.length}</strong> warehouses.
      </div>

      {/* Warehouse Dialog */}
      <WarehouseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        warehouse={editingWarehouse}
        properties={properties}
        defaultPropertyId={defaultPropertyId}
        showPropertySelector={currentScope === "ALL"}
      />
    </div>
  );
}
