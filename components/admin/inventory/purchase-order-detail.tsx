"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
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
  submitForApproval,
  approvePO,
  rejectPO,
  sendToSupplier,
  cancelPO,
  closePO,
} from "@/lib/inventory/purchase-order";
import {
  Loader2,
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Package,
  Archive,
  Check,
  X,
  Building2,
  Warehouse,
  Calendar,
  User,
  PackageOpen,
} from "lucide-react";
import { POStatus } from "@prisma/client";
import { formatDistanceToNow, format } from "date-fns";
import Link from "next/link";

interface POItem {
  id: string;
  stockItemId: string;
  quantity: number;
  unitCost: number;
  receivedQty: number;
  stockItem: {
    id: string;
    name: string;
    itemCode: string;
    primaryUnit: {
      abbreviation: string;
    };
  };
}

interface POReceipt {
  id: string;
  notes: string | null;
  createdAt: Date;
  receivedBy: {
    id: string;
    name: string | null;
  };
  items: {
    id: string;
    quantity: number;
    batchNumber: string | null;
    expirationDate: Date | null;
    stockItem: {
      id: string;
      name: string;
    };
  }[];
}

interface PurchaseOrderDetailProps {
  purchaseOrder: {
    id: string;
    poNumber: string;
    status: POStatus;
    subtotal: number;
    taxAmount: number;
    total: number;
    expectedDate: Date | null;
    notes: string | null;
    sentAt: Date | null;
    approvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    property: {
      id: string;
      name: string;
    };
    supplier: {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
    };
    warehouse: {
      id: string;
      name: string;
      type: string;
    };
    createdBy: {
      id: string;
      name: string | null;
      email: string | null;
    };
    approvedBy: {
      id: string;
      name: string | null;
      email: string | null;
    } | null;
    items: POItem[];
    receipts: POReceipt[];
  };
  userId: string;
}

const STATUS_CONFIG: Record<
  POStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  DRAFT: {
    label: "Draft",
    color: "bg-neutral-500/20 text-neutral-400 border-neutral-500/30",
    icon: FileText,
  },
  PENDING_APPROVAL: {
    label: "Pending Approval",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    icon: Clock,
  },
  APPROVED: {
    label: "Approved",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    icon: CheckCircle,
  },
  SENT: {
    label: "Sent to Supplier",
    color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    icon: Send,
  },
  PARTIALLY_RECEIVED: {
    label: "Partially Received",
    color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    icon: Package,
  },
  RECEIVED: {
    label: "Received",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: CheckCircle,
  },
  CLOSED: {
    label: "Closed",
    color: "bg-neutral-500/20 text-neutral-400 border-neutral-500/30",
    icon: Archive,
  },
  CANCELLED: {
    label: "Cancelled",
    color: "bg-red-500/20 text-red-400 border-red-500/30",
    icon: XCircle,
  },
};

export function PurchaseOrderDetail({
  purchaseOrder,
  userId,
}: PurchaseOrderDetailProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [rejectReason, setRejectReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  const statusConfig = STATUS_CONFIG[purchaseOrder.status];
  const StatusIcon = statusConfig.icon;

  const canSubmitForApproval = purchaseOrder.status === "DRAFT" && purchaseOrder.items.length > 0;
  const canApprove = purchaseOrder.status === "PENDING_APPROVAL";
  const canReject = purchaseOrder.status === "PENDING_APPROVAL";
  const canSendToSupplier = purchaseOrder.status === "APPROVED";
  const canReceive = ["SENT", "PARTIALLY_RECEIVED"].includes(purchaseOrder.status);
  const canClose = purchaseOrder.status === "RECEIVED";
  const canCancel = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT"].includes(purchaseOrder.status);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

  const getReceivingProgress = () => {
    const totalOrdered = purchaseOrder.items.reduce(
      (sum, item) => sum + Number(item.quantity),
      0
    );
    const totalReceived = purchaseOrder.items.reduce(
      (sum, item) => sum + Number(item.receivedQty),
      0
    );
    if (totalOrdered === 0) return 0;
    return Math.round((totalReceived / totalOrdered) * 100);
  };

  const handleSubmitForApproval = () => {
    startTransition(async () => {
      const result = await submitForApproval(purchaseOrder.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Purchase order submitted for approval");
        router.refresh();
      }
    });
  };

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approvePO(purchaseOrder.id, userId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Purchase order approved");
        router.refresh();
      }
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const result = await rejectPO(purchaseOrder.id, rejectReason.trim() || undefined);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Purchase order rejected");
        setIsRejectDialogOpen(false);
        router.refresh();
      }
    });
  };

  const handleSendToSupplier = () => {
    startTransition(async () => {
      const result = await sendToSupplier(purchaseOrder.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Purchase order sent to supplier");
        router.refresh();
      }
    });
  };

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelPO(purchaseOrder.id, cancelReason.trim() || undefined);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Purchase order cancelled");
        setIsCancelDialogOpen(false);
        router.refresh();
      }
    });
  };

  const handleClose = () => {
    startTransition(async () => {
      const result = await closePO(purchaseOrder.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Purchase order closed");
        router.refresh();
      }
    });
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
              <FileText className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">
                Purchase Order
              </h1>
              <p className="text-sm text-orange-400 font-mono">
                {purchaseOrder.poNumber}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {canSubmitForApproval && (
            <Button
              onClick={handleSubmitForApproval}
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit for Approval
            </Button>
          )}

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
                    <DialogTitle>Reject Purchase Order</DialogTitle>
                    <DialogDescription>
                      This will return the PO to draft status.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Rejection Reason (Optional)</Label>
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
                      disabled={isPending}
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

          {canSendToSupplier && (
            <Button
              onClick={handleSendToSupplier}
              disabled={isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send to Supplier
            </Button>
          )}

          {canReceive && (
            <Button
              asChild
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Link href={`/admin/inventory/purchase-orders/${purchaseOrder.id}/receive`}>
                <PackageOpen className="h-4 w-4 mr-2" />
                Receive Items
              </Link>
            </Button>
          )}

          {canClose && (
            <Button
              onClick={handleClose}
              disabled={isPending}
              className="bg-neutral-600 hover:bg-neutral-700"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Archive className="h-4 w-4 mr-2" />
              )}
              Close PO
            </Button>
          )}

          {canCancel && (
            <Dialog
              open={isCancelDialogOpen}
              onOpenChange={setIsCancelDialogOpen}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  disabled={isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel PO
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-neutral-900 border-white/10">
                <DialogHeader>
                  <DialogTitle>Cancel Purchase Order</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Cancellation Reason (Optional)</Label>
                    <Textarea
                      placeholder="Enter reason for cancellation..."
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      className="bg-neutral-800 border-white/10"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setIsCancelDialogOpen(false)}
                  >
                    Keep PO
                  </Button>
                  <Button
                    onClick={handleCancel}
                    disabled={isPending}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Cancel PO"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Status Banner */}
      <div
        className={`p-4 rounded-lg border ${statusConfig.color} flex items-center justify-between`}
      >
        <div className="flex items-center gap-3">
          <StatusIcon className="h-5 w-5" />
          <span className="font-medium">{statusConfig.label}</span>
        </div>
        {canReceive && (
          <div className="flex items-center gap-3">
            <span className="text-sm">Receiving Progress:</span>
            <div className="w-32 h-2 bg-black/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-current transition-all"
                style={{ width: `${getReceivingProgress()}%` }}
              />
            </div>
            <span className="text-sm font-medium">{getReceivingProgress()}%</span>
          </div>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Supplier Info */}
        <div className="p-4 bg-neutral-900/50 rounded-lg border border-white/10">
          <Label className="text-xs text-neutral-500 uppercase tracking-widest">
            Supplier
          </Label>
          <p className="text-white font-medium mt-2">
            {purchaseOrder.supplier.name}
          </p>
          {purchaseOrder.supplier.email && (
            <p className="text-xs text-neutral-400 mt-1">
              {purchaseOrder.supplier.email}
            </p>
          )}
          {purchaseOrder.supplier.phone && (
            <p className="text-xs text-neutral-400">
              {purchaseOrder.supplier.phone}
            </p>
          )}
        </div>

        {/* Warehouse Info */}
        <div className="p-4 bg-neutral-900/50 rounded-lg border border-white/10">
          <Label className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-widest">
            <Warehouse className="h-3 w-3" />
            Destination Warehouse
          </Label>
          <p className="text-white font-medium mt-2">
            {purchaseOrder.warehouse.name}
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            {purchaseOrder.warehouse.type.replace(/_/g, " ")}
          </p>
        </div>

        {/* Property Info */}
        <div className="p-4 bg-neutral-900/50 rounded-lg border border-white/10">
          <Label className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-widest">
            <Building2 className="h-3 w-3" />
            Property
          </Label>
          <p className="text-white font-medium mt-2">
            {purchaseOrder.property.name}
          </p>
        </div>

        {/* Dates Info */}
        <div className="p-4 bg-neutral-900/50 rounded-lg border border-white/10">
          <Label className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-widest">
            <Calendar className="h-3 w-3" />
            Dates
          </Label>
          <div className="mt-2 space-y-1">
            <p className="text-xs text-neutral-400">
              Created: {format(new Date(purchaseOrder.createdAt), "PPp")}
            </p>
            {purchaseOrder.expectedDate && (
              <p className="text-xs text-neutral-400">
                Expected: {format(new Date(purchaseOrder.expectedDate), "PP")}
              </p>
            )}
            {purchaseOrder.approvedAt && (
              <p className="text-xs text-green-400">
                Approved: {format(new Date(purchaseOrder.approvedAt), "PPp")}
              </p>
            )}
            {purchaseOrder.sentAt && (
              <p className="text-xs text-purple-400">
                Sent: {format(new Date(purchaseOrder.sentAt), "PPp")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Created By / Approved By */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-neutral-900/50 rounded-lg border border-white/10">
          <Label className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-widest">
            <User className="h-3 w-3" />
            Created By
          </Label>
          <p className="text-white mt-2">
            {purchaseOrder.createdBy.name || purchaseOrder.createdBy.email}
          </p>
        </div>
        {purchaseOrder.approvedBy && (
          <div className="p-4 bg-neutral-900/50 rounded-lg border border-white/10">
            <Label className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-widest">
              <CheckCircle className="h-3 w-3" />
              Approved By
            </Label>
            <p className="text-white mt-2">
              {purchaseOrder.approvedBy.name || purchaseOrder.approvedBy.email}
            </p>
          </div>
        )}
      </div>

      {/* Notes */}
      {purchaseOrder.notes && (
        <div className="p-4 bg-neutral-900/50 rounded-lg border border-white/10">
          <Label className="text-xs text-neutral-500 uppercase tracking-widest">
            Notes
          </Label>
          <p className="text-neutral-300 mt-2 whitespace-pre-wrap">
            {purchaseOrder.notes}
          </p>
        </div>
      )}

      {/* Items Table */}
      <div className="space-y-2">
        <Label className="text-xs text-neutral-500 uppercase tracking-widest">
          Order Items
        </Label>
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-neutral-400">Item</TableHead>
                <TableHead className="text-neutral-400 w-28">Ordered</TableHead>
                <TableHead className="text-neutral-400 w-28">Received</TableHead>
                <TableHead className="text-neutral-400 w-28">Remaining</TableHead>
                <TableHead className="text-neutral-400 w-28 text-right">
                  Unit Cost
                </TableHead>
                <TableHead className="text-neutral-400 w-32 text-right">
                  Line Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrder.items.map((item) => {
                const remaining = Number(item.quantity) - Number(item.receivedQty);
                const lineTotal = Number(item.quantity) * Number(item.unitCost);
                const isFullyReceived = remaining <= 0;

                return (
                  <TableRow key={item.id} className="border-white/10">
                    <TableCell>
                      <div>
                        <p className="text-white font-medium">
                          {item.stockItem.name}
                        </p>
                        <p className="text-xs text-neutral-500 font-mono">
                          {item.stockItem.itemCode}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-neutral-300">
                        {Number(item.quantity).toFixed(3)}{" "}
                        {item.stockItem.primaryUnit.abbreviation}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          Number(item.receivedQty) > 0
                            ? "text-green-400"
                            : "text-neutral-500"
                        }
                      >
                        {Number(item.receivedQty).toFixed(3)}{" "}
                        {item.stockItem.primaryUnit.abbreviation}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          isFullyReceived ? "text-green-400" : "text-orange-400"
                        }
                      >
                        {remaining.toFixed(3)}{" "}
                        {item.stockItem.primaryUnit.abbreviation}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-neutral-300">
                        {formatCurrency(Number(item.unitCost))}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-white font-medium">
                        {formatCurrency(lineTotal)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-2 p-4 bg-neutral-900/50 rounded-lg border border-white/10">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-400">Subtotal</span>
            <span className="text-white">
              {formatCurrency(Number(purchaseOrder.subtotal))}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-400">Tax</span>
            <span className="text-white">
              {formatCurrency(Number(purchaseOrder.taxAmount))}
            </span>
          </div>
          <div className="border-t border-white/10 pt-2 flex justify-between">
            <span className="text-neutral-400 font-medium">Total</span>
            <span className="text-orange-400 font-bold text-lg">
              {formatCurrency(Number(purchaseOrder.total))}
            </span>
          </div>
        </div>
      </div>

      {/* Receipts History */}
      {purchaseOrder.receipts.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-neutral-500 uppercase tracking-widest">
            Receiving History
          </Label>
          <div className="space-y-3">
            {purchaseOrder.receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="p-4 bg-neutral-900/50 rounded-lg border border-white/10"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-green-400" />
                    <span className="text-white font-medium">
                      Receipt #{receipt.id.slice(0, 8)}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-400">
                    {format(new Date(receipt.createdAt), "PPp")} by{" "}
                    {receipt.receivedBy.name || "Unknown"}
                  </div>
                </div>
                <div className="space-y-1">
                  {receipt.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-neutral-300">
                        {item.stockItem.name}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="text-green-400">
                          +{Number(item.quantity).toFixed(3)}
                        </span>
                        {item.batchNumber && (
                          <span className="text-xs text-neutral-500 font-mono">
                            Batch: {item.batchNumber}
                          </span>
                        )}
                        {item.expirationDate && (
                          <span className="text-xs text-neutral-500">
                            Exp: {format(new Date(item.expirationDate), "PP")}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {receipt.notes && (
                  <p className="text-xs text-neutral-400 mt-2 pt-2 border-t border-white/5">
                    {receipt.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
