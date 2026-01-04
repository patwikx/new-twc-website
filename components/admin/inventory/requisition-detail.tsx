"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  approveRequisition,
  rejectRequisition,
  fulfillRequisition,
} from "@/lib/inventory/requisition";
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  ClipboardList,
  Clock,
  CheckCircle,
  XCircle,
  Package,
  Check,
  X,
} from "lucide-react";
import { RequisitionStatus } from "@prisma/client";
import { formatDistanceToNow, format } from "date-fns";

interface RequisitionItem {
  id: string;
  stockItemId: string;
  requestedQuantity: number;
  fulfilledQuantity: number;
  stockItem: {
    id: string;
    name: string;
    sku: string | null;
    primaryUnit: {
      abbreviation: string;
    };
  };
}

interface StockAvailability {
  stockItemId: string;
  availableQuantity: number;
}

interface RequisitionDetailProps {
  requisition: {
    id: string;
    status: RequisitionStatus;
    requestedById: string;
    approvedById: string | null;
    rejectionReason: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    requestingWarehouse: {
      id: string;
      name: string;
      type: string;
    };
    sourceWarehouse: {
      id: string;
      name: string;
      type: string;
    };
    items: RequisitionItem[];
  };
  stockAvailability: StockAvailability[];
  userId: string;
}

const STATUS_CONFIG: Record<
  RequisitionStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  PENDING: {
    label: "Pending Approval",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    icon: Clock,
  },
  APPROVED: {
    label: "Approved - Ready for Fulfillment",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    icon: CheckCircle,
  },
  PARTIALLY_FULFILLED: {
    label: "Partially Fulfilled",
    color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    icon: Package,
  },
  FULFILLED: {
    label: "Fulfilled",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: CheckCircle,
  },
  REJECTED: {
    label: "Rejected",
    color: "bg-red-500/20 text-red-400 border-red-500/30",
    icon: XCircle,
  },
};

export function RequisitionDetail({
  requisition,
  stockAvailability,
  userId,
}: RequisitionDetailProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [rejectReason, setRejectReason] = useState("");
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [fulfillmentQuantities, setFulfillmentQuantities] = useState<
    Record<string, string>
  >(() => {
    const initial: Record<string, string> = {};
    requisition.items.forEach((item) => {
      const remaining = item.requestedQuantity - item.fulfilledQuantity;
      const available =
        stockAvailability.find((sa) => sa.stockItemId === item.stockItemId)
          ?.availableQuantity ?? 0;
      initial[item.stockItemId] = Math.min(remaining, available).toString();
    });
    return initial;
  });

  const statusConfig = STATUS_CONFIG[requisition.status];
  const StatusIcon = statusConfig.icon;

  const canApprove = requisition.status === "PENDING";
  const canReject = requisition.status === "PENDING";
  const canFulfill =
    requisition.status === "APPROVED" ||
    requisition.status === "PARTIALLY_FULFILLED";

  const getAvailableQuantity = (stockItemId: string): number => {
    return (
      stockAvailability.find((sa) => sa.stockItemId === stockItemId)
        ?.availableQuantity ?? 0
    );
  };

  const getRemainingQuantity = (item: RequisitionItem): number => {
    return item.requestedQuantity - item.fulfilledQuantity;
  };

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveRequisition(requisition.id, userId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Requisition approved successfully");
        router.refresh();
      }
    });
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    startTransition(async () => {
      const result = await rejectRequisition(
        requisition.id,
        userId,
        rejectReason.trim()
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Requisition rejected");
        setIsRejectDialogOpen(false);
        router.refresh();
      }
    });
  };

  const handleFulfill = () => {
    // Build fulfillment items
    const items = requisition.items
      .map((item) => ({
        stockItemId: item.stockItemId,
        fulfilledQuantity: parseFloat(
          fulfillmentQuantities[item.stockItemId] || "0"
        ),
      }))
      .filter((item) => item.fulfilledQuantity > 0);

    if (items.length === 0) {
      toast.error("Please enter quantities to fulfill");
      return;
    }

    // Validate quantities
    for (const item of items) {
      const reqItem = requisition.items.find(
        (ri) => ri.stockItemId === item.stockItemId
      );
      if (!reqItem) continue;

      const remaining = getRemainingQuantity(reqItem);
      const available = getAvailableQuantity(item.stockItemId);

      if (item.fulfilledQuantity > remaining) {
        toast.error(
          `${reqItem.stockItem.name}: Cannot fulfill more than remaining (${remaining})`
        );
        return;
      }

      if (item.fulfilledQuantity > available) {
        toast.error(
          `${reqItem.stockItem.name}: Insufficient stock (available: ${available})`
        );
        return;
      }
    }

    startTransition(async () => {
      const result = await fulfillRequisition(requisition.id, items, userId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Requisition fulfilled successfully");
        router.refresh();
      }
    });
  };

  const updateFulfillmentQuantity = (stockItemId: string, value: string) => {
    setFulfillmentQuantities((prev) => ({
      ...prev,
      [stockItemId]: value,
    }));
  };

  const setMaxFulfillment = (item: RequisitionItem) => {
    const remaining = getRemainingQuantity(item);
    const available = getAvailableQuantity(item.stockItemId);
    const max = Math.min(remaining, available);
    updateFulfillmentQuantity(item.stockItemId, max.toString());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="text-neutral-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">
                Requisition Details
              </h1>
              <p className="text-sm text-neutral-400 font-mono">
                {requisition.id.slice(0, 8)}...
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {canApprove && (
            <>
              <Dialog
                open={isRejectDialogOpen}
                onOpenChange={setIsRejectDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    disabled={isPending}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-neutral-900 border-white/10">
                  <DialogHeader>
                    <DialogTitle>Reject Requisition</DialogTitle>
                    <DialogDescription>
                      Please provide a reason for rejecting this requisition.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Rejection Reason</Label>
                      <Textarea
                        placeholder="Enter reason for rejection..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="bg-neutral-800 border-white/10"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="ghost"
                      onClick={() => setIsRejectDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleReject}
                      disabled={isPending || !rejectReason.trim()}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Reject"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button
                onClick={handleApprove}
                disabled={isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Approve
              </Button>
            </>
          )}

          {canFulfill && (
            <Button
              onClick={handleFulfill}
              disabled={isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Package className="h-4 w-4 mr-2" />
              )}
              Fulfill Items
            </Button>
          )}
        </div>
      </div>

      {/* Status Banner */}
      <div
        className={`p-4 rounded-lg border ${statusConfig.color} flex items-center gap-3`}
      >
        <StatusIcon className="h-5 w-5" />
        <span className="font-medium">{statusConfig.label}</span>
        {requisition.rejectionReason && (
          <span className="text-sm opacity-80">
            — {requisition.rejectionReason}
          </span>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Transfer Info */}
        <div className="p-4 bg-neutral-900/50 rounded-lg border border-white/10">
          <Label className="text-xs text-neutral-500 uppercase tracking-widest">
            Transfer Route
          </Label>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-neutral-300">
              {requisition.sourceWarehouse.name}
            </span>
            <ArrowRight className="h-4 w-4 text-orange-500" />
            <span className="text-white font-medium">
              {requisition.requestingWarehouse.name}
            </span>
          </div>
        </div>

        {/* Created Info */}
        <div className="p-4 bg-neutral-900/50 rounded-lg border border-white/10">
          <Label className="text-xs text-neutral-500 uppercase tracking-widest">
            Created
          </Label>
          <p className="text-white mt-2">
            {format(new Date(requisition.createdAt), "PPp")}
          </p>
          <p className="text-xs text-neutral-500">
            {formatDistanceToNow(new Date(requisition.createdAt), {
              addSuffix: true,
            })}
          </p>
        </div>

        {/* Items Summary */}
        <div className="p-4 bg-neutral-900/50 rounded-lg border border-white/10">
          <Label className="text-xs text-neutral-500 uppercase tracking-widest">
            Items
          </Label>
          <p className="text-white mt-2 text-2xl font-semibold">
            {requisition.items.length}
          </p>
          <p className="text-xs text-neutral-500">
            {requisition.items.reduce(
              (sum, item) => sum + item.fulfilledQuantity,
              0
            )}{" "}
            /{" "}
            {requisition.items.reduce(
              (sum, item) => sum + item.requestedQuantity,
              0
            )}{" "}
            units fulfilled
          </p>
        </div>
      </div>

      {/* Notes */}
      {requisition.notes && (
        <div className="p-4 bg-neutral-900/50 rounded-lg border border-white/10">
          <Label className="text-xs text-neutral-500 uppercase tracking-widest">
            Notes
          </Label>
          <p className="text-neutral-300 mt-2">{requisition.notes}</p>
        </div>
      )}

      {/* Items Table */}
      <div className="border border-white/10 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-neutral-400">Item</TableHead>
              <TableHead className="text-neutral-400 w-32">Requested</TableHead>
              <TableHead className="text-neutral-400 w-32">Fulfilled</TableHead>
              <TableHead className="text-neutral-400 w-32">Remaining</TableHead>
              {canFulfill && (
                <>
                  <TableHead className="text-neutral-400 w-32">
                    Available
                  </TableHead>
                  <TableHead className="text-neutral-400 w-40">
                    Fulfill Qty
                  </TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {requisition.items.map((item) => {
              const remaining = getRemainingQuantity(item);
              const available = getAvailableQuantity(item.stockItemId);
              const isFulfilled = remaining === 0;

              return (
                <TableRow key={item.id} className="border-white/10">
                  <TableCell>
                    <div>
                      <p className="text-white font-medium">
                        {item.stockItem.name}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {item.stockItem.sku || "No SKU"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-neutral-300">
                      {item.requestedQuantity.toFixed(3)}{" "}
                      {item.stockItem.primaryUnit.abbreviation}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        item.fulfilledQuantity > 0
                          ? "text-green-400"
                          : "text-neutral-500"
                      }
                    >
                      {item.fulfilledQuantity.toFixed(3)}{" "}
                      {item.stockItem.primaryUnit.abbreviation}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        isFulfilled ? "text-green-400" : "text-orange-400"
                      }
                    >
                      {remaining.toFixed(3)}{" "}
                      {item.stockItem.primaryUnit.abbreviation}
                    </span>
                  </TableCell>
                  {canFulfill && (
                    <>
                      <TableCell>
                        <span
                          className={
                            available >= remaining
                              ? "text-green-400"
                              : "text-red-400"
                          }
                        >
                          {available.toFixed(3)}{" "}
                          {item.stockItem.primaryUnit.abbreviation}
                        </span>
                      </TableCell>
                      <TableCell>
                        {!isFulfilled ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.001"
                              max={Math.min(remaining, available)}
                              value={
                                fulfillmentQuantities[item.stockItemId] || ""
                              }
                              onChange={(e) =>
                                updateFulfillmentQuantity(
                                  item.stockItemId,
                                  e.target.value
                                )
                              }
                              className="h-8 w-24 bg-neutral-900/30 border-white/10"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setMaxFulfillment(item)}
                              className="h-8 px-2 text-xs border-white/10"
                            >
                              Max
                            </Button>
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-green-500/20 text-green-400 border-green-500/30"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Complete
                          </Badge>
                        )}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
