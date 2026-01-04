"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  RefreshCw,
  CalendarIcon,
  TrendingUp,
  Target,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { CycleCountType } from "@prisma/client";
import { cn } from "@/lib/utils";
import { getInventoryAccuracy, DateRange } from "@/lib/inventory/cycle-count";
import { toast } from "sonner";

// =============================================================================
// Types
// =============================================================================

export interface InventoryAccuracyDataPoint {
  cycleCountId: string;
  countNumber: string;
  completedAt: Date;
  warehouseId: string;
  warehouseName: string;
  type: CycleCountType;
  totalItems: number;
  itemsWithZeroVariance: number;
  accuracyPercent: number;
  totalVarianceCost: number;
}

export interface InventoryAccuracySummary {
  totalCycleCounts: number;
  averageAccuracy: number;
  minAccuracy: number;
  maxAccuracy: number;
  totalVarianceCost: number;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
}

interface WarehouseOption {
  id: string;
  name: string;
}

interface InventoryAccuracyChartProps {
  warehouses: WarehouseOption[];
  initialData?: {
    dataPoints: InventoryAccuracyDataPoint[];
    summary: InventoryAccuracySummary;
  };
}

// =============================================================================
// Constants
// =============================================================================

const COUNT_TYPE_LABELS: Record<CycleCountType, string> = {
  FULL: "Full",
  ABC_CLASS_A: "ABC-A",
  ABC_CLASS_B: "ABC-B",
  ABC_CLASS_C: "ABC-C",
  RANDOM: "Random",
  SPOT: "Spot",
};

const TARGET_ACCURACY = 95; // Target accuracy percentage

// =============================================================================
// Component
// =============================================================================

export function InventoryAccuracyChart({
  warehouses,
  initialData,
}: InventoryAccuracyChartProps) {
  const [selectedWarehouseId, setSelectedWarehouseId] = React.useState<string>("all");
  const [startDate, setStartDate] = React.useState<Date>(
    new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 days ago
  );
  const [endDate, setEndDate] = React.useState<Date>(new Date());
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<{
    dataPoints: InventoryAccuracyDataPoint[];
    summary: InventoryAccuracySummary;
  } | null>(initialData || null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const dateRange: DateRange = {
        start: startDate,
        end: endDate,
      };
      
      const result = await getInventoryAccuracy(
        selectedWarehouseId !== "all" ? selectedWarehouseId : undefined,
        dateRange
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.data) {
        setData(result.data);
        toast.success("Accuracy data loaded");
      }
    } catch {
      toast.error("Failed to load accuracy data");
    } finally {
      setLoading(false);
    }
  };

  // Transform data for chart
  const chartData = React.useMemo(() => {
    if (!data?.dataPoints) return [];
    
    return data.dataPoints.map((point) => ({
      ...point,
      date: format(new Date(point.completedAt), "MMM dd"),
      fullDate: format(new Date(point.completedAt), "MMM dd, yyyy"),
    }));
  }, [data]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof chartData[0] }> }) => {
    if (!active || !payload?.length) return null;
    
    const point = payload[0].payload;
    return (
      <div className="bg-neutral-900 border border-white/10 rounded-lg p-3 shadow-lg">
        <p className="font-medium text-white">{point.countNumber}</p>
        <p className="text-xs text-neutral-400 mb-2">{point.fullDate}</p>
        <div className="space-y-1 text-sm">
          <p className="text-neutral-300">
            Warehouse: <span className="text-white">{point.warehouseName}</span>
          </p>
          <p className="text-neutral-300">
            Type: <span className="text-white">{COUNT_TYPE_LABELS[point.type]}</span>
          </p>
          <p className="text-neutral-300">
            Accuracy: <span className={cn(
              "font-medium",
              point.accuracyPercent >= TARGET_ACCURACY ? "text-green-400" : "text-orange-400"
            )}>{point.accuracyPercent.toFixed(1)}%</span>
          </p>
          <p className="text-neutral-300">
            Items: <span className="text-white">{point.itemsWithZeroVariance}/{point.totalItems}</span>
          </p>
          <p className="text-neutral-300">
            Variance Cost: <span className="text-red-400">{formatCurrency(point.totalVarianceCost)}</span>
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-neutral-900/30 border border-white/5">
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Warehouse</label>
          <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
            <SelectTrigger className="w-[180px] bg-neutral-900 border-white/10">
              <SelectValue placeholder="All Warehouses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Warehouses</SelectItem>
              {warehouses.map((wh) => (
                <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-muted-foreground">Start Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className={cn(
                  "w-[160px] justify-start text-left font-normal bg-neutral-900 border-white/10",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "MMM dd, yyyy") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => date && setStartDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-muted-foreground">End Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className={cn(
                  "w-[160px] justify-start text-left font-normal bg-neutral-900 border-white/10",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "MMM dd, yyyy") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(date) => date && setEndDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <Button onClick={loadData} disabled={loading} className="bg-orange-600 hover:bg-orange-700">
          {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <BarChart3 className="h-4 w-4 mr-2" />}
          Load Data
        </Button>
      </div>

      {/* Summary Stats */}
      {data && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-neutral-900/50 border border-white/10">
            <BarChart3 className="h-8 w-8 text-blue-400" />
            <div>
              <p className="text-sm text-muted-foreground">Cycle Counts</p>
              <p className="text-xl font-bold">{data.summary.totalCycleCounts}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-neutral-900/50 border border-white/10">
            <TrendingUp className={cn(
              "h-8 w-8",
              data.summary.averageAccuracy >= TARGET_ACCURACY ? "text-green-400" : "text-orange-400"
            )} />
            <div>
              <p className="text-sm text-muted-foreground">Avg Accuracy</p>
              <p className={cn(
                "text-xl font-bold",
                data.summary.averageAccuracy >= TARGET_ACCURACY ? "text-green-400" : "text-orange-400"
              )}>
                {data.summary.averageAccuracy.toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-neutral-900/50 border border-white/10">
            <Target className="h-8 w-8 text-purple-400" />
            <div>
              <p className="text-sm text-muted-foreground">Target</p>
              <p className="text-xl font-bold text-purple-400">{TARGET_ACCURACY}%</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-neutral-900/50 border border-white/10">
            <TrendingUp className="h-8 w-8 text-green-400" />
            <div>
              <p className="text-sm text-muted-foreground">Best</p>
              <p className="text-xl font-bold text-green-400">{data.summary.maxAccuracy.toFixed(1)}%</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-neutral-900/50 border border-white/10">
            <AlertTriangle className="h-8 w-8 text-red-400" />
            <div>
              <p className="text-sm text-muted-foreground">Total Variance</p>
              <p className="text-xl font-bold text-red-400">{formatCurrency(data.summary.totalVarianceCost)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="p-4 rounded-lg bg-neutral-900/30 border border-white/5">
        <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-widest mb-4">
          Inventory Accuracy Trend
        </h3>
        
        {!data || chartData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            {loading ? "Loading..." : "Click \"Load Data\" to view accuracy trend"}
          </div>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis 
                  dataKey="date" 
                  stroke="#666"
                  tick={{ fill: '#999', fontSize: 12 }}
                />
                <YAxis 
                  domain={[0, 100]}
                  stroke="#666"
                  tick={{ fill: '#999', fontSize: 12 }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <ReferenceLine 
                  y={TARGET_ACCURACY} 
                  stroke="#a855f7" 
                  strokeDasharray="5 5"
                  label={{ 
                    value: `Target ${TARGET_ACCURACY}%`, 
                    fill: '#a855f7', 
                    fontSize: 12,
                    position: 'right'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="accuracyPercent"
                  name="Accuracy %"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ fill: '#f97316', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#f97316' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Data Table */}
      {data && chartData.length > 0 && (
        <div className="p-4 rounded-lg bg-neutral-900/30 border border-white/5">
          <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-widest mb-4">
            Cycle Count Details
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-neutral-400 font-medium">Count #</th>
                  <th className="text-left py-2 px-3 text-neutral-400 font-medium">Date</th>
                  <th className="text-left py-2 px-3 text-neutral-400 font-medium">Warehouse</th>
                  <th className="text-left py-2 px-3 text-neutral-400 font-medium">Type</th>
                  <th className="text-right py-2 px-3 text-neutral-400 font-medium">Items</th>
                  <th className="text-right py-2 px-3 text-neutral-400 font-medium">Accuracy</th>
                  <th className="text-right py-2 px-3 text-neutral-400 font-medium">Variance Cost</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((point) => (
                  <tr key={point.cycleCountId} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 px-3 font-mono text-xs">{point.countNumber}</td>
                    <td className="py-2 px-3 text-neutral-300">{point.fullDate}</td>
                    <td className="py-2 px-3 text-neutral-300">{point.warehouseName}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-neutral-800">
                        {COUNT_TYPE_LABELS[point.type]}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-neutral-300">
                      {point.itemsWithZeroVariance}/{point.totalItems}
                    </td>
                    <td className={cn(
                      "py-2 px-3 text-right font-medium",
                      point.accuracyPercent >= TARGET_ACCURACY ? "text-green-400" : "text-orange-400"
                    )}>
                      {point.accuracyPercent.toFixed(1)}%
                    </td>
                    <td className="py-2 px-3 text-right text-red-400">
                      {formatCurrency(point.totalVarianceCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
