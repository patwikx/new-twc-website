"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  FileText,
  Clock,
  Banknote,
  CreditCard,
  Building2,
  Ticket,
  Gift,
  TrendingUp,
  TrendingDown,
  Minus,
  Printer,
  Download,
} from "lucide-react";
import { getShiftReport, ShiftReport as ShiftReportType } from "@/lib/pos/shift";
import { format } from "date-fns";
import { PaymentMethod } from "@prisma/client";

interface ShiftReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftId: string;
}

const PAYMENT_METHOD_ICONS: Record<PaymentMethod, React.ReactNode> = {
  CASH: <Banknote className="h-4 w-4" />,
  CREDIT_CARD: <CreditCard className="h-4 w-4" />,
  DEBIT_CARD: <CreditCard className="h-4 w-4" />,
  ROOM_CHARGE: <Building2 className="h-4 w-4" />,
  VOUCHER: <Ticket className="h-4 w-4" />,
  COMPLIMENTARY: <Gift className="h-4 w-4" />,
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  ROOM_CHARGE: "Room Charge",
  VOUCHER: "Voucher",
  COMPLIMENTARY: "Complimentary",
};

export function ShiftReport({ open, onOpenChange, shiftId }: ShiftReportProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [report, setReport] = React.useState<ShiftReportType | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Load report data when dialog opens
  React.useEffect(() => {
    if (open && shiftId) {
      loadReport();
    }
  }, [open, shiftId]);

  const loadReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getShiftReport(shiftId);
      if ("error" in result) {
        setError(result.error);
      } else {
        setReport(result.data);
      }
    } catch {
      setError("Failed to load shift report");
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDateTime = (date: Date) => {
    return format(new Date(date), "MMM d, yyyy h:mm a");
  };

  const formatTime = (date: Date) => {
    return format(new Date(date), "h:mm a");
  };

  const formatDuration = (start: Date, end: Date | null) => {
    if (!end) return "Ongoing";
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getVarianceIcon = (variance: number | null) => {
    if (variance === null) return null;
    if (variance > 0.01) return <TrendingUp className="h-4 w-4 text-green-400" />;
    if (variance < -0.01) return <TrendingDown className="h-4 w-4 text-red-400" />;
    return <Minus className="h-4 w-4 text-neutral-400" />;
  };

  const getVarianceColor = (variance: number | null) => {
    if (variance === null) return "text-neutral-400";
    if (variance > 0.01) return "text-green-400";
    if (variance < -0.01) return "text-red-400";
    return "text-neutral-400";
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-neutral-900 border-white/10 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-orange-400" />
            Shift Report
          </DialogTitle>
          {report && (
            <DialogDescription>
              {report.outlet.name} • {report.cashier.name || "Unknown Cashier"}
            </DialogDescription>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={loadReport}
            >
              Retry
            </Button>
          </div>
        ) : report ? (
          <div className="space-y-6 print:space-y-4">
            {/* Shift Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-neutral-800/50 rounded-lg">
                <p className="text-xs text-neutral-500 uppercase tracking-wider">Status</p>
                <Badge
                  variant="outline"
                  className={
                    report.shift.status === "OPEN"
                      ? "bg-green-500/20 text-green-400 border-green-500/30 mt-1"
                      : "bg-neutral-500/20 text-neutral-400 border-neutral-500/30 mt-1"
                  }
                >
                  {report.shift.status}
                </Badge>
              </div>
              <div className="p-3 bg-neutral-800/50 rounded-lg">
                <p className="text-xs text-neutral-500 uppercase tracking-wider">Opened</p>
                <p className="text-sm text-white mt-1">{formatDateTime(report.shift.openedAt)}</p>
              </div>
              <div className="p-3 bg-neutral-800/50 rounded-lg">
                <p className="text-xs text-neutral-500 uppercase tracking-wider">Closed</p>
                <p className="text-sm text-white mt-1">
                  {report.shift.closedAt ? formatDateTime(report.shift.closedAt) : "—"}
                </p>
              </div>
              <div className="p-3 bg-neutral-800/50 rounded-lg">
                <p className="text-xs text-neutral-500 uppercase tracking-wider">Duration</p>
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="h-3.5 w-3.5 text-neutral-400" />
                  <p className="text-sm text-white">
                    {formatDuration(report.shift.openedAt, report.shift.closedAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Cash Summary */}
            <div className="p-4 bg-neutral-800/50 rounded-lg">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Banknote className="h-4 w-4 text-green-400" />
                Cash Summary
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Starting Cash</span>
                  <span className="text-white">{formatCurrency(report.shift.startingCash)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Cash Payments</span>
                  <span className="text-green-400">+{formatCurrency(report.summary.cashPayments)}</span>
                </div>
                <Separator className="bg-white/10" />
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Expected Cash</span>
                  <span className="text-white font-medium">
                    {report.shift.expectedCash !== null
                      ? formatCurrency(report.shift.expectedCash)
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Actual Ending Cash</span>
                  <span className="text-white font-medium">
                    {report.shift.endingCash !== null
                      ? formatCurrency(report.shift.endingCash)
                      : "—"}
                  </span>
                </div>
                <Separator className="bg-white/10" />
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Variance</span>
                  <div className="flex items-center gap-2">
                    {getVarianceIcon(report.shift.variance)}
                    <span className={`font-semibold ${getVarianceColor(report.shift.variance)}`}>
                      {report.shift.variance !== null
                        ? formatCurrency(report.shift.variance)
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sales Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-neutral-800/50 rounded-lg">
                <p className="text-xs text-neutral-500 uppercase tracking-wider">Total Orders</p>
                <p className="text-xl font-semibold text-white mt-1">{report.summary.totalOrders}</p>
              </div>
              <div className="p-3 bg-neutral-800/50 rounded-lg">
                <p className="text-xs text-neutral-500 uppercase tracking-wider">Total Sales</p>
                <p className="text-xl font-semibold text-green-400 mt-1">
                  {formatCurrency(report.summary.totalSales)}
                </p>
              </div>
              <div className="p-3 bg-neutral-800/50 rounded-lg">
                <p className="text-xs text-neutral-500 uppercase tracking-wider">Card Payments</p>
                <p className="text-xl font-semibold text-blue-400 mt-1">
                  {formatCurrency(report.summary.cardPayments)}
                </p>
              </div>
              <div className="p-3 bg-neutral-800/50 rounded-lg">
                <p className="text-xs text-neutral-500 uppercase tracking-wider">Room Charges</p>
                <p className="text-xl font-semibold text-purple-400 mt-1">
                  {formatCurrency(report.summary.roomCharges)}
                </p>
              </div>
            </div>

            {/* Payments by Method */}
            {report.paymentsByMethod.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Payments by Method</h3>
                <div className="rounded-md border border-white/10 bg-neutral-800/30">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-xs text-neutral-400">Method</TableHead>
                        <TableHead className="text-xs text-neutral-400 text-right">Count</TableHead>
                        <TableHead className="text-xs text-neutral-400 text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.paymentsByMethod.map((payment) => (
                        <TableRow key={payment.method} className="border-white/10">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {PAYMENT_METHOD_ICONS[payment.method]}
                              <span className="text-sm text-white">
                                {PAYMENT_METHOD_LABELS[payment.method]}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm text-neutral-300">
                            {payment.count}
                          </TableCell>
                          <TableCell className="text-right text-sm text-white font-medium">
                            {formatCurrency(payment.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Transactions */}
            {report.transactions.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">
                  Transactions ({report.transactions.length})
                </h3>
                <div className="rounded-md border border-white/10 bg-neutral-800/30 max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-xs text-neutral-400">Order #</TableHead>
                        <TableHead className="text-xs text-neutral-400">Time</TableHead>
                        <TableHead className="text-xs text-neutral-400">Status</TableHead>
                        <TableHead className="text-xs text-neutral-400 text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.transactions.map((tx) => (
                        <TableRow key={tx.orderId} className="border-white/10">
                          <TableCell className="text-sm text-white font-mono">
                            {tx.orderNumber}
                          </TableCell>
                          <TableCell className="text-sm text-neutral-300">
                            {formatTime(tx.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                tx.status === "PAID"
                                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                                  : tx.status === "CANCELLED" || tx.status === "VOID"
                                  ? "bg-red-500/20 text-red-400 border-red-500/30"
                                  : "bg-neutral-500/20 text-neutral-400 border-neutral-500/30"
                              }
                            >
                              {tx.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm text-white font-medium">
                            {formatCurrency(tx.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Notes */}
            {report.shift.notes && (
              <div className="p-3 bg-neutral-800/50 rounded-lg">
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Notes</p>
                <p className="text-sm text-neutral-300 whitespace-pre-wrap">{report.shift.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 print:hidden">
              <Button
                variant="outline"
                size="sm"
                className="border-white/10"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-white/10"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
