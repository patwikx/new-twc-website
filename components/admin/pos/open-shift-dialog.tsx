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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, PlayCircle, Banknote } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { openShift } from "@/lib/pos/shift";

interface Outlet {
  id: string;
  name: string;
}

interface OpenShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outlets: Outlet[];
  cashierId: string;
  cashierName: string;
}

export function OpenShiftDialog({
  open,
  onOpenChange,
  outlets,
  cashierId,
  cashierName,
}: OpenShiftDialogProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [outletId, setOutletId] = React.useState<string>("");
  const [startingCash, setStartingCash] = React.useState<string>("0.00");
  const [notes, setNotes] = React.useState<string>("");

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setOutletId(outlets[0]?.id || "");
      setStartingCash("0.00");
      setNotes("");
    }
  }, [open, outlets]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!outletId) {
      toast.error("Please select an outlet");
      return;
    }

    const cashAmount = parseFloat(startingCash);
    if (isNaN(cashAmount) || cashAmount < 0) {
      toast.error("Please enter a valid starting cash amount");
      return;
    }

    setIsLoading(true);
    try {
      const result = await openShift({
        outletId,
        cashierId,
        startingCash: cashAmount,
        notes: notes.trim() || undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Shift opened successfully");
      router.refresh();
      onOpenChange(false);
    } catch {
      toast.error("Failed to open shift");
    } finally {
      setIsLoading(false);
    }
  };

  // Quick amount buttons
  const setQuickAmount = (amount: number) => {
    setStartingCash(amount.toFixed(2));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-neutral-900 border-white/10 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-green-400" />
            Open Shift
          </DialogTitle>
          <DialogDescription>
            Start a new shift for {cashierName}. Count your starting cash drawer.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Outlet Selection */}
          <div className="space-y-2">
            <Label htmlFor="outlet">Sales Outlet</Label>
            <Select value={outletId} onValueChange={setOutletId}>
              <SelectTrigger className="bg-neutral-800 border-white/10">
                <SelectValue placeholder="Select outlet" />
              </SelectTrigger>
              <SelectContent>
                {outlets.map((outlet) => (
                  <SelectItem key={outlet.id} value={outlet.id}>
                    {outlet.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Starting Cash */}
          <div className="space-y-2">
            <Label htmlFor="startingCash">Starting Cash</Label>
            <div className="relative">
              <Banknote className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
              <Input
                id="startingCash"
                type="number"
                step="0.01"
                min="0"
                value={startingCash}
                onChange={(e) => setStartingCash(e.target.value)}
                className="pl-10 bg-neutral-800 border-white/10"
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-neutral-500">
              Count the cash in your drawer before starting
            </p>
          </div>

          {/* Quick Amount Buttons */}
          <div className="space-y-2">
            <Label className="text-xs text-neutral-500">Quick Amount</Label>
            <div className="flex flex-wrap gap-2">
              {[0, 500, 1000, 2000, 5000].map((amount) => (
                <Button
                  key={amount}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-white/10"
                  onClick={() => setQuickAmount(amount)}
                >
                  {amount === 0 ? "₱0" : formatCurrency(amount)}
                </Button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-neutral-800 border-white/10 min-h-[80px]"
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
              disabled={isLoading || !outletId}
              className="bg-green-600 hover:bg-green-700 min-w-[120px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Opening...
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Open Shift
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
