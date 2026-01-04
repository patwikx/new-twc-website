"use client";

import * as React from "react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  BarChart3,
  Package,
  AlertTriangle,
  Clock,
  Search,
  RefreshCw,
  TrendingDown,
  Warehouse,
  CalendarIcon,
  ArrowUpDown,
  ClipboardCheck,
  Target,
} from "lucide-react";
import {
  StockValuationReport,
  LowStockAlertsReport,
  BatchExpirationReport,
  StockMovementHistoryReport,
  generateStockValuationReport,
  generateLowStockAlertsReport,
  generateBatchExpirationReport,
  generateStockMovementHistoryReport,
} from "@/lib/inventory/reporting";
import { MovementType } from "@prisma/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { InventoryAccuracyChart } from "@/components/admin/inventory/inventory-accuracy-chart";
import {
  getCycleCounts,
  getVarianceAnalysis,
  type DateRange,
} from "@/lib/inventory/cycle-count";

interface Property {
  id: string;
  name: string;
}

interface WarehouseOption {
  id: string;
  name: string;
  propertyId: string;
}

interface InventoryReportsClientProps {
  properties: Property[];
  warehouses: WarehouseOption[];
  currentScope: string;
  initialStockValuation: StockValuationReport | null;
  initialLowStockAlerts: LowStockAlertsReport | null;
  initialBatchExpiration: BatchExpirationReport | null;
}

const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  RECEIPT: "Receipt",
  TRANSFER_IN: "Transfer In",
  TRANSFER_OUT: "Transfer Out",
  CONSUMPTION: "Consumption",
  ADJUSTMENT: "Adjustment",
  RETURN: "Return",
  WASTE: "Waste",
};

const MOVEMENT_TYPE_COLORS: Record<MovementType, string> = {
  RECEIPT: "bg-green-500/20 text-green-400 border-green-500/30",
  TRANSFER_IN: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  TRANSFER_OUT: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  CONSUMPTION: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  ADJUSTMENT: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  RETURN: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  WASTE: "bg-red-500/20 text-red-400 border-red-500/30",
};

export function InventoryReportsClient({
  properties,
  warehouses,
  currentScope,
  initialStockValuation,
  initialLowStockAlerts,
  initialBatchExpiration,
}: InventoryReportsClientProps) {
  const [selectedPropertyId, setSelectedPropertyId] = React.useState<string>(
    currentScope !== "ALL" ? currentScope : properties[0]?.id || ""
  );

  const [stockValuation, setStockValuation] = React.useState<StockValuationReport | null>(
    initialStockValuation
  );
  const [lowStockAlerts, setLowStockAlerts] = React.useState<LowStockAlertsReport | null>(
    initialLowStockAlerts
  );
  const [batchExpiration, setBatchExpiration] = React.useState<BatchExpirationReport | null>(
    initialBatchExpiration
  );
  const [movementHistory, setMovementHistory] = React.useState<StockMovementHistoryReport | null>(
    null
  );

  const [loadingValuation, setLoadingValuation] = React.useState(false);
  const [loadingLowStock, setLoadingLowStock] = React.useState(false);
  const [loadingExpiration, setLoadingExpiration] = React.useState(false);
  const [loadingMovements, setLoadingMovements] = React.useState(false);

  const [movementWarehouseId, setMovementWarehouseId] = React.useState<string>("all");
  const [movementType, setMovementType] = React.useState<string>("all");
  const [movementStartDate, setMovementStartDate] = React.useState<Date>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
  const [movementEndDate, setMovementEndDate] = React.useState<Date>(new Date());

  const [expirationDays, setExpirationDays] = React.useState<number>(30);

  const [valuationSearch, setValuationSearch] = React.useState("");
  const [lowStockSearch, setLowStockSearch] = React.useState("");
  const [expirationSearch, setExpirationSearch] = React.useState("");

  const filteredWarehouses = React.useMemo(() => {
    if (!selectedPropertyId) return warehouses;
    return warehouses.filter((w) => w.propertyId === selectedPropertyId);
  }, [warehouses, selectedPropertyId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const formatDateShort = (date: Date) => {
    return new Intl.DateTimeFormat("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(date));
  };


  const refreshStockValuation = async () => {
    if (!selectedPropertyId) return;
    setLoadingValuation(true);
    try {
      const report = await generateStockValuationReport(selectedPropertyId);
      setStockValuation(report);
      toast.success("Stock valuation report refreshed");
    } catch {
      toast.error("Failed to refresh stock valuation report");
    } finally {
      setLoadingValuation(false);
    }
  };

  const refreshLowStockAlerts = async () => {
    if (!selectedPropertyId) return;
    setLoadingLowStock(true);
    try {
      const report = await generateLowStockAlertsReport(selectedPropertyId);
      setLowStockAlerts(report);
      toast.success("Low stock alerts refreshed");
    } catch {
      toast.error("Failed to refresh low stock alerts");
    } finally {
      setLoadingLowStock(false);
    }
  };

  const refreshBatchExpiration = async () => {
    if (!selectedPropertyId) return;
    setLoadingExpiration(true);
    try {
      const report = await generateBatchExpirationReport(selectedPropertyId, expirationDays);
      setBatchExpiration(report);
      toast.success("Expiration alerts refreshed");
    } catch {
      toast.error("Failed to refresh expiration alerts");
    } finally {
      setLoadingExpiration(false);
    }
  };

  const loadMovementHistory = async () => {
    if (!selectedPropertyId) return;
    setLoadingMovements(true);
    try {
      const endOfDay = new Date(movementEndDate);
      endOfDay.setHours(23, 59, 59, 999);
      const report = await generateStockMovementHistoryReport({
        propertyId: selectedPropertyId,
        warehouseId: movementWarehouseId !== "all" ? movementWarehouseId : undefined,
        type: movementType !== "all" ? (movementType as MovementType) : undefined,
        startDate: movementStartDate,
        endDate: endOfDay,
        page: 1,
        pageSize: 100,
      });
      setMovementHistory(report);
      toast.success("Movement history loaded");
    } catch {
      toast.error("Failed to load movement history");
    } finally {
      setLoadingMovements(false);
    }
  };

  const handlePropertyChange = async (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setMovementWarehouseId("all");
    
    setLoadingValuation(true);
    setLoadingLowStock(true);
    setLoadingExpiration(true);
    
    try {
      const [valuation, lowStock, expiration] = await Promise.all([
        generateStockValuationReport(propertyId),
        generateLowStockAlertsReport(propertyId),
        generateBatchExpirationReport(propertyId, expirationDays),
      ]);
      setStockValuation(valuation);
      setLowStockAlerts(lowStock);
      setBatchExpiration(expiration);
      setMovementHistory(null);
    } catch {
      toast.error("Failed to load reports for selected property");
    } finally {
      setLoadingValuation(false);
      setLoadingLowStock(false);
      setLoadingExpiration(false);
    }
  };

  const filteredValuationItems = React.useMemo(() => {
    if (!stockValuation?.items) return [];
    if (!valuationSearch) return stockValuation.items;
    const search = valuationSearch.toLowerCase();
    return stockValuation.items.filter(
      (item) =>
        item.stockItemName.toLowerCase().includes(search) ||
        item.stockItemSku?.toLowerCase().includes(search) ||
        item.warehouseName.toLowerCase().includes(search) ||
        item.category.name.toLowerCase().includes(search)
    );
  }, [stockValuation, valuationSearch]);

  const filteredLowStockItems = React.useMemo(() => {
    if (!lowStockAlerts?.alerts) return [];
    if (!lowStockSearch) return lowStockAlerts.alerts;
    const search = lowStockSearch.toLowerCase();
    return lowStockAlerts.alerts.filter(
      (item) =>
        item.stockItemName.toLowerCase().includes(search) ||
        item.stockItemSku?.toLowerCase().includes(search) ||
        item.warehouseName.toLowerCase().includes(search) ||
        item.category.name.toLowerCase().includes(search)
    );
  }, [lowStockAlerts, lowStockSearch]);

  const filteredExpirationItems = React.useMemo(() => {
    if (!batchExpiration?.batches) return [];
    if (!expirationSearch) return batchExpiration.batches;
    const search = expirationSearch.toLowerCase();
    return batchExpiration.batches.filter(
      (item) =>
        item.stockItemName.toLowerCase().includes(search) ||
        item.stockItemSku?.toLowerCase().includes(search) ||
        item.warehouseName.toLowerCase().includes(search) ||
        item.batchNumber.toLowerCase().includes(search)
    );
  }, [batchExpiration, expirationSearch]);

  const showPropertySelector = currentScope === "ALL" && properties.length > 1;


  return (
    <div className="space-y-4">
      {/* Property Selector */}
      {showPropertySelector && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Property:</span>
          <Select value={selectedPropertyId} onValueChange={handlePropertyChange}>
            <SelectTrigger className="w-[250px] bg-neutral-900 border-white/10">
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
      )}

      <Tabs defaultValue="valuation" className="space-y-4">
        <TabsList className="bg-neutral-900 border border-white/10">
          <TabsTrigger value="valuation" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Stock Valuation
          </TabsTrigger>
          <TabsTrigger value="movements" className="gap-2">
            <ArrowUpDown className="h-4 w-4" />
            Movement History
          </TabsTrigger>
          <TabsTrigger value="low-stock" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Low Stock Alerts
            {lowStockAlerts && lowStockAlerts.totalAlerts > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                {lowStockAlerts.totalAlerts}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="expiration" className="gap-2">
            <Clock className="h-4 w-4" />
            Expiration Alerts
            {batchExpiration && (batchExpiration.expiredBatches + batchExpiration.criticalBatches) > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                {batchExpiration.expiredBatches + batchExpiration.criticalBatches}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="cycle-counts" className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Cycle Counts
          </TabsTrigger>
        </TabsList>

        {/* Stock Valuation Tab */}
        <TabsContent value="valuation" className="space-y-4">
          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-neutral-900/50 border border-white/10">
              <BarChart3 className="h-8 w-8 text-green-400" />
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-xl font-bold text-green-400">
                  {stockValuation ? formatCurrency(stockValuation.totalValue) : "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-neutral-900/50 border border-white/10">
              <Warehouse className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-sm text-muted-foreground">Warehouses</p>
                <p className="text-xl font-bold">{stockValuation?.byWarehouse.length || 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-neutral-900/50 border border-white/10">
              <Package className="h-8 w-8 text-purple-400" />
              <div>
                <p className="text-sm text-muted-foreground">Stock Items</p>
                <p className="text-xl font-bold">{stockValuation?.items.length || 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-neutral-900/50 border border-white/10">
              <TrendingDown className="h-8 w-8 text-orange-400" />
              <div>
                <p className="text-sm text-muted-foreground">Categories</p>
                <p className="text-xl font-bold">{stockValuation?.byCategory.length || 0}</p>
              </div>
            </div>
          </div>

          {/* Value by Warehouse */}
          {stockValuation && stockValuation.byWarehouse.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-widest">Value by Warehouse</h3>
              <div className="space-y-2">
                {stockValuation.byWarehouse.map((wh) => (
                  <div key={wh.warehouseId} className="flex items-center justify-between p-3 rounded-lg bg-neutral-900/30 border border-white/5">
                    <div className="flex items-center gap-3">
                      <Warehouse className="h-4 w-4 text-neutral-400" />
                      <span className="text-sm">{wh.warehouseName}</span>
                      <Badge variant="outline" className="text-xs">{wh.itemCount} items</Badge>
                    </div>
                    <span className="font-medium text-green-400">{formatCurrency(wh.totalValue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stock Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-widest">Stock Items</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search items..."
                    value={valuationSearch}
                    onChange={(e) => setValuationSearch(e.target.value)}
                    className="pl-8 w-[200px] bg-neutral-900 border-white/10"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={refreshStockValuation} disabled={loadingValuation} className="border-white/10">
                  <RefreshCw className={cn("h-4 w-4 mr-2", loadingValuation && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            </div>
            <div className="rounded-md border border-white/10">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-neutral-900/50">
                    <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Item</TableHead>
                    <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Category</TableHead>
                    <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Warehouse</TableHead>
                    <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">Quantity</TableHead>
                    <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">Avg Cost</TableHead>
                    <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">Total Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredValuationItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        {loadingValuation ? "Loading..." : "No stock items found."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredValuationItems.slice(0, 50).map((item, idx) => (
                      <TableRow key={`${item.stockItemId}-${item.warehouseId}-${idx}`} className="border-white/10 hover:bg-white/5">
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm">{item.stockItemName}</div>
                            {item.stockItemSku && <div className="text-xs text-muted-foreground">{item.stockItemSku}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" style={{
                            backgroundColor: item.category.color ? `${item.category.color}20` : undefined,
                            borderColor: item.category.color ? `${item.category.color}50` : undefined,
                            color: item.category.color || undefined,
                          }}>
                            {item.category.name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-neutral-300">{item.warehouseName}</TableCell>
                        <TableCell className="text-right text-sm">{item.quantity.toFixed(2)} {item.unit}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(item.averageCost)}</TableCell>
                        <TableCell className="text-right font-medium text-green-400">{formatCurrency(item.totalValue)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {filteredValuationItems.length > 50 && (
              <p className="text-xs text-muted-foreground">Showing 50 of {filteredValuationItems.length} items</p>
            )}
          </div>
        </TabsContent>


        {/* Movement History Tab */}
        <TabsContent value="movements" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-neutral-900/30 border border-white/5">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Warehouse</label>
              <Select value={movementWarehouseId} onValueChange={setMovementWarehouseId}>
                <SelectTrigger className="w-[180px] bg-neutral-900 border-white/10">
                  <SelectValue placeholder="All Warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {filteredWarehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Movement Type</label>
              <Select value={movementType} onValueChange={setMovementType}>
                <SelectTrigger className="w-[160px] bg-neutral-900 border-white/10">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(MOVEMENT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm text-muted-foreground">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal bg-neutral-900 border-white/10", !movementStartDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {movementStartDate ? format(movementStartDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={movementStartDate} onSelect={(date) => date && setMovementStartDate(date)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm text-muted-foreground">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal bg-neutral-900 border-white/10", !movementEndDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {movementEndDate ? format(movementEndDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={movementEndDate} onSelect={(date) => date && setMovementEndDate(date)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <Button onClick={loadMovementHistory} disabled={loadingMovements} className="bg-orange-600 hover:bg-orange-700">
              {loadingMovements ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Load Report
            </Button>
          </div>

          {/* Movement Summary */}
          {movementHistory && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-neutral-900/50 border border-white/10">
                <ArrowUpDown className="h-8 w-8 text-blue-400" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Movements</p>
                  <p className="text-xl font-bold">{movementHistory.totalMovements}</p>
                </div>
              </div>
              {movementHistory.byType.slice(0, 3).map((typeData) => (
                <div key={typeData.type} className="flex items-center gap-3 p-4 rounded-lg bg-neutral-900/50 border border-white/10">
                  <div>
                    <p className="text-sm text-muted-foreground">{MOVEMENT_TYPE_LABELS[typeData.type]}</p>
                    <p className="text-xl font-bold">{typeData.count}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(typeData.totalValue)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Movement History Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-widest">Movement Records</h3>
            <div className="rounded-md border border-white/10">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-neutral-900/50">
                    <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Date</TableHead>
                    <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Item</TableHead>
                    <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Type</TableHead>
                    <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Warehouse</TableHead>
                    <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">Quantity</TableHead>
                    <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!movementHistory ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Click &quot;Load Report&quot; to view movement history
                      </TableCell>
                    </TableRow>
                  ) : movementHistory.movements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No movements found for the selected criteria
                      </TableCell>
                    </TableRow>
                  ) : (
                    movementHistory.movements.map((movement) => (
                      <TableRow key={movement.id} className="border-white/10 hover:bg-white/5">
                        <TableCell className="text-sm text-neutral-300">{formatDateTime(movement.createdAt)}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm">{movement.stockItemName}</div>
                            {movement.batchNumber && <div className="text-xs text-muted-foreground">Batch: {movement.batchNumber}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={MOVEMENT_TYPE_COLORS[movement.type]}>
                            {MOVEMENT_TYPE_LABELS[movement.type]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {movement.type === "TRANSFER_OUT" && movement.sourceWarehouseName && (
                            <span className="text-orange-400">{movement.sourceWarehouseName}</span>
                          )}
                          {movement.type === "TRANSFER_IN" && movement.destinationWarehouseName && (
                            <span className="text-blue-400">{movement.destinationWarehouseName}</span>
                          )}
                          {movement.type !== "TRANSFER_OUT" && movement.type !== "TRANSFER_IN" && (
                            <span className="text-neutral-300">{movement.sourceWarehouseName || movement.destinationWarehouseName || "—"}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">{movement.quantity.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-sm">{movement.totalCost ? formatCurrency(movement.totalCost) : "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {movementHistory && movementHistory.pagination.totalPages > 1 && (
              <p className="text-xs text-muted-foreground">
                Page {movementHistory.pagination.page} of {movementHistory.pagination.totalPages} ({movementHistory.pagination.total} total)
              </p>
            )}
          </div>
        </TabsContent>


        {/* Low Stock Alerts Tab */}
        <TabsContent value="low-stock" className="space-y-4">
          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-neutral-900/50 border border-white/10">
              <AlertTriangle className="h-8 w-8 text-yellow-400" />
              <div>
                <p className="text-sm text-muted-foreground">Total Alerts</p>
                <p className="text-xl font-bold">{lowStockAlerts?.totalAlerts || 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-neutral-900/50 border border-white/10 border-l-4 border-l-red-500">
              <AlertTriangle className="h-8 w-8 text-red-400" />
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-xl font-bold text-red-400">{lowStockAlerts?.criticalAlerts || 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-neutral-900/50 border border-white/10 border-l-4 border-l-yellow-500">
              <AlertTriangle className="h-8 w-8 text-yellow-400" />
              <div>
                <p className="text-sm text-muted-foreground">Warning</p>
                <p className="text-xl font-bold text-yellow-400">{lowStockAlerts?.warningAlerts || 0}</p>
              </div>
            </div>
          </div>

          {/* Low Stock Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-widest">Low Stock Items</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search items..."
                    value={lowStockSearch}
                    onChange={(e) => setLowStockSearch(e.target.value)}
                    className="pl-8 w-[200px] bg-neutral-900 border-white/10"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={refreshLowStockAlerts} disabled={loadingLowStock} className="border-white/10">
                  <RefreshCw className={cn("h-4 w-4 mr-2", loadingLowStock && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            </div>
            <div className="rounded-md border border-white/10">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-neutral-900/50">
                    <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Item</TableHead>
                    <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Category</TableHead>
                    <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Warehouse</TableHead>
                    <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">Current</TableHead>
                    <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">Par Level</TableHead>
                    <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">Deficit</TableHead>
                    <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLowStockItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        {loadingLowStock ? "Loading..." : "No low stock alerts. All items are above par level."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLowStockItems.map((item, idx) => {
                      const isCritical = item.currentQuantity === 0 || item.deficitPercentage >= 75;
                      return (
                        <TableRow key={`${item.stockItemId}-${item.warehouseId}-${idx}`} className="border-white/10 hover:bg-white/5">
                          <TableCell>
                            <div>
                              <div className="font-medium text-sm">{item.stockItemName}</div>
                              {item.stockItemSku && <div className="text-xs text-muted-foreground">{item.stockItemSku}</div>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" style={{
                              backgroundColor: item.category.color ? `${item.category.color}20` : undefined,
                              borderColor: item.category.color ? `${item.category.color}50` : undefined,
                              color: item.category.color || undefined,
                            }}>
                              {item.category.name}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-neutral-300">{item.warehouseName}</TableCell>
                          <TableCell className={cn("text-right text-sm", isCritical ? "text-red-400" : "text-yellow-400")}>
                            {item.currentQuantity.toFixed(2)} {item.unit}
                          </TableCell>
                          <TableCell className="text-right text-sm text-neutral-300">{item.parLevel.toFixed(2)} {item.unit}</TableCell>
                          <TableCell className="text-right text-sm font-medium text-orange-400">{item.deficit.toFixed(2)} {item.unit}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={isCritical ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"}>
                              {isCritical ? "Critical" : "Warning"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>


        {/* Expiration Alerts Tab */}
        <TabsContent value="expiration" className="space-y-4">
          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-neutral-900/50 border border-white/10">
              <Clock className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-sm text-muted-foreground">Total Batches</p>
                <p className="text-xl font-bold">{batchExpiration?.totalBatches || 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-neutral-900/50 border border-white/10 border-l-4 border-l-red-500">
              <AlertTriangle className="h-8 w-8 text-red-400" />
              <div>
                <p className="text-sm text-muted-foreground">Expired</p>
                <p className="text-xl font-bold text-red-400">{batchExpiration?.expiredBatches || 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-neutral-900/50 border border-white/10 border-l-4 border-l-orange-500">
              <Clock className="h-8 w-8 text-orange-400" />
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-xl font-bold text-orange-400">{batchExpiration?.criticalBatches || 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-neutral-900/50 border border-white/10">
              <TrendingDown className="h-8 w-8 text-yellow-400" />
              <div>
                <p className="text-sm text-muted-foreground">At Risk Value</p>
                <p className="text-xl font-bold text-yellow-400">
                  {batchExpiration ? formatCurrency(batchExpiration.totalAtRiskValue) : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Expiration Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-widest">Expiring Batches</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search batches..."
                    value={expirationSearch}
                    onChange={(e) => setExpirationSearch(e.target.value)}
                    className="pl-8 w-[200px] bg-neutral-900 border-white/10"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Days:</span>
                  <Input
                    type="number"
                    value={expirationDays}
                    onChange={(e) => setExpirationDays(parseInt(e.target.value) || 30)}
                    className="w-[80px] bg-neutral-900 border-white/10"
                    min={1}
                    max={365}
                  />
                </div>
                <Button variant="outline" size="sm" onClick={refreshBatchExpiration} disabled={loadingExpiration} className="border-white/10">
                  <RefreshCw className={cn("h-4 w-4 mr-2", loadingExpiration && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            </div>
            <div className="rounded-md border border-white/10">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-neutral-900/50">
                    <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Item</TableHead>
                    <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Batch</TableHead>
                    <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Warehouse</TableHead>
                    <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">Quantity</TableHead>
                    <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Expiration</TableHead>
                    <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">Value</TableHead>
                    <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpirationItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        {loadingExpiration ? "Loading..." : "No batches expiring within the threshold period."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredExpirationItems.map((batch) => (
                      <TableRow key={batch.batchId} className="border-white/10 hover:bg-white/5">
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm">{batch.stockItemName}</div>
                            {batch.stockItemSku && <div className="text-xs text-muted-foreground">{batch.stockItemSku}</div>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-mono text-neutral-300">{batch.batchNumber}</TableCell>
                        <TableCell className="text-sm text-neutral-300">{batch.warehouseName}</TableCell>
                        <TableCell className="text-right text-sm">{batch.quantity.toFixed(2)} {batch.unit}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="h-3.5 w-3.5 text-neutral-400" />
                            <span className={cn("text-sm",
                              batch.status === "expired" ? "text-red-400" :
                              batch.status === "critical" ? "text-orange-400" : "text-yellow-400"
                            )}>
                              {formatDateShort(batch.expirationDate)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({batch.daysUntilExpiration <= 0 ? "Expired" : `${batch.daysUntilExpiration}d`})
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium text-yellow-400">{formatCurrency(batch.totalValue)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            batch.status === "expired" ? "bg-red-500/20 text-red-400 border-red-500/30" :
                            batch.status === "critical" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" :
                            "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                          }>
                            {batch.status === "expired" ? "Expired" : batch.status === "critical" ? "Critical" : "Warning"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Cycle Counts Tab */}
        <TabsContent value="cycle-counts" className="space-y-4">
          <InventoryAccuracyChart warehouses={filteredWarehouses} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
