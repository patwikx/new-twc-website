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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Eye,
  Play,
  XCircle,
  ClipboardCheck,
  Clock,
  CheckCircle,
  FileEdit,
  AlertTriangle,
  MoreHorizontal,
  Calendar,
  Warehouse,
  CalendarDays,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import Link from "next/link";
import { CycleCountStatus, CycleCountType } from "@prisma/client";
import { formatDistanceToNow, format } from "date-fns";
import { startCycleCount, cancelCycleCount } from "@/lib/inventory/cycle-count";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface CycleCountData {
  id: string;
  countNumber: string;
  type: CycleCountType;
  status: CycleCountStatus;
  blindCount: boolean;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  totalItems: number | null;
  itemsCounted: number | null;
  itemsWithVariance: number | null;
  totalVarianceCost: number | null;
  accuracyPercent: number | null;
  createdAt: Date;
  warehouse: {
    id: string;
    name: string;
    type: string;
    property: {
      id: string;
      name: string;
    };
  };
}

interface WarehouseOption {
  id: string;
  name: string;
}

interface CycleCountsTableProps {
  cycleCounts: CycleCountData[];
  warehouses: WarehouseOption[];
  permissions: {
    canCreate: boolean;
    canCount: boolean;
    canCancel: boolean;
  };
}


const STATUS_CONFIG: Record<CycleCountStatus, { label: string; color: string; icon: React.ElementType }> = {
  DRAFT: {
    label: "Draft",
    color: "bg-neutral-500/20 text-neutral-400 border-neutral-500/30",
    icon: FileEdit,
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

export function CycleCountsTable({ cycleCounts, warehouses, permissions }: CycleCountsTableProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [warehouseFilter, setWarehouseFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
  const [isLoading, setIsLoading] = React.useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [startDialogOpen, setStartDialogOpen] = React.useState(false);
  const [selectedCount, setSelectedCount] = React.useState<CycleCountData | null>(null);

  const filteredCycleCounts = React.useMemo(() => {
    let result = cycleCounts;

    if (statusFilter !== "all") {
      result = result.filter((cc) => cc.status === statusFilter);
    }

    if (warehouseFilter !== "all") {
      result = result.filter((cc) => cc.warehouse.id === warehouseFilter);
    }

    if (typeFilter !== "all") {
      result = result.filter((cc) => cc.type === typeFilter);
    }

    // Date range filter
    if (dateRange?.from) {
      result = result.filter((cc) => {
        const createdDate = new Date(cc.createdAt);
        if (dateRange.from && createdDate < dateRange.from) return false;
        if (dateRange.to && createdDate > dateRange.to) return false;
        return true;
      });
    }

    return result;
  }, [cycleCounts, statusFilter, warehouseFilter, typeFilter, dateRange]);

  const resetFilters = () => {
    setStatusFilter("all");
    setWarehouseFilter("all");
    setTypeFilter("all");
    setDateRange(undefined);
  };

  const handleStartCount = async () => {
    if (!selectedCount) return;
    
    setIsLoading(selectedCount.id);
    try {
      const result = await startCycleCount(selectedCount.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Cycle count started successfully");
        router.refresh();
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsLoading(null);
      setStartDialogOpen(false);
      setSelectedCount(null);
    }
  };

  const handleCancelCount = async () => {
    if (!selectedCount) return;
    
    setIsLoading(selectedCount.id);
    try {
      const result = await cancelCycleCount(selectedCount.id, "Cancelled by user");
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Cycle count cancelled");
        router.refresh();
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsLoading(null);
      setCancelDialogOpen(false);
      setSelectedCount(null);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "—";
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatAccuracy = (value: number | null) => {
    if (value === null) return "—";
    return `${value.toFixed(1)}%`;
  };

  const canStartCount = (status: CycleCountStatus) => {
    return (status === "DRAFT" || status === "SCHEDULED") && permissions.canCount;
  };

  const canCancelCount = (status: CycleCountStatus) => {
    return status !== "COMPLETED" && status !== "CANCELLED" && permissions.canCancel;
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
              {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                <SelectItem key={value} value={value}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Warehouse Filter */}
          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger className="w-[180px] bg-neutral-900 border-white/10">
              <SelectValue placeholder="All Warehouses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Warehouses</SelectItem>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Type Filter */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px] bg-neutral-900 border-white/10">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Range Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-[200px] justify-start text-left font-normal bg-neutral-900 border-white/10"
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d")}
                    </>
                  ) : (
                    format(dateRange.from, "MMM d, yyyy")
                  )
                ) : (
                  <span className="text-muted-foreground">Date Range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-neutral-900 border-white/10" align="start">
              <CalendarComponent
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={resetFilters}
          >
            Reset
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {permissions.canCreate && (
            <Button
              asChild
              size="sm"
              className="h-9 gap-1 bg-orange-600 hover:bg-orange-700 text-white rounded-none uppercase tracking-widest text-xs"
            >
              <Link href="/admin/inventory/cycle-counts/new">
                <Plus className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  New Cycle Count
                </span>
              </Link>
            </Button>
          )}
        </div>
      </div>


      {/* Table */}
      <div className="rounded-md border border-white/10 bg-neutral-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-neutral-900/50">
              <TableHead className="w-[140px] pl-4 uppercase tracking-widest text-xs font-medium text-neutral-400">
                Count #
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Warehouse
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Type
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Status
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Scheduled
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Items
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Accuracy
              </TableHead>
              <TableHead className="text-right pr-4 uppercase tracking-widest text-xs font-medium text-neutral-400">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCycleCounts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  No cycle counts found.
                </TableCell>
              </TableRow>
            ) : (
              filteredCycleCounts.map((cycleCount) => {
                const statusConfig = STATUS_CONFIG[cycleCount.status];
                const StatusIcon = statusConfig.icon;

                return (
                  <TableRow
                    key={cycleCount.id}
                    className="border-white/10 hover:bg-white/5"
                  >
                    <TableCell className="pl-4 py-3">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4 text-neutral-400" />
                        <span className="font-mono text-sm text-white">
                          {cycleCount.countNumber}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Warehouse className="h-4 w-4 text-neutral-500" />
                        <span className="text-sm text-neutral-300">
                          {cycleCount.warehouse.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-neutral-300">
                        {TYPE_LABELS[cycleCount.type]}
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
                      {cycleCount.scheduledAt ? (
                        <span className="text-sm text-neutral-400">
                          {format(new Date(cycleCount.scheduledAt), "MMM d, yyyy")}
                        </span>
                      ) : (
                        <span className="text-sm text-neutral-500">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm text-neutral-300">
                          {cycleCount.totalItems ?? 0} items
                        </span>
                        {cycleCount.itemsCounted !== null && cycleCount.totalItems !== null && cycleCount.totalItems > 0 && (
                          <span className="text-xs text-neutral-500">
                            {cycleCount.itemsCounted}/{cycleCount.totalItems} counted
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {cycleCount.status === "COMPLETED" ? (
                        <div className="flex flex-col">
                          <span className={`text-sm font-medium ${
                            (cycleCount.accuracyPercent ?? 0) >= 95 
                              ? "text-green-400" 
                              : (cycleCount.accuracyPercent ?? 0) >= 90 
                                ? "text-yellow-400" 
                                : "text-red-400"
                          }`}>
                            {formatAccuracy(cycleCount.accuracyPercent)}
                          </span>
                          {cycleCount.totalVarianceCost !== null && cycleCount.totalVarianceCost > 0 && (
                            <span className="text-xs text-neutral-500">
                              {formatCurrency(cycleCount.totalVarianceCost)} variance
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-neutral-500">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-white/10"
                            disabled={isLoading === cycleCount.id}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-neutral-900 border-white/10">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/inventory/cycle-counts/${cycleCount.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          
                          {canStartCount(cycleCount.status) && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedCount(cycleCount);
                                setStartDialogOpen(true);
                              }}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Start Count
                            </DropdownMenuItem>
                          )}
                          
                          {canCancelCount(cycleCount.status) && (
                            <>
                              <DropdownMenuSeparator className="bg-white/10" />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => {
                                  setSelectedCount(cycleCount);
                                  setCancelDialogOpen(true);
                                }}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Cancel Count
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground">
        Showing <strong>{filteredCycleCounts.length}</strong> of{" "}
        <strong>{cycleCounts.length}</strong> cycle counts.
      </div>

      {/* Start Confirmation Dialog */}
      <AlertDialog open={startDialogOpen} onOpenChange={setStartDialogOpen}>
        <AlertDialogContent className="bg-neutral-900 border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Start Cycle Count</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to start cycle count{" "}
              <strong>{selectedCount?.countNumber}</strong>? This will lock the
              current system quantities as the baseline for counting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-neutral-800 border-white/10 hover:bg-neutral-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStartCount}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Start Count
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent className="bg-neutral-900 border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Cycle Count</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel cycle count{" "}
              <strong>{selectedCount?.countNumber}</strong>? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-neutral-800 border-white/10 hover:bg-neutral-700">
              Keep Count
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelCount}
              className="bg-red-600 hover:bg-red-700"
            >
              Cancel Count
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
