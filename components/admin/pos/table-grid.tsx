"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { TableCard } from "./table-card";
import { Plus, Search, LayoutGrid, List, Loader2 } from "lucide-react";
import { POSTableStatus } from "@prisma/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createTable, updateTableStatus, forceClearTable } from "@/lib/pos/table";
import { usePOSSocket } from "@/lib/socket";

interface TableOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: Date;
  customerName?: string | null;
}

interface TableData {
  id: string;
  number: string;
  capacity: number;
  status: POSTableStatus;
  positionX: number | null;
  positionY: number | null;
  orders: TableOrder[];
}

interface TableGridProps {
  tables: TableData[];
  outletId: string;
  outletName: string;
  onTableSelect?: (tableId: string) => void;
  selectedTableId?: string | null;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "AVAILABLE", label: "Available" },
  { value: "OCCUPIED", label: "Occupied" },
  { value: "RESERVED", label: "Reserved" },
  { value: "DIRTY", label: "Dirty" },
  { value: "OUT_OF_SERVICE", label: "Out of Service" },
];

export function TableGrid({
  tables,
  outletId,
  outletName,
  onTableSelect,
  selectedTableId,
}: TableGridProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  // Socket.io for real-time sync
  const { emitTableUpdate, onTableUpdate, onTablesRefreshAll } = usePOSSocket(outletId);

  // Listen for table updates from other clients
  React.useEffect(() => {
    const unsubTableUpdate = onTableUpdate((data) => {
      console.log("[Socket] Table update received:", data);
      // Refresh to get latest data
      router.refresh();
    });

    const unsubRefreshAll = onTablesRefreshAll(() => {
      console.log("[Socket] Refresh all command received");
      router.refresh();
    });

    return () => {
      unsubTableUpdate();
      unsubRefreshAll();
    };
  }, [onTableUpdate, onTablesRefreshAll, router]);

  // New table form state
  const [newTableNumber, setNewTableNumber] = React.useState("");
  const [newTableCapacity, setNewTableCapacity] = React.useState("4");

  // Filter tables
  const filteredTables = React.useMemo(() => {
    let result = tables;

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter((table) =>
        table.number.toLowerCase().includes(lowerQuery)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((table) => table.status === statusFilter);
    }

    return result;
  }, [tables, searchQuery, statusFilter]);

  // Status counts
  const statusCounts = React.useMemo(() => {
    return {
      all: tables.length,
      AVAILABLE: tables.filter((t) => t.status === "AVAILABLE").length,
      OCCUPIED: tables.filter((t) => t.status === "OCCUPIED").length,
      RESERVED: tables.filter((t) => t.status === "RESERVED").length,
      DIRTY: tables.filter((t) => t.status === "DIRTY").length,
      OUT_OF_SERVICE: tables.filter((t) => t.status === "OUT_OF_SERVICE").length,
    };
  }, [tables]);

  const handleAddTable = async () => {
    if (!newTableNumber.trim()) {
      toast.error("Table number is required");
      return;
    }

    const capacity = parseInt(newTableCapacity);
    if (isNaN(capacity) || capacity < 1) {
      toast.error("Capacity must be at least 1");
      return;
    }

    setIsLoading(true);
    try {
      const result = await createTable({
        outletId,
        number: newTableNumber.trim(),
        capacity,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Table created successfully");
        setIsAddDialogOpen(false);
        setNewTableNumber("");
        setNewTableCapacity("4");
        router.refresh();
      }
    } catch {
      toast.error("Failed to create table");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (tableId: string, newStatus: POSTableStatus) => {
    try {
      // Check for Override (Occupied -> Available)
      const table = tables.find(t => t.id === tableId);
      let result;

      if (newStatus === "AVAILABLE" && table?.status === "OCCUPIED") {
         result = await forceClearTable(tableId);
      } else {
         result = await updateTableStatus(tableId, newStatus);
      }

      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Table status updated to ${newStatus.toLowerCase().replace("_", " ")}`);
        // Emit to other clients via socket
        emitTableUpdate(tableId, newStatus);
        router.refresh();
      }
    } catch {
      toast.error("Failed to update table status");
    }
  };

  const handleTableSelect = (tableId: string) => {
    if (onTableSelect) {
      onTableSelect(tableId);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">{outletName}</h2>
          <p className="text-sm text-neutral-400">
            {tables.length} tables • {statusCounts.AVAILABLE} available
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center border border-white/10 rounded-md">
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 rounded-r-none ${viewMode === "grid" ? "bg-white/10" : ""}`}
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 rounded-l-none ${viewMode === "list" ? "bg-white/10" : ""}`}
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          <Button
            size="sm"
            className="h-8 gap-1 bg-orange-600 hover:bg-orange-700 text-white"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Table
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 bg-neutral-900 border-white/10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9 bg-neutral-900 border-white/10">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label} ({statusCounts[option.value as keyof typeof statusCounts] || 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table Grid/List */}
      {filteredTables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-neutral-400 mb-4">No tables found</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddDialogOpen(true)}
            className="border-white/10"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add First Table
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredTables.map((table) => (
            <TableCard
              key={table.id}
              id={table.id}
              number={table.number}
              capacity={table.capacity}
              status={table.status}
              positionX={table.positionX}
              positionY={table.positionY}
              currentOrder={table.orders[0] || null}
              onSelect={handleTableSelect}
              onStatusChange={handleStatusChange}
              isSelected={selectedTableId === table.id}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTables.map((table) => (
            <TableCard
              key={table.id}
              id={table.id}
              number={table.number}
              capacity={table.capacity}
              status={table.status}
              positionX={table.positionX}
              positionY={table.positionY}
              currentOrder={table.orders[0] || null}
              onSelect={handleTableSelect}
              onStatusChange={handleStatusChange}
              isSelected={selectedTableId === table.id}
              compact
            />
          ))}
        </div>
      )}

      {/* Add Table Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="bg-neutral-900 border-white/10">
          <DialogHeader>
            <DialogTitle>Add New Table</DialogTitle>
            <DialogDescription>
              Create a new table for {outletName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tableNumber">Table Number</Label>
              <Input
                id="tableNumber"
                placeholder="e.g. T1, A1, 101"
                value={newTableNumber}
                onChange={(e) => setNewTableNumber(e.target.value)}
                className="bg-neutral-800 border-white/10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tableCapacity">Capacity (seats)</Label>
              <Input
                id="tableCapacity"
                type="number"
                min="1"
                placeholder="4"
                value={newTableCapacity}
                onChange={(e) => setNewTableCapacity(e.target.value)}
                className="bg-neutral-800 border-white/10"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsAddDialogOpen(false)}
              className="text-neutral-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddTable}
              disabled={isLoading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Table"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
