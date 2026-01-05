"use client";

import { format } from "date-fns";
import { CalendarIcon, Users, Utensils, BedDouble, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface EventDetailsDialogProps {
  event: any; // Using any to be flexible with the Prisma return type for now
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventDetailsDialog({ event, open, onOpenChange }: EventDetailsDialogProps) {
  if (!event) return null;

  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);

  // Parse menu details if it's a string (though it should be Json from Prisma)
  let menuItems = [];
  if (event.menuDetails && typeof event.menuDetails === 'object' && event.menuDetails.items) {
      menuItems = event.menuDetails.items;
  }

  // Extract blocked rooms
  const blockedRooms = event.bookings?.flatMap((b: any) => b.items.map((i: any) => ({
      roomName: i.room.name,
      unitNumber: i.roomUnit?.number || "Unassigned"
  }))) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between mr-6">
              <DialogTitle className="text-xl">{event.title}</DialogTitle>
              <Badge variant={event.status === "CONFIRMED" ? "default" : "secondary"}>
                  {event.status}
              </Badge>
          </div>
          <DialogDescription className="flex items-center gap-2 mt-1">
            <CalendarIcon className="h-4 w-4" />
            <span>
              {format(startDate, "MMM d, yyyy")} - {format(endDate, "MMM d, yyyy")}
            </span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
            <div className="space-y-6 py-4">
                {/* Description */}
                {event.description && (
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                            <Info className="h-4 w-4 text-muted-foreground" />
                            Description
                        </h4>
                        <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                            {event.description}
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    {/* Guest Count */}
                    <div className="space-y-1">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                             Guests
                        </h4>
                        <p className="text-2xl font-bold">{event.guestCount || 0}</p>
                    </div>

                    {/* Room Count */}
                    <div className="space-y-1">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                            <BedDouble className="h-4 w-4 text-muted-foreground" />
                             Rooms Blocked
                        </h4>
                        <p className="text-2xl font-bold">{event.roomCount || 0}</p>
                    </div>
                </div>

                <Separator />

                {/* Catering Menu */}
                {menuItems.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                            <Utensils className="h-4 w-4 text-muted-foreground" />
                            Catering Selection
                        </h4>
                        <div className="grid gap-2">
                            {menuItems.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-sm bg-muted/30 p-2 rounded">
                                    <span>{item.name}</span>
                                    <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Blocked Rooms List */}
                {blockedRooms.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                            <BedDouble className="h-4 w-4 text-muted-foreground" />
                            Assigned Units
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                            {blockedRooms.map((room: any, idx: number) => (
                                <div key={idx} className="text-xs bg-muted/30 p-2 rounded border border-border/50">
                                    <div className="font-medium">{room.roomName}</div>
                                    <div className="text-muted-foreground">Unit {room.unitNumber}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
