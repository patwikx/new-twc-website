"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { generateSettlement } from "@/lib/inventory/consignment";
import { Loader2, Plus, FileText } from "lucide-react";

interface SupplierOption {
  id: string;
  name: string;
  contactName: string | null;
}

interface GenerateSettlementFormProps {
  suppliers: SupplierOption[];
}

export function GenerateSettlementForm({
  suppliers,
}: GenerateSettlementFormProps) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!supplierId) {
      toast.error("Please select a supplier");
      return;
    }

    if (!periodStart) {
      toast.error("Please select a start date");
      return;
    }

    if (!periodEnd) {
      toast.error("Please select an end date");
      return;
    }

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    endDate.setHours(23, 59, 59, 999); // End of day

    if (startDate > endDate) {
      toast.error("Start date must be before end date");
      return;
    }

    startTransition(async () => {
      const result = await generateSettlement(supplierId, startDate, endDate);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          `Settlement generated with ${result.data?.salesCount} sales totaling ₱${result.data?.totalSupplierDue.toFixed(2)}`
        );
        setOpen(false);
        setSupplierId("");
        setPeriodStart("");
        setPeriodEnd("");
        router.refresh();
      }
    });
  };

  // Set default dates (current month)
  const setCurrentMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    setPeriodStart(firstDay.toISOString().split("T")[0]);
    setPeriodEnd(lastDay.toISOString().split("T")[0]);
  };

  // Set previous month
  const setPreviousMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    
    setPeriodStart(firstDay.toISOString().split("T")[0]);
    setPeriodEnd(lastDay.toISOString().split("T")[0]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-orange-600 hover:bg-orange-700 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Generate Settlement
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-neutral-900 border-white/10">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Generate Settlement Report
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              Create a settlement report for unsettled consignment sales within
              the specified period.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-4">
            {/* Supplier Selection */}
            <div className="space-y-2">
              <Label className="text-neutral-300">Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="bg-neutral-800 border-white/10">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quick Date Selection */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={setCurrentMonth}
                className="text-neutral-400 border-white/10 hover:bg-white/5"
              >
                Current Month
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={setPreviousMonth}
                className="text-neutral-400 border-white/10 hover:bg-white/5"
              >
                Previous Month
              </Button>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-neutral-300">Period Start</Label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="bg-neutral-800 border-white/10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-300">Period End</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="bg-neutral-800 border-white/10"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="text-neutral-400"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Settlement"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
