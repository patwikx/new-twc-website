"use client";

import jsPDF from "jspdf";
import type {
  InventoryValueByWarehouseReport,
  SalesByOutletReport,
  FoodCostTrendsReport,
  WasteAnalysisReport,
} from "./dashboard";

// ============================================================================
// Dashboard Export Utilities
// Requirements: 16.5 - Export dashboard data to PDF and Excel formats
// ============================================================================

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(value);
}

/**
 * Format date for display
 */
function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format percentage for display
 */
function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

/**
 * Generate filename with timestamp
 */
function generateFilename(prefix: string, extension: string): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  return `${prefix}_${timestamp}.${extension}`;
}

/**
 * Trigger file download in browser
 */
function downloadFile(content: string | Blob, filename: string, mimeType: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================================
// CSV Export Functions (Excel-compatible)
// ============================================================================

/**
 * Escape CSV field value
 */
function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert array of objects to CSV string
 */
function arrayToCSV(data: Record<string, unknown>[], headers?: string[]): string {
  if (data.length === 0) return "";
  
  const keys = headers || Object.keys(data[0]);
  const headerRow = keys.map(escapeCSV).join(",");
  const dataRows = data.map((row) =>
    keys.map((key) => escapeCSV(row[key] as string | number)).join(",")
  );
  
  return [headerRow, ...dataRows].join("\n");
}

/**
 * Export Inventory Value Report to CSV
 */
export function exportInventoryToCSV(report: InventoryValueByWarehouseReport): void {
  const data = report.warehouses.map((w) => ({
    "Warehouse Name": w.warehouseName,
    "Warehouse Type": w.warehouseType,
    "Property": w.propertyName,
    "Item Count": w.itemCount,
    "Total Value": w.totalValue,
  }));
  
  // Add summary row
  data.push({
    "Warehouse Name": "TOTAL",
    "Warehouse Type": "",
    "Property": report.propertyName,
    "Item Count": report.totalItems,
    "Total Value": report.totalValue,
  });
  
  const csv = arrayToCSV(data);
  const filename = generateFilename("inventory_value_report", "csv");
  downloadFile(csv, filename, "text/csv;charset=utf-8;");
}

/**
 * Export Sales Report to CSV
 */
export function exportSalesToCSV(report: SalesByOutletReport): void {
  const data = report.outlets.map((o) => ({
    "Outlet Name": o.outletName,
    "Outlet Type": o.outletType,
    "Property": o.propertyName,
    "Total Sales": o.totalSales,
    "Order Count": o.orderCount,
    "Average Order": o.averageOrderValue,
    "Tax Collected": o.taxCollected,
    "Service Charge": o.serviceChargeCollected,
    "Discounts Given": o.discountsGiven,
    "Tips Received": o.tipsReceived,
  }));
  
  // Add summary row
  data.push({
    "Outlet Name": "TOTAL",
    "Outlet Type": "",
    "Property": report.propertyName,
    "Total Sales": report.totalSales,
    "Order Count": report.totalOrders,
    "Average Order": report.averageOrderValue,
    "Tax Collected": report.outlets.reduce((sum, o) => sum + o.taxCollected, 0),
    "Service Charge": report.outlets.reduce((sum, o) => sum + o.serviceChargeCollected, 0),
    "Discounts Given": report.outlets.reduce((sum, o) => sum + o.discountsGiven, 0),
    "Tips Received": report.outlets.reduce((sum, o) => sum + o.tipsReceived, 0),
  });
  
  const csv = arrayToCSV(data);
  const filename = generateFilename("sales_report", "csv");
  downloadFile(csv, filename, "text/csv;charset=utf-8;");
}

/**
 * Export Food Cost Trends to CSV
 */
export function exportFoodCostToCSV(report: FoodCostTrendsReport): void {
  const data = report.trends.map((t) => ({
    "Period": t.period,
    "Period Start": formatDate(t.periodStart),
    "Period End": formatDate(t.periodEnd),
    "Total Revenue": t.totalRevenue,
    "Total COGS": t.totalCOGS,
    "Gross Profit": t.grossProfit,
    "Food Cost %": t.foodCostPercentage,
    "Gross Margin %": t.grossMargin,
  }));
  
  const csv = arrayToCSV(data);
  const filename = generateFilename("food_cost_trends", "csv");
  downloadFile(csv, filename, "text/csv;charset=utf-8;");
}

/**
 * Export Waste Analysis to CSV
 */
export function exportWasteToCSV(report: WasteAnalysisReport): void {
  // Export waste by type
  const byTypeData = report.byType.map((t) => ({
    "Type": t.type,
    "Total Cost": t.totalCost,
    "Total Quantity": t.totalQuantity,
    "Percentage": t.percentage,
    "Record Count": t.recordCount,
  }));
  
  // Export waste by category
  const byCategoryData = report.byCategory.map((c) => ({
    "Category": c.categoryName,
    "Total Cost": c.totalCost,
    "Total Quantity": c.totalQuantity,
    "Percentage": c.percentage,
  }));
  
  // Export waste by reason
  const byReasonData = report.byReason.map((r) => ({
    "Reason": r.reason,
    "Total Cost": r.totalCost,
    "Total Quantity": r.totalQuantity,
    "Percentage": r.percentage,
    "Record Count": r.recordCount,
  }));
  
  // Combine all sections
  const sections = [
    "WASTE ANALYSIS REPORT",
    `Property: ${report.propertyName}`,
    `Period: ${formatDate(report.periodStart)} - ${formatDate(report.periodEnd)}`,
    `Total Waste Cost: ${report.totalWasteCost}`,
    `Total Records: ${report.totalRecords}`,
    "",
    "BY TYPE",
    arrayToCSV(byTypeData),
    "",
    "BY CATEGORY",
    arrayToCSV(byCategoryData),
    "",
    "BY REASON",
    arrayToCSV(byReasonData),
  ];
  
  const csv = sections.join("\n");
  const filename = generateFilename("waste_analysis", "csv");
  downloadFile(csv, filename, "text/csv;charset=utf-8;");
}

// ============================================================================
// PDF Export Functions
// ============================================================================

/**
 * Add header to PDF document
 */
function addPDFHeader(doc: jsPDF, title: string, subtitle: string, yPos: number): number {
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, yPos);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, 14, yPos + 7);
  
  doc.setDrawColor(200, 200, 200);
  doc.line(14, yPos + 12, 196, yPos + 12);
  
  return yPos + 20;
}

/**
 * Add table to PDF document
 */
function addPDFTable(
  doc: jsPDF,
  headers: string[],
  rows: string[][],
  yPos: number,
  colWidths: number[]
): number {
  const lineHeight = 7;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;
  
  // Header row
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 5, 182, lineHeight, "F");
  
  let xPos = margin;
  headers.forEach((header, i) => {
    doc.text(header, xPos + 2, yPos);
    xPos += colWidths[i];
  });
  
  yPos += lineHeight;
  
  // Data rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  
  for (const row of rows) {
    // Check if we need a new page
    if (yPos > pageHeight - 20) {
      doc.addPage();
      yPos = 20;
    }
    
    xPos = margin;
    row.forEach((cell, i) => {
      const text = cell.length > 25 ? cell.substring(0, 22) + "..." : cell;
      doc.text(text, xPos + 2, yPos);
      xPos += colWidths[i];
    });
    
    yPos += lineHeight;
  }
  
  return yPos;
}

/**
 * Export Inventory Value Report to PDF
 */
export function exportInventoryToPDF(report: InventoryValueByWarehouseReport): void {
  const doc = new jsPDF();
  
  let yPos = addPDFHeader(
    doc,
    "Inventory Value Report",
    `Property: ${report.propertyName} | Generated: ${formatDate(report.generatedAt)}`,
    20
  );
  
  // Summary section
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", 14, yPos);
  yPos += 8;
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Total Inventory Value: ${formatCurrency(report.totalValue)}`, 14, yPos);
  yPos += 6;
  doc.text(`Total Warehouses: ${report.totalWarehouses}`, 14, yPos);
  yPos += 6;
  doc.text(`Total Items with Stock: ${report.totalItems}`, 14, yPos);
  yPos += 12;
  
  // Warehouse table
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Warehouse Details", 14, yPos);
  yPos += 8;
  
  const headers = ["Warehouse", "Type", "Property", "Items", "Value"];
  const colWidths = [50, 30, 40, 25, 37];
  const rows = report.warehouses.map((w) => [
    w.warehouseName,
    w.warehouseType,
    w.propertyName,
    w.itemCount.toString(),
    formatCurrency(w.totalValue),
  ]);
  
  addPDFTable(doc, headers, rows, yPos, colWidths);
  
  const filename = generateFilename("inventory_value_report", "pdf");
  doc.save(filename);
}

/**
 * Export Sales Report to PDF
 */
export function exportSalesToPDF(report: SalesByOutletReport): void {
  const doc = new jsPDF();
  
  let yPos = addPDFHeader(
    doc,
    "Sales Report",
    `Property: ${report.propertyName} | Period: ${formatDate(report.periodStart)} - ${formatDate(report.periodEnd)}`,
    20
  );
  
  // Summary section
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", 14, yPos);
  yPos += 8;
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Total Sales: ${formatCurrency(report.totalSales)}`, 14, yPos);
  yPos += 6;
  doc.text(`Total Orders: ${report.totalOrders.toLocaleString()}`, 14, yPos);
  yPos += 6;
  doc.text(`Average Order Value: ${formatCurrency(report.averageOrderValue)}`, 14, yPos);
  yPos += 12;
  
  // Outlet table
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Sales by Outlet", 14, yPos);
  yPos += 8;
  
  const headers = ["Outlet", "Type", "Orders", "Avg Order", "Total Sales"];
  const colWidths = [50, 35, 25, 35, 37];
  const rows = report.outlets.map((o) => [
    o.outletName,
    o.outletType,
    o.orderCount.toString(),
    formatCurrency(o.averageOrderValue),
    formatCurrency(o.totalSales),
  ]);
  
  addPDFTable(doc, headers, rows, yPos, colWidths);
  
  const filename = generateFilename("sales_report", "pdf");
  doc.save(filename);
}

/**
 * Export Food Cost Trends to PDF
 */
export function exportFoodCostToPDF(report: FoodCostTrendsReport): void {
  const doc = new jsPDF();
  
  let yPos = addPDFHeader(
    doc,
    "Food Cost Trends Report",
    `Property: ${report.propertyName} | Period: ${formatDate(report.periodStart)} - ${formatDate(report.periodEnd)}`,
    20
  );
  
  // Summary section
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", 14, yPos);
  yPos += 8;
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Average Food Cost Percentage: ${formatPercent(report.averageFoodCostPercentage)}`, 14, yPos);
  yPos += 6;
  doc.text(`Granularity: ${report.granularity}`, 14, yPos);
  yPos += 6;
  doc.text(`Target Range: 28% - 32%`, 14, yPos);
  yPos += 12;
  
  // Trends table
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Period Details", 14, yPos);
  yPos += 8;
  
  const headers = ["Period", "Revenue", "COGS", "Profit", "Food Cost %"];
  const colWidths = [35, 40, 40, 40, 27];
  const rows = report.trends.map((t) => [
    t.period,
    formatCurrency(t.totalRevenue),
    formatCurrency(t.totalCOGS),
    formatCurrency(t.grossProfit),
    formatPercent(t.foodCostPercentage),
  ]);
  
  addPDFTable(doc, headers, rows, yPos, colWidths);
  
  const filename = generateFilename("food_cost_trends", "pdf");
  doc.save(filename);
}

/**
 * Export Waste Analysis to PDF
 */
export function exportWasteToPDF(report: WasteAnalysisReport): void {
  const doc = new jsPDF();
  
  let yPos = addPDFHeader(
    doc,
    "Waste Analysis Report",
    `Property: ${report.propertyName} | Period: ${formatDate(report.periodStart)} - ${formatDate(report.periodEnd)}`,
    20
  );
  
  // Summary section
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", 14, yPos);
  yPos += 8;
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Total Waste Cost: ${formatCurrency(report.totalWasteCost)}`, 14, yPos);
  yPos += 6;
  doc.text(`Total Waste Quantity: ${report.totalWasteQuantity.toFixed(2)}`, 14, yPos);
  yPos += 6;
  doc.text(`Total Records: ${report.totalRecords}`, 14, yPos);
  yPos += 12;
  
  // Waste by Type table
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Waste by Type", 14, yPos);
  yPos += 8;
  
  const typeHeaders = ["Type", "Cost", "Quantity", "Share %", "Records"];
  const typeColWidths = [45, 40, 35, 30, 32];
  const typeRows = report.byType.map((t) => [
    t.type.replace(/_/g, " "),
    formatCurrency(t.totalCost),
    t.totalQuantity.toFixed(2),
    formatPercent(t.percentage),
    t.recordCount.toString(),
  ]);
  
  yPos = addPDFTable(doc, typeHeaders, typeRows, yPos, typeColWidths);
  yPos += 10;
  
  // Check if we need a new page
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }
  
  // Waste by Category table
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Waste by Category (Top 10)", 14, yPos);
  yPos += 8;
  
  const catHeaders = ["Category", "Cost", "Quantity", "Share %"];
  const catColWidths = [60, 45, 40, 37];
  const catRows = report.byCategory.slice(0, 10).map((c) => [
    c.categoryName,
    formatCurrency(c.totalCost),
    c.totalQuantity.toFixed(2),
    formatPercent(c.percentage),
  ]);
  
  yPos = addPDFTable(doc, catHeaders, catRows, yPos, catColWidths);
  yPos += 10;
  
  // Check if we need a new page
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }
  
  // Waste by Reason table
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Waste by Reason (Top 8)", 14, yPos);
  yPos += 8;
  
  const reasonHeaders = ["Reason", "Cost", "Share %", "Records"];
  const reasonColWidths = [70, 45, 35, 32];
  const reasonRows = report.byReason.slice(0, 8).map((r) => [
    r.reason,
    formatCurrency(r.totalCost),
    formatPercent(r.percentage),
    r.recordCount.toString(),
  ]);
  
  addPDFTable(doc, reasonHeaders, reasonRows, yPos, reasonColWidths);
  
  const filename = generateFilename("waste_analysis", "pdf");
  doc.save(filename);
}

// ============================================================================
// Combined Export Types
// ============================================================================

export type ExportFormat = "pdf" | "csv";

export interface ExportOptions {
  format: ExportFormat;
}

/**
 * Export inventory report in specified format
 */
export function exportInventoryReport(
  report: InventoryValueByWarehouseReport,
  options: ExportOptions
): void {
  if (options.format === "pdf") {
    exportInventoryToPDF(report);
  } else {
    exportInventoryToCSV(report);
  }
}

/**
 * Export sales report in specified format
 */
export function exportSalesReport(
  report: SalesByOutletReport,
  options: ExportOptions
): void {
  if (options.format === "pdf") {
    exportSalesToPDF(report);
  } else {
    exportSalesToCSV(report);
  }
}

/**
 * Export food cost report in specified format
 */
export function exportFoodCostReport(
  report: FoodCostTrendsReport,
  options: ExportOptions
): void {
  if (options.format === "pdf") {
    exportFoodCostToPDF(report);
  } else {
    exportFoodCostToCSV(report);
  }
}

/**
 * Export waste report in specified format
 */
export function exportWasteReport(
  report: WasteAnalysisReport,
  options: ExportOptions
): void {
  if (options.format === "pdf") {
    exportWasteToPDF(report);
  } else {
    exportWasteToCSV(report);
  }
}
