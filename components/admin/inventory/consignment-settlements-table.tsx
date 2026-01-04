"use client";

import { useState, useTransition } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { markSettlementPaid } from "@/lib/inventory/consignment";
import { format } from "date-fns";
import { CheckCircle, Clock, Eye, Loader2 } from "lucide-react";

interface Settlement {
  id: string;
  supplierId: string;
  periodStart: Date;
  periodEnd: Date;
  totalSales: number | { toNumber: () => number };
  totalSupplierDue: number | { toNumber: () => number };
  settledAt: Date | null;
  createdAt: Date;
  supplier: {
    id: string;
    name: string;
  };
  _count: {
    sales: number;
  };
}

interface ConsignmentSettlementsTableProps {
  settlements: Settlement[];
}

export function ConsignmentSettlementsTable({
  settlements,
}: ConsignmentSettlementsTableProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const router = useRouter();

  const handleMarkPaid = (settlement: Settlement) => {
    setSelectedSettlement(settlement);
    setShowConfirmDialog(true);
  };

  const confirmMarkPaid = () => {
    if (!selectedSettlement) return;

    startTransition(async () => {
      const result = await markSettlementPaid(selectedSettlement.id);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Settlement marked as paid");
        router.refresh();
      }

      setShowConfirmDialog(false);
      setSelectedSettlement(null);
    });
  };

  const getNumericValue = (value: number | { toNumber: () => number }): number => {
    return typeof value === "number" ? value : value.toNumber();
  };

  return (
    <>
      <div className="border border-white/10 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-neutral-400">Supplier</TableHead>
              <TableHead className="text-neutral-400">Period</TableHead>
              <TableHead className="text-neutral-400 text-center">Sales Count</TableHead>
              <TableHead className="text-neutral-400 text-right">Total Sales</TableHead>
              <TableHead className="text-neutral-400 text-right">Supplier Due</TableHead>
              <TableHead className="text-neutral-400 text-center">Status</TableHead>
              <TableHead className="text-neutral-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settlements.map((settlement) => {
              const totalSales = getNumericValue(settlement.totalSales);
              const totalSupplierDue = getNumericValue(settlement.totalSupplierDue);
              const isPaid = settlement.settledAt !== null;

              return (
                <TableRow key={settlement.id} className="border-white/10">
                  <TableCell>
                    <div>
                      <p className="text-white font-medium">
                        {settlement.supplier.name}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Created {format(new Date(settlement.createdAt), "MMM d, yyyy")}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-neutral-300">
                      {format(new Date(settlement.periodStart), "MMM d")} -{" "}
                      {format(new Date(settlement.periodEnd), "MMM d, yyyy")}
                    </p>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-neutral-300">
                      {settlement._count.sales}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-neutral-300">
                      ₱{totalSales.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-orange-400 font-medium">
                      ₱{totalSupplierDue.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {isPaid ? (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Paid
                      </Badge>
                    ) : (
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/admin/inventory/consignment/settlements/${settlement.id}`)}
                        className="text-neutral-400 hover:text-white"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {!isPaid && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkPaid(settlement)}
                          className="text-green-400 hover:text-green-300"
                          disabled={isPending}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {settlements.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-neutral-500 py-8"
                >
                  No settlements found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Confirm Mark Paid Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-neutral-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Mark Settlement as Paid</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Are you sure you want to mark this settlement as paid? This action
              will record the payment date and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedSettlement && (
            <div className="py-4 space-y-2">
              <p className="text-neutral-300">
                <span className="text-neutral-500">Supplier:</span>{" "}
                {selectedSettlement.supplier.name}
              </p>
              <p className="text-neutral-300">
                <span className="text-neutral-500">Amount Due:</span>{" "}
                <span className="text-orange-400 font-medium">
                  ₱{getNumericValue(selectedSettlement.totalSupplierDue).toFixed(2)}
                </span>
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowConfirmDialog(false)}
              className="text-neutral-400"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmMarkPaid}
              disabled={isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Mark as Paid"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
