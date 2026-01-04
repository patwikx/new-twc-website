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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  RefreshCw,
  Calendar,
  Percent,
  Trash2,
  AlertTriangle,
  ChefHat,
  Package,
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
  getFoodCostTrends,
  getWasteAnalysis,
  type FoodCostTrendsReport,
  type WasteAnalysisReport,
} from "@/lib/analytics/dashboard";
import {
  exportFoodCostToPDF,
  exportFoodCostToCSV,
  exportWasteToPDF,
  exportWasteToCSV,
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
  foodCost: {
    label: "Food Cost %",
    color: "hsl(var(--chart-1))",
  },
  revenue: {
    label: "Revenue",
    color: "hsl(var(--chart-2))",
  },
  cogs: {
    label: "COGS",
    color: "hsl(var(--chart-3))",
  },
  waste: {
    label: "Waste Cost",
    color: "hsl(var(--chart-4))",
  },
};

type DateView = "daily" | "weekly" | "monthly";

function getDateRange(view: DateView): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  switch (view) {
    case "daily":
      start.setDate(start.getDate() - 30);
      break;
    case "weekly":
      start.setDate(start.getDate() - 84);
      break;
    case "monthly":
      start.setMonth(start.getMonth() - 12);
      break;
  }

  return { start, end };
}

export default function AnalyticsDashboardPage() {
  const [foodCostReport, setFoodCostReport] = React.useState<FoodCostTrendsReport | null>(null);
  const [wasteReport, setWasteReport] = React.useState<WasteAnalysisReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [propertyScope, setPropertyScope] = React.useState<string>("all");
  const [dateView, setDateView] = React.useState<DateView>("daily");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const loadReports = React.useCallback(async () => {
    setLoading(true);
    try {
      const scope = propertyScope === "all" ? "ALL" : propertyScope;
      const { start, end } = getDateRange(dateView);
      
      const [foodCost, waste] = await Promise.all([
        getFoodCostTrends(scope === "current" ? "ALL" : scope, start, end, dateView),
        getWasteAnalysis(scope === "current" ? "ALL" : scope, start, end),
      ]);
      
      setFoodCostReport(foodCost);
      setWasteReport(waste);
    } catch (error) {
      console.error("Failed to load analytics reports:", error);
      toast.error("Failed to load analytics dashboard");
    } finally {
      setLoading(false);
    }
  }, [propertyScope, dateView]);

  const handleExportFoodCost = (format: "pdf" | "csv") => {
    if (!foodCostReport) {
      toast.error("No food cost data to export");
      return;
    }
    try {
      if (format === "pdf") {
        exportFoodCostToPDF(foodCostReport);
        toast.success("Food cost PDF exported successfully");
      } else {
        exportFoodCostToCSV(foodCostReport);
        toast.success("Food cost CSV exported successfully");
      }
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export food cost report");
    }
  };

  const handleExportWaste = (format: "pdf" | "csv") => {
    if (!wasteReport) {
      toast.error("No waste data to export");
      return;
    }
    try {
      if (format === "pdf") {
        exportWasteToPDF(wasteReport);
        toast.success("Waste analysis PDF exported successfully");
      } else {
        exportWasteToCSV(wasteReport);
        toast.success("Waste analysis CSV exported successfully");
      }
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export waste report");
    }
  };

  const handleExportAll = (format: "pdf" | "csv") => {
    handleExportFoodCost(format);
    handleExportWaste(format);
  };

  React.useEffect(() => {
    loadReports();
  }, [loadReports]);


  // Prepare food cost trend data for line chart
  const foodCostTrendData = React.useMemo(() => {
    if (!foodCostReport?.trends) return [];
    return foodCostReport.trends.map((t) => ({
      period: t.period,
      displayPeriod: dateView === "daily" 
        ? new Date(t.period).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : dateView === "weekly"
        ? t.period
        : new Date(t.period + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      foodCostPercentage: t.foodCostPercentage,
      grossMargin: t.grossMargin,
      revenue: t.totalRevenue,
      cogs: t.totalCOGS,
      grossProfit: t.grossProfit,
    }));
  }, [foodCostReport, dateView]);

  // Prepare waste trend data for area chart
  const wasteTrendData = React.useMemo(() => {
    if (!wasteReport?.trends) return [];
    return wasteReport.trends.map((t) => ({
      period: t.period,
      displayPeriod: new Date(t.period).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      wasteCost: t.wasteCost,
      wasteQuantity: t.wasteQuantity,
    }));
  }, [wasteReport]);

  // Prepare waste by type data for pie chart
  const wasteByTypePieData = React.useMemo(() => {
    if (!wasteReport?.byType) return [];
    return wasteReport.byType.map((t, index) => ({
      name: t.type.replace(/_/g, " "),
      value: t.totalCost,
      percentage: t.percentage.toFixed(1),
      recordCount: t.recordCount,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [wasteReport]);

  // Prepare waste by category data for bar chart
  const wasteByCategoryData = React.useMemo(() => {
    if (!wasteReport?.byCategory) return [];
    return wasteReport.byCategory.slice(0, 10).map((c) => ({
      name: c.categoryName.length > 15 
        ? c.categoryName.substring(0, 15) + "..." 
        : c.categoryName,
      fullName: c.categoryName,
      value: c.totalCost,
      percentage: c.percentage,
    }));
  }, [wasteReport]);

  // Prepare waste by reason data
  const wasteByReasonData = React.useMemo(() => {
    if (!wasteReport?.byReason) return [];
    return wasteReport.byReason.slice(0, 8);
  }, [wasteReport]);

  // Calculate totals for food cost
  const foodCostTotals = React.useMemo(() => {
    if (!foodCostReport?.trends) return { revenue: 0, cogs: 0, profit: 0 };
    return {
      revenue: foodCostReport.trends.reduce((sum, t) => sum + t.totalRevenue, 0),
      cogs: foodCostReport.trends.reduce((sum, t) => sum + t.totalCOGS, 0),
      profit: foodCostReport.trends.reduce((sum, t) => sum + t.grossProfit, 0),
    };
  }, [foodCostReport]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Food cost trends and waste analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateView} onValueChange={(v) => setDateView(v as DateView)}>
            <SelectTrigger className="w-[140px] bg-neutral-900 border-white/10">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Last 30 Days</SelectItem>
              <SelectItem value="weekly">Last 12 Weeks</SelectItem>
              <SelectItem value="monthly">Last 12 Months</SelectItem>
            </SelectContent>
          </Select>
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
                disabled={loading || (!foodCostReport && !wasteReport)}
                className="border-white/10"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExportAll("pdf")}>
                <FileText className="h-4 w-4 mr-2" />
                Export All as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportAll("csv")}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export All as Excel (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportFoodCost("pdf")}>
                <ChefHat className="h-4 w-4 mr-2" />
                Food Cost PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportWaste("pdf")}>
                <Trash2 className="h-4 w-4 mr-2" />
                Waste Analysis PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={loadReports}
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
            <CardTitle className="text-sm font-medium">Avg Food Cost %</CardTitle>
            <Percent className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-400">
              {loading ? "—" : formatPercent(foodCostReport?.averageFoodCostPercentage || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Target: 28-32%
            </p>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900/50 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              {loading ? "—" : formatCurrency(foodCostTotals.revenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              From menu sales
            </p>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900/50 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Waste Cost</CardTitle>
            <Trash2 className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">
              {loading ? "—" : formatCurrency(wasteReport?.totalWasteCost || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {wasteReport?.totalRecords || 0} waste records
            </p>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900/50 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">
              {loading ? "—" : formatCurrency(foodCostTotals.profit)}
            </div>
            <p className="text-xs text-muted-foreground">
              Revenue - COGS
            </p>
          </CardContent>
        </Card>
      </div>


      {/* Food Cost Trend Chart */}
      <Card className="bg-neutral-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5" />
            Food Cost Percentage Trend
          </CardTitle>
          <CardDescription>
            Track food cost percentage over time (target: 28-32%)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Loading chart...
            </div>
          ) : foodCostTrendData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No food cost data available for this period
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <LineChart data={foodCostTrendData} margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="displayPeriod"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 'auto']}
                  tickFormatter={(value) => `${value}%`}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name, item) => (
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{item.payload.period}</span>
                          <span>Food Cost: {formatPercent(Number(value))}</span>
                          <span>Gross Margin: {formatPercent(item.payload.grossMargin)}</span>
                          <span>Revenue: {formatCurrency(item.payload.revenue)}</span>
                          <span>COGS: {formatCurrency(item.payload.cogs)}</span>
                        </div>
                      )}
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="foodCostPercentage"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="foodCost"
                />
                {/* Reference lines for target range */}
                <Line
                  type="monotone"
                  dataKey={() => 28}
                  stroke="#22c55e"
                  strokeDasharray="5 5"
                  strokeWidth={1}
                  dot={false}
                  name="Target Low"
                />
                <Line
                  type="monotone"
                  dataKey={() => 32}
                  stroke="#22c55e"
                  strokeDasharray="5 5"
                  strokeWidth={1}
                  dot={false}
                  name="Target High"
                />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Revenue vs COGS Chart */}
      <Card className="bg-neutral-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Revenue vs Cost of Goods Sold
          </CardTitle>
          <CardDescription>
            Compare revenue against cost of goods sold over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Loading chart...
            </div>
          ) : foodCostTrendData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No data available for this period
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <AreaChart data={foodCostTrendData} margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="displayPeriod"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <span>
                          {name === "revenue" ? "Revenue" : "COGS"}: {formatCurrency(Number(value))}
                        </span>
                      )}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stackId="1"
                  stroke="hsl(var(--chart-2))"
                  fill="hsl(var(--chart-2))"
                  fillOpacity={0.3}
                  name="revenue"
                />
                <Area
                  type="monotone"
                  dataKey="cogs"
                  stackId="2"
                  stroke="hsl(var(--chart-3))"
                  fill="hsl(var(--chart-3))"
                  fillOpacity={0.3}
                  name="cogs"
                />
                <Legend />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>


      {/* Waste Analysis Section Header */}
      <div className="flex items-center gap-2 pt-4">
        <Trash2 className="h-6 w-6 text-red-400" />
        <h2 className="text-xl font-semibold">Waste Analysis</h2>
      </div>

      {/* Waste Trend Chart */}
      <Card className="bg-neutral-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Waste Cost Trend
          </CardTitle>
          <CardDescription>
            Daily waste cost over the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              Loading chart...
            </div>
          ) : wasteTrendData.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              No waste data available for this period
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <AreaChart data={wasteTrendData} margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="displayPeriod"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={(value) => `₱${value.toLocaleString()}`}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name, item) => (
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{item.payload.period}</span>
                          <span>Waste Cost: {formatCurrency(Number(value))}</span>
                          <span>Quantity: {item.payload.wasteQuantity.toFixed(2)}</span>
                        </div>
                      )}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="wasteCost"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.2}
                  name="waste"
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Waste Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Waste by Type Pie Chart */}
        <Card className="bg-neutral-900/50 border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Waste by Type
            </CardTitle>
            <CardDescription>
              Distribution of waste cost by type
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Loading chart...
              </div>
            ) : wasteByTypePieData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No waste type data available
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <PieChart>
                  <Pie
                    data={wasteByTypePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ percentage }) => `${percentage}%`}
                    labelLine={false}
                  >
                    {wasteByTypePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, _name, item) => (
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{item.payload.name}</span>
                            <span>Cost: {formatCurrency(Number(value))}</span>
                            <span>Share: {item.payload.percentage}%</span>
                            <span>Records: {item.payload.recordCount}</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    formatter={(value) => (
                      <span className="text-xs text-muted-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Waste by Category Bar Chart */}
        <Card className="bg-neutral-900/50 border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Waste by Category
            </CardTitle>
            <CardDescription>
              Top 10 categories by waste cost
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Loading chart...
              </div>
            ) : wasteByCategoryData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No waste category data available
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={wasteByCategoryData} layout="vertical" margin={{ left: 20, right: 20 }}>
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
                        formatter={(value, _name, item) => (
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{item.payload.fullName}</span>
                            <span>Cost: {formatCurrency(Number(value))}</span>
                            <span>Share: {item.payload.percentage.toFixed(1)}%</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>


      {/* Waste by Reason Table */}
      <Card className="bg-neutral-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Waste by Reason
          </CardTitle>
          <CardDescription>
            Breakdown of waste cost by recorded reason
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground">
              Loading...
            </div>
          ) : wasteByReasonData.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground">
              No waste reason data available
            </div>
          ) : (
            <div className="space-y-2">
              {wasteByReasonData.map((item, index) => (
                <div
                  key={item.reason}
                  className="flex items-center justify-between p-3 rounded-lg bg-neutral-800/30 border border-white/5 hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-8 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <div>
                      <p className="font-medium text-sm">{item.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.recordCount} record{item.recordCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Share</p>
                      <Badge variant="outline" className="text-xs">
                        {item.percentage.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="text-right min-w-[100px]">
                      <p className="text-xs text-muted-foreground">Cost</p>
                      <p className="font-bold text-red-400">
                        {formatCurrency(item.totalCost)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Food Cost Period Details */}
      <Card className="bg-neutral-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5" />
            Food Cost Period Details
          </CardTitle>
          <CardDescription>
            Detailed breakdown by period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground">
              Loading...
            </div>
          ) : !foodCostReport?.trends || foodCostReport.trends.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground">
              No food cost data available
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {foodCostReport.trends.slice().reverse().map((item, index) => {
                const isAboveTarget = item.foodCostPercentage > 32;
                const isBelowTarget = item.foodCostPercentage < 28;
                const isOnTarget = !isAboveTarget && !isBelowTarget;
                
                return (
                  <div
                    key={item.period}
                    className="flex items-center justify-between p-3 rounded-lg bg-neutral-800/30 border border-white/5 hover:bg-neutral-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-2 h-8 rounded-full",
                          isOnTarget && "bg-green-500",
                          isAboveTarget && "bg-red-500",
                          isBelowTarget && "bg-yellow-500"
                        )}
                      />
                      <div>
                        <p className="font-medium text-sm">{item.period}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.periodStart).toLocaleDateString()} - {new Date(item.periodEnd).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Revenue</p>
                        <p className="font-medium text-green-400">{formatCurrency(item.totalRevenue)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">COGS</p>
                        <p className="font-medium">{formatCurrency(item.totalCOGS)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Gross Profit</p>
                        <p className="font-medium text-blue-400">{formatCurrency(item.grossProfit)}</p>
                      </div>
                      <div className="text-right min-w-[80px]">
                        <p className="text-xs text-muted-foreground">Food Cost %</p>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs",
                            isOnTarget && "border-green-500 text-green-400",
                            isAboveTarget && "border-red-500 text-red-400",
                            isBelowTarget && "border-yellow-500 text-yellow-400"
                          )}
                        >
                          {formatPercent(item.foodCostPercentage)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Metadata */}
      {(foodCostReport || wasteReport) && (
        <div className="text-xs text-muted-foreground text-center">
          Report generated at {new Date(foodCostReport?.generatedAt || wasteReport?.generatedAt || new Date()).toLocaleString()} • 
          Property: {foodCostReport?.propertyName || wasteReport?.propertyName} •
          Period: {foodCostReport?.periodStart ? new Date(foodCostReport.periodStart).toLocaleDateString() : ""} - {foodCostReport?.periodEnd ? new Date(foodCostReport.periodEnd).toLocaleDateString() : ""}
        </div>
      )}
    </div>
  );
}
