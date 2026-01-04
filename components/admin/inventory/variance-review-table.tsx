"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Settings2,
  Package,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

export interface VarianceReviewItem {
  id: string;
  stockItemId: string;
  batchId: string | null;
  systemQuantity: number;
  countedQuantity: number | null;
  variance: number | null;
  variancePercent: number | null;
  varianceCost: number | null;
  unitCost: number | null;
  notes: string | null;
  adjustmentMade: boolean;
  stockItem: {
    id: string;
    name: string;
    itemCode: string;
    sku: string | null;
    primaryUnit: {
      id: string;
      name: string;
      abbreviation: string;
    };
    category: {
      id: string;
      name: string;
      color: string | null;
    } | null;
  };
  batch: {
    id: string;
    batchNumber: string;
    expirationDate: Date | null;
  } | null;
}

export interface VarianceThreshold {
  percentThreshold: number; // Default 5%
  costThreshold: number; // Default ₱1000
}

type SortField = "item" | "systemQty" | "countedQty" | "variance" | "variancePercent" | "varianceCost";
type SortDirection = "asc" | "desc";
type FilterOption = "all" | "with-variance" | "exceeds-threshold" | "positive" | "negative";

interface VarianceReviewTableProps {
  items: VarianceReviewItem[];
  threshold?: VarianceThreshold;
  onThresholdChange?: (threshold: VarianceThreshold) => void;
}

// =============================================================================
// Default Threshold Values
// =============================================================================

const DEFAULT_THRESHOLD: VarianceThreshold = {
  percentThreshold: 5, // 5%
  costThreshold: 1000, // ₱1000
};

// =============================================================================
// Component
// =============================================================================

export function VarianceReviewTable({
  items,
  threshold = DEFAULT_THRESHOLD,
  onThresholdChange,
}: VarianceReviewTableProps) {
  // State for search, filter, and sort
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOption, setFilterOption] = useState<FilterOption>("all");
  const [sortField, setSortField] = useState<SortField>("varianceCost");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  
  // State for threshold configuration
  const [localThreshold, setLocalThreshold] = useState<VarianceThreshold>(threshold);
  const [isThresholdOpen, setIsThresholdOpen] = useState(false);

  // =============================================================================
  // Helper Functions
  // =============================================================================

  const formatCurrency = (value: number | null) => {
    if (value === null) return "—";
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(value);
  };

  const getVarianceColor = (variance: number | null) => {
    if (variance === null || variance === 0) return "text-neutral-400";
    if (variance > 0) return "text-green-400";
    return "text-red-400";
  };

  const getVarianceIcon = (variance: number | null) => {
    if (variance === null || variance === 0) return Minus;
    if (variance > 0) return TrendingUp;
    return TrendingDown;
  };

  /**
   * Check if an item exceeds the configured threshold
   * Requirements: REQ-CC-3.2
   */
  const exceedsThreshold = (item: VarianceReviewItem): boolean => {
    if (item.variance === null || item.variance === 0) return false;
    
    const absVariancePercent = Math.abs(item.variancePercent || 0);
    const absVarianceCost = Math.abs(item.varianceCost || 0);
    
    return absVariancePercent > localThreshold.percentThreshold || 
           absVarianceCost > localThreshold.costThreshold;
  };

  // =============================================================================
  // Filtering and Sorting
  // =============================================================================

  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    // Apply search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      result = result.filter((item) =>
        item.stockItem.name.toLowerCase().includes(searchLower) ||
        item.stockItem.itemCode.toLowerCase().includes(searchLower) ||
        (item.stockItem.sku && item.stockItem.sku.toLowerCase().includes(searchLower)) ||
        (item.batch && item.batch.batchNumber.toLowerCase().includes(searchLower)) ||
        (item.stockItem.category && item.stockItem.category.name.toLowerCase().includes(searchLower))
      );
    }

    // Apply filter option
    switch (filterOption) {
      case "with-variance":
        result = result.filter((item) => item.variance !== null && item.variance !== 0);
        break;
      case "exceeds-threshold":
        result = result.filter((item) => exceedsThreshold(item));
        break;
      case "positive":
        result = result.filter((item) => item.variance !== null && item.variance > 0);
        break;
      case "negative":
        result = result.filter((item) => item.variance !== null && item.variance < 0);
        break;
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "item":
          comparison = a.stockItem.name.localeCompare(b.stockItem.name);
          break;
        case "systemQty":
          comparison = a.systemQuantity - b.systemQuantity;
          break;
        case "countedQty":
          comparison = (a.countedQuantity || 0) - (b.countedQuantity || 0);
          break;
        case "variance":
          comparison = Math.abs(a.variance || 0) - Math.abs(b.variance || 0);
          break;
        case "variancePercent":
          comparison = Math.abs(a.variancePercent || 0) - Math.abs(b.variancePercent || 0);
          break;
        case "varianceCost":
          comparison = Math.abs(a.varianceCost || 0) - Math.abs(b.varianceCost || 0);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [items, searchQuery, filterOption, sortField, sortDirection, localThreshold]);

  // =============================================================================
  // Summary Statistics
  // =============================================================================

  const summary = useMemo(() => {
    const itemsWithVariance = items.filter((item) => item.variance !== null && item.variance !== 0);
    const itemsExceedingThreshold = items.filter((item) => exceedsThreshold(item));
    const positiveVariance = items.filter((item) => item.variance !== null && item.variance > 0);
    const negativeVariance = items.filter((item) => item.variance !== null && item.variance < 0);

    const totalPositiveCost = positiveVariance.reduce(
      (sum, item) => sum + (item.varianceCost || 0),
      0
    );
    const totalNegativeCost = negativeVariance.reduce(
      (sum, item) => sum + Math.abs(item.varianceCost || 0),
      0
    );

    return {
      total: items.length,
      withVariance: itemsWithVariance.length,
      exceedingThreshold: itemsExceedingThreshold.length,
      positive: positiveVariance.length,
      negative: negativeVariance.length,
      totalPositiveCost,
      totalNegativeCost,
      netCost: totalPositiveCost - totalNegativeCost,
    };
  }, [items, localThreshold]);

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const handleThresholdSave = () => {
    onThresholdChange?.(localThreshold);
    setIsThresholdOpen(false);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 text-neutral-500" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="h-4 w-4 text-orange-500" />
      : <ArrowDown className="h-4 w-4 text-orange-500" />;
  };

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-neutral-900/50 rounded-lg border border-white/10">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">Total Items</p>
          <p className="text-xl font-semibold text-white">{summary.total}</p>
        </div>
        <div className="p-3 bg-neutral-900/50 rounded-lg border border-white/10">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">With Variance</p>
          <p className="text-xl font-semibold text-white">{summary.withVariance}</p>
        </div>
        <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30">
          <p className="text-xs text-red-400 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Exceeds Threshold
          </p>
          <p className="text-xl font-semibold text-red-400">{summary.exceedingThreshold}</p>
        </div>
        <div className="p-3 bg-neutral-900/50 rounded-lg border border-white/10">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">Net Variance Cost</p>
          <p className={`text-xl font-semibold ${
            summary.netCost > 0 ? "text-green-400" : 
            summary.netCost < 0 ? "text-red-400" : "text-white"
          }`}>
            {formatCurrency(summary.netCost)}
          </p>
        </div>
      </div>

      {/* Variance Breakdown */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-neutral-500">Breakdown:</span>
        <span className="flex items-center gap-1 text-green-400">
          <TrendingUp className="h-4 w-4" />
          {summary.positive} over (+{formatCurrency(summary.totalPositiveCost)})
        </span>
        <span className="flex items-center gap-1 text-red-400">
          <TrendingDown className="h-4 w-4" />
          {summary.negative} under (-{formatCurrency(summary.totalNegativeCost)})
        </span>
      </div>

      {/* Search, Filter, and Threshold Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <Input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-neutral-900/50 border-white/10"
          />
        </div>

        {/* Filter */}
        <Select value={filterOption} onValueChange={(v) => setFilterOption(v as FilterOption)}>
          <SelectTrigger className="w-[180px] bg-neutral-900/50 border-white/10">
            <Filter className="h-4 w-4 mr-2 text-neutral-500" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-neutral-900 border-white/10">
            <SelectItem value="all">All Items</SelectItem>
            <SelectItem value="with-variance">With Variance</SelectItem>
            <SelectItem value="exceeds-threshold">
              <span className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="h-3 w-3" />
                Exceeds Threshold
              </span>
            </SelectItem>
            <SelectItem value="positive">
              <span className="flex items-center gap-2 text-green-400">
                <TrendingUp className="h-3 w-3" />
                Positive (Over)
              </span>
            </SelectItem>
            <SelectItem value="negative">
              <span className="flex items-center gap-2 text-red-400">
                <TrendingDown className="h-3 w-3" />
                Negative (Under)
              </span>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Threshold Configuration */}
        <Popover open={isThresholdOpen} onOpenChange={setIsThresholdOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="border-white/10 bg-neutral-900/50">
              <Settings2 className="h-4 w-4 mr-2" />
              Threshold
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 bg-neutral-900 border-white/10" align="end">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-white mb-2">Variance Threshold</h4>
                <p className="text-xs text-neutral-500">
                  Items exceeding these thresholds will be highlighted for review.
                </p>
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm">Percentage Threshold (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={localThreshold.percentThreshold}
                    onChange={(e) => setLocalThreshold({
                      ...localThreshold,
                      percentThreshold: parseFloat(e.target.value) || 0,
                    })}
                    className="bg-neutral-800 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Cost Threshold (₱)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={localThreshold.costThreshold}
                    onChange={(e) => setLocalThreshold({
                      ...localThreshold,
                      costThreshold: parseFloat(e.target.value) || 0,
                    })}
                    className="bg-neutral-800 border-white/10"
                  />
                </div>
              </div>
              <Button onClick={handleThresholdSave} className="w-full bg-orange-600 hover:bg-orange-700">
                Apply Threshold
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Current Threshold Display */}
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <AlertTriangle className="h-3 w-3" />
        <span>
          Threshold: &gt;{localThreshold.percentThreshold}% variance OR &gt;{formatCurrency(localThreshold.costThreshold)} cost
        </span>
      </div>

      {/* Table */}
      <div className="border border-white/10 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-neutral-400">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("item")}
                  className="h-auto p-0 font-medium text-neutral-400 hover:text-white"
                >
                  Item
                  {getSortIcon("item")}
                </Button>
              </TableHead>
              <TableHead className="text-neutral-400 w-28">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("systemQty")}
                  className="h-auto p-0 font-medium text-neutral-400 hover:text-white"
                >
                  System Qty
                  {getSortIcon("systemQty")}
                </Button>
              </TableHead>
              <TableHead className="text-neutral-400 w-28">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("countedQty")}
                  className="h-auto p-0 font-medium text-neutral-400 hover:text-white"
                >
                  Counted Qty
                  {getSortIcon("countedQty")}
                </Button>
              </TableHead>
              <TableHead className="text-neutral-400 w-28">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("variance")}
                  className="h-auto p-0 font-medium text-neutral-400 hover:text-white"
                >
                  Variance
                  {getSortIcon("variance")}
                </Button>
              </TableHead>
              <TableHead className="text-neutral-400 w-24">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("variancePercent")}
                  className="h-auto p-0 font-medium text-neutral-400 hover:text-white"
                >
                  %
                  {getSortIcon("variancePercent")}
                </Button>
              </TableHead>
              <TableHead className="text-neutral-400 w-32">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("varianceCost")}
                  className="h-auto p-0 font-medium text-neutral-400 hover:text-white"
                >
                  Cost
                  {getSortIcon("varianceCost")}
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedItems.map((item) => {
              const VarianceIcon = getVarianceIcon(item.variance);
              const isExceedingThreshold = exceedsThreshold(item);
              
              return (
                <TableRow
                  key={item.id}
                  className={`border-white/10 ${
                    isExceedingThreshold 
                      ? "bg-red-500/10 hover:bg-red-500/15" 
                      : "hover:bg-neutral-900/50"
                  }`}
                >
                  {/* Item Info */}
                  <TableCell>
                    <div className="flex items-start gap-2">
                      {isExceedingThreshold && (
                        <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="text-white font-medium">{item.stockItem.name}</p>
                        <div className="flex items-center gap-2 text-xs text-neutral-500 flex-wrap">
                          <span className="font-mono">{item.stockItem.itemCode}</span>
                          {item.batch && (
                            <Badge variant="outline" className="text-xs border-white/10">
                              Batch: {item.batch.batchNumber}
                            </Badge>
                          )}
                          {item.stockItem.category && (
                            <span
                              className="px-1.5 py-0.5 rounded text-xs"
                              style={{
                                backgroundColor: item.stockItem.category.color
                                  ? `${item.stockItem.category.color}20`
                                  : undefined,
                                color: item.stockItem.category.color || undefined,
                              }}
                            >
                              {item.stockItem.category.name}
                            </span>
                          )}
                        </div>
                        {item.notes && (
                          <p className="text-xs text-neutral-500 mt-1 italic">
                            Note: {item.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* System Quantity */}
                  <TableCell>
                    <span className="text-neutral-300">
                      {item.systemQuantity.toFixed(3)} {item.stockItem.primaryUnit.abbreviation}
                    </span>
                  </TableCell>

                  {/* Counted Quantity */}
                  <TableCell>
                    <span className="text-white">
                      {item.countedQuantity !== null
                        ? `${item.countedQuantity.toFixed(3)} ${item.stockItem.primaryUnit.abbreviation}`
                        : "—"}
                    </span>
                  </TableCell>

                  {/* Variance */}
                  <TableCell>
                    <div className={`flex items-center gap-1 ${getVarianceColor(item.variance)}`}>
                      <VarianceIcon className="h-3 w-3" />
                      <span className="font-medium">
                        {item.variance !== null
                          ? `${item.variance > 0 ? "+" : ""}${item.variance.toFixed(3)}`
                          : "—"}
                      </span>
                    </div>
                  </TableCell>

                  {/* Variance Percent */}
                  <TableCell>
                    <span className={`font-medium ${getVarianceColor(item.variancePercent)}`}>
                      {item.variancePercent !== null
                        ? `${item.variancePercent > 0 ? "+" : ""}${item.variancePercent.toFixed(1)}%`
                        : "—"}
                    </span>
                  </TableCell>

                  {/* Variance Cost */}
                  <TableCell>
                    <span className={`font-medium ${getVarianceColor(item.varianceCost)}`}>
                      {item.varianceCost !== null
                        ? formatCurrency(item.varianceCost)
                        : "—"}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredAndSortedItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-neutral-500 py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="h-8 w-8 text-neutral-600" />
                    {searchQuery || filterOption !== "all"
                      ? "No items match your search or filter"
                      : "No items to review"}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Results Count */}
      <div className="text-sm text-neutral-500">
        Showing {filteredAndSortedItems.length} of {items.length} items
      </div>
    </div>
  );
}
