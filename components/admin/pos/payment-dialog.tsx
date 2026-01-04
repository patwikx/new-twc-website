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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Banknote,
  CreditCard,
  Building2,
  Ticket,
  Gift,
  Plus,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { PaymentMethod } from "@prisma/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { processPayment, processRoomCharge } from "@/lib/pos/payment";
import { cn } from "@/lib/utils";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  orderTotal: number;
  bookingId?: string | null;
  bookingRef?: string | null;
  guestName?: string | null;
  processedById: string;
  onPaymentComplete?: () => void;
}

interface PaymentLine {
  id: string;
  method: PaymentMethod;
  amount: string;
  reference: string;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: "CASH", label: "Cash", icon: <Banknote className="h-4 w-4" /> },
  { value: "CREDIT_CARD", label: "Credit Card", icon: <CreditCard className="h-4 w-4" /> },
  { value: "DEBIT_CARD", label: "Debit Card", icon: <CreditCard className="h-4 w-4" /> },
  { value: "ROOM_CHARGE", label: "Room Charge", icon: <Building2 className="h-4 w-4" /> },
  { value: "VOUCHER", label: "Voucher", icon: <Ticket className="h-4 w-4" /> },
  { value: "COMPLIMENTARY", label: "Complimentary", icon: <Gift className="h-4 w-4" /> },
];

export function PaymentDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  orderTotal,
  bookingId,
  bookingRef,
  guestName,
  processedById,
  onPaymentComplete,
}: PaymentDialogProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [paymentLines, setPaymentLines] = React.useState<PaymentLine[]>([
    { id: "1", method: "CASH", amount: orderTotal.toFixed(2), reference: "" },
  ]);
  const [paymentSuccess, setPaymentSuccess] = React.useState(false);
  const [changeDue, setChangeDue] = React.useState<number | null>(null);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setPaymentLines([
        { id: "1", method: "CASH", amount: orderTotal.toFixed(2), reference: "" },
      ]);
      setPaymentSuccess(false);
      setChangeDue(null);
    }
  }, [open, orderTotal]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Calculate totals
  const totalPayment = paymentLines.reduce((sum, line) => {
    const amount = parseFloat(line.amount) || 0;
    return sum + amount;
  }, 0);

  const remaining = orderTotal - totalPayment;
  const isOverpaid = totalPayment > orderTotal;
  const hasCash = paymentLines.some((line) => line.method === "CASH");
  const calculatedChange = hasCash && isOverpaid ? totalPayment - orderTotal : 0;

  // Add payment line
  const addPaymentLine = () => {
    const newId = (paymentLines.length + 1).toString();
    setPaymentLines([
      ...paymentLines,
      { id: newId, method: "CASH", amount: remaining > 0 ? remaining.toFixed(2) : "0.00", reference: "" },
    ]);
  };

  // Remove payment line
  const removePaymentLine = (id: string) => {
    if (paymentLines.length > 1) {
      setPaymentLines(paymentLines.filter((line) => line.id !== id));
    }
  };

  // Update payment line
  const updatePaymentLine = (id: string, field: keyof PaymentLine, value: string) => {
    setPaymentLines(
      paymentLines.map((line) =>
        line.id === id ? { ...line, [field]: value } : line
      )
    );
  };

  // Quick amount buttons
  const setQuickAmount = (amount: number) => {
    if (paymentLines.length === 1) {
      setPaymentLines([{ ...paymentLines[0], amount: amount.toFixed(2) }]);
    }
  };

  // Handle payment submission
  const handleSubmit = async () => {
    // Validate payments
    const hasRoomCharge = paymentLines.some((line) => line.method === "ROOM_CHARGE");
    
    if (hasRoomCharge && !bookingId) {
      toast.error("Room charge requires an associated booking");
      return;
    }

    // Check if payment covers order total
    if (!hasCash && totalPayment < orderTotal - 0.01) {
      toast.error("Payment amount is less than order total");
      return;
    }

    setIsLoading(true);
    try {
      // If single room charge payment, use processRoomCharge
      if (hasRoomCharge && paymentLines.length === 1 && bookingId) {
        const result = await processRoomCharge({
          orderId,
          bookingId,
          processedById,
        });

        if (!result.success) {
          toast.error(result.error || "Payment failed");
          return;
        }

        setPaymentSuccess(true);
        toast.success("Room charge processed successfully");
      } else {
        // Use processPayment for other payment types
        const payments = paymentLines.map((line) => ({
          method: line.method,
          amount: parseFloat(line.amount) || 0,
          reference: line.reference || undefined,
        }));

        const result = await processPayment({
          orderId,
          payments,
          processedById,
        });

        if (!result.success) {
          toast.error(result.error || "Payment failed");
          return;
        }

        setPaymentSuccess(true);
        if (result.data?.changeDue) {
          setChangeDue(result.data.changeDue);
        }
        toast.success("Payment processed successfully");
      }

      router.refresh();
      
      // Call completion callback after a short delay
      setTimeout(() => {
        if (onPaymentComplete) {
          onPaymentComplete();
        }
        onOpenChange(false);
      }, 2000);
    } catch {
      toast.error("Failed to process payment");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle room charge quick action
  const handleRoomCharge = () => {
    if (!bookingId) {
      toast.error("No booking associated with this order");
      return;
    }
    setPaymentLines([
      { id: "1", method: "ROOM_CHARGE", amount: orderTotal.toFixed(2), reference: bookingRef || "" },
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-neutral-900 border-white/10 max-w-lg">
        <DialogHeader>
          <DialogTitle>Process Payment</DialogTitle>
          <DialogDescription>
            Order #{orderNumber} • Total: {formatCurrency(orderTotal)}
          </DialogDescription>
        </DialogHeader>

        {paymentSuccess ? (
          <div className="py-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Payment Complete</h3>
            {changeDue !== null && changeDue > 0 && (
              <p className="text-lg text-orange-400">
                Change Due: {formatCurrency(changeDue)}
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Booking Info */}
            {bookingId && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-md mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-400" />
                    <span className="text-sm text-blue-400">Room Charge Available</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                    onClick={handleRoomCharge}
                  >
                    Charge to Room
                  </Button>
                </div>
                {guestName && (
                  <p className="text-xs text-neutral-400 mt-1">
                    Guest: {guestName} • Booking: {bookingRef}
                  </p>
                )}
              </div>
            )}

            {/* Payment Lines */}
            <div className="space-y-3">
              {paymentLines.map((line, index) => (
                <div key={line.id} className="flex items-start gap-2">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-neutral-500">Method</Label>
                      <Select
                        value={line.method}
                        onValueChange={(value) =>
                          updatePaymentLine(line.id, "method", value as PaymentMethod)
                        }
                      >
                        <SelectTrigger className="bg-neutral-800 border-white/10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((method) => (
                            <SelectItem
                              key={method.value}
                              value={method.value}
                              disabled={method.value === "ROOM_CHARGE" && !bookingId}
                            >
                              <div className="flex items-center gap-2">
                                {method.icon}
                                {method.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-neutral-500">Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.amount}
                        onChange={(e) =>
                          updatePaymentLine(line.id, "amount", e.target.value)
                        }
                        className="bg-neutral-800 border-white/10"
                      />
                    </div>
                  </div>
                  {paymentLines.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 mt-6 text-neutral-400 hover:text-red-400"
                      onClick={() => removePaymentLine(line.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed border-white/20 text-neutral-400"
                onClick={addPaymentLine}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Split Payment
              </Button>
            </div>

            {/* Quick Amount Buttons (for single payment) */}
            {paymentLines.length === 1 && paymentLines[0].method === "CASH" && (
              <div className="flex flex-wrap gap-2 mt-4">
                <Label className="w-full text-xs text-neutral-500">Quick Amount</Label>
                {[100, 200, 500, 1000, 2000].map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    className="border-white/10"
                    onClick={() => setQuickAmount(amount)}
                  >
                    ₱{amount}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10"
                  onClick={() => setQuickAmount(orderTotal)}
                >
                  Exact
                </Button>
              </div>
            )}

            <Separator className="bg-white/10 my-4" />

            {/* Summary */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Order Total</span>
                <span className="text-white font-medium">{formatCurrency(orderTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Payment Total</span>
                <span className={cn(
                  "font-medium",
                  totalPayment >= orderTotal ? "text-green-400" : "text-orange-400"
                )}>
                  {formatCurrency(totalPayment)}
                </span>
              </div>
              {remaining > 0.01 && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Remaining</span>
                  <span className="text-red-400 font-medium">
                    {formatCurrency(remaining)}
                  </span>
                </div>
              )}
              {calculatedChange > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Change Due</span>
                  <span className="text-orange-400 font-medium">
                    {formatCurrency(calculatedChange)}
                  </span>
                </div>
              )}
            </div>

            {/* Validation Messages */}
            {remaining > 0.01 && !hasCash && (
              <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded-md mt-4">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <span className="text-xs text-red-400">
                  Payment amount must equal order total for non-cash payments
                </span>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          {!paymentSuccess && (
            <>
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-neutral-400"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isLoading || (remaining > 0.01 && !hasCash)}
                className="bg-green-600 hover:bg-green-700 min-w-[120px]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete Payment
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
