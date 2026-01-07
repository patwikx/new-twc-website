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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Percent, 
  Loader2, 
  Check,
  IdCard,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ManagerPinDialog } from "./manager-pin-dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronsUpDown } from "lucide-react";

interface DiscountType {
  id: string;
  code: string;
  name: string;
  description?: string;
  percentage: number;
  requiresId: boolean;
  requiresApproval: boolean;
  maxAmount?: number;
}

interface DiscountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  discountTypes: DiscountType[];
  orderSubtotal: number;
  onApplyDiscount: (data: {
    discountTypeId: string;
    amount: number;
    percentage: number;
    idNumber?: string;
    approvedById?: string;
  }) => Promise<void>;
  onVerifyManagerPin: (pin: string) => Promise<{ 
    success: boolean; 
    managerId?: string; 
    managerName?: string;
  }>;
}

export function DiscountDialog({
  open,
  onOpenChange,
  discountTypes,
  orderSubtotal,
  onApplyDiscount,
  onVerifyManagerPin,
}: DiscountDialogProps) {
  const [selectedDiscount, setSelectedDiscount] = React.useState<DiscountType | null>(null);
  const [idNumber, setIdNumber] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPinDialog, setShowPinDialog] = React.useState(false);
  const [openCombobox, setOpenCombobox] = React.useState(false);
  const [pendingApproval, setPendingApproval] = React.useState<{
    discountTypeId: string;
    amount: number;
    percentage: number;
    idNumber?: string;
  } | null>(null);

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setSelectedDiscount(null);
      setIdNumber("");
      setPendingApproval(null);
    }
  }, [open]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const calculateDiscountAmount = (discount: DiscountType) => {
    const amount = (orderSubtotal * discount.percentage) / 100;
    if (discount.maxAmount && amount > discount.maxAmount) {
      return discount.maxAmount;
    }
    return amount;
  };

  const handleApply = async (approvedById?: string) => {
    if (!selectedDiscount) return;

    if (selectedDiscount.requiresId && !idNumber.trim()) {
      toast.error("Please enter the ID number");
      return;
    }

    const discountAmount = calculateDiscountAmount(selectedDiscount);

    // If requires approval and not yet approved
    if (selectedDiscount.requiresApproval && !approvedById) {
      setPendingApproval({
        discountTypeId: selectedDiscount.id,
        amount: discountAmount,
        percentage: selectedDiscount.percentage,
        idNumber: idNumber.trim() || undefined,
      });
      setShowPinDialog(true);
      return;
    }

    setIsLoading(true);
    try {
      await onApplyDiscount({
        discountTypeId: selectedDiscount.id,
        amount: discountAmount,
        percentage: selectedDiscount.percentage,
        idNumber: idNumber.trim() || undefined,
        approvedById,
      });
      toast.success(`${selectedDiscount.name} applied`);
      onOpenChange(false);
    } catch {
      toast.error("Failed to apply discount");
    } finally {
      setIsLoading(false);
    }
  };

  const handleManagerApproval = (managerId: string) => {
    if (pendingApproval) {
      handleApply(managerId);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-neutral-900 border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Apply Discount
            </DialogTitle>
            <DialogDescription>
              Select a discount type to apply to this order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Order Subtotal */}
            <div className="flex items-center justify-between p-3 bg-neutral-800 rounded-lg">
              <span className="text-neutral-400">Order Subtotal</span>
              <span className="font-medium text-white">{formatCurrency(orderSubtotal)}</span>
            </div>



            {/* Discount Selection (Combobox) */}
            <div className="space-y-2">
              <Label>Select Discount Type</Label>
              <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCombobox}
                    className="w-full justify-between bg-neutral-800 border-white/10 text-white hover:bg-neutral-700 hover:text-white"
                  >
                    {selectedDiscount
                      ? selectedDiscount.name
                      : "Select discount..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[460px] p-0 bg-neutral-900 border-white/10">
                  <Command className="bg-neutral-900 text-white">
                    <CommandInput placeholder="Search discount..." className="h-9" />
                    <CommandList>
                      <CommandEmpty>No discount found.</CommandEmpty>
                      <CommandGroup>
                        {discountTypes.map((discount) => (
                          <CommandItem
                            key={discount.id}
                            value={discount.name}
                            onSelect={() => {
                              setSelectedDiscount(discount);
                              setOpenCombobox(false);
                            }}
                            className="bg-neutral-900 data-[selected=true]:bg-neutral-800 text-white cursor-pointer"
                          >
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedDiscount?.id === discount.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <span>{discount.name}</span>
                                    <Badge variant="outline" className="ml-2 text-xs border-white/20 text-neutral-400">
                                        {discount.percentage}%
                                    </Badge>
                                </div>
                                {discount.requiresApproval && <ShieldCheck className="h-3 w-3 text-orange-400" />}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              
              {selectedDiscount && (
                 <div className="mt-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex justify-between items-center">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-green-400">Discount Applied</span>
                         <span className="text-xs text-green-400/70">{selectedDiscount.percentage}% off</span>
                    </div>
                    <span className="text-lg font-bold text-green-400">
                        -{formatCurrency(calculateDiscountAmount(selectedDiscount))}
                    </span>
                 </div>
              )}
            </div>

            {/* ID Number Input (if required) */}
            {selectedDiscount?.requiresId && (
              <div className="space-y-2">
                <Label htmlFor="idNumber">
                  {selectedDiscount.code === "PWD" ? "PWD ID Number" : 
                   selectedDiscount.code === "SENIOR" ? "Senior Citizen ID" : 
                   "ID Number"} *
                </Label>
                <div className="relative">
                  <IdCard className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                  <Input
                    id="idNumber"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder="Enter ID number"
                    className="pl-10 bg-neutral-800 border-white/10"
                  />
                </div>
              </div>
            )}
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
              onClick={() => handleApply()}
              disabled={isLoading || !selectedDiscount || (selectedDiscount.requiresId && !idNumber.trim())}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Apply Discount
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManagerPinDialog
        open={showPinDialog}
        onOpenChange={setShowPinDialog}
        title="Manager Approval Required"
        description={`Authorize ${selectedDiscount?.name} discount application.`}
        onVerify={onVerifyManagerPin}
        onSuccess={handleManagerApproval}
      />
    </>
  );
}
