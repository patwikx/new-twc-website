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
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, X, Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
    SheetClose
} from "@/components/ui/sheet";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createRoomUnit, updateRoomUnit, deleteRoomUnit } from "@/actions/admin/room-units";
import { useRouter } from "next/navigation";

interface RoomUnit {
  id: string;
  number: string;
  floor: number | null;
  status: string;
  isActive: boolean;
  notes: string | null;
}

interface RoomUnitsTableProps {
  roomTypeId: string;
  units: RoomUnit[];
}

const STATUS_COLORS: Record<string, string> = {
    CLEAN: "bg-green-500/10 text-green-400 border-green-500/20",
    DIRTY: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    OCCUPIED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    MAINTENANCE: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    OUT_OF_ORDER: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function RoomUnitsTable({ roomTypeId, units }: RoomUnitsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [isAddSheetOpen, setIsAddSheetOpen] = React.useState(false);
  const [editingUnit, setEditingUnit] = React.useState<RoomUnit | null>(null);

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
        const result = await createRoomUnit(roomTypeId, formData);
        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success("Room unit created");
            setIsAddSheetOpen(false);
            router.refresh();
        }
    });
  };

  const handleEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUnit) return;
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
        const result = await updateRoomUnit(editingUnit.id, formData);
        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success("Room unit updated");
            setEditingUnit(null);
            router.refresh();
        }
    });
  };

  const handleDelete = (unitId: string) => {
    if (!confirm("Delete this room unit?")) return;
    
    startTransition(async () => {
        const result = await deleteRoomUnit(unitId);
        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success("Room unit deleted");
            router.refresh();
        }
    });
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
            <h3 className="text-sm font-medium text-white">Inventory</h3>
            <p className="text-xs text-muted-foreground">
                Manage individual units (e.g. 101, 102)
            </p>
        </div>
        <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
            <Button size="sm" onClick={() => setIsAddSheetOpen(true)} className="gap-1 bg-orange-600 hover:bg-orange-700 text-white">
                <Plus className="h-3.5 w-3.5" />
                Add Unit
            </Button>
            <SheetContent className="bg-neutral-950 border-white/10 sm:max-w-md p-6">
                <SheetHeader>
                    <SheetTitle className="text-white">Add Room Unit</SheetTitle>
                    <SheetDescription>Create a new inventory item for this room type.</SheetDescription>
                </SheetHeader>
                <form onSubmit={handleCreate} className="space-y-4 mt-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="number">Room Number</Label>
                            <Input 
                                id="number" 
                                name="number" 
                                placeholder="e.g. 101" 
                                required 
                                className="bg-neutral-900 border-white/10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="floor">Floor</Label>
                            <Input 
                                id="floor" 
                                name="floor" 
                                type="number"
                                placeholder="e.g. 1" 
                                className="bg-neutral-900 border-white/10"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes (optional)</Label>
                        <Textarea 
                            id="notes" 
                            name="notes" 
                            placeholder="Any notes..." 
                            className="bg-neutral-900 border-white/10 h-24 resize-none"
                        />
                    </div>
                    <SheetFooter className="mt-4">
                        <SheetClose asChild>
                            <Button type="button" variant="ghost">Cancel</Button>
                        </SheetClose>
                        <Button type="submit" disabled={isPending} className="bg-orange-600 hover:bg-orange-700">
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Unit"}
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
      </div>

      <div className="rounded-md border border-white/10 bg-neutral-900/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-neutral-900/50">
              <TableHead className="pl-4 uppercase tracking-widest text-[10px] font-medium text-neutral-500">
                Number
              </TableHead>
              <TableHead className="uppercase tracking-widest text-[10px] font-medium text-neutral-500">
                Floor
              </TableHead>
              <TableHead className="uppercase tracking-widest text-[10px] font-medium text-neutral-500">
                Status
              </TableHead>
              <TableHead className="uppercase tracking-widest text-[10px] font-medium text-neutral-500">
                Active
              </TableHead>
              <TableHead className="text-right pr-4 uppercase tracking-widest text-[10px] font-medium text-neutral-500">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground text-sm"
                >
                  No units added yet.
                </TableCell>
              </TableRow>
            ) : (
              units.map((unit) => (
                <TableRow
                  key={unit.id}
                  className="border-white/10 hover:bg-white/5"
                >
                  <TableCell className="pl-4 py-3">
                    <span className="font-mono font-medium text-white text-sm">
                      {unit.number}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-neutral-400">
                      {unit.floor ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-normal ${STATUS_COLORS[unit.status] || ""}`}
                    >
                      {unit.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {unit.isActive ? (
                      <div className="h-2 w-2 rounded-full bg-green-500/50 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-red-500/50" />
                    )}
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-neutral-400 hover:text-white hover:bg-white/10"
                        onClick={() => setEditingUnit(unit)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-neutral-400 hover:text-red-400 hover:bg-red-900/10"
                        onClick={() => handleDelete(unit.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Drawer */}
      <Sheet open={!!editingUnit} onOpenChange={(open) => !open && setEditingUnit(null)}>
        <SheetContent className="bg-neutral-950 border-white/10 sm:max-w-md p-6">
            <SheetHeader>
                <SheetTitle className="text-white">Edit Room {editingUnit?.number}</SheetTitle>
                <SheetDescription>Update unit details and status.</SheetDescription>
            </SheetHeader>
            {editingUnit && (
                <form onSubmit={handleEdit} className="space-y-4 mt-6">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-number">Room Number</Label>
                            <Input 
                                id="edit-number" 
                                name="number" 
                                defaultValue={editingUnit.number}
                                required 
                                className="bg-neutral-900 border-white/10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-floor">Floor</Label>
                            <Input 
                                id="edit-floor" 
                                name="floor" 
                                type="number"
                                defaultValue={editingUnit.floor ?? ""}
                                className="bg-neutral-900 border-white/10"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-status">Status</Label>
                        <Select name="status" defaultValue={editingUnit.status}>
                            <SelectTrigger className="bg-neutral-900 border-white/10">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CLEAN">Clean</SelectItem>
                                <SelectItem value="DIRTY">Dirty</SelectItem>
                                <SelectItem value="OCCUPIED">Occupied</SelectItem>
                                <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                                <SelectItem value="OUT_OF_ORDER">Out of Order</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-notes">Notes</Label>
                        <Textarea 
                            id="edit-notes" 
                            name="notes" 
                            defaultValue={editingUnit.notes ?? ""}
                            className="bg-neutral-900 border-white/10 h-24 resize-none"
                        />
                    </div>
                    <SheetFooter className="mt-4">
                        <SheetClose asChild>
                            <Button type="button" variant="ghost">Cancel</Button>
                        </SheetClose>
                        <Button type="submit" disabled={isPending} className="bg-orange-600 hover:bg-orange-700">
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                        </Button>
                    </SheetFooter>
                </form>
            )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
