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
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Search,
  Shirt,
  DoorOpen,
  RotateCcw,
  WashingMachine,
  AlertTriangle,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  issueToRoom,
  returnFromRoom,
  sendToLaundry,
  receiveFromLaundry,
  markDamaged,
  retire,
} from "@/lib/inventory/linen";
import { LinenType, LinenStatus, LinenCondition, WarehouseType } from "@prisma/client";


interface LinenData {
  id: string;
  stockItemId: string;
  stockItemName: string;
  stockItemCode: string;
  propertyId: string;
  propertyName: string;
  serialNumber: string | null;
  type: LinenType;
  size: string | null;
  condition: LinenCondition;
  status: LinenStatus;
  warehouseId: string;
  warehouseName: string;
  warehouseType: WarehouseType;
  assignedRoomId: string | null;
  purchaseDate: Date | null;
  lastLaundryDate: Date | null;
  cycleCount: number;
  damageNotes: string | null;
  retiredAt: Date | null;
  retiredReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Warehouse {
  id: string;
  name: string;
  type: WarehouseType;
}

interface Room {
  id: string;
  number: string;
  floor: number | null;
  roomTypeName: string;
  propertyId: string;
  propertyName: string;
}

interface LinensTableProps {
  linens: LinenData[];
  warehouses: Warehouse[];
  rooms: Room[];
}

const STATUS_COLORS: Record<LinenStatus, string> = {
  IN_STOCK: "bg-green-500/20 text-green-400 border-green-500/30",
  IN_USE: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  IN_LAUNDRY: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  DAMAGED: "bg-red-500/20 text-red-400 border-red-500/30",
  RETIRED: "bg-neutral-500/20 text-neutral-400 border-neutral-500/30",
};

const CONDITION_COLORS: Record<LinenCondition, string> = {
  NEW: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  GOOD: "bg-green-500/20 text-green-400 border-green-500/30",
  FAIR: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  POOR: "bg-red-500/20 text-red-400 border-red-500/30",
};

const TYPE_LABELS: Record<LinenType, string> = {
  BED_SHEET: "Bed Sheet",
  PILLOW_CASE: "Pillow Case",
  DUVET_COVER: "Duvet Cover",
  TOWEL: "Towel",
  BATH_MAT: "Bath Mat",
  BLANKET: "Blanket",
};

const STATUS_LABELS: Record<LinenStatus, string> = {
  IN_STOCK: "In Stock",
  IN_USE: "In Use",
  IN_LAUNDRY: "In Laundry",
  DAMAGED: "Damaged",
  RETIRED: "Retired",
};

const CONDITION_LABELS: Record<LinenCondition, string> = {
  NEW: "New",
  GOOD: "Good",
  FAIR: "Fair",
  POOR: "Poor",
};

type DialogType = "issue" | "return" | "laundry" | "receiveLaundry" | "damage" | "retire" | null;

export function LinensTable({ linens, warehouses, rooms }: LinensTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [conditionFilter, setConditionFilter] = React.useState<string>("all");
  const [warehouseFilter, setWarehouseFilter] = React.useState<string>("all");
  
  const [selectedItems, setSelectedItems] = React.useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = React.useState(false);
  const [dialogType, setDialogType] = React.useState<DialogType>(null);
  
  // Dialog form state
  const [selectedRoom, setSelectedRoom] = React.useState<string>("");
  const [returnCondition, setReturnCondition] = React.useState<LinenCondition>("GOOD");
  const [damageNotes, setDamageNotes] = React.useState("");
  const [retireReason, setRetireReason] = React.useState("");


  // Filter linens based on search and filters
  const filteredLinens = React.useMemo(() => {
    let result = linens;

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.stockItemName.toLowerCase().includes(lowerQuery) ||
          item.stockItemCode.toLowerCase().includes(lowerQuery) ||
          item.serialNumber?.toLowerCase().includes(lowerQuery) ||
          item.warehouseName.toLowerCase().includes(lowerQuery)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((item) => item.status === statusFilter);
    }

    if (typeFilter !== "all") {
      result = result.filter((item) => item.type === typeFilter);
    }

    if (conditionFilter !== "all") {
      result = result.filter((item) => item.condition === conditionFilter);
    }

    if (warehouseFilter !== "all") {
      result = result.filter((item) => item.warehouseId === warehouseFilter);
    }

    return result;
  }, [linens, searchQuery, statusFilter, typeFilter, conditionFilter, warehouseFilter]);

  // Get selected items that are valid for each action
  const selectedLinens = React.useMemo(() => {
    return filteredLinens.filter((item) => selectedItems.has(item.id));
  }, [filteredLinens, selectedItems]);

  const canIssue = selectedLinens.length > 0 && selectedLinens.every((item) => item.status === "IN_STOCK");
  const canReturn = selectedLinens.length > 0 && selectedLinens.every((item) => item.status === "IN_USE");
  const canSendToLaundry = selectedLinens.length > 0 && selectedLinens.every((item) => 
    item.status === "IN_STOCK" || item.status === "IN_USE"
  );
  const canReceiveFromLaundry = selectedLinens.length > 0 && selectedLinens.every((item) => item.status === "IN_LAUNDRY");
  const canMarkDamaged = selectedLinens.length === 1 && selectedLinens[0].status !== "RETIRED";
  const canRetire = selectedLinens.length === 1 && selectedLinens[0].status !== "RETIRED";

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(filteredLinens.map((item) => item.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedItems(newSelected);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    setConditionFilter("all");
    setWarehouseFilter("all");
    setSelectedItems(new Set());
  };

  const closeDialog = () => {
    setDialogType(null);
    setSelectedRoom("");
    setReturnCondition("GOOD");
    setDamageNotes("");
    setRetireReason("");
  };


  // Action handlers
  const handleIssueToRoom = async () => {
    if (!selectedRoom) {
      toast.error("Please select a room");
      return;
    }

    setIsLoading(true);
    try {
      const result = await issueToRoom(Array.from(selectedItems), selectedRoom);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${selectedItems.size} linen(s) issued to room successfully`);
        setSelectedItems(new Set());
        closeDialog();
        router.refresh();
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReturnFromRoom = async () => {
    setIsLoading(true);
    try {
      const result = await returnFromRoom(
        Array.from(selectedItems),
        returnCondition,
        returnCondition === "POOR" ? damageNotes : undefined
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${selectedItems.size} linen(s) returned successfully`);
        setSelectedItems(new Set());
        closeDialog();
        router.refresh();
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendToLaundry = async () => {
    setIsLoading(true);
    try {
      const result = await sendToLaundry(Array.from(selectedItems));
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${selectedItems.size} linen(s) sent to laundry`);
        setSelectedItems(new Set());
        closeDialog();
        router.refresh();
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReceiveFromLaundry = async () => {
    setIsLoading(true);
    try {
      const result = await receiveFromLaundry(Array.from(selectedItems));
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${selectedItems.size} linen(s) received from laundry`);
        setSelectedItems(new Set());
        closeDialog();
        router.refresh();
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkDamaged = async () => {
    if (!damageNotes.trim()) {
      toast.error("Please provide damage notes");
      return;
    }

    const itemId = Array.from(selectedItems)[0];
    setIsLoading(true);
    try {
      const result = await markDamaged(itemId, damageNotes);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Linen marked as damaged");
        setSelectedItems(new Set());
        closeDialog();
        router.refresh();
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetire = async () => {
    if (!retireReason.trim()) {
      toast.error("Please provide a retirement reason");
      return;
    }

    const itemId = Array.from(selectedItems)[0];
    setIsLoading(true);
    try {
      const result = await retire(itemId, retireReason);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Linen retired successfully");
        setSelectedItems(new Set());
        closeDialog();
        router.refresh();
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };


  // Status summary counts
  const statusCounts = React.useMemo(() => {
    const counts: Record<LinenStatus, number> = {
      IN_STOCK: 0,
      IN_USE: 0,
      IN_LAUNDRY: 0,
      DAMAGED: 0,
      RETIRED: 0,
    };
    linens.forEach((item) => {
      counts[item.status]++;
    });
    return counts;
  }, [linens]);

  return (
    <div className="w-full space-y-4">
      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(Object.keys(statusCounts) as LinenStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
            className={`p-3 rounded-lg border transition-colors ${
              statusFilter === status
                ? "border-orange-500 bg-orange-500/10"
                : "border-white/10 bg-neutral-900/50 hover:bg-neutral-900"
            }`}
          >
            <div className="text-2xl font-bold text-white">{statusCounts[status]}</div>
            <div className="text-xs text-neutral-400">{STATUS_LABELS[status]}</div>
          </button>
        ))}
      </div>

      {/* Filters Row */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex flex-1 flex-wrap items-center gap-2 w-full">
          {/* Search */}
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search linens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-neutral-900 border-white/10"
            />
          </div>

          {/* Type Filter */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] bg-neutral-900 border-white/10">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {(Object.keys(TYPE_LABELS) as LinenType[]).map((type) => (
                <SelectItem key={type} value={type}>
                  {TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Condition Filter */}
          <Select value={conditionFilter} onValueChange={setConditionFilter}>
            <SelectTrigger className="w-[130px] bg-neutral-900 border-white/10">
              <SelectValue placeholder="All Conditions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Conditions</SelectItem>
              {(Object.keys(CONDITION_LABELS) as LinenCondition[]).map((condition) => (
                <SelectItem key={condition} value={condition}>
                  {CONDITION_LABELS[condition]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Warehouse Filter */}
          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger className="w-[160px] bg-neutral-900 border-white/10">
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

          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={resetFilters}
          >
            Reset
          </Button>
        </div>
      </div>


      {/* Action Buttons */}
      {selectedItems.size > 0 && (
        <div className="flex items-center gap-2 p-3 bg-neutral-900 rounded-lg border border-white/10">
          <span className="text-sm text-neutral-400 mr-2">
            {selectedItems.size} selected
          </span>
          
          <Button
            size="sm"
            variant="outline"
            className="gap-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
            disabled={!canIssue}
            onClick={() => setDialogType("issue")}
          >
            <DoorOpen className="h-3.5 w-3.5" />
            Issue to Room
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="gap-1 border-green-500/30 text-green-400 hover:bg-green-500/10"
            disabled={!canReturn}
            onClick={() => setDialogType("return")}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Return
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="gap-1 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            disabled={!canSendToLaundry}
            onClick={() => setDialogType("laundry")}
          >
            <WashingMachine className="h-3.5 w-3.5" />
            Send to Laundry
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            disabled={!canReceiveFromLaundry}
            onClick={() => setDialogType("receiveLaundry")}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Receive from Laundry
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="gap-1 border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
            disabled={!canMarkDamaged}
            onClick={() => setDialogType("damage")}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Mark Damaged
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
            disabled={!canRetire}
            onClick={() => setDialogType("retire")}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Retire
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border border-white/10 bg-neutral-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-neutral-900/50">
              <TableHead className="w-[50px] pl-4">
                <Checkbox
                  checked={
                    filteredLinens.length > 0 &&
                    filteredLinens.every((item) => selectedItems.has(item.id))
                  }
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Item
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Type
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Status
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Condition
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Warehouse
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Cycles
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Last Laundry
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLinens.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  No linen items found.
                </TableCell>
              </TableRow>
            ) : (
              filteredLinens.map((item) => (
                <TableRow
                  key={item.id}
                  className={`border-white/10 hover:bg-white/5 ${
                    selectedItems.has(item.id) ? "bg-white/5" : ""
                  }`}
                >
                  <TableCell className="pl-4">
                    <Checkbox
                      checked={selectedItems.has(item.id)}
                      onCheckedChange={(checked) =>
                        handleSelectItem(item.id, checked as boolean)
                      }
                    />
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-neutral-800 rounded-md flex items-center justify-center">
                        <Shirt className="h-5 w-5 text-neutral-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm text-white">
                          {item.stockItemName}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {item.stockItemCode}
                          {item.serialNumber && ` • S/N: ${item.serialNumber}`}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-neutral-300">
                      {TYPE_LABELS[item.type]}
                    </span>
                    {item.size && (
                      <span className="text-xs text-neutral-500 block">
                        {item.size}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={STATUS_COLORS[item.status]}
                    >
                      {STATUS_LABELS[item.status]}
                    </Badge>
                    {item.assignedRoomId && (
                      <span className="text-xs text-neutral-500 block mt-1">
                        Room: {item.assignedRoomId}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={CONDITION_COLORS[item.condition]}
                    >
                      {CONDITION_LABELS[item.condition]}
                    </Badge>
                    {item.damageNotes && (
                      <span className="text-xs text-red-400 block mt-1 truncate max-w-[150px]" title={item.damageNotes}>
                        {item.damageNotes}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-neutral-300">
                      {item.warehouseName}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-neutral-300">
                      {item.cycleCount}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-neutral-400">
                      {formatDate(item.lastLaundryDate)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground">
        Showing <strong>{filteredLinens.length}</strong> of{" "}
        <strong>{linens.length}</strong> linen items.
      </div>


      {/* Issue to Room Dialog */}
      <Dialog open={dialogType === "issue"} onOpenChange={() => closeDialog()}>
        <DialogContent className="bg-neutral-900 border-white/10">
          <DialogHeader>
            <DialogTitle>Issue Linens to Room</DialogTitle>
            <DialogDescription>
              Select a room to issue {selectedItems.size} linen item(s) to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Room</Label>
              <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                <SelectTrigger className="bg-neutral-800 border-white/10">
                  <SelectValue placeholder="Select a room..." />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      Room {room.number} - {room.roomTypeName} ({room.propertyName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleIssueToRoom}
              disabled={isLoading || !selectedRoom}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? "Issuing..." : "Issue to Room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return from Room Dialog */}
      <Dialog open={dialogType === "return"} onOpenChange={() => closeDialog()}>
        <DialogContent className="bg-neutral-900 border-white/10">
          <DialogHeader>
            <DialogTitle>Return Linens from Room</DialogTitle>
            <DialogDescription>
              Return {selectedItems.size} linen item(s) and update their condition.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Condition on Return</Label>
              <Select value={returnCondition} onValueChange={(v) => setReturnCondition(v as LinenCondition)}>
                <SelectTrigger className="bg-neutral-800 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CONDITION_LABELS) as LinenCondition[]).map((condition) => (
                    <SelectItem key={condition} value={condition}>
                      {CONDITION_LABELS[condition]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {returnCondition === "POOR" && (
              <div className="space-y-2">
                <Label>Damage Notes</Label>
                <Textarea
                  value={damageNotes}
                  onChange={(e) => setDamageNotes(e.target.value)}
                  placeholder="Describe the damage..."
                  className="bg-neutral-800 border-white/10"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleReturnFromRoom}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? "Returning..." : "Return Linens"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send to Laundry Dialog */}
      <Dialog open={dialogType === "laundry"} onOpenChange={() => closeDialog()}>
        <DialogContent className="bg-neutral-900 border-white/10">
          <DialogHeader>
            <DialogTitle>Send to Laundry</DialogTitle>
            <DialogDescription>
              Send {selectedItems.size} linen item(s) to laundry?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleSendToLaundry}
              disabled={isLoading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isLoading ? "Sending..." : "Send to Laundry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive from Laundry Dialog */}
      <Dialog open={dialogType === "receiveLaundry"} onOpenChange={() => closeDialog()}>
        <DialogContent className="bg-neutral-900 border-white/10">
          <DialogHeader>
            <DialogTitle>Receive from Laundry</DialogTitle>
            <DialogDescription>
              Mark {selectedItems.size} linen item(s) as received from laundry?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleReceiveFromLaundry}
              disabled={isLoading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isLoading ? "Receiving..." : "Receive from Laundry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Damaged Dialog */}
      <Dialog open={dialogType === "damage"} onOpenChange={() => closeDialog()}>
        <DialogContent className="bg-neutral-900 border-white/10">
          <DialogHeader>
            <DialogTitle>Mark as Damaged</DialogTitle>
            <DialogDescription>
              Record damage information for this linen item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Damage Description</Label>
              <Textarea
                value={damageNotes}
                onChange={(e) => setDamageNotes(e.target.value)}
                placeholder="Describe the damage (e.g., torn, stained, worn out)..."
                className="bg-neutral-800 border-white/10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleMarkDamaged}
              disabled={isLoading || !damageNotes.trim()}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isLoading ? "Saving..." : "Mark as Damaged"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retire Dialog */}
      <Dialog open={dialogType === "retire"} onOpenChange={() => closeDialog()}>
        <DialogContent className="bg-neutral-900 border-white/10">
          <DialogHeader>
            <DialogTitle>Retire Linen</DialogTitle>
            <DialogDescription>
              This will permanently retire the linen item from inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Retirement Reason</Label>
              <Textarea
                value={retireReason}
                onChange={(e) => setRetireReason(e.target.value)}
                placeholder="Reason for retirement (e.g., beyond repair, end of life)..."
                className="bg-neutral-800 border-white/10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleRetire}
              disabled={isLoading || !retireReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? "Retiring..." : "Retire Linen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
