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
  Package,
  Power,
  PowerOff,
  Boxes,
  ChefHat,
  Truck,
  Download,
  Upload,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { deactivateStockItem, reactivateStockItem } from "@/lib/inventory/stock-item";
import { exportStockItems, exportStockItemsWithLevels } from "@/lib/bulk/export";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface StockCategory {
  id: string;
  name: string;
  color: string | null;
}

interface StockItemData {
  id: string;
  itemCode: string;
  name: string;
  sku: string | null;
  category: StockCategory;
  isConsignment: boolean;
  isActive: boolean;
  propertyId: string;
  propertyName: string;
  primaryUnit: {
    id: string;
    name: string;
    abbreviation: string;
  };
  supplier: {
    id: string;
    name: string;
  } | null;
  totalQuantity: number;
  totalValue: number;
  warehouseCount: number;
  batchCount: number;
  recipeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Property {
  id: string;
  name: string;
}

interface StockItemsTableProps {
  stockItems: StockItemData[];
  properties: Property[];
  categories: StockCategory[];
}

const CATEGORY_COLORS: Record<string, string> = {
  orange: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  green: "bg-green-500/20 text-green-400 border-green-500/30",
  purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  cyan: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  red: "bg-red-500/20 text-red-400 border-red-500/30",
  yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  pink: "bg-pink-500/20 text-pink-400 border-pink-500/30",
};

function getCategoryColor(color: string | null): string {
  if (color && CATEGORY_COLORS[color]) {
    return CATEGORY_COLORS[color];
  }
  return "bg-neutral-500/20 text-neutral-400 border-neutral-500/30";
}

export function StockItemsTable({ stockItems, properties, categories }: StockItemsTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [propertyFilter, setPropertyFilter] = React.useState<string>("all");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [consignmentFilter, setConsignmentFilter] = React.useState<string>("all");
  const [isLoading, setIsLoading] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  // Filter stock items based on search and filters
  const filteredItems = React.useMemo(() => {
    let result = stockItems;

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(lowerQuery) ||
          item.itemCode.toLowerCase().includes(lowerQuery) ||
          item.sku?.toLowerCase().includes(lowerQuery) ||
          item.propertyName.toLowerCase().includes(lowerQuery) ||
          item.supplier?.name.toLowerCase().includes(lowerQuery)
      );
    }

    if (propertyFilter !== "all") {
      result = result.filter((item) => item.propertyId === propertyFilter);
    }

    if (categoryFilter !== "all") {
      result = result.filter((item) => item.category.id === categoryFilter);
    }

    if (statusFilter !== "all") {
      const isActive = statusFilter === "active";
      result = result.filter((item) => item.isActive === isActive);
    }

    if (consignmentFilter !== "all") {
      const isConsignment = consignmentFilter === "consignment";
      result = result.filter((item) => item.isConsignment === isConsignment);
    }

    return result;
  }, [stockItems, searchQuery, propertyFilter, categoryFilter, statusFilter, consignmentFilter]);

  const handleToggleStatus = async (item: StockItemData) => {
    setIsLoading(item.id);
    try {
      const result = item.isActive
        ? await deactivateStockItem(item.id)
        : await reactivateStockItem(item.id);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          item.isActive
            ? "Stock item deactivated successfully"
            : "Stock item reactivated successfully"
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
    setCategoryFilter("all");
    setStatusFilter("all");
    setConsignmentFilter("all");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatQuantity = (value: number, unit: string) => {
    return `${value.toLocaleString("en-PH", { maximumFractionDigits: 2 })} ${unit}`;
  };

  const handleExport = async (type: "items" | "levels") => {
    setIsExporting(true);
    try {
      // Get the first property ID for export (or use filter if set)
      const propertyId = propertyFilter !== "all" ? propertyFilter : properties[0]?.id;
      
      if (!propertyId) {
        toast.error("No property selected for export");
        return;
      }

      const result = type === "items" 
        ? await exportStockItems(propertyId)
        : await exportStockItemsWithLevels(propertyId);

      if (!result.success) {
        toast.error(result.error || "Export failed");
        return;
      }

      // Create and download the file
      const blob = new Blob([result.data], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${result.rowCount} records`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    } finally {
      setIsExporting(false);
    }
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
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-neutral-900 border-white/10"
            />
          </div>

          {/* Property Filter */}
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

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px] bg-neutral-900 border-white/10">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
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

          {/* Consignment Filter */}
          <Select value={consignmentFilter} onValueChange={setConsignmentFilter}>
            <SelectTrigger className="w-[150px] bg-neutral-900 border-white/10">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="owned">Owned</SelectItem>
              <SelectItem value="consignment">Consignment</SelectItem>
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
          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1 bg-neutral-800 border-white/10 hover:bg-neutral-700 text-white rounded-none uppercase tracking-widest text-xs"
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Export
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-neutral-900 border-white/10">
              <DropdownMenuItem 
                onClick={() => handleExport("items")}
                className="cursor-pointer"
              >
                Export Stock Items
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleExport("levels")}
                className="cursor-pointer"
              >
                Export with Stock Levels
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Import Button */}
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-9 gap-1 bg-neutral-800 border-white/10 hover:bg-neutral-700 text-white rounded-none uppercase tracking-widest text-xs"
          >
            <Link href="/admin/inventory/bulk/import">
              <Upload className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Import
              </span>
            </Link>
          </Button>

          <Button
            asChild
            size="sm"
            className="h-9 gap-1 bg-orange-600 hover:bg-orange-700 text-white rounded-none uppercase tracking-widest text-xs"
          >
            <Link href="/admin/inventory/items/new">
              <Plus className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Add Item
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
              <TableHead className="w-[280px] pl-4 uppercase tracking-widest text-xs font-medium text-neutral-400">
                Item
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Category
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Stock Level
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Total Value
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Supplier
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
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No stock items found.
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow
                  key={item.id}
                  className="border-white/10 hover:bg-white/5"
                >
                  <TableCell className="pl-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-neutral-800 rounded-md flex items-center justify-center">
                        <Package className="h-5 w-5 text-neutral-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm text-white">
                          {item.name}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {item.itemCode}{item.sku ? ` • SKU: ${item.sku}` : ""}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge
                        variant="outline"
                        className={getCategoryColor(item.category.color)}
                      >
                        {item.category.name}
                      </Badge>
                      {item.isConsignment && (
                        <Badge
                          variant="outline"
                          className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]"
                        >
                          <Truck className="h-2.5 w-2.5 mr-1" />
                          Consignment
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white">
                        {formatQuantity(item.totalQuantity, item.primaryUnit.abbreviation)}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <span className="flex items-center gap-1">
                          <Boxes className="h-3 w-3" />
                          {item.warehouseCount} warehouse{item.warehouseCount !== 1 ? "s" : ""}
                        </span>
                        {item.recipeCount > 0 && (
                          <span className="flex items-center gap-1">
                            <ChefHat className="h-3 w-3" />
                            {item.recipeCount} recipe{item.recipeCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium text-green-400">
                      {formatCurrency(item.totalValue)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {item.supplier ? (
                      <span className="text-sm text-neutral-300">
                        {item.supplier.name}
                      </span>
                    ) : (
                      <span className="text-sm text-neutral-500">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        item.isActive
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : "bg-neutral-500/20 text-neutral-400 border-neutral-500/30"
                      }
                    >
                      {item.isActive ? "Active" : "Inactive"}
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
                        <Link href={`/admin/inventory/items/${item.id}`}>
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
                              item.isActive
                                ? "text-neutral-400 hover:text-red-400 hover:bg-red-900/10"
                                : "text-neutral-400 hover:text-green-400 hover:bg-green-900/10"
                            }`}
                            disabled={isLoading === item.id}
                          >
                            {item.isActive ? (
                              <PowerOff className="h-3.5 w-3.5" />
                            ) : (
                              <Power className="h-3.5 w-3.5" />
                            )}
                            <span className="sr-only">
                              {item.isActive ? "Deactivate" : "Reactivate"}
                            </span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-neutral-900 border-white/10">
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {item.isActive
                                ? "Deactivate Stock Item"
                                : "Reactivate Stock Item"}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {item.isActive
                                ? `Are you sure you want to deactivate "${item.name}"? This will hide it from active selections but preserve all historical data.`
                                : `Are you sure you want to reactivate "${item.name}"? This will make it available for use again.`}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-neutral-800 border-white/10 hover:bg-neutral-700">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleToggleStatus(item)}
                              className={
                                item.isActive
                                  ? "bg-red-600 hover:bg-red-700"
                                  : "bg-green-600 hover:bg-green-700"
                              }
                            >
                              {item.isActive ? "Deactivate" : "Reactivate"}
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
        Showing <strong>{filteredItems.length}</strong> of{" "}
        <strong>{stockItems.length}</strong> stock items.
      </div>
    </div>
  );
}
