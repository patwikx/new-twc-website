"use client";

import * as React from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Eye,
  ArrowRight,
  ClipboardList,
  Clock,
  CheckCircle,
  XCircle,
  Package,
} from "lucide-react";
import Link from "next/link";
import { RequisitionStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";

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

interface RequisitionData {
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
}

interface RequisitionsTableProps {
  requisitions: RequisitionData[];
}

const STATUS_CONFIG: Record<RequisitionStatus, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: {
    label: "Pending",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    icon: Clock,
  },
  APPROVED: {
    label: "Approved",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    icon: CheckCircle,
  },
  PARTIALLY_FULFILLED: {
    label: "Partial",
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

export function RequisitionsTable({ requisitions }: RequisitionsTableProps) {
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const filteredRequisitions = React.useMemo(() => {
    if (statusFilter === "all") return requisitions;
    return requisitions.filter((req) => req.status === statusFilter);
  }, [requisitions, statusFilter]);

  const resetFilters = () => {
    setStatusFilter("all");
  };

  const getItemsSummary = (items: RequisitionItem[]) => {
    const totalItems = items.length;
    const totalRequested = items.reduce((sum, item) => sum + Number(item.requestedQuantity), 0);
    const totalFulfilled = items.reduce((sum, item) => sum + Number(item.fulfilledQuantity), 0);
    return { totalItems, totalRequested, totalFulfilled };
  };

  const getFulfillmentProgress = (items: RequisitionItem[]) => {
    const totalRequested = items.reduce((sum, item) => sum + Number(item.requestedQuantity), 0);
    const totalFulfilled = items.reduce((sum, item) => sum + Number(item.fulfilledQuantity), 0);
    if (totalRequested === 0) return 0;
    return Math.round((totalFulfilled / totalRequested) * 100);
  };

  return (
    <div className="w-full space-y-4">
      {/* Filters Row */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex flex-1 flex-wrap items-center gap-2 w-full">
          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-neutral-900 border-white/10">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="PARTIALLY_FULFILLED">Partially Fulfilled</SelectItem>
              <SelectItem value="FULFILLED">Fulfilled</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={resetFilters}
          >
            Reset
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            className="h-9 gap-1 bg-orange-600 hover:bg-orange-700 text-white rounded-none uppercase tracking-widest text-xs"
          >
            <Link href="/admin/inventory/requisitions/new">
              <Plus className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                New Requisition
              </span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-white/10 bg-neutral-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-neutral-900/50">
              <TableHead className="w-[100px] pl-4 uppercase tracking-widest text-xs font-medium text-neutral-400">
                ID
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Transfer
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Items
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Progress
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Status
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Created
              </TableHead>
              <TableHead className="text-right pr-4 uppercase tracking-widest text-xs font-medium text-neutral-400">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequisitions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No requisitions found.
                </TableCell>
              </TableRow>
            ) : (
              filteredRequisitions.map((requisition) => {
                const statusConfig = STATUS_CONFIG[requisition.status];
                const StatusIcon = statusConfig.icon;
                const { totalItems } = getItemsSummary(requisition.items);
                const progress = getFulfillmentProgress(requisition.items);

                return (
                  <TableRow
                    key={requisition.id}
                    className="border-white/10 hover:bg-white/5"
                  >
                    <TableCell className="pl-4 py-3">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-neutral-400" />
                        <span className="font-mono text-xs text-neutral-400">
                          {requisition.id.slice(0, 8)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-neutral-300">
                          {requisition.sourceWarehouse.name}
                        </span>
                        <ArrowRight className="h-4 w-4 text-orange-500" />
                        <span className="text-sm text-white font-medium">
                          {requisition.requestingWarehouse.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-neutral-300">
                        {totalItems} item{totalItems !== 1 ? "s" : ""}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-500 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-neutral-400">
                          {progress}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${statusConfig.color} flex items-center gap-1 w-fit`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-neutral-400">
                        {formatDistanceToNow(new Date(requisition.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-white/10"
                      >
                        <Link href={`/admin/inventory/requisitions/${requisition.id}`}>
                          <Eye className="h-3.5 w-3.5" />
                          <span className="sr-only">View</span>
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground">
        Showing <strong>{filteredRequisitions.length}</strong> of{" "}
        <strong>{requisitions.length}</strong> requisitions.
      </div>
    </div>
  );
}
