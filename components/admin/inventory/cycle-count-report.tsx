"use client";

import { useRef } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Printer,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { CycleCountType, CycleCountStatus } from "@prisma/client";

// =============================================================================
// Types
// =============================================================================

export interface CycleCountReportItem {
  id: string;
  stockItemId: string;
  stockItemName: string;
  stockItemCode: string;
  stockItemSku: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  unitName: string;
  unitAbbreviation: string;
  batchId: string | null;
  batchNumber: string | null;
  expirationDate: Date | null;
  systemQuantity: number;
  countedQuantity: number | null;
  variance: number | null;
  variancePercent: number | null;
  unitCost: number | null;
  varianceCost: number | null;
  countedById: string | null;
  countedAt: Date | null;
  notes: string | null;
  adjustmentMade: boolean;
  adjustmentId: string | null;
}

export interface CycleCountReportSummary {
  totalItems: number;
  itemsCounted: number;
  itemsWithVariance: number;
  itemsWithPositiveVariance: number;
  itemsWithNegativeVariance: number;
  totalPositiveVarianceCost: number;
  totalNegativeVarianceCost: number;
  totalAbsoluteVarianceCost: number;
  netVarianceCost: number;
  accuracyPercent: number;
}

export interface CycleCountReportData {
  cycleCount: {
    id: string;
    countNumber: string;
    type: CycleCountType;
    status: CycleCountStatus;
    blindCount: boolean;
    warehouseId: string;
    warehouseName: string;
    warehouseType: string;
    propertyId: string | null;
    propertyName: string | null;
    scheduledAt: Date | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdById: string;
    approvedById: string | null;
    notes: string | null;
    createdAt: Date;
  };
  items: CycleCountReportItem[];
  summary: CycleCountReportSummary;
}

interface CycleCountReportProps {
  report: CycleCountReportData;
}

// =============================================================================
// Constants
// =============================================================================

const COUNT_TYPE_LABELS: Record<CycleCountType, string> = {
  FULL: "Full Count",
  ABC_CLASS_A: "ABC Class A",
  ABC_CLASS_B: "ABC Class B",
  ABC_CLASS_C: "ABC Class C",
  RANDOM: "Random Sample",
  SPOT: "Spot Check",
};

const STATUS_LABELS: Record<CycleCountStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In Progress",
  PENDING_REVIEW: "Pending Review",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

// =============================================================================
// Component
// =============================================================================

export function CycleCountReport({ report }: CycleCountReportProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (value: number | null) => {
    if (value === null) return "—";
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(value);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "—";
    return format(new Date(date), "MMM dd, yyyy");
  };

  const formatDateTime = (date: Date | null) => {
    if (!date) return "—";
    return format(new Date(date), "MMM dd, yyyy HH:mm");
  };

  const getVarianceColor = (variance: number | null) => {
    if (variance === null || variance === 0) return "";
    if (variance > 0) return "text-green-600";
    return "text-red-600";
  };

  const getVarianceIcon = (variance: number | null) => {
    if (variance === null || variance === 0) return Minus;
    if (variance > 0) return TrendingUp;
    return TrendingDown;
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter items with variance for the variance section
  const itemsWithVariance = report.items.filter(
    (item) => item.variance !== null && item.variance !== 0
  );

  return (
    <div className="space-y-4">
      {/* Print Button - Hidden in print */}
      <div className="flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={handlePrint} className="border-white/10">
          <Printer className="h-4 w-4 mr-2" />
          Print Report
        </Button>
      </div>

      {/* Printable Report Content */}
      <div
        ref={printRef}
        className="bg-white text-black p-8 rounded-lg print:p-0 print:rounded-none print:shadow-none"
      >
        {/* Header */}
        <div className="border-b-2 border-black pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">Cycle Count Report</h1>
              <p className="text-gray-600 mt-1">
                {report.cycleCount.propertyName || "Property"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">{report.cycleCount.countNumber}</p>
              <Badge variant="outline" className="mt-1">
                {STATUS_LABELS[report.cycleCount.status]}
              </Badge>
            </div>
          </div>
        </div>

        {/* Count Information */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Warehouse</p>
            <p className="font-medium">{report.cycleCount.warehouseName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Count Type</p>
            <p className="font-medium">{COUNT_TYPE_LABELS[report.cycleCount.type]}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Started</p>
            <p className="font-medium">{formatDateTime(report.cycleCount.startedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Completed</p>
            <p className="font-medium">{formatDateTime(report.cycleCount.completedAt)}</p>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6 print:bg-gray-100">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Summary Statistics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-white rounded border">
              <p className="text-2xl font-bold">{report.summary.totalItems}</p>
              <p className="text-xs text-gray-500">Total Items</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="text-2xl font-bold">{report.summary.itemsCounted}</p>
              <p className="text-xs text-gray-500">Items Counted</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="text-2xl font-bold text-blue-600">
                {report.summary.accuracyPercent.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">Accuracy</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="text-2xl font-bold text-orange-600">
                {report.summary.itemsWithVariance}
              </p>
              <p className="text-xs text-gray-500">Items with Variance</p>
            </div>
          </div>

          {/* Variance Cost Breakdown */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center p-3 bg-green-50 rounded border border-green-200">
              <p className="text-lg font-bold text-green-600">
                {formatCurrency(report.summary.totalPositiveVarianceCost)}
              </p>
              <p className="text-xs text-gray-500">Overage (+{report.summary.itemsWithPositiveVariance} items)</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded border border-red-200">
              <p className="text-lg font-bold text-red-600">
                {formatCurrency(report.summary.totalNegativeVarianceCost)}
              </p>
              <p className="text-xs text-gray-500">Shortage ({report.summary.itemsWithNegativeVariance} items)</p>
            </div>
            <div className="text-center p-3 bg-gray-100 rounded border">
              <p className={`text-lg font-bold ${
                report.summary.netVarianceCost > 0 ? "text-green-600" :
                report.summary.netVarianceCost < 0 ? "text-red-600" : ""
              }`}>
                {formatCurrency(report.summary.netVarianceCost)}
              </p>
              <p className="text-xs text-gray-500">Net Variance</p>
            </div>
          </div>
        </div>

        {/* Items with Variance Table */}
        {itemsWithVariance.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Items with Variance ({itemsWithVariance.length})
            </h2>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs font-semibold">Item</TableHead>
                    <TableHead className="text-xs font-semibold text-right">System Qty</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Counted Qty</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Variance</TableHead>
                    <TableHead className="text-xs font-semibold text-right">%</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Cost Impact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsWithVariance.map((item) => {
                    const VarianceIcon = getVarianceIcon(item.variance);
                    return (
                      <TableRow key={item.id} className="text-sm">
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.stockItemName}</p>
                            <p className="text-xs text-gray-500">
                              {item.stockItemCode}
                              {item.batchNumber && ` • Batch: ${item.batchNumber}`}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.systemQuantity.toFixed(2)} {item.unitAbbreviation}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.countedQuantity?.toFixed(2)} {item.unitAbbreviation}
                        </TableCell>
                        <TableCell className={`text-right ${getVarianceColor(item.variance)}`}>
                          <span className="flex items-center justify-end gap-1">
                            <VarianceIcon className="h-3 w-3" />
                            {item.variance !== null && (
                              <span>{item.variance > 0 ? "+" : ""}{item.variance.toFixed(2)}</span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className={`text-right ${getVarianceColor(item.variancePercent)}`}>
                          {item.variancePercent !== null && (
                            <span>{item.variancePercent > 0 ? "+" : ""}{item.variancePercent.toFixed(1)}%</span>
                          )}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${getVarianceColor(item.varianceCost)}`}>
                          {formatCurrency(item.varianceCost)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* All Items Table */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            All Counted Items ({report.items.length})
          </h2>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-xs font-semibold">Item</TableHead>
                  <TableHead className="text-xs font-semibold">Category</TableHead>
                  <TableHead className="text-xs font-semibold text-right">System</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Counted</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Variance</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.items.map((item) => {
                  const hasVariance = item.variance !== null && item.variance !== 0;
                  return (
                    <TableRow 
                      key={item.id} 
                      className={`text-sm ${hasVariance ? "bg-orange-50" : ""}`}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.stockItemName}</p>
                          <p className="text-xs text-gray-500">
                            {item.stockItemCode}
                            {item.batchNumber && ` • ${item.batchNumber}`}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.categoryName && (
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100">
                            {item.categoryName}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.systemQuantity.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.countedQuantity?.toFixed(2) || "—"}
                      </TableCell>
                      <TableCell className={`text-right ${getVarianceColor(item.variance)}`}>
                        {item.variance !== null ? (
                          <span>{item.variance > 0 ? "+" : ""}{item.variance.toFixed(2)}</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className={`text-right ${getVarianceColor(item.varianceCost)}`}>
                        {formatCurrency(item.varianceCost)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Notes Section */}
        {report.cycleCount.notes && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Notes</h2>
            <div className="bg-gray-50 p-4 rounded-lg border">
              <p className="text-sm whitespace-pre-wrap">{report.cycleCount.notes}</p>
            </div>
          </div>
        )}

        {/* Signatures Section */}
        <div className="mt-8 pt-6 border-t-2 border-black">
          <h2 className="text-lg font-semibold mb-6">Signatures</h2>
          <div className="grid grid-cols-3 gap-8">
            <div>
              <div className="border-b border-black h-12 mb-2"></div>
              <p className="text-sm font-medium">Counted By</p>
              <p className="text-xs text-gray-500">Date: _______________</p>
            </div>
            <div>
              <div className="border-b border-black h-12 mb-2"></div>
              <p className="text-sm font-medium">Verified By</p>
              <p className="text-xs text-gray-500">Date: _______________</p>
            </div>
            <div>
              <div className="border-b border-black h-12 mb-2"></div>
              <p className="text-sm font-medium">Approved By</p>
              <p className="text-xs text-gray-500">Date: _______________</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
          <p>
            Report generated on {format(new Date(), "MMMM dd, yyyy 'at' HH:mm")}
          </p>
          <p className="mt-1">
            {report.cycleCount.countNumber} • {report.cycleCount.warehouseName} • {COUNT_TYPE_LABELS[report.cycleCount.type]}
          </p>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
          [data-print-content],
          [data-print-content] * {
            visibility: visible;
          }
          [data-print-content] {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            margin: 1cm;
            size: A4;
          }
        }
      `}</style>
    </div>
  );
}
