// Analytics Module Index
// Re-exports all analytics functions for convenient importing

export {
  // Types
  type WarehouseInventoryValue,
  type InventoryValueByWarehouseReport,
  type OutletSalesData,
  type SalesByOutletReport,
  type FoodCostTrendItem,
  type FoodCostTrendsReport,
  type WasteByTypeData,
  type WasteByCategoryData,
  type WasteByReasonData,
  type WasteAnalysisReport,
  type DashboardSummary,
  
  // Core Functions - Requirements 16.1, 16.2, 16.3, 16.4
  getInventoryValueByWarehouse,
  getSalesByOutlet,
  getFoodCostTrends,
  getWasteAnalysis,
  
  // Multi-Property Consolidation - Requirement 16.6
  getConsolidatedInventoryValue,
  getConsolidatedSales,
  getConsolidatedFoodCostTrends,
  getConsolidatedWasteAnalysis,
  
  // Dashboard Summary
  getDashboardSummary,
  
  // Convenience Functions
  getTodaySales,
  getWeekSales,
  getMonthSales,
  getLast30DaysFoodCostTrends,
  getLast12WeeksFoodCostTrends,
  getLast12MonthsFoodCostTrends,
  getLast30DaysWasteAnalysis,
  getLastMonthWasteAnalysis,
} from "./dashboard";

// Export Functions - Requirement 16.5
export {
  type ExportFormat,
  type ExportOptions,
  exportInventoryToCSV,
  exportInventoryToPDF,
  exportInventoryReport,
  exportSalesToCSV,
  exportSalesToPDF,
  exportSalesReport,
  exportFoodCostToCSV,
  exportFoodCostToPDF,
  exportFoodCostReport,
  exportWasteToCSV,
  exportWasteToPDF,
  exportWasteReport,
} from "./export";
