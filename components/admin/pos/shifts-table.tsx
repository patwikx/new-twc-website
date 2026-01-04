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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Clock,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { ShiftStatus } from "@prisma/client";
import { format } from "date-fns";

interface ShiftData {
  id: string;
  outletId: string;
  outletName: string;
  cashierId: string;
  cashierName: string | null;
  startingCash: number;
  endingCash: number | null;
  expectedCash: number | null;
  variance: number | null;
  status: ShiftStatus;
  openedAt: Date;
  closedAt: Date | null;
  orderCount: number;
}

interface Outlet {
  id: string;
  name: string;
}

interface ShiftsTableProps {
  shifts: ShiftData[];
  outlets: Outlet[];
  onViewReport: (shiftId: string) => void;
}

const STATUS_COLORS: Record<ShiftStatus, string> = {
  OPEN: "bg-green-500/20 text-green-400 border-green-500/30",
  CLOSED: "bg-neutral-500/20 text-neutral-400 border-neutral-500/30",
};

export function ShiftsTable({ shifts, outlets, onViewReport }: ShiftsTableProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [outletFilter, setOutletFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDateTime = (date: Date) => {
    return format(new Date(date), "MMM d, yyyy h:mm a");
  };

  const formatDuration = (start: Date, end: Date | null) => {
    if (!end) return "Ongoing";
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // Filter shifts
  const filteredShifts = React.useMemo(() => {
    let result = shifts;

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        (shift) =>
          shift.cashierName?.toLowerCase().includes(lowerQuery) ||
          shift.outletName.toLowerCase().includes(lowerQuery)
      );
    }

    if (outletFilter !== "all") {
      result = result.filter((shift) => shift.outletId === outletFilter);
    }

    if (statusFilter !== "all") {
      result = result.filter((shift) => shift.status === statusFilter);
    }

    return result;
  }, [shifts, searchQuery, outletFilter, statusFilter]);

  const resetFilters = () => {
    setSearchQuery("");
    setOutletFilter("all");
    setStatusFilter("all");
  };

  const getVarianceIcon = (variance: number | null) => {
    if (variance === null) return null;
    if (variance > 0) return <TrendingUp className="h-4 w-4 text-green-400" />;
    if (variance < 0) return <TrendingDown className="h-4 w-4 text-red-400" />;
    return <Minus className="h-4 w-4 text-neutral-400" />;
  };

  const getVarianceColor = (variance: number | null) => {
    if (variance === null) return "text-neutral-400";
    if (variance > 0) return "text-green-400";
    if (variance < 0) return "text-red-400";
    return "text-neutral-400";
  };

  return (
    <div className="w-full space-y-4">
      {/* Filters Row */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex flex-1 flex-wrap items-center gap-2 w-full">
          {/* Search */}
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by cashier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-neutral-900 border-white/10"
            />
          </div>

          {/* Outlet Filter */}
          {outlets.length > 1 && (
            <Select value={outletFilter} onValueChange={setOutletFilter}>
              <SelectTrigger className="w-[180px] bg-neutral-900 border-white/10">
                <SelectValue placeholder="All Outlets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outlets</SelectItem>
                {outlets.map((outlet) => (
                  <SelectItem key={outlet.id} value={outlet.id}>
                    {outlet.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] bg-neutral-900 border-white/10">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
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
      </div>

      {/* Table */}
      <div className="rounded-md border border-white/10 bg-neutral-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-neutral-900/50">
              <TableHead className="pl-4 uppercase tracking-widest text-xs font-medium text-neutral-400">
                Cashier
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Outlet
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Opened
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Duration
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Orders
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Starting Cash
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Variance
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Status
              </TableHead>
              <TableHead className="text-right pr-4 uppercase tracking-widest text-xs font-medium text-neutral-400">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredShifts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-24 text-center text-muted-foreground"
                >
                  No shifts found.
                </TableCell>
              </TableRow>
            ) : (
              filteredShifts.map((shift) => (
                <TableRow
                  key={shift.id}
                  className="border-white/10 hover:bg-white/5"
                >
                  <TableCell className="pl-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-neutral-800 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-neutral-300">
                          {shift.cashierName?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                      </div>
                      <span className="font-medium text-sm text-white">
                        {shift.cashierName || "Unknown"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-neutral-300">
                      {shift.outletName}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-neutral-300">
                      {formatDateTime(shift.openedAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-neutral-400">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDuration(shift.openedAt, shift.closedAt)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-neutral-300">
                      {shift.orderCount}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-neutral-300">
                      {formatCurrency(shift.startingCash)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {shift.variance !== null ? (
                      <div className="flex items-center gap-1">
                        {getVarianceIcon(shift.variance)}
                        <span className={`text-sm font-medium ${getVarianceColor(shift.variance)}`}>
                          {formatCurrency(Math.abs(shift.variance))}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-neutral-500">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={STATUS_COLORS[shift.status]}
                    >
                      {shift.status === "OPEN" ? "Open" : "Closed"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-neutral-400 hover:text-white hover:bg-white/10"
                      onClick={() => onViewReport(shift.id)}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      Report
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground">
        Showing <strong>{filteredShifts.length}</strong> of{" "}
        <strong>{shifts.length}</strong> shifts.
      </div>
    </div>
  );
}
