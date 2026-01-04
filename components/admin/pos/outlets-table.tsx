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
  Store,
  Power,
  PowerOff,
  UtensilsCrossed,
  Wine,
  Coffee,
  Bed,
  Waves,
  Package,
} from "lucide-react";
import Link from "next/link";
import { OutletType } from "@prisma/client";
import { deactivateOutlet, reactivateOutlet } from "@/lib/pos/outlet";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface OutletData {
  id: string;
  name: string;
  type: OutletType;
  isActive: boolean;
  propertyId: string;
  propertyName: string;
  warehouseId: string;
  warehouseName: string;
  tableCount: number;
  orderCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Property {
  id: string;
  name: string;
}

interface OutletsTableProps {
  outlets: OutletData[];
  properties: Property[];
  currentScope: string;
}

const OUTLET_TYPE_LABELS: Record<OutletType, string> = {
  RESTAURANT: "Restaurant",
  BAR: "Bar",
  ROOM_SERVICE: "Room Service",
  POOL_BAR: "Pool Bar",
  CAFE: "Café",
  MINIBAR: "Minibar",
};

const OUTLET_TYPE_COLORS: Record<OutletType, string> = {
  RESTAURANT: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  BAR: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  ROOM_SERVICE: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  POOL_BAR: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  CAFE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  MINIBAR: "bg-pink-500/20 text-pink-400 border-pink-500/30",
};

const OUTLET_TYPE_ICONS: Record<OutletType, React.ReactNode> = {
  RESTAURANT: <UtensilsCrossed className="h-5 w-5 text-orange-400" />,
  BAR: <Wine className="h-5 w-5 text-purple-400" />,
  ROOM_SERVICE: <Bed className="h-5 w-5 text-blue-400" />,
  POOL_BAR: <Waves className="h-5 w-5 text-cyan-400" />,
  CAFE: <Coffee className="h-5 w-5 text-amber-400" />,
  MINIBAR: <Package className="h-5 w-5 text-pink-400" />,
};

export function OutletsTable({ outlets, properties, currentScope }: OutletsTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [propertyFilter, setPropertyFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [isLoading, setIsLoading] = React.useState<string | null>(null);

  // Only show property filter when viewing ALL properties
  const showPropertyFilter = currentScope === "ALL" && properties.length > 0;

  // Filter outlets based on search and filters
  const filteredOutlets = React.useMemo(() => {
    let result = outlets;

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        (outlet) =>
          outlet.name.toLowerCase().includes(lowerQuery) ||
          outlet.propertyName.toLowerCase().includes(lowerQuery) ||
          outlet.warehouseName.toLowerCase().includes(lowerQuery)
      );
    }

    if (propertyFilter !== "all") {
      result = result.filter((outlet) => outlet.propertyId === propertyFilter);
    }

    if (typeFilter !== "all") {
      result = result.filter((outlet) => outlet.type === typeFilter);
    }

    if (statusFilter !== "all") {
      const isActive = statusFilter === "active";
      result = result.filter((outlet) => outlet.isActive === isActive);
    }

    return result;
  }, [outlets, searchQuery, propertyFilter, typeFilter, statusFilter]);

  const handleToggleStatus = async (outlet: OutletData) => {
    setIsLoading(outlet.id);
    try {
      const result = outlet.isActive
        ? await deactivateOutlet(outlet.id)
        : await reactivateOutlet(outlet.id);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          outlet.isActive
            ? "Outlet deactivated successfully"
            : "Outlet reactivated successfully"
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

  return (
    <div className="w-full space-y-4">
      {/* Filters Row */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex flex-1 flex-wrap items-center gap-2 w-full">
          {/* Search */}
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search outlets..."
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
              {Object.entries(OUTLET_TYPE_LABELS).map(([value, label]) => (
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
            asChild
            size="sm"
            className="h-9 gap-1 bg-orange-600 hover:bg-orange-700 text-white rounded-none uppercase tracking-widest text-xs"
          >
            <Link href="/admin/pos/outlets/new">
              <Plus className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Add Outlet
              </span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-white/10 bg-neutral-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-neutral-900/50">
              <TableHead className="w-[250px] pl-4 uppercase tracking-widest text-xs font-medium text-neutral-400">
                Outlet
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
                Warehouse
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Tables
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
            {filteredOutlets.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={showPropertyFilter ? 7 : 6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No outlets found.
                </TableCell>
              </TableRow>
            ) : (
              filteredOutlets.map((outlet) => (
                <TableRow
                  key={outlet.id}
                  className="border-white/10 hover:bg-white/5"
                >
                  <TableCell className="pl-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-neutral-800 rounded-md flex items-center justify-center">
                        {OUTLET_TYPE_ICONS[outlet.type] || <Store className="h-5 w-5 text-neutral-400" />}
                      </div>
                      <span className="font-medium text-sm text-white">
                        {outlet.name}
                      </span>
                    </div>
                  </TableCell>
                  {showPropertyFilter && (
                    <TableCell>
                      <span className="text-sm text-neutral-300">
                        {outlet.propertyName}
                      </span>
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={OUTLET_TYPE_COLORS[outlet.type]}
                    >
                      {OUTLET_TYPE_LABELS[outlet.type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-neutral-300">
                      {outlet.warehouseName}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-neutral-400">
                      {outlet.tableCount}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        outlet.isActive
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : "bg-neutral-500/20 text-neutral-400 border-neutral-500/30"
                      }
                    >
                      {outlet.isActive ? "Active" : "Inactive"}
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
                        <Link href={`/admin/pos/outlets/${outlet.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">Edit</span>
                        </Link>
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${
                              outlet.isActive
                                ? "text-neutral-400 hover:text-red-400 hover:bg-red-900/10"
                                : "text-neutral-400 hover:text-green-400 hover:bg-green-900/10"
                            }`}
                            disabled={isLoading === outlet.id}
                          >
                            {outlet.isActive ? (
                              <PowerOff className="h-3.5 w-3.5" />
                            ) : (
                              <Power className="h-3.5 w-3.5" />
                            )}
                            <span className="sr-only">
                              {outlet.isActive ? "Deactivate" : "Reactivate"}
                            </span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-neutral-900 border-white/10">
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {outlet.isActive
                                ? "Deactivate Outlet"
                                : "Reactivate Outlet"}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {outlet.isActive
                                ? `Are you sure you want to deactivate "${outlet.name}"? This will prevent new orders but preserve all historical data.`
                                : `Are you sure you want to reactivate "${outlet.name}"? This will make it available for new orders.`}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-neutral-800 border-white/10 hover:bg-neutral-700">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleToggleStatus(outlet)}
                              className={
                                outlet.isActive
                                  ? "bg-red-600 hover:bg-red-700"
                                  : "bg-green-600 hover:bg-green-700"
                              }
                            >
                              {outlet.isActive ? "Deactivate" : "Reactivate"}
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
        Showing <strong>{filteredOutlets.length}</strong> of{" "}
        <strong>{outlets.length}</strong> outlets.
      </div>
    </div>
  );
}
