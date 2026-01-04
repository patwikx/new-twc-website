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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StockCategory {
  id: string;
  name: string;
  color: string | null;
}

interface StockLevelData {
  id: string;
  stockItemId: string;
  stockItemName: string;
  stockItemSku: string | null;
  category: StockCategory;
  quantity: number;
  averageCost: number;
  totalValue: number;
  unit: string;
  parLevel?: number;
}

interface WarehouseStockTableProps {
  stockLevels: StockLevelData[];
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

export function WarehouseStockTable({ stockLevels, categories }: WarehouseStockTableProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [showLowStock, setShowLowStock] = React.useState(false);

  // Filter stock levels
  const filteredStockLevels = React.useMemo(() => {
    let result = stockLevels;

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        (level) =>
          level.stockItemName.toLowerCase().includes(lowerQuery) ||
          level.stockItemSku?.toLowerCase().includes(lowerQuery)
      );
    }

    if (categoryFilter !== "all") {
      result = result.filter((level) => level.category.id === categoryFilter);
    }

    if (showLowStock) {
      result = result.filter(
        (level) =>
          level.parLevel !== undefined && level.quantity < level.parLevel
      );
    }

    return result;
  }, [stockLevels, searchQuery, categoryFilter, showLowStock]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatQuantity = (quantity: number, unit: string) => {
    return `${quantity.toLocaleString("en-PH", { maximumFractionDigits: 2 })} ${unit}`;
  };

  const isLowStock = (level: StockLevelData) => {
    return level.parLevel !== undefined && level.quantity < level.parLevel;
  };

  const resetFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setShowLowStock(false);
  };

  if (stockLevels.length === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-neutral-900/50 p-8 text-center">
        <p className="text-muted-foreground">
          No stock items in this warehouse yet.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 bg-neutral-900 border-white/10"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px] bg-neutral-900 border-white/10">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={showLowStock ? "default" : "outline"}
          size="sm"
          onClick={() => setShowLowStock(!showLowStock)}
          className={
            showLowStock
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "border-white/10 text-neutral-400 hover:text-white"
          }
        >
          <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
          Low Stock
        </Button>

        <Button
          variant="ghost"
          className="text-muted-foreground"
          onClick={resetFilters}
        >
          Reset
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border border-white/10 bg-neutral-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-neutral-900/50">
              <TableHead className="w-[300px] pl-4 uppercase tracking-widest text-xs font-medium text-neutral-400">
                Item
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                SKU
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Category
              </TableHead>
              <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">
                Quantity
              </TableHead>
              <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">
                Par Level
              </TableHead>
              <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">
                Avg Cost
              </TableHead>
              <TableHead className="text-right pr-4 uppercase tracking-widest text-xs font-medium text-neutral-400">
                Total Value
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStockLevels.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No items match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredStockLevels.map((level) => (
                <TableRow
                  key={level.id}
                  className={`border-white/10 hover:bg-white/5 ${
                    isLowStock(level) ? "bg-red-900/10" : ""
                  }`}
                >
                  <TableCell className="pl-4 py-3">
                    <div className="flex items-center gap-2">
                      {isLowStock(level) && (
                        <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
                      )}
                      <span className="font-medium text-sm text-white">
                        {level.stockItemName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-neutral-400 font-mono">
                      {level.stockItemSku || "-"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={getCategoryColor(level.category.color)}
                    >
                      {level.category.name}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`text-sm font-medium ${
                        isLowStock(level) ? "text-red-400" : "text-white"
                      }`}
                    >
                      {formatQuantity(level.quantity, level.unit)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm text-neutral-400">
                      {level.parLevel !== undefined
                        ? formatQuantity(level.parLevel, level.unit)
                        : "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm text-neutral-400">
                      {formatCurrency(level.averageCost)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <span className="text-sm font-medium text-green-400">
                      {formatCurrency(level.totalValue)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground">
        Showing <strong>{filteredStockLevels.length}</strong> of{" "}
        <strong>{stockLevels.length}</strong> items.
      </div>
    </div>
  );
}
