"use client";

import { useTransition, useState, useMemo } from "react";
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
  startCycleCount,
  submitForReview,
  approveCycleCount,
  rejectCycleCount,
  cancelCycleCount,
  createAdjustments,
} from "@/lib/inventory/cycle-count";
import { CountEntryForm } from "./count-entry-form";
import { VarianceReviewTable } from "./variance-review-table";
import {
  Loader2,
  ArrowLeft,
  ClipboardCheck,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  Send,
  Check,
  X,
  AlertTriangle,
  Warehouse,
  Calendar,
  EyeOff,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  Ban,
} from "lucide-react";
import { CycleCountStatus, CycleCountType } from "@prisma/client";
import { formatDistanceToNow, format } from "date-fns";

interface CycleCountItem {
  id: string;
  stockItemId: string;
  batchId: string | null;
  systemQuantity: number;
  countedQuantity: number | null;
  variance: number | null;
  variancePercent: number | null;
  varianceCost: number | null;
  unitCost: number | null;
  countedById: string | null;
  countedAt: Date | null;
  notes: string | null;
  adjustmentMade: boolean;
  adjustmentId: string | null;
  stockItem: {
    id: string;
    name: string;
    itemCode: string;
    sku: string | null;
    primaryUnit: {
      id: string;
      name: string;
      abbreviation: string;
    };
    category: {
      id: string;
      name: string;
      color: string | null;
    } | null;
  };
  batch: {
    id: string;
    batchNumber: string;
    expirationDate: Date | null;
  } | null;
}

interface CycleCountDetailProps {
  cycleCount: {
    id: string;
    countNumber: string;
    type: CycleCountType;
    status: CycleCountStatus;
    blindCount: boolean;
    scheduledAt: Date | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdById: string;
    approvedById: string | null;
    notes: string | null;
    totalItems: number | null;
    itemsCounted: number | null;
    itemsWithVariance: number | null;
    totalVarianceCost: number | null;
    accuracyPercent: number | null;
    createdAt: Date;
    updatedAt: Date;
    warehouse: {
      id: string;
      name: string;
      type: string;
      property: {
        id: string;
        name: string;
      } | null;
    };
    items: CycleCountItem[];
  };
  userId: string;
  permissions: {
    canCount: boolean;
    canApprove: boolean;
    canCancel: boolean;
    canCreate: boolean;
  };
}

const STATUS_CONFIG: Record<
  CycleCountStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  DRAFT: {
    label: "Draft",
    color: "bg-neutral-500/20 text-neutral-400 border-neutral-500/30",
    icon: FileText,
  },
  SCHEDULED: {
    label: "Scheduled",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    icon: Calendar,
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    icon: Clock,
  },
  PENDING_REVIEW: {
    label: "Pending Review",
    color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    icon: AlertTriangle,
  },
  COMPLETED: {
    label: "Completed",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: CheckCircle,
  },
  CANCELLED: {
    label: "Cancelled",
    color: "bg-red-500/20 text-red-400 border-red-500/30",
    icon: XCircle,
  },
};

const TYPE_LABELS: Record<CycleCountType, string> = {
  FULL: "Full Count",
  ABC_CLASS_A: "ABC Class A",
  ABC_CLASS_B: "ABC Class B",
  ABC_CLASS_C: "ABC Class C",
  RANDOM: "Random Sample",
  SPOT: "Spot Check",
};

export function CycleCountDetail({
  cycleCount,
  userId,
  permissions,
}: CycleCountDetailProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // State for dialogs
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [clearCountsOnReject, setClearCountsOnReject] = useState(false);

  const statusConfig = STATUS_CONFIG[cycleCount.status];
  const StatusIcon = statusConfig.icon;

  // Determine available actions based on status AND permissions
  const canStart = (cycleCount.status === "DRAFT" || cycleCount.status === "SCHEDULED") && permissions.canCount;
  const canApprove = cycleCount.status === "PENDING_REVIEW" && permissions.canApprove;
  const canReject = cycleCount.status === "PENDING_REVIEW" && permissions.canApprove;
  const canCancel = cycleCount.status !== "COMPLETED" && cycleCount.status !== "CANCELLED" && permissions.canCancel;
  const canEnterCounts = cycleCount.status === "IN_PROGRESS" && permissions.canCount;
  const canSubmitForReview = cycleCount.status === "IN_PROGRESS" && permissions.canCount;

  // Calculate progress
  const progress = useMemo(() => {
    const total = cycleCount.items.length;
    const counted = cycleCount.items.filter((item) => item.countedQuantity !== null).length;
    const remaining = total - counted;
    const percent = total > 0 ? Math.round((counted / total) * 100) : 0;
    return { total, counted, remaining, percent };
  }, [cycleCount.items]);

  // Calculate variance summary
  const varianceSummary = useMemo(() => {
    const itemsWithVariance = cycleCount.items.filter(
      (item) => item.variance !== null && item.variance !== 0
    );
    const positiveVariance = itemsWithVariance.filter((item) => item.variance! > 0);
    const negativeVariance = itemsWithVariance.filter((item) => item.variance! < 0);
    
    const totalPositiveCost = positiveVariance.reduce(
      (sum, item) => sum + (item.varianceCost || 0),
      0
    );
    const totalNegativeCost = negativeVariance.reduce(
      (sum, item) => sum + Math.abs(item.varianceCost || 0),
      0
    );

    return {
      total: itemsWithVariance.length,
      positive: positiveVariance.length,
      negative: negativeVariance.length,
      totalPositiveCost,
      totalNegativeCost,
      netCost: totalPositiveCost - totalNegativeCost,
    };
  }, [cycleCount.items]);

  // Handlers
  const handleStart = () => {
    startTransition(async () => {
      const result = await startCycleCount(cycleCount.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Cycle count started. System quantities have been locked.");
        router.refresh();
      }
    });
  };

  const handleSubmitForReview = () => {
    if (progress.remaining > 0) {
      toast.error(`Cannot submit. ${progress.remaining} item(s) have not been counted yet.`);
      return;
    }

    startTransition(async () => {
      const result = await submitForReview(cycleCount.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Cycle count submitted for review");
        router.refresh();
      }
    });
  };

  const handleApprove = () => {
    startTransition(async () => {
      // First approve the cycle count
      const approveResult = await approveCycleCount(cycleCount.id, userId);
      if (approveResult.error) {
        toast.error(approveResult.error);
        return;
      }

      // Then create adjustments for items with variance
      const adjustResult = await createAdjustments(cycleCount.id, userId);
      if (adjustResult.error) {
        toast.error(`Approved but failed to create adjustments: ${adjustResult.error}`);
      } else {
        const adjustCount = adjustResult.data?.adjustmentsCreated || 0;
        toast.success(`Cycle count approved. ${adjustCount} adjustment(s) created.`);
      }
      router.refresh();
    });
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    startTransition(async () => {
      const result = await rejectCycleCount(cycleCount.id, rejectReason.trim(), {
        clearCounts: clearCountsOnReject,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Cycle count rejected and returned to In Progress");
        setIsRejectDialogOpen(false);
        setRejectReason("");
        router.refresh();
      }
    });
  };

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelCycleCount(cycleCount.id, cancelReason.trim() || undefined);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Cycle count cancelled");
        setIsCancelDialogOpen(false);
        setCancelReason("");
        router.refresh();
      }
    });
  };

  const getVarianceColor = (variance: number | null) => {
    if (variance === null || variance === 0) return "text-neutral-400";
    if (variance > 0) return "text-green-400";
    return "text-red-400";
  };

  const getVarianceIcon = (variance: number | null) => {
    if (variance === null || variance === 0) return Minus;
    if (variance > 0) return TrendingUp;
    return TrendingDown;
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "—";
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin/inventory/cycle-counts")}
            className="text-neutral-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">
                {cycleCount.countNumber}
              </h1>
              <p className="text-sm text-neutral-400">
                {TYPE_LABELS[cycleCount.type]} • {cycleCount.warehouse.name}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {canStart && (
            <Button
              onClick={handleStart}
              disabled={isPending || cycleCount.items.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Start Count
            </Button>
          )}

          {canApprove && (
            <>
              <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
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
                    <DialogTitle>Reject Cycle Count</DialogTitle>
                    <DialogDescription>
                      This will return the cycle count to In Progress status for recounting.
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
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="clearCounts"
                        checked={clearCountsOnReject}
                        onChange={(e) => setClearCountsOnReject(e.target.checked)}
                        className="rounded border-white/10"
                      />
                      <Label htmlFor="clearCounts" className="text-sm text-neutral-400">
                        Clear all counted quantities (require full recount)
                      </Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsRejectDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleReject}
                      disabled={isPending || !rejectReason.trim()}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject"}
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
                Approve & Adjust
              </Button>
            </>
          )}

          {canCancel && (
            <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-neutral-500/30 text-neutral-400 hover:bg-neutral-500/10"
                  disabled={isPending}
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-neutral-900 border-white/10">
                <DialogHeader>
                  <DialogTitle>Cancel Cycle Count</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. The cycle count will be marked as cancelled.
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
                  <Button variant="ghost" onClick={() => setIsCancelDialogOpen(false)}>
                    Keep Count
                  </Button>
                  <Button
                    onClick={handleCancel}
                    disabled={isPending}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel Count"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Status Banner */}
      <div className={`p-4 rounded-lg border ${statusConfig.color} flex items-center gap-3`}>
        <StatusIcon className="h-5 w-5" />
        <span className="font-medium">{statusConfig.label}</span>
        {cycleCount.blindCount && (
          <Badge variant="outline" className="ml-2 border-white/20">
            <EyeOff className="h-3 w-3 mr-1" />
            Blind Count
          </Badge>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Warehouse Info */}
        <div className="p-4 bg-neutral-900/50 rounded-lg border border-white/10">
          <Label className="text-xs text-neutral-500 uppercase tracking-widest flex items-center gap-1">
            <Warehouse className="h-3 w-3" />
            Warehouse
          </Label>
          <p className="text-white mt-2 font-medium">{cycleCount.warehouse.name}</p>
          <p className="text-xs text-neutral-500">{cycleCount.warehouse.type}</p>
        </div>

        {/* Progress */}
        <div className="p-4 bg-neutral-900/50 rounded-lg border border-white/10">
          <Label className="text-xs text-neutral-500 uppercase tracking-widest flex items-center gap-1">
            <Package className="h-3 w-3" />
            Progress
          </Label>
          <p className="text-white mt-2 text-2xl font-semibold">{progress.percent}%</p>
          <p className="text-xs text-neutral-500">
            {progress.counted} / {progress.total} items counted
          </p>
        </div>

        {/* Accuracy (if available) */}
        <div className="p-4 bg-neutral-900/50 rounded-lg border border-white/10">
          <Label className="text-xs text-neutral-500 uppercase tracking-widest flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Accuracy
          </Label>
          <p className="text-white mt-2 text-2xl font-semibold">
            {cycleCount.accuracyPercent !== null
              ? `${cycleCount.accuracyPercent.toFixed(1)}%`
              : "—"}
          </p>
          <p className="text-xs text-neutral-500">
            {varianceSummary.total} item(s) with variance
          </p>
        </div>

        {/* Variance Cost */}
        <div className="p-4 bg-neutral-900/50 rounded-lg border border-white/10">
          <Label className="text-xs text-neutral-500 uppercase tracking-widest flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Variance Cost
          </Label>
          <p className={`mt-2 text-2xl font-semibold ${
            varianceSummary.netCost > 0 ? "text-green-400" : 
            varianceSummary.netCost < 0 ? "text-red-400" : "text-white"
          }`}>
            {formatCurrency(varianceSummary.netCost)}
          </p>
          <p className="text-xs text-neutral-500">
            +{formatCurrency(varianceSummary.totalPositiveCost)} / -{formatCurrency(varianceSummary.totalNegativeCost)}
          </p>
        </div>
      </div>

      {/* Timestamps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-neutral-900/50 rounded-lg border border-white/10">
          <Label className="text-xs text-neutral-500 uppercase tracking-widest">Created</Label>
          <p className="text-white mt-2">{format(new Date(cycleCount.createdAt), "PPp")}</p>
          <p className="text-xs text-neutral-500">
            {formatDistanceToNow(new Date(cycleCount.createdAt), { addSuffix: true })}
          </p>
        </div>
        {cycleCount.startedAt && (
          <div className="p-4 bg-neutral-900/50 rounded-lg border border-white/10">
            <Label className="text-xs text-neutral-500 uppercase tracking-widest">Started</Label>
            <p className="text-white mt-2">{format(new Date(cycleCount.startedAt), "PPp")}</p>
            <p className="text-xs text-neutral-500">
              {formatDistanceToNow(new Date(cycleCount.startedAt), { addSuffix: true })}
            </p>
          </div>
        )}
        {cycleCount.completedAt && (
          <div className="p-4 bg-neutral-900/50 rounded-lg border border-white/10">
            <Label className="text-xs text-neutral-500 uppercase tracking-widest">Completed</Label>
            <p className="text-white mt-2">{format(new Date(cycleCount.completedAt), "PPp")}</p>
            <p className="text-xs text-neutral-500">
              {formatDistanceToNow(new Date(cycleCount.completedAt), { addSuffix: true })}
            </p>
          </div>
        )}
        {cycleCount.scheduledAt && !cycleCount.startedAt && (
          <div className="p-4 bg-neutral-900/50 rounded-lg border border-white/10">
            <Label className="text-xs text-neutral-500 uppercase tracking-widest">Scheduled For</Label>
            <p className="text-white mt-2">{format(new Date(cycleCount.scheduledAt), "PPp")}</p>
          </div>
        )}
      </div>

      {/* Notes */}
      {cycleCount.notes && (
        <div className="p-4 bg-neutral-900/50 rounded-lg border border-white/10">
          <Label className="text-xs text-neutral-500 uppercase tracking-widest">Notes</Label>
          <p className="text-neutral-300 mt-2 whitespace-pre-wrap">{cycleCount.notes}</p>
        </div>
      )}

      {/* Count Entry Form - shown during IN_PROGRESS status */}
      {cycleCount.status === "IN_PROGRESS" ? (
        <div className="space-y-4">
          {canEnterCounts ? (
            <>
              <CountEntryForm
                cycleCountId={cycleCount.id}
                items={cycleCount.items}
                blindCount={cycleCount.blindCount}
                userId={userId}
              />
              
              {/* Submit for Review Button */}
              {canSubmitForReview && (
                <div className="flex justify-end pt-4 border-t border-white/10">
                  <Button
                    onClick={handleSubmitForReview}
                    disabled={isPending || progress.remaining > 0}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Submit for Review
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center border border-white/10 rounded-lg">
              <p className="text-neutral-400">You do not have permission to enter counts.</p>
            </div>
          )}
        </div>
      ) : (cycleCount.status === "PENDING_REVIEW" || cycleCount.status === "COMPLETED") ? (
        /* Variance Review Table - shown for PENDING_REVIEW and COMPLETED statuses */
        <VarianceReviewTable items={cycleCount.items} />
      ) : (
        /* Items Table - shown for DRAFT, SCHEDULED, and CANCELLED statuses */
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-neutral-400">Item</TableHead>
                <TableHead className="text-neutral-400 w-32">System Qty</TableHead>
                <TableHead className="text-neutral-400 w-40">Counted Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cycleCount.items.map((item) => {
                const isCounted = item.countedQuantity !== null;
                
                return (
                  <TableRow key={item.id} className="border-white/10">
                    <TableCell>
                      <div>
                        <p className="text-white font-medium">{item.stockItem.name}</p>
                        <div className="flex items-center gap-2 text-xs text-neutral-500">
                          <span className="font-mono">{item.stockItem.itemCode}</span>
                          {item.batch && (
                            <Badge variant="outline" className="text-xs border-white/10">
                              Batch: {item.batch.batchNumber}
                            </Badge>
                          )}
                          {item.stockItem.category && (
                            <span
                              className="px-1.5 py-0.5 rounded text-xs"
                              style={{
                                backgroundColor: item.stockItem.category.color
                                  ? `${item.stockItem.category.color}20`
                                  : undefined,
                                color: item.stockItem.category.color || undefined,
                              }}
                            >
                              {item.stockItem.category.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* System Quantity */}
                    <TableCell>
                      <span className="text-neutral-300">
                        {item.systemQuantity.toFixed(3)} {item.stockItem.primaryUnit.abbreviation}
                      </span>
                    </TableCell>

                    {/* Counted Quantity */}
                    <TableCell>
                      <span className={isCounted ? "text-white" : "text-neutral-500"}>
                        {isCounted
                          ? `${item.countedQuantity!.toFixed(3)} ${item.stockItem.primaryUnit.abbreviation}`
                          : "—"}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
              {cycleCount.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-neutral-500 py-8">
                    No items in this cycle count
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
