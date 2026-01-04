"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Warehouse,
  Package,
  DollarSign,
  RefreshCw,
  TrendingUp,
  Building2,
  Download,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getInventoryValueByWarehouse,
  type InventoryValueByWarehouseReport,
} from "@/lib/analytics/dashboard";
import {
  exportInventoryToPDF,
  exportInventoryToCSV,
} from "@/lib/analytics/export";

// Chart colors
const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
];

const chartConfig: ChartConfig = {
  value: {
    label: "Value",
    color: "hsl(var(--chart-1))",
  },
  items: {
    label: "Items",
    color: "hsl(var(--chart-2))",
  },
};

export default function InventoryDashboardPage() {
  const [report, setReport] = React.useState<InventoryValueByWarehouseReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [propertyScope, setPropertyScope] = React.useState<string>("current");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const loadReport = React.useCallback(async () => {
    setLoading(true);
    try {
      // Get property scope from cookie or use "ALL" for super admin
      const scope = propertyScope === "all" ? "ALL" : propertyScope;
      const data = await getInventoryValueByWarehouse(scope === "current" ? "ALL" : scope);
      setReport(data);
    } catch (error) {
      console.error("Failed to load inventory report:", error);
      toast.error("Failed to load inventory dashboard");
    } finally {
      setLoading(false);
    }
  }, [propertyScope]);

  const handleExport = (format: "pdf" | "csv") => {
    if (!report) {
      toast.error("No data to export");
      return;
    }
    try {
      if (format === "pdf") {
        exportInventoryToPDF(report);
        toast.success("PDF exported successfully");
      } else {
        exportInventoryToCSV(report);
        toast.success("CSV exported successfully");
      }
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export report");
    }
  };

  React.useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Prepare chart data for bar chart
  const barChartData = React.useMemo(() => {
    if (!report?.warehouses) return [];
    return report.warehouses.slice(0, 10).map((w) => ({
      name: w.warehouseName.length > 15 
        ? w.warehouseName.substring(0, 15) + "..." 
        : w.warehouseName,
      fullName: w.warehouseName,
      value: w.totalValue,
      items: w.itemCount,
      type: w.warehouseType,
    }));
  }, [report]);

  // Prepare chart data for pie chart
  const pieChartData = React.useMemo(() => {
    if (!report?.warehouses) return [];
    const total = report.totalValue;
    return report.warehouses.slice(0, 8).map((w, index) => ({
      name: w.warehouseName,
      value: w.totalValue,
      percentage: total > 0 ? ((w.totalValue / total) * 100).toFixed(1) : "0",
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [report]);

  // Group warehouses by type
  const warehousesByType = React.useMemo(() => {
    if (!report?.warehouses) return [];
    const typeMap = new Map<string, { count: number; value: number; items: number }>();
    
    for (const w of report.warehouses) {
      const existing = typeMap.get(w.warehouseType) || { count: 0, value: 0, items: 0 };
      typeMap.set(w.warehouseType, {
        count: existing.count + 1,
        value: existing.value + w.totalValue,
        items: existing.items + w.itemCount,
      });
    }
    
    return Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      ...data,
    }));
  }, [report]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor inventory value across warehouses
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={propertyScope} onValueChange={setPropertyScope}>
            <SelectTrigger className="w-[180px] bg-neutral-900 border-white/10">
              <SelectValue placeholder="Select scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current Property</SelectItem>
              <SelectItem value="all">All Properties</SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || !report}
                className="border-white/10"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("pdf")}>
                <FileText className="h-4 w-4 mr-2" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("csv")}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as Excel (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={loadReport}
            disabled={loading}
            className="border-white/10"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-neutral-900/50 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inventory Value</CardTitle>
            <DollarSign className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              {loading ? "—" : formatCurrency(report?.totalValue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all warehouses
            </p>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900/50 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warehouses</CardTitle>
            <Warehouse className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "—" : report?.totalWarehouses || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Active locations
            </p>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900/50 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Items</CardTitle>
            <Package className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "—" : report?.totalItems || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Items with stock
            </p>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900/50 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Value/Warehouse</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading || !report?.totalWarehouses
                ? "—"
                : formatCurrency(report.totalValue / report.totalWarehouses)}
            </div>
            <p className="text-xs text-muted-foreground">
              Per warehouse
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Bar Chart - Value by Warehouse */}
        <Card className="bg-neutral-900/50 border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5" />
              Inventory Value by Warehouse
            </CardTitle>
            <CardDescription>
              Top 10 warehouses by total inventory value
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                Loading chart...
              </div>
            ) : barChartData.length === 0 ? (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                No warehouse data available
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-[350px] w-full">
                <BarChart data={barChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 12 }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name, item) => (
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{item.payload.fullName}</span>
                            <span>Value: {formatCurrency(Number(value))}</span>
                            <span>Items: {item.payload.items}</span>
                            <span>Type: {item.payload.type}</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart - Value Distribution */}
        <Card className="bg-neutral-900/50 border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Value Distribution
            </CardTitle>
            <CardDescription>
              Inventory value share by warehouse
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                Loading chart...
              </div>
            ) : pieChartData.length === 0 ? (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                No warehouse data available
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-[350px] w-full">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percentage }) => `${percentage}%`}
                    labelLine={false}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name, item) => (
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{item.payload.name}</span>
                            <span>Value: {formatCurrency(Number(value))}</span>
                            <span>Share: {item.payload.percentage}%</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    formatter={(value, entry) => (
                      <span className="text-xs text-muted-foreground">
                        {value.length > 20 ? value.substring(0, 20) + "..." : value}
                      </span>
                    )}
                  />
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Warehouse Type Summary */}
      <Card className="bg-neutral-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Value by Warehouse Type
          </CardTitle>
          <CardDescription>
            Inventory distribution across warehouse categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground">
              Loading...
            </div>
          ) : warehousesByType.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground">
              No data available
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {warehousesByType.map((item, index) => (
                <div
                  key={item.type}
                  className="flex items-center gap-3 p-4 rounded-lg bg-neutral-800/50 border border-white/5"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.count} warehouse{item.count !== 1 ? "s" : ""} • {item.items} items
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-400">
                      {formatCurrency(item.value)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Warehouse Details Table */}
      <Card className="bg-neutral-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            Warehouse Details
          </CardTitle>
          <CardDescription>
            Complete breakdown of inventory value by warehouse
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground">
              Loading...
            </div>
          ) : !report?.warehouses || report.warehouses.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground">
              No warehouses found
            </div>
          ) : (
            <div className="space-y-2">
              {report.warehouses.map((warehouse, index) => (
                <div
                  key={warehouse.warehouseId}
                  className="flex items-center justify-between p-3 rounded-lg bg-neutral-800/30 border border-white/5 hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-8 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <div>
                      <p className="font-medium text-sm">{warehouse.warehouseName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {warehouse.warehouseType}
                        </Badge>
                        <span>{warehouse.propertyName}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Items</p>
                      <p className="font-medium">{warehouse.itemCount}</p>
                    </div>
                    <div className="text-right min-w-[120px]">
                      <p className="text-xs text-muted-foreground">Value</p>
                      <p className="font-bold text-green-400">
                        {formatCurrency(warehouse.totalValue)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Metadata */}
      {report && (
        <div className="text-xs text-muted-foreground text-center">
          Report generated at {new Date(report.generatedAt).toLocaleString()} • 
          Property: {report.propertyName}
        </div>
      )}
    </div>
  );
}
