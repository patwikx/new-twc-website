"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Search, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

// Supported audit actions
const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "APPROVE",
  "REJECT",
  "RECEIVE",
  "TRANSFER",
  "ADJUST",
  "WASTE",
  "VOID",
  "CANCEL",
] as const;

// Supported entity types
const ENTITY_TYPES = [
  "StockItem",
  "StockMovement",
  "StockAdjustment",
  "WasteRecord",
  "PurchaseOrder",
  "PurchaseOrderItem",
  "POReceipt",
  "Requisition",
  "CycleCount",
  "Warehouse",
  "Supplier",
  "StockCategory",
  "MenuItem",
  "Recipe",
  "Order",
  "OrderPayment",
  "Shift",
  "User",
  "Role",
] as const;

interface User {
  id: string;
  name: string | null;
  email: string | null;
}

export interface AuditLogFilterValues {
  userId?: string;
  entityType?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
}

interface AuditLogFiltersProps {
  users: User[];
  filters: AuditLogFilterValues;
  onFiltersChange: (filters: AuditLogFilterValues) => void;
  onReset: () => void;
}

export function AuditLogFilters({
  users,
  filters,
  onFiltersChange,
  onReset,
}: AuditLogFiltersProps) {
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(
    filters.startDate || filters.endDate
      ? {
          from: filters.startDate,
          to: filters.endDate,
        }
      : undefined
  );

  const handleUserChange = (value: string) => {
    onFiltersChange({
      ...filters,
      userId: value === "all" ? undefined : value,
    });
  };

  const handleEntityTypeChange = (value: string) => {
    onFiltersChange({
      ...filters,
      entityType: value === "all" ? undefined : value,
    });
  };

  const handleActionChange = (value: string) => {
    onFiltersChange({
      ...filters,
      action: value === "all" ? undefined : value,
    });
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    onFiltersChange({
      ...filters,
      startDate: range?.from,
      endDate: range?.to,
    });
  };

  const clearDateRange = () => {
    setDateRange(undefined);
    onFiltersChange({
      ...filters,
      startDate: undefined,
      endDate: undefined,
    });
  };

  const hasActiveFilters =
    filters.userId ||
    filters.entityType ||
    filters.action ||
    filters.startDate ||
    filters.endDate;

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row items-start lg:items-end gap-4">
        {/* User Filter */}
        <div className="w-full lg:w-[200px] space-y-1.5">
          <Label className="text-xs text-neutral-400">User</Label>
          <Select
            value={filters.userId || "all"}
            onValueChange={handleUserChange}
          >
            <SelectTrigger className="bg-neutral-900 border-white/10">
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name || user.email || "Unknown"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Entity Type Filter */}
        <div className="w-full lg:w-[180px] space-y-1.5">
          <Label className="text-xs text-neutral-400">Entity Type</Label>
          <Select
            value={filters.entityType || "all"}
            onValueChange={handleEntityTypeChange}
          >
            <SelectTrigger className="bg-neutral-900 border-white/10">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {ENTITY_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action Filter */}
        <div className="w-full lg:w-[150px] space-y-1.5">
          <Label className="text-xs text-neutral-400">Action</Label>
          <Select
            value={filters.action || "all"}
            onValueChange={handleActionChange}
          >
            <SelectTrigger className="bg-neutral-900 border-white/10">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {AUDIT_ACTIONS.map((action) => (
                <SelectItem key={action} value={action}>
                  {action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range Filter */}
        <div className="w-full lg:w-auto space-y-1.5">
          <Label className="text-xs text-neutral-400">Date Range</Label>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full lg:w-[280px] justify-start text-left font-normal bg-neutral-900 border-white/10",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-neutral-900 border-white/10" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={handleDateRangeChange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            {dateRange && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-neutral-400 hover:text-white"
                onClick={clearDateRange}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Reset Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-white"
            onClick={onReset}
          >
            Reset All
          </Button>
        )}
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-500">Active filters:</span>
          {filters.userId && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/20 text-blue-400 text-xs">
              User: {users.find((u) => u.id === filters.userId)?.name || "Unknown"}
              <button
                onClick={() => onFiltersChange({ ...filters, userId: undefined })}
                className="hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.entityType && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-500/20 text-purple-400 text-xs">
              Type: {filters.entityType}
              <button
                onClick={() => onFiltersChange({ ...filters, entityType: undefined })}
                className="hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.action && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/20 text-green-400 text-xs">
              Action: {filters.action}
              <button
                onClick={() => onFiltersChange({ ...filters, action: undefined })}
                className="hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {(filters.startDate || filters.endDate) && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-500/20 text-orange-400 text-xs">
              Date: {filters.startDate && format(filters.startDate, "MMM d")}
              {filters.startDate && filters.endDate && " - "}
              {filters.endDate && format(filters.endDate, "MMM d")}
              <button
                onClick={clearDateRange}
                className="hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
