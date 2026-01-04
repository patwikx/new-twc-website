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
} from "recharts";
import {
  Store,
  DollarSign,
  RefreshCw,
  TrendingUp,
  ShoppingCart,
  Receipt,
  Calendar,
  Percent,
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
  getSalesByOutlet,
  type SalesByOutletReport,
} from "@/lib/analytics/dashboard";
import {
  exportSalesToPDF,
  exportSalesToCSV,
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
  sales: {
    label: "Sales",
    color: "hsl(var(--chart-1))",
  },
  orders: {
    label: "Orders",
    color: "hsl(var(--chart-2))",
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

export default function SalesDashboardPage() {
  const [report, setReport] = React.useState<SalesByOutletReport | null>(null);
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

  const loadReport = React.useCallback(async () => {
    setLoading(true);
    try {
      const scope = propertyScope === "all" ? "ALL" : propertyScope;
      const { start, end } = getDateRange(dateView);
      const data = await getSalesByOutlet(scope === "current" ? "ALL" : scope, start, end);
      setReport(data);
    } catch (error) {
      console.error("Failed to load sales report:", error);
      toast.error("Failed to load sales dashboard");
    } finally {
      setLoading(false);
    }
  }, [propertyScope, dateView]);

  const handleExport = (format: "pdf" | "csv") => {
    if (!report) {
      toast.error("No data to export");
      return;
    }
    try {
      if (format === "pdf") {
        exportSalesToPDF(report);
        toast.success("PDF exported successfully");
      } else {
        exportSalesToCSV(report);
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

  // Prepare chart data for bar chart - sales by outlet
  const barChartData = React.useMemo(() => {
    if (!report?.outlets) return [];
    return report.outlets.slice(0, 10).map((o) => ({
      name: o.outletName.length > 15 
        ? o.outletName.substring(0, 15) + "..." 
        : o.outletName,
      fullName: o.outletName,
      sales: o.totalSales,
      orders: o.orderCount,
      type: o.outletType,
      avgOrder: o.averageOrderValue,
    }));
  }, [report]);

  // Prepare chart data for pie chart - sales distribution
  const pieChartData = React.useMemo(() => {
    if (!report?.outlets) return [];
    const total = report.totalSales;
    return report.outlets.slice(0, 8).map((o, index) => ({
      name: o.outletName,
      value: o.totalSales,
      percentage: total > 0 ? ((o.totalSales / total) * 100).toFixed(1) : "0",
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [report]);

  // Prepare daily trend data for line chart
  const trendChartData = React.useMemo(() => {
    if (!report?.dailyTrend) return [];
    return report.dailyTrend.map((d) => ({
      date: d.date,
      displayDate: new Date(d.date).toLocaleDateString("en-US", { 
        month: "short", 
        day: "numeric" 
      }),
      sales: d.sales,
      orders: d.orders,
    }));
  }, [report]);

  // Group outlets by type
  const outletsByType = React.useMemo(() => {
    if (!report?.outlets) return [];
    const typeMap = new Map<string, { count: number; sales: number; orders: number }>();
    
    for (const o of report.outlets) {
      const existing = typeMap.get(o.outletType) || { count: 0, sales: 0, orders: 0 };
      typeMap.set(o.outletType, {
        count: existing.count + 1,
        sales: existing.sales + o.totalSales,
        orders: existing.orders + o.orderCount,
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
          <h1 className="text-3xl font-bold tracking-tight">Sales Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor sales performance across outlets
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
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              {loading ? "—" : formatCurrency(report?.totalSales || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {dateView === "daily" ? "Last 30 days" : dateView === "weekly" ? "Last 12 weeks" : "Last 12 months"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900/50 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "—" : (report?.totalOrders || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Completed orders
            </p>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900/50 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Order</CardTitle>
            <Receipt className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "—" : formatCurrency(report?.averageOrderValue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Per transaction
            </p>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900/50 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Outlets</CardTitle>
            <Store className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "—" : report?.outlets?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              With sales activity
            </p>
          </CardContent>
        </Card>
      </div>


      {/* Sales Trend Chart */}
      <Card className="bg-neutral-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Sales Trend
          </CardTitle>
          <CardDescription>
            Daily sales and order volume over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Loading chart...
            </div>
          ) : trendChartData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No sales data available for this period
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <LineChart data={trendChartData} margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="sales"
                  orientation="left"
                  tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  yAxisId="orders"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <span>
                          {name === "sales" ? formatCurrency(Number(value)) : `${value} orders`}
                        </span>
                      )}
                    />
                  }
                />
                <Line
                  yAxisId="sales"
                  type="monotone"
                  dataKey="sales"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={false}
                  name="sales"
                />
                <Line
                  yAxisId="orders"
                  type="monotone"
                  dataKey="orders"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={false}
                  name="orders"
                />
                <Legend />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Bar Chart - Sales by Outlet */}
        <Card className="bg-neutral-900/50 border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Sales by Outlet
            </CardTitle>
            <CardDescription>
              Top 10 outlets by total sales
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                Loading chart...
              </div>
            ) : barChartData.length === 0 ? (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                No outlet data available
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
                        formatter={(value, _name, item) => (
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{item.payload.fullName}</span>
                            <span>Sales: {formatCurrency(Number(value))}</span>
                            <span>Orders: {item.payload.orders}</span>
                            <span>Avg Order: {formatCurrency(item.payload.avgOrder)}</span>
                            <span>Type: {item.payload.type}</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar dataKey="sales" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart - Sales Distribution */}
        <Card className="bg-neutral-900/50 border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Sales Distribution
            </CardTitle>
            <CardDescription>
              Sales share by outlet
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                Loading chart...
              </div>
            ) : pieChartData.length === 0 ? (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                No outlet data available
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
                    label={({ percentage }) => `${percentage}%`}
                    labelLine={false}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, _name, item) => (
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{item.payload.name}</span>
                            <span>Sales: {formatCurrency(Number(value))}</span>
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
                    formatter={(value) => (
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


      {/* Outlet Type Summary */}
      <Card className="bg-neutral-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Sales by Outlet Type
          </CardTitle>
          <CardDescription>
            Performance breakdown by outlet category
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground">
              Loading...
            </div>
          ) : outletsByType.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground">
              No data available
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {outletsByType.map((item, index) => (
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
                      {item.count} outlet{item.count !== 1 ? "s" : ""} • {item.orders.toLocaleString()} orders
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-400">
                      {formatCurrency(item.sales)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outlet Details Table */}
      <Card className="bg-neutral-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Outlet Performance Details
          </CardTitle>
          <CardDescription>
            Complete breakdown of sales by outlet
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground">
              Loading...
            </div>
          ) : !report?.outlets || report.outlets.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground">
              No outlets found with sales activity
            </div>
          ) : (
            <div className="space-y-2">
              {report.outlets.map((outlet, index) => (
                <div
                  key={outlet.outletId}
                  className="flex items-center justify-between p-3 rounded-lg bg-neutral-800/30 border border-white/5 hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-8 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <div>
                      <p className="font-medium text-sm">{outlet.outletName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {outlet.outletType}
                        </Badge>
                        <span>{outlet.propertyName}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Orders</p>
                      <p className="font-medium">{outlet.orderCount.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Avg Order</p>
                      <p className="font-medium">{formatCurrency(outlet.averageOrderValue)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Tax</p>
                      <p className="font-medium text-xs">{formatCurrency(outlet.taxCollected)}</p>
                    </div>
                    <div className="text-right min-w-[120px]">
                      <p className="text-xs text-muted-foreground">Total Sales</p>
                      <p className="font-bold text-green-400">
                        {formatCurrency(outlet.totalSales)}
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
          Property: {report.propertyName} •
          Period: {new Date(report.periodStart).toLocaleDateString()} - {new Date(report.periodEnd).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
