"use client";

import * as React from "react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  DollarSign,
  ChefHat,
  Trash2,
  Search,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Percent,
  CalendarIcon,
} from "lucide-react";
import {
  COGSReport,
  RecipeProfitabilityReport,
  WasteAnalysisReport,
  generateCOGSReport,
  generateRecipeProfitabilityReport,
  generateWasteAnalysisReport,
} from "@/lib/inventory/reporting";
import { WasteType } from "@prisma/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Property {
  id: string;
  name: string;
}

interface WarehouseOption {
  id: string;
  name: string;
  propertyId: string;
}

interface RestaurantReportsClientProps {
  properties: Property[];
  warehouses: WarehouseOption[];
  currentScope: string;
  initialCOGSReport: COGSReport | null;
  initialRecipeProfitability: RecipeProfitabilityReport | null;
  initialWasteAnalysis: WasteAnalysisReport | null;
}

// Helper function to get category color class
function getCategoryColorClass(color: string | null): string {
  if (!color) return "bg-neutral-500/20 text-neutral-400 border-neutral-500/30";
  
  const colorMap: Record<string, string> = {
    orange: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    red: "bg-red-500/20 text-red-400 border-red-500/30",
    green: "bg-green-500/20 text-green-400 border-green-500/30",
    blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    pink: "bg-pink-500/20 text-pink-400 border-pink-500/30",
    yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    cyan: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  };

  return colorMap[color] || "bg-neutral-500/20 text-neutral-400 border-neutral-500/30";
}

const WASTE_TYPE_LABELS: Record<WasteType, string> = {
  SPOILAGE: "Spoilage",
  EXPIRED: "Expired",
  DAMAGED: "Damaged",
  OVERPRODUCTION: "Overproduction",
  PREPARATION_WASTE: "Preparation Waste",
};

const WASTE_TYPE_COLORS: Record<WasteType, string> = {
  SPOILAGE: "bg-red-500/20 text-red-400 border-red-500/30",
  EXPIRED: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  DAMAGED: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  OVERPRODUCTION: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  PREPARATION_WASTE: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};


export function RestaurantReportsClient({
  properties,
  warehouses,
  currentScope,
  initialCOGSReport,
  initialRecipeProfitability,
  initialWasteAnalysis,
}: RestaurantReportsClientProps) {
  const [selectedPropertyId, setSelectedPropertyId] = React.useState<string>(
    currentScope !== "ALL" ? currentScope : properties[0]?.id || ""
  );
  const [selectedWarehouseId, setSelectedWarehouseId] = React.useState<string>(
    warehouses.find((w) => w.propertyId === (currentScope !== "ALL" ? currentScope : properties[0]?.id))?.id || ""
  );

  const [cogsReport, setCOGSReport] = React.useState<COGSReport | null>(initialCOGSReport);
  const [recipeProfitability, setRecipeProfitability] = React.useState<RecipeProfitabilityReport | null>(initialRecipeProfitability);
  const [wasteAnalysis, setWasteAnalysis] = React.useState<WasteAnalysisReport | null>(initialWasteAnalysis);

  const [loadingCOGS, setLoadingCOGS] = React.useState(false);
  const [loadingRecipes, setLoadingRecipes] = React.useState(false);
  const [loadingWaste, setLoadingWaste] = React.useState(false);

  const [cogsStartDate, setCOGSStartDate] = React.useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [cogsEndDate, setCOGSEndDate] = React.useState<Date>(new Date());
  const [wasteStartDate, setWasteStartDate] = React.useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [wasteEndDate, setWasteEndDate] = React.useState<Date>(new Date());

  const [targetFoodCost, setTargetFoodCost] = React.useState<number>(35);
  const [cogsSearch, setCOGSSearch] = React.useState("");
  const [recipeSearch, setRecipeSearch] = React.useState("");
  const [wasteSearch, setWasteSearch] = React.useState("");

  const filteredWarehouses = React.useMemo(() => {
    if (!selectedPropertyId) return warehouses;
    return warehouses.filter((w) => w.propertyId === selectedPropertyId);
  }, [warehouses, selectedPropertyId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(value);
  };

  const formatPercent = (value: number) => `${value.toFixed(2)}%`;

  const formatDateShort = (date: Date) => {
    return new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "numeric" }).format(new Date(date));
  };

  const loadCOGSReport = async () => {
    if (!selectedPropertyId) return;
    setLoadingCOGS(true);
    try {
      const endOfDay = new Date(cogsEndDate);
      endOfDay.setHours(23, 59, 59, 999);
      const report = await generateCOGSReport(selectedPropertyId, cogsStartDate, endOfDay);
      setCOGSReport(report);
      toast.success("COGS report loaded");
    } catch {
      toast.error("Failed to load COGS report");
    } finally {
      setLoadingCOGS(false);
    }
  };

  const loadRecipeProfitability = async () => {
    if (!selectedPropertyId || !selectedWarehouseId) return;
    setLoadingRecipes(true);
    try {
      const report = await generateRecipeProfitabilityReport(selectedPropertyId, selectedWarehouseId, targetFoodCost);
      setRecipeProfitability(report);
      toast.success("Recipe profitability report loaded");
    } catch {
      toast.error("Failed to load recipe profitability report");
    } finally {
      setLoadingRecipes(false);
    }
  };

  const loadWasteAnalysis = async () => {
    if (!selectedPropertyId) return;
    setLoadingWaste(true);
    try {
      const endOfDay = new Date(wasteEndDate);
      endOfDay.setHours(23, 59, 59, 999);
      const report = await generateWasteAnalysisReport(selectedPropertyId, wasteStartDate, endOfDay);
      setWasteAnalysis(report);
      toast.success("Waste analysis report loaded");
    } catch {
      toast.error("Failed to load waste analysis report");
    } finally {
      setLoadingWaste(false);
    }
  };

  const handlePropertyChange = async (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    const firstWarehouse = warehouses.find((w) => w.propertyId === propertyId);
    setSelectedWarehouseId(firstWarehouse?.id || "");
    setCOGSReport(null);
    setRecipeProfitability(null);
    setWasteAnalysis(null);
  };


  const filteredCOGSItems = React.useMemo(() => {
    if (!cogsReport?.items) return [];
    if (!cogsSearch) return cogsReport.items;
    const search = cogsSearch.toLowerCase();
    return cogsReport.items.filter((item) =>
      item.menuItemName.toLowerCase().includes(search) || 
      (typeof item.category === 'string' ? item.category : item.category?.name || '').toLowerCase().includes(search)
    );
  }, [cogsReport, cogsSearch]);

  const filteredRecipeItems = React.useMemo(() => {
    if (!recipeProfitability?.recipes) return [];
    if (!recipeSearch) return recipeProfitability.recipes;
    const search = recipeSearch.toLowerCase();
    return recipeProfitability.recipes.filter((item) =>
      item.recipeName.toLowerCase().includes(search) || item.menuItemName?.toLowerCase().includes(search)
    );
  }, [recipeProfitability, recipeSearch]);

  const filteredWasteItems = React.useMemo(() => {
    if (!wasteAnalysis?.topWastedItems) return [];
    if (!wasteSearch) return wasteAnalysis.topWastedItems;
    const search = wasteSearch.toLowerCase();
    return wasteAnalysis.topWastedItems.filter((item) =>
      item.stockItemName.toLowerCase().includes(search) || item.stockItemSku?.toLowerCase().includes(search) || item.category.name.toLowerCase().includes(search)
    );
  }, [wasteAnalysis, wasteSearch]);

  const showPropertySelector = currentScope === "ALL" && properties.length > 1;


  return (
    <div className="space-y-6">
      {showPropertySelector && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Property:</span>
          <Select value={selectedPropertyId} onValueChange={handlePropertyChange}>
            <SelectTrigger className="w-[250px] bg-neutral-900 border-white/10">
              <SelectValue placeholder="Select property" />
            </SelectTrigger>
            <SelectContent>
              {properties.map((property) => (
                <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Tabs defaultValue="cogs" className="space-y-6">
        <TabsList className="bg-neutral-900 border border-white/10">
          <TabsTrigger value="cogs" className="gap-2">
            <DollarSign className="h-4 w-4" />
            COGS Analysis
          </TabsTrigger>
          <TabsTrigger value="profitability" className="gap-2">
            <ChefHat className="h-4 w-4" />
            Recipe Profitability
          </TabsTrigger>
          <TabsTrigger value="waste" className="gap-2">
            <Trash2 className="h-4 w-4" />
            Waste Analysis
            {wasteAnalysis && wasteAnalysis.overallWastePercentage > 5 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5">{formatPercent(wasteAnalysis.overallWastePercentage)}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* COGS Analysis Tab */}
        <TabsContent value="cogs" className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal bg-neutral-900 border-white/10", !cogsStartDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {cogsStartDate ? format(cogsStartDate, "PPP") : "Start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-neutral-950 border-white/10" align="start">
                <Calendar mode="single" selected={cogsStartDate} onSelect={(date) => date && setCOGSStartDate(date)} initialFocus />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal bg-neutral-900 border-white/10", !cogsEndDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {cogsEndDate ? format(cogsEndDate, "PPP") : "End date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-neutral-950 border-white/10" align="start">
                <Calendar mode="single" selected={cogsEndDate} onSelect={(date) => date && setCOGSEndDate(date)} initialFocus />
              </PopoverContent>
            </Popover>
            <Button onClick={loadCOGSReport} disabled={loadingCOGS} className="bg-orange-600 hover:bg-orange-700">
              {loadingCOGS ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Load Report
            </Button>
          </div>

          {/* Summary Stats */}
          {cogsReport && (
            <div className="grid gap-6 md:grid-cols-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4 text-green-400" />
                  Total Revenue
                </div>
                <div className="text-2xl font-bold text-green-400">{formatCurrency(cogsReport.totalRevenue)}</div>
                <div className="text-xs text-muted-foreground">{formatDateShort(cogsReport.periodStart)} - {formatDateShort(cogsReport.periodEnd)}</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingDown className="h-4 w-4 text-red-400" />
                  Total COGS
                </div>
                <div className="text-2xl font-bold text-red-400">{formatCurrency(cogsReport.totalCOGS)}</div>
                <div className="text-xs text-muted-foreground">Cost of goods sold</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-blue-400" />
                  Gross Profit
                </div>
                <div className="text-2xl font-bold text-blue-400">{formatCurrency(cogsReport.totalGrossProfit)}</div>
                <div className="text-xs text-muted-foreground">Revenue - COGS</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Percent className="h-4 w-4 text-yellow-400" />
                  Food Cost %
                </div>
                <div className={`text-2xl font-bold ${cogsReport.overallFoodCostPercentage > 35 ? "text-red-400" : "text-green-400"}`}>
                  {formatPercent(cogsReport.overallFoodCostPercentage)}
                </div>
                <div className="text-xs text-muted-foreground">Target: &lt;35%</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-purple-400" />
                  Gross Margin
                </div>
                <div className="text-2xl font-bold text-purple-400">{formatPercent(cogsReport.overallGrossMargin)}</div>
                <div className="text-xs text-muted-foreground">Profit margin</div>
              </div>
            </div>
          )}

          {/* COGS by Category */}
          {cogsReport && cogsReport.byCategory.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">COGS by Category</h3>
              <div className="space-y-2">
                {cogsReport.byCategory.map((cat) => (
                  <div key={typeof cat.category === 'string' ? cat.category : cat.category?.id || 'unknown'} className="flex items-center justify-between py-2 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={typeof cat.category === 'object' ? getCategoryColorClass(cat.category?.color) : "bg-neutral-500/20 text-neutral-400 border-neutral-500/30"}>
                        {typeof cat.category === 'string' ? cat.category : cat.category?.name || 'Unknown'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{cat.itemCount} items</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm text-green-400">{formatCurrency(cat.totalRevenue)}</div>
                        <div className="text-xs text-muted-foreground">Revenue</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-red-400">{formatCurrency(cat.totalCOGS)}</div>
                        <div className="text-xs text-muted-foreground">COGS</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm ${cat.foodCostPercentage > 35 ? "text-red-400" : "text-green-400"}`}>{formatPercent(cat.foodCostPercentage)}</div>
                        <div className="text-xs text-muted-foreground">Food Cost</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* COGS Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Menu Item COGS</h3>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search items..." value={cogsSearch} onChange={(e) => setCOGSSearch(e.target.value)} className="pl-8 w-[200px] bg-neutral-900 border-white/10" />
              </div>
            </div>
            <div className="rounded-md border border-white/10">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-neutral-900/50">
                    <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Menu Item</TableHead>
                    <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Category</TableHead>
                    <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">Qty Sold</TableHead>
                    <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">Revenue</TableHead>
                    <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">COGS</TableHead>
                    <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">Profit</TableHead>
                    <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">Food Cost %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!cogsReport ? (
                    <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Click &quot;Load Report&quot; to view COGS analysis</TableCell></TableRow>
                  ) : filteredCOGSItems.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No sales data found for the selected period</TableCell></TableRow>
                  ) : (
                    filteredCOGSItems.map((item) => (
                      <TableRow key={item.menuItemId} className="border-white/10 hover:bg-white/5">
                        <TableCell><div className="font-medium text-sm">{item.menuItemName}</div></TableCell>
                        <TableCell>
                          <Badge variant="outline" className={typeof item.category === 'object' ? getCategoryColorClass(item.category?.color) : "bg-neutral-500/20 text-neutral-400 border-neutral-500/30"}>
                            {typeof item.category === 'string' ? item.category : item.category?.name || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">{item.quantitySold}</TableCell>
                        <TableCell className="text-right text-sm text-green-400">{formatCurrency(item.totalRevenue)}</TableCell>
                        <TableCell className="text-right text-sm text-red-400">{formatCurrency(item.totalCOGS)}</TableCell>
                        <TableCell className="text-right text-sm text-blue-400">{formatCurrency(item.grossProfit)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className={item.foodCostPercentage > 35 ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-green-500/20 text-green-400 border-green-500/30"}>
                            {formatPercent(item.foodCostPercentage)}
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


        {/* Recipe Profitability Tab */}
        <TabsContent value="profitability" className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Warehouse (for cost calculation)</label>
              <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                <SelectTrigger className="w-[200px] bg-neutral-900 border-white/10">
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {filteredWarehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Target Food Cost %</label>
              <Input type="number" value={targetFoodCost} onChange={(e) => setTargetFoodCost(parseInt(e.target.value) || 35)} className="w-[100px] bg-neutral-900 border-white/10" min={1} max={100} />
            </div>
            <Button onClick={loadRecipeProfitability} disabled={loadingRecipes || !selectedWarehouseId} className="bg-orange-600 hover:bg-orange-700">
              {loadingRecipes ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Load Report
            </Button>
          </div>

          {/* Summary Stats */}
          {recipeProfitability && (
            <div className="grid gap-6 md:grid-cols-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ChefHat className="h-4 w-4 text-blue-400" />
                  Total Recipes
                </div>
                <div className="text-2xl font-bold">{recipeProfitability.totalRecipes}</div>
                <div className="text-xs text-muted-foreground">Active recipes</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  Above Target
                </div>
                <div className="text-2xl font-bold text-red-400">{recipeProfitability.recipesAboveTarget}</div>
                <div className="text-xs text-muted-foreground">Exceeding {targetFoodCost}% food cost</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Percent className="h-4 w-4 text-yellow-400" />
                  Avg Food Cost
                </div>
                <div className={`text-2xl font-bold ${recipeProfitability.averageFoodCostPercentage > targetFoodCost ? "text-red-400" : "text-green-400"}`}>
                  {formatPercent(recipeProfitability.averageFoodCostPercentage)}
                </div>
                <div className="text-xs text-muted-foreground">Target: {targetFoodCost}%</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Warehouse</div>
                <div className="text-lg font-bold truncate">{recipeProfitability.warehouseName}</div>
                <div className="text-xs text-muted-foreground">Cost source</div>
              </div>
            </div>
          )}

          {/* Recipe Profitability Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Recipe Profitability</h3>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search recipes..." value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} className="pl-8 w-[200px] bg-neutral-900 border-white/10" />
              </div>
            </div>
            <div className="rounded-md border border-white/10">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-neutral-900/50">
                    <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Recipe</TableHead>
                    <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Menu Item</TableHead>
                    <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">Yield</TableHead>
                    <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">Recipe Cost</TableHead>
                    <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">Cost/Portion</TableHead>
                    <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">Selling Price</TableHead>
                    <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">Food Cost %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!recipeProfitability ? (
                    <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Select a warehouse and click &quot;Load Report&quot; to view recipe profitability</TableCell></TableRow>
                  ) : filteredRecipeItems.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No recipes found</TableCell></TableRow>
                  ) : (
                    filteredRecipeItems.map((recipe) => (
                      <TableRow key={recipe.recipeId} className="border-white/10 hover:bg-white/5">
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm">{recipe.recipeName}</div>
                            <div className="text-xs text-muted-foreground">{recipe.ingredientCount} ingredients</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-neutral-300">{recipe.menuItemName || "—"}</TableCell>
                        <TableCell className="text-right text-sm">{recipe.yield}</TableCell>
                        <TableCell className="text-right text-sm text-red-400">{formatCurrency(recipe.recipeCost)}</TableCell>
                        <TableCell className="text-right text-sm text-orange-400">{formatCurrency(recipe.costPerPortion)}</TableCell>
                        <TableCell className="text-right text-sm text-green-400">{recipe.sellingPrice ? formatCurrency(recipe.sellingPrice) : "—"}</TableCell>
                        <TableCell className="text-right">
                          {recipe.foodCostPercentage !== null ? (
                            <Badge variant="outline" className={recipe.isAboveTargetCost ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-green-500/20 text-green-400 border-green-500/30"}>
                              {formatPercent(recipe.foodCostPercentage)}
                            </Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>


        {/* Waste Analysis Tab */}
        <TabsContent value="waste" className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal bg-neutral-900 border-white/10", !wasteStartDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {wasteStartDate ? format(wasteStartDate, "PPP") : "Start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-neutral-950 border-white/10" align="start">
                <Calendar mode="single" selected={wasteStartDate} onSelect={(date) => date && setWasteStartDate(date)} initialFocus />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal bg-neutral-900 border-white/10", !wasteEndDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {wasteEndDate ? format(wasteEndDate, "PPP") : "End date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-neutral-950 border-white/10" align="start">
                <Calendar mode="single" selected={wasteEndDate} onSelect={(date) => date && setWasteEndDate(date)} initialFocus />
              </PopoverContent>
            </Popover>
            <Button onClick={loadWasteAnalysis} disabled={loadingWaste} className="bg-orange-600 hover:bg-orange-700">
              {loadingWaste ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Load Report
            </Button>
          </div>

          {/* Summary Stats */}
          {wasteAnalysis && (
            <div className="grid gap-6 md:grid-cols-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Trash2 className="h-4 w-4 text-red-400" />
                  Total Waste Cost
                </div>
                <div className="text-2xl font-bold text-red-400">{formatCurrency(wasteAnalysis.totalWasteCost)}</div>
                <div className="text-xs text-muted-foreground">{formatDateShort(wasteAnalysis.periodStart)} - {formatDateShort(wasteAnalysis.periodEnd)}</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4 text-blue-400" />
                  Consumption Cost
                </div>
                <div className="text-2xl font-bold text-blue-400">{formatCurrency(wasteAnalysis.totalConsumptionCost)}</div>
                <div className="text-xs text-muted-foreground">Total consumption</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Percent className="h-4 w-4 text-yellow-400" />
                  Waste %
                </div>
                <div className={`text-2xl font-bold ${wasteAnalysis.overallWastePercentage > 5 ? "text-red-400" : "text-green-400"}`}>
                  {formatPercent(wasteAnalysis.overallWastePercentage)}
                </div>
                <div className="text-xs text-muted-foreground">Target: &lt;5%</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 text-orange-400" />
                  Waste Types
                </div>
                <div className="text-2xl font-bold">{wasteAnalysis.byType.length}</div>
                <div className="text-xs text-muted-foreground">Categories of waste</div>
              </div>
            </div>
          )}

          {/* Waste by Type */}
          {wasteAnalysis && wasteAnalysis.byType.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Waste by Type</h3>
              <div className="space-y-2">
                {wasteAnalysis.byType.map((typeData) => (
                  <div key={typeData.type} className="flex items-center justify-between py-2 border-b border-white/5">
                    <Badge variant="outline" className={WASTE_TYPE_COLORS[typeData.type]}>{WASTE_TYPE_LABELS[typeData.type]}</Badge>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm text-red-400">{formatCurrency(typeData.totalCost)}</div>
                        <div className="text-xs text-muted-foreground">Cost</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-neutral-300">{typeData.totalQuantity.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">Quantity</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-yellow-400">{formatPercent(typeData.percentage)}</div>
                        <div className="text-xs text-muted-foreground">% of Total</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Waste by Warehouse */}
          {wasteAnalysis && wasteAnalysis.byWarehouse.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Waste by Warehouse</h3>
              <div className="space-y-2">
                {wasteAnalysis.byWarehouse.map((wh) => (
                  <div key={wh.warehouseId} className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-sm">{wh.warehouseName}</span>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm text-red-400">{formatCurrency(wh.wasteCost)}</div>
                        <div className="text-xs text-muted-foreground">Waste Cost</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm ${wh.wastePercentage > 5 ? "text-red-400" : "text-green-400"}`}>{formatPercent(wh.wastePercentage)}</div>
                        <div className="text-xs text-muted-foreground">Waste %</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}


          {/* Top Wasted Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Top Wasted Items</h3>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search items..." value={wasteSearch} onChange={(e) => setWasteSearch(e.target.value)} className="pl-8 w-[200px] bg-neutral-900 border-white/10" />
              </div>
            </div>
            <div className="rounded-md border border-white/10">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-neutral-900/50">
                    <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Item</TableHead>
                    <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Category</TableHead>
                    <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">Qty Wasted</TableHead>
                    <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">Cost</TableHead>
                    <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">% of Total</TableHead>
                    <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Waste Types</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!wasteAnalysis ? (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Click &quot;Load Report&quot; to view waste analysis</TableCell></TableRow>
                  ) : filteredWasteItems.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No waste records found for the selected period</TableCell></TableRow>
                  ) : (
                    filteredWasteItems.map((item) => (
                      <TableRow key={item.stockItemId} className="border-white/10 hover:bg-white/5">
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
                          }}>{item.category.name}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">{item.totalQuantityWasted.toFixed(2)} {item.unit}</TableCell>
                        <TableCell className="text-right text-sm text-red-400">{formatCurrency(item.totalCostWasted)}</TableCell>
                        <TableCell className="text-right text-sm text-yellow-400">{formatPercent(item.wastePercentage)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {item.byType.map((t) => (
                              <Badge key={t.type} variant="outline" className={`text-xs ${WASTE_TYPE_COLORS[t.type]}`}>{WASTE_TYPE_LABELS[t.type]}</Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Waste Trends */}
          {wasteAnalysis && wasteAnalysis.trends.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Weekly Waste Trends</h3>
              <div className="rounded-md border border-white/10">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-neutral-900/50">
                      <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Period</TableHead>
                      <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">Waste Cost</TableHead>
                      <TableHead className="text-right uppercase tracking-widest text-xs font-medium text-neutral-400">Waste %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wasteAnalysis.trends.map((trend, idx) => (
                      <TableRow key={idx} className="border-white/10 hover:bg-white/5">
                        <TableCell className="text-sm">{trend.period}</TableCell>
                        <TableCell className="text-right text-sm text-red-400">{formatCurrency(trend.wasteCost)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className={trend.wastePercentage > 5 ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-green-500/20 text-green-400 border-green-500/30"}>
                            {formatPercent(trend.wastePercentage)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
