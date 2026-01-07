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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Trash2, 
  Loader2, 
  AlertTriangle,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { ManagerPinDialog } from "./manager-pin-dialog";

const VOID_REASONS = [
  { value: "CUSTOMER_REQUEST", label: "Customer Request" },
  { value: "WRONG_ORDER", label: "Wrong Order" },
  { value: "DUPLICATE_ENTRY", label: "Duplicate Entry" },
  { value: "SYSTEM_ERROR", label: "System Error" },
  { value: "QUALITY_ISSUE", label: "Quality Issue" },
  { value: "OTHER", label: "Other" },
];

interface VoidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voidType: "order" | "item";
  itemName?: string;
  amount: number;
  onVoid: (data: {
    reason: string;
    reasonCode: string;
    approvedById: string;
  }) => Promise<void>;
  onVerifyManagerPin: (pin: string) => Promise<{ 
    success: boolean; 
    managerId?: string; 
    managerName?: string;
  }>;
}

export function VoidDialog({
  open,
  onOpenChange,
  voidType,
  itemName,
  amount,
  onVoid,
  onVerifyManagerPin,
}: VoidDialogProps) {
  const [reasonCode, setReasonCode] = React.useState("");
  const [customReason, setCustomReason] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPinDialog, setShowPinDialog] = React.useState(false);

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setReasonCode("");
      setCustomReason("");
    }
  }, [open]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getReasonText = () => {
    if (reasonCode === "OTHER") {
      return customReason.trim();
    }
    const reason = VOID_REASONS.find((r) => r.value === reasonCode);
    return reason?.label || reasonCode;
  };

  const handleRequestApproval = () => {
    if (!reasonCode) {
      toast.error("Please select a reason");
      return;
    }
    if (reasonCode === "OTHER" && !customReason.trim()) {
      toast.error("Please enter a reason");
      return;
    }
    setShowPinDialog(true);
  };

  const handleManagerApproval = async (managerId: string) => {
    setIsLoading(true);
    try {
      await onVoid({
        reason: getReasonText(),
        reasonCode,
        approvedById: managerId,
      });
      toast.success(
        voidType === "order" 
          ? "Order voided successfully" 
          : `${itemName} voided successfully`
      );
      onOpenChange(false);
    } catch {
      toast.error("Failed to void");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-neutral-900 border-white/10 max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-4">
              <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-red-400" />
              </div>
            </div>
            <DialogTitle className="text-center">
              Void {voidType === "order" ? "Order" : "Item"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {voidType === "order" 
                ? "This will void the entire order and all items."
                : `Void "${itemName}" from this order.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Amount Warning */}
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
              <div className="text-sm">
                <span className="text-red-400">Amount to void: </span>
                <span className="font-bold text-red-400">{formatCurrency(amount)}</span>
              </div>
            </div>

            {/* Reason Selection */}
            <div className="space-y-2">
              <Label>Reason for Void *</Label>
              <RadioGroup value={reasonCode} onValueChange={setReasonCode}>
                {VOID_REASONS.map((reason) => (
                  <div key={reason.value} className="flex items-center space-x-2">
                    <RadioGroupItem 
                      value={reason.value} 
                      id={reason.value}
                      className="border-white/20"
                    />
                    <Label 
                      htmlFor={reason.value} 
                      className="text-sm font-normal cursor-pointer"
                    >
                      {reason.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Custom Reason */}
            {reasonCode === "OTHER" && (
              <div className="space-y-2">
                <Label htmlFor="customReason">Specify Reason *</Label>
                <Textarea
                  id="customReason"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Enter reason for void..."
                  className="bg-neutral-800 border-white/10 min-h-[80px]"
                />
              </div>
            )}

            {/* Manager Approval Notice */}
            <div className="flex items-center gap-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <ShieldCheck className="h-5 w-5 text-orange-400 shrink-0" />
              <p className="text-sm text-orange-400">
                Manager approval is required to void.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRequestApproval}
              disabled={isLoading || !reasonCode || (reasonCode === "OTHER" && !customReason.trim())}
              variant="destructive"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Voiding...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Request Approval
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManagerPinDialog
        open={showPinDialog}
        onOpenChange={setShowPinDialog}
        title="Void Authorization"
        description={`Authorize void of ${formatCurrency(amount)}`}
        actionLabel="Authorize Void"
        onVerify={onVerifyManagerPin}
        onSuccess={handleManagerApproval}
      />
    </>
  );
}
