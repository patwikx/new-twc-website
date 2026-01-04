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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  StopCircle,
  Banknote,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { closeShift, getShiftById } from "@/lib/pos/shift";
import { format } from "date-fns";
import Decimal from "decimal.js";

interface CloseShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftId: string;
  outletName: string;
  startingCash: number;
  openedAt: Date;
}

export function CloseShiftDialog({
  open,
  onOpenChange,
  shiftId,
  outletName,
  startingCash,
  openedAt,
}: CloseShiftDialogProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingData, setIsLoadingData] = React.useState(false);
  const [endingCash, setEndingCash] = React.useState<string>("0.00");
  const [notes, setNotes] = React.useState<string>("");
  const [expectedCash, setExpectedCash] = React.useState<number>(startingCash);
  const [cashPaymentsTotal, setCashPaymentsTotal] = React.useState<number>(0);
  const [closeSuccess, setCloseSuccess] = React.useState(false);
  const [finalVariance, setFinalVariance] = React.useState<number | null>(null);

  // Load shift data when dialog opens
  React.useEffect(() => {
    if (open) {
      setEndingCash("0.00");
      setNotes("");
      setCloseSuccess(false);
      setFinalVariance(null);
      loadShiftData();
    }
  }, [open, shiftId]);

  const loadShiftData = async () => {
    setIsLoadingData(true);
    try {
      const shift = await getShiftById(shiftId);
      if (shift) {
        // Calculate expected cash from orders
        let totalCashPayments = 0;
        for (const order of shift.orders) {
          for (const payment of order.payments) {
            if (payment.method === "CASH") {
              totalCashPayments += new Decimal(payment.amount.toString()).toNumber();
            }
          }
        }
        setCashPaymentsTotal(totalCashPayments);
        setExpectedCash(startingCash + totalCashPayments);
      }
    } catch (error) {
      console.error("Failed to load shift data:", error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDuration = (start: Date) => {
    const diff = Date.now() - new Date(start).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // Calculate variance
  const endingCashNum = parseFloat(endingCash) || 0;
  const variance = endingCashNum - expectedCash;

  const getVarianceIcon = () => {
    if (variance > 0.01) return <TrendingUp className="h-4 w-4 text-green-400" />;
    if (variance < -0.01) return <TrendingDown className="h-4 w-4 text-red-400" />;
    return <Minus className="h-4 w-4 text-neutral-400" />;
  };

  const getVarianceColor = () => {
    if (variance > 0.01) return "text-green-400";
    if (variance < -0.01) return "text-red-400";
    return "text-neutral-400";
  };

  const getVarianceLabel = () => {
    if (variance > 0.01) return "Overage";
    if (variance < -0.01) return "Shortage";
    return "Balanced";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cashAmount = parseFloat(endingCash);
    if (isNaN(cashAmount) || cashAmount < 0) {
      toast.error("Please enter a valid ending cash amount");
      return;
    }

    setIsLoading(true);
    try {
      const result = await closeShift({
        shiftId,
        endingCash: cashAmount,
        notes: notes.trim() || undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setCloseSuccess(true);
      setFinalVariance(variance);
      toast.success("Shift closed successfully");
      router.refresh();
      
      // Close dialog after showing success
      setTimeout(() => {
        onOpenChange(false);
      }, 2000);
    } catch {
      toast.error("Failed to close shift");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-neutral-900 border-white/10 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StopCircle className="h-5 w-5 text-red-400" />
            Close Shift
          </DialogTitle>
          <DialogDescription>
            {outletName} • Started {format(new Date(openedAt), "h:mm a")} ({formatDuration(openedAt)})
          </DialogDescription>
        </DialogHeader>

        {closeSuccess ? (
          <div className="py-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Shift Closed</h3>
            {finalVariance !== null && (
              <div className="flex items-center justify-center gap-2 mt-2">
                {finalVariance > 0.01 ? (
                  <TrendingUp className="h-5 w-5 text-green-400" />
                ) : finalVariance < -0.01 ? (
                  <TrendingDown className="h-5 w-5 text-red-400" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                )}
                <span className={finalVariance > 0.01 ? "text-green-400" : finalVariance < -0.01 ? "text-red-400" : "text-green-400"}>
                  {finalVariance > 0.01 ? `Overage: ${formatCurrency(finalVariance)}` :
                   finalVariance < -0.01 ? `Shortage: ${formatCurrency(Math.abs(finalVariance))}` :
                   "Cash balanced perfectly!"}
                </span>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Shift Summary */}
            <div className="p-3 bg-neutral-800/50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Starting Cash</span>
                <span className="text-white font-medium">{formatCurrency(startingCash)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Cash Payments</span>
                <span className="text-green-400 font-medium">
                  {isLoadingData ? "..." : `+${formatCurrency(cashPaymentsTotal)}`}
                </span>
              </div>
              <Separator className="bg-white/10" />
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Expected Cash</span>
                <span className="text-white font-semibold">
                  {isLoadingData ? "..." : formatCurrency(expectedCash)}
                </span>
              </div>
            </div>

            {/* Ending Cash */}
            <div className="space-y-2">
              <Label htmlFor="endingCash">Actual Ending Cash</Label>
              <div className="relative">
                <Banknote className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                <Input
                  id="endingCash"
                  type="number"
                  step="0.01"
                  min="0"
                  value={endingCash}
                  onChange={(e) => setEndingCash(e.target.value)}
                  className="pl-10 bg-neutral-800 border-white/10 text-lg"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <p className="text-xs text-neutral-500">
                Count all cash in your drawer
              </p>
            </div>

            {/* Variance Display */}
            {endingCashNum > 0 && (
              <div className={`p-3 rounded-lg border ${
                variance > 0.01 ? "bg-green-500/10 border-green-500/30" :
                variance < -0.01 ? "bg-red-500/10 border-red-500/30" :
                "bg-neutral-800/50 border-white/10"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getVarianceIcon()}
                    <span className={`text-sm font-medium ${getVarianceColor()}`}>
                      {getVarianceLabel()}
                    </span>
                  </div>
                  <span className={`text-lg font-semibold ${getVarianceColor()}`}>
                    {variance >= 0 ? "+" : ""}{formatCurrency(variance)}
                  </span>
                </div>
                {Math.abs(variance) > 50 && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    Large variance detected. Please verify your count.
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-neutral-800 border-white/10 min-h-[60px]"
                placeholder="Any notes about this shift..."
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-neutral-400"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || isLoadingData}
                className="bg-red-600 hover:bg-red-700 min-w-[120px]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Closing...
                  </>
                ) : (
                  <>
                    <StopCircle className="h-4 w-4 mr-2" />
                    Close Shift
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
