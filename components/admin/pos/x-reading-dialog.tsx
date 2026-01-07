"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  Loader2, 
  Download,
  Printer,
  Clock,
  CreditCard,
  Banknote,
  Hotel,
  Percent,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface XReadingData {
  readingNumber: number;
  shiftId: string;
  generatedAt: Date;
  cashierName: string;
  outletName: string;
  shiftStartedAt: Date;
  
  // Totals
  orderCount: number;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  roomChargeSales: number;
  otherSales: number;
  
  // Adjustments
  voidCount: number;
  voidAmount: number;
  discountCount: number;
  discountTotal: number;
  
  // Cash
  startingCash: number;
  expectedCash: number;
}

interface XReadingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftId: string;
  onGenerateReading: () => Promise<XReadingData>;
  onPrint?: (data: XReadingData) => void;
  onDownload?: (data: XReadingData) => void;
}

export function XReadingDialog({
  open,
  onOpenChange,
  shiftId,
  onGenerateReading,
  onPrint,
  onDownload,
}: XReadingDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [readingData, setReadingData] = React.useState<XReadingData | null>(null);

  // Generate reading when dialog opens
  React.useEffect(() => {
    if (open && !readingData) {
      generateReading();
    }
    if (!open) {
      setReadingData(null);
    }
  }, [open]);

  const generateReading = async () => {
    setIsLoading(true);
    try {
      const data = await onGenerateReading();
      setReadingData(data);
    } catch {
      toast.error("Failed to generate X reading");
      onOpenChange(false);
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

  const handlePrint = () => {
    if (!readingData) return;
    
    // Create print-friendly content
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>X Reading #${readingData.readingNumber}</title>
        <style>
          @page { size: 80mm auto; margin: 5mm; }
          body { 
            font-family: 'Courier New', monospace; 
            font-size: 12px; 
            width: 70mm; 
            margin: 0 auto;
            padding: 5mm;
          }
          .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
          .header h2 { margin: 0; font-size: 14px; }
          .header p { margin: 2px 0; }
          .section { margin: 10px 0; }
          .section-title { font-weight: bold; border-bottom: 1px solid #000; margin-bottom: 5px; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; }
          .total { font-weight: bold; border-top: 1px dashed #000; margin-top: 5px; padding-top: 5px; }
          .footer { text-align: center; margin-top: 10px; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>X READING #${readingData.readingNumber}</h2>
          <p><strong>${readingData.outletName}</strong></p>
          <p>${readingData.cashierName}</p>
          <p>${formatDateTime(readingData.generatedAt)}</p>
        </div>
        
        <div class="section">
          <div class="row"><span>Shift Started:</span><span>${formatTime(readingData.shiftStartedAt)}</span></div>
        </div>
        
        <div class="section">
          <div class="section-title">SALES SUMMARY</div>
          <div class="row"><span>Orders:</span><span>${readingData.orderCount}</span></div>
          <div class="row"><span>Cash:</span><span>${formatCurrency(readingData.cashSales)}</span></div>
          <div class="row"><span>Card:</span><span>${formatCurrency(readingData.cardSales)}</span></div>
          <div class="row"><span>Room Charge:</span><span>${formatCurrency(readingData.roomChargeSales)}</span></div>
          <div class="row"><span>Other:</span><span>${formatCurrency(readingData.otherSales)}</span></div>
          <div class="row total"><span>TOTAL SALES:</span><span>${formatCurrency(readingData.totalSales)}</span></div>
        </div>
        
        <div class="section">
          <div class="section-title">ADJUSTMENTS</div>
          <div class="row"><span>Voids (${readingData.voidCount}):</span><span>-${formatCurrency(readingData.voidAmount)}</span></div>
          <div class="row"><span>Discounts (${readingData.discountCount}):</span><span>-${formatCurrency(readingData.discountTotal)}</span></div>
        </div>
        
        <div class="section">
          <div class="section-title">CASH DRAWER</div>
          <div class="row"><span>Starting Cash:</span><span>${formatCurrency(readingData.startingCash)}</span></div>
          <div class="row"><span>+ Cash Sales:</span><span>${formatCurrency(readingData.cashSales)}</span></div>
          <div class="row total"><span>EXPECTED CASH:</span><span>${formatCurrency(readingData.expectedCash)}</span></div>
        </div>
        
        <div class="footer">
          <p>--- INTERIM READING ---</p>
          <p>Shift remains active</p>
        </div>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-neutral-900 border-white/10 max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            X Reading
          </DialogTitle>
          <DialogDescription>
            Interim sales report - does not close the shift
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-400 mb-4" />
            <p className="text-neutral-400">Generating X reading...</p>
          </div>
        ) : readingData ? (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {/* Header Info */}
            <div className="text-center pb-2 border-b border-white/10">
              <Badge variant="outline" className="mb-1">
                X Reading #{readingData.readingNumber}
              </Badge>
              <p className="text-base font-bold text-white">{readingData.outletName}</p>
              <p className="text-sm text-neutral-400">{readingData.cashierName}</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                {formatDateTime(readingData.generatedAt)}
              </p>
            </div>

            {/* Shift Info */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-neutral-400">
                <Clock className="h-4 w-4" />
                <span>Shift started</span>
              </div>
              <span className="text-white">{formatTime(readingData.shiftStartedAt)}</span>
            </div>

            {/* Sales Breakdown */}
            <Card className="bg-neutral-800 border-white/10">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm">Sales Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm px-3 pb-3">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Orders</span>
                  <span className="text-white">{readingData.orderCount}</span>
                </div>
                <Separator className="bg-white/10" />
                <div className="flex justify-between">
                  <div className="flex items-center gap-2 text-neutral-400">
                    <Banknote className="h-3 w-3" />
                    Cash
                  </div>
                  <span className="text-white">{formatCurrency(readingData.cashSales)}</span>
                </div>
                <div className="flex justify-between">
                  <div className="flex items-center gap-2 text-neutral-400">
                    <CreditCard className="h-3 w-3" />
                    Card
                  </div>
                  <span className="text-white">{formatCurrency(readingData.cardSales)}</span>
                </div>
                <div className="flex justify-between">
                  <div className="flex items-center gap-2 text-neutral-400">
                    <Hotel className="h-3 w-3" />
                    Room Charge
                  </div>
                  <span className="text-white">{formatCurrency(readingData.roomChargeSales)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Other</span>
                  <span className="text-white">{formatCurrency(readingData.otherSales)}</span>
                </div>
                <Separator className="bg-white/10" />
                <div className="flex justify-between font-bold">
                  <span className="text-white">Total Sales</span>
                  <span className="text-green-400">{formatCurrency(readingData.totalSales)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Adjustments */}
            <Card className="bg-neutral-800 border-white/10">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm">Adjustments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm px-3 pb-3">
                <div className="flex justify-between">
                  <div className="flex items-center gap-2 text-neutral-400">
                    <Trash2 className="h-3 w-3" />
                    Voids ({readingData.voidCount})
                  </div>
                  <span className="text-red-400">-{formatCurrency(readingData.voidAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <div className="flex items-center gap-2 text-neutral-400">
                    <Percent className="h-3 w-3" />
                    Discounts ({readingData.discountCount})
                  </div>
                  <span className="text-red-400">-{formatCurrency(readingData.discountTotal)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Cash Status */}
            <Card className="bg-neutral-800 border-white/10">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm">Cash Drawer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm px-3 pb-3">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Starting Cash</span>
                  <span className="text-white">{formatCurrency(readingData.startingCash)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">+ Cash Sales</span>
                  <span className="text-green-400">+{formatCurrency(readingData.cashSales)}</span>
                </div>
                <Separator className="bg-white/10" />
                <div className="flex justify-between font-bold">
                  <span className="text-white">Expected Cash</span>
                  <span className="text-white">{formatCurrency(readingData.expectedCash)}</span>
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-neutral-500 text-center">
              This is an interim reading. Your shift remains active.
            </p>
          </div>
        ) : null}

        <DialogFooter className="flex-shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          {readingData && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-white/10"
                onClick={onPrint ? () => onPrint(readingData) : handlePrint}
              >
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              {onDownload && (
                <Button
                  className="bg-orange-600 hover:bg-orange-700"
                  onClick={() => onDownload(readingData)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              )}
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
