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
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Package,
  Archive,
  Download,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { POStatus } from "@prisma/client";
import { formatDistanceToNow, format } from "date-fns";
import { exportPurchaseOrders } from "@/lib/bulk/export";
import { toast } from "sonner";

interface PurchaseOrderData {
  id: string;
  poNumber: string;
  status: POStatus;
  subtotal: number;
  taxAmount: number;
  total: number;
  expectedDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  property: {
    id: string;
    name: string;
  };
  supplier: {
    id: string;
    name: string;
  };
  warehouse: {
    id: string;
    name: string;
  };
  createdBy: {
    id: string;
    name: string | null;
  };
  _count: {
    items: number;
  };
}

interface PurchaseOrdersTableProps {
  purchaseOrders: PurchaseOrderData[];
  propertyId?: string;
}

const STATUS_CONFIG: Record<POStatus, { label: string; color: string; icon: React.ElementType }> = {
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
    label: "Partial",
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

export function PurchaseOrdersTable({ purchaseOrders, propertyId }: PurchaseOrdersTableProps) {
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [isExporting, setIsExporting] = React.useState(false);

  const filteredOrders = React.useMemo(() => {
    if (statusFilter === "all") return purchaseOrders;
    return purchaseOrders.filter((po) => po.status === statusFilter);
  }, [purchaseOrders, statusFilter]);

  const resetFilters = () => {
    setStatusFilter("all");
  };

  const handleExport = async () => {
    if (!propertyId) {
      toast.error("No property selected for export");
      return;
    }
    
    setIsExporting(true);
    try {
      const result = await exportPurchaseOrders(propertyId);

      if (!result.success) {
        toast.error(result.error || "Export failed");
        return;
      }

      // Create and download the file
      const blob = new Blob([result.data], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${result.rowCount} purchase orders`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export purchase orders");
    } finally {
      setIsExporting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

  return (
    <div className="w-full space-y-4">
      {/* Filters Row */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex flex-1 flex-wrap items-center gap-2 w-full">
          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px] bg-neutral-900 border-white/10">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="SENT">Sent to Supplier</SelectItem>
              <SelectItem value="PARTIALLY_RECEIVED">Partially Received</SelectItem>
              <SelectItem value="RECEIVED">Received</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
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
          {/* Export Button */}
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1 bg-neutral-800 border-white/10 hover:bg-neutral-700 text-white rounded-none uppercase tracking-widest text-xs"
            onClick={handleExport}
            disabled={isExporting || !propertyId}
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Export
            </span>
          </Button>

          <Button
            asChild
            size="sm"
            className="h-9 gap-1 bg-orange-600 hover:bg-orange-700 text-white rounded-none uppercase tracking-widest text-xs"
          >
            <Link href="/admin/inventory/purchase-orders/new">
              <Plus className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                New Purchase Order
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
              <TableHead className="w-[140px] pl-4 uppercase tracking-widest text-xs font-medium text-neutral-400">
                PO Number
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Supplier
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Warehouse
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Items
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Total
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
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  No purchase orders found.
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((po) => {
                const statusConfig = STATUS_CONFIG[po.status];
                const StatusIcon = statusConfig.icon;

                return (
                  <TableRow
                    key={po.id}
                    className="border-white/10 hover:bg-white/5"
                  >
                    <TableCell className="pl-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-neutral-400" />
                        <span className="font-mono text-sm text-orange-400">
                          {po.poNumber}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-white font-medium">
                        {po.supplier.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-neutral-300">
                        {po.warehouse.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-neutral-300">
                        {po._count.items} item{po._count.items !== 1 ? "s" : ""}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-white font-medium">
                        {formatCurrency(Number(po.total))}
                      </span>
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
                      <div className="flex flex-col">
                        <span className="text-sm text-neutral-300">
                          {format(new Date(po.createdAt), "MMM d, yyyy")}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {formatDistanceToNow(new Date(po.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-white/10"
                      >
                        <Link href={`/admin/inventory/purchase-orders/${po.id}`}>
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
        Showing <strong>{filteredOrders.length}</strong> of{" "}
        <strong>{purchaseOrders.length}</strong> purchase orders.
      </div>
    </div>
  );
}
