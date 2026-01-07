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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Banknote, 
  Loader2, 
  Check,
  AlertTriangle,
  ArrowRight,
  FileText,
  LogOut,
  User
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ShiftSummary {
  shiftId: string;
  startingCash: number;
  orderCount: number;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  roomChargeSales: number;
  otherSales: number;
  voidCount: number;
  voidAmount: number;
  discountCount: number;
  discountTotal: number;
  expectedCash: number;
}

interface Cashier {
  id: string;
  name: string | null;
}

interface CloseShiftWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftId: string;
  cashierId: string;
  cashierName: string;
  shiftSummary: ShiftSummary;
  availableCashiers?: Cashier[];
  onCloseShift: (data: {
    endingCash: number;
    variance: number;
    notes?: string;
    generateZReading: boolean;
  }) => Promise<void>;
  onHandoverShift?: (data: {
    endingCash: number;
    variance: number;
    notes?: string;
    handoverToId: string;
    handoverNotes?: string;
  }) => Promise<void>;
}

type WizardStep = "cash_count" | "summary" | "options";

const DENOMINATIONS = [
  { value: 1000, label: "₱1,000" },
  { value: 500, label: "₱500" },
  { value: 200, label: "₱200" },
  { value: 100, label: "₱100" },
  { value: 50, label: "₱50" },
  { value: 20, label: "₱20" },
  { value: 10, label: "₱10" },
  { value: 5, label: "₱5" },
  { value: 1, label: "₱1" },
  { value: 0.25, label: "25¢" },
];

export function CloseShiftWizard({
  open,
  onOpenChange,
  shiftId,
  cashierId,
  cashierName,
  shiftSummary,
  availableCashiers = [],
  onCloseShift,
  onHandoverShift,
}: CloseShiftWizardProps) {
  const [step, setStep] = React.useState<WizardStep>("cash_count");
  const [isLoading, setIsLoading] = React.useState(false);
  
  // Cash count state
  const [denomCounts, setDenomCounts] = React.useState<Record<number, number>>({});
  const [notes, setNotes] = React.useState("");
  
  // Handover state
  const [isHandover, setIsHandover] = React.useState(false);
  const [handoverToId, setHandoverToId] = React.useState("");
  const [handoverNotes, setHandoverNotes] = React.useState("");

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setStep("cash_count");
      setDenomCounts({});
      setNotes("");
      setIsHandover(false);
      setHandoverToId("");
      setHandoverNotes("");
    }
  }, [open]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Calculate total from denomination counts
  const totalCashCounted = React.useMemo(() => {
    return DENOMINATIONS.reduce((sum, denom) => {
      const count = denomCounts[denom.value] || 0;
      return sum + (denom.value * count);
    }, 0);
  }, [denomCounts]);

  const variance = totalCashCounted - shiftSummary.expectedCash;
  const hasVariance = Math.abs(variance) >= 0.01;

  const handleDenomChange = (value: number, count: string) => {
    const numCount = parseInt(count) || 0;
    setDenomCounts((prev) => ({ ...prev, [value]: numCount }));
  };

  const handleNext = () => {
    if (step === "cash_count") {
      setStep("summary");
    } else if (step === "summary") {
      setStep("options");
    }
  };

  const handleBack = () => {
    if (step === "summary") {
      setStep("cash_count");
    } else if (step === "options") {
      setStep("summary");
    }
  };

  const handleCloseShift = async () => {
    setIsLoading(true);
    try {
      await onCloseShift({
        endingCash: totalCashCounted,
        variance,
        notes: notes.trim() || undefined,
        generateZReading: true,
      });
      toast.success("Shift closed successfully");
      onOpenChange(false);
    } catch {
      toast.error("Failed to close shift");
    } finally {
      setIsLoading(false);
    }
  };

  const handleHandover = async () => {
    if (!handoverToId) {
      toast.error("Please select a cashier for handover");
      return;
    }
    
    if (!onHandoverShift) {
      toast.error("Handover not available");
      return;
    }

    setIsLoading(true);
    try {
      await onHandoverShift({
        endingCash: totalCashCounted,
        variance,
        notes: notes.trim() || undefined,
        handoverToId,
        handoverNotes: handoverNotes.trim() || undefined,
      });
      toast.success("Shift handed over successfully");
      onOpenChange(false);
    } catch {
      toast.error("Failed to handover shift");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-neutral-900 border-white/10 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5" />
            Close Shift
          </DialogTitle>
          <DialogDescription>
            Count your cash drawer and generate a Z reading to close the shift.
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          {["cash_count", "summary", "options"].map((s, i) => (
            <React.Fragment key={s}>
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium",
                  step === s
                    ? "bg-orange-600 text-white"
                    : ["cash_count", "summary", "options"].indexOf(step) > i
                    ? "bg-green-600 text-white"
                    : "bg-neutral-700 text-neutral-400"
                )}
              >
                {i + 1}
              </div>
              {i < 2 && (
                <ArrowRight className="h-4 w-4 text-neutral-600" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Cash Count */}
        {step === "cash_count" && (
          <div className="space-y-4">
            <Card className="bg-neutral-800 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Banknote className="h-4 w-4" />
                  Count Cash by Denomination
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {DENOMINATIONS.map((denom) => (
                    <div key={denom.value} className="flex items-center gap-2">
                      <Label className="w-16 text-right text-neutral-400">
                        {denom.label}
                      </Label>
                      <span className="text-neutral-600">×</span>
                      <Input
                        type="number"
                        min="0"
                        value={denomCounts[denom.value] || ""}
                        onChange={(e) => handleDenomChange(denom.value, e.target.value)}
                        className="w-20 bg-neutral-700 border-white/10 text-center"
                        placeholder="0"
                      />
                      <span className="text-neutral-500 text-sm w-24">
                        = {formatCurrency((denomCounts[denom.value] || 0) * denom.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Running Total */}
            <div className="flex items-center justify-between p-4 bg-neutral-800 rounded-lg">
              <span className="text-neutral-400">Total Counted</span>
              <span className="text-2xl font-bold text-white">
                {formatCurrency(totalCashCounted)}
              </span>
            </div>
          </div>
        )}

        {/* Step 2: Summary */}
        {step === "summary" && (
          <div className="space-y-4">
            {/* Shift Stats */}
            <Card className="bg-neutral-800 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Shift Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Orders</span>
                    <span className="text-white">{shiftSummary.orderCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Total Sales</span>
                    <span className="text-white">{formatCurrency(shiftSummary.totalSales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Cash Sales</span>
                    <span className="text-white">{formatCurrency(shiftSummary.cashSales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Card Sales</span>
                    <span className="text-white">{formatCurrency(shiftSummary.cardSales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Room Charges</span>
                    <span className="text-white">{formatCurrency(shiftSummary.roomChargeSales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Other</span>
                    <span className="text-white">{formatCurrency(shiftSummary.otherSales)}</span>
                  </div>
                </div>

                <Separator className="bg-white/10" />

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Voids ({shiftSummary.voidCount})</span>
                    <span className="text-red-400">-{formatCurrency(shiftSummary.voidAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Discounts ({shiftSummary.discountCount})</span>
                    <span className="text-red-400">-{formatCurrency(shiftSummary.discountTotal)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cash Reconciliation */}
            <Card className="bg-neutral-800 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Cash Reconciliation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Starting Cash</span>
                  <span className="text-white">{formatCurrency(shiftSummary.startingCash)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">+ Cash Sales</span>
                  <span className="text-green-400">+{formatCurrency(shiftSummary.cashSales)}</span>
                </div>
                <Separator className="bg-white/10" />
                <div className="flex justify-between font-medium">
                  <span className="text-neutral-400">Expected Cash</span>
                  <span className="text-white">{formatCurrency(shiftSummary.expectedCash)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-neutral-400">Counted Cash</span>
                  <span className="text-white">{formatCurrency(totalCashCounted)}</span>
                </div>
                <Separator className="bg-white/10" />
                <div className="flex justify-between font-bold">
                  <span className="text-neutral-400">Variance</span>
                  <span className={cn(
                    hasVariance 
                      ? variance > 0 ? "text-green-400" : "text-red-400"
                      : "text-white"
                  )}>
                    {variance > 0 ? "+" : ""}{formatCurrency(variance)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Variance Warning */}
            {hasVariance && (
              <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0" />
                <p className="text-sm text-yellow-400">
                  Cash variance detected. Please verify your count.
                </p>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes about this shift..."
                className="bg-neutral-800 border-white/10 min-h-[80px]"
              />
            </div>
          </div>
        )}

        {/* Step 3: Close Options */}
        {step === "options" && (
          <div className="space-y-4">
            <p className="text-neutral-400 text-sm">
              Choose how to end your shift:
            </p>

            {/* Close and End */}
            <Card 
              className={cn(
                "cursor-pointer transition-colors",
                !isHandover
                  ? "bg-orange-600/20 border-orange-500"
                  : "bg-neutral-800 border-white/10 hover:border-white/20"
              )}
              onClick={() => setIsHandover(false)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center",
                    !isHandover ? "bg-orange-500" : "bg-neutral-700"
                  )}>
                    <LogOut className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Close Shift</p>
                    <p className="text-sm text-neutral-400">
                      End your shift and generate Z reading
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Handover */}
            {availableCashiers.length > 0 && onHandoverShift && (
              <Card 
                className={cn(
                  "cursor-pointer transition-colors",
                  isHandover
                    ? "bg-blue-600/20 border-blue-500"
                    : "bg-neutral-800 border-white/10 hover:border-white/20"
                )}
                onClick={() => setIsHandover(true)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center",
                      isHandover ? "bg-blue-500" : "bg-neutral-700"
                    )}>
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-white">Handover to Next Cashier</p>
                      <p className="text-sm text-neutral-400">
                        Transfer cash drawer to another cashier
                      </p>
                    </div>
                  </div>

                  {isHandover && (
                    <div className="mt-4 space-y-3">
                      <div className="space-y-2">
                        <Label>Hand over to</Label>
                        <select
                          value={handoverToId}
                          onChange={(e) => setHandoverToId(e.target.value)}
                          className="w-full bg-neutral-700 border-white/10 rounded-md p-2 text-white"
                        >
                          <option value="">Select cashier...</option>
                          {availableCashiers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Handover Notes</Label>
                        <Textarea
                          value={handoverNotes}
                          onChange={(e) => setHandoverNotes(e.target.value)}
                          placeholder="Notes for the next cashier..."
                          className="bg-neutral-700 border-white/10 min-h-[60px]"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <div>
            {step !== "cash_count" && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleBack}
                disabled={isLoading}
              >
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            {step === "options" ? (
              <Button
                onClick={isHandover ? handleHandover : handleCloseShift}
                disabled={isLoading || (isHandover && !handoverToId)}
                className={cn(
                  isHandover 
                    ? "bg-blue-600 hover:bg-blue-700" 
                    : "bg-orange-600 hover:bg-orange-700"
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {isHandover ? "Complete Handover" : "Close Shift"}
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
