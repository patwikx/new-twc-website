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
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger,
    DialogFooter,
    DialogClose
} from "@/components/ui/dialog";
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

interface RoomUnitsTabProps {
  roomTypeId: string;
  units: RoomUnit[];
}

const STATUS_COLORS: Record<string, string> = {
    CLEAN: "bg-green-500/20 text-green-400 border-green-500/30",
    DIRTY: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    OCCUPIED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    MAINTENANCE: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    OUT_OF_ORDER: "bg-red-500/20 text-red-400 border-red-500/30",
};

export function RoomUnitsTab({ roomTypeId, units }: RoomUnitsTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [dialogOpen, setDialogOpen] = React.useState(false);
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
            setDialogOpen(false);
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
        <p className="text-sm text-muted-foreground">
            Manage individual room numbers for this room type.
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-1 bg-orange-600 hover:bg-orange-700">
                    <Plus className="h-3.5 w-3.5" />
                    Add Unit
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-neutral-900 border-white/10">
                <DialogHeader>
                    <DialogTitle>Add Room Unit</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="number">Room Number</Label>
                            <Input 
                                id="number" 
                                name="number" 
                                placeholder="e.g. 101" 
                                required 
                                className="bg-neutral-950 border-white/10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="floor">Floor</Label>
                            <Input 
                                id="floor" 
                                name="floor" 
                                type="number"
                                placeholder="e.g. 1" 
                                className="bg-neutral-950 border-white/10"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes (optional)</Label>
                        <Textarea 
                            id="notes" 
                            name="notes" 
                            placeholder="Any notes..." 
                            className="bg-neutral-950 border-white/10 h-20"
                        />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="ghost">Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isPending} className="bg-orange-600 hover:bg-orange-700">
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border border-white/10 bg-neutral-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-neutral-900/50">
              <TableHead className="pl-4 uppercase tracking-widest text-xs font-medium text-neutral-400">
                Room #
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Floor
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Status
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Active
              </TableHead>
              <TableHead className="text-right pr-4 uppercase tracking-widest text-xs font-medium text-neutral-400">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No room units yet. Add your first unit above.
                </TableCell>
              </TableRow>
            ) : (
              units.map((unit) => (
                <TableRow
                  key={unit.id}
                  className="border-white/10 hover:bg-white/5"
                >
                  <TableCell className="pl-4 py-3">
                    <span className="font-mono font-medium text-white">
                      {unit.number}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-neutral-400">
                      {unit.floor ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={STATUS_COLORS[unit.status] || ""}
                    >
                      {unit.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {unit.isActive ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Dialog open={editingUnit?.id === unit.id} onOpenChange={(open) => !open && setEditingUnit(null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-white/10"
                            onClick={() => setEditingUnit(unit)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-neutral-900 border-white/10">
                            <DialogHeader>
                                <DialogTitle>Edit Room {unit.number}</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleEdit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-number">Room Number</Label>
                                        <Input 
                                            id="edit-number" 
                                            name="number" 
                                            defaultValue={unit.number}
                                            required 
                                            className="bg-neutral-950 border-white/10"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-floor">Floor</Label>
                                        <Input 
                                            id="edit-floor" 
                                            name="floor" 
                                            type="number"
                                            defaultValue={unit.floor ?? ""}
                                            className="bg-neutral-950 border-white/10"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-status">Status</Label>
                                    <Select name="status" defaultValue={unit.status}>
                                        <SelectTrigger className="bg-neutral-950 border-white/10">
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
                                        defaultValue={unit.notes ?? ""}
                                        className="bg-neutral-950 border-white/10 h-20"
                                    />
                                </div>
                                <input type="hidden" name="isActive" value={unit.isActive ? "true" : "false"} />
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button type="button" variant="ghost">Cancel</Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={isPending} className="bg-orange-600 hover:bg-orange-700">
                                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-neutral-400 hover:text-red-400 hover:bg-red-900/10"
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
    </div>
  );
}
