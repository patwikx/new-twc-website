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
import { Plus, Search, Bed, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoomForm } from "@/components/admin/room-form";
import { RoomUnitsTab } from "@/components/admin/room-units-tab";

interface Room {
  id: string;
  name: string;
  propertyId: string;
  description: string;
  capacity: number;
  price: number;
  image: string | null;
  _count: {
    units: number;
  };
}

interface RoomUnit {
  id: string;
  number: string;
  floor: number | null;
  status: string;
  isActive: boolean;
  notes: string | null;
}

interface PropertyRoomsTabProps {
  propertyId: string;
  propertyName: string;
  rooms: Room[];
  properties: { id: string; name: string }[];
}

export function PropertyRoomsTab({ propertyId, propertyName, rooms, properties }: PropertyRoomsTabProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedRoom, setSelectedRoom] = React.useState<Room | null>(null);
  const [roomUnits, setRoomUnits] = React.useState<RoomUnit[]>([]);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [isLoadingUnits, setIsLoadingUnits] = React.useState(false);

  const filteredRooms = React.useMemo(() => {
    if (!searchQuery) return rooms;
    const lowerQuery = searchQuery.toLowerCase();
    return rooms.filter((room) => room.name.toLowerCase().includes(lowerQuery));
  }, [rooms, searchQuery]);

  const handleOpenRoom = async (room: Room) => {
    setSelectedRoom(room);
    setIsSheetOpen(true);
    setIsLoadingUnits(true);
    
    // Fetch units for this room
    try {
      const res = await fetch(`/api/admin/rooms/${room.id}/units`);
      if (res.ok) {
        const data = await res.json();
        setRoomUnits(data.units || []);
      }
    } catch (error) {
      console.error("Error fetching room units:", error);
      setRoomUnits([]);
    } finally {
      setIsLoadingUnits(false);
    }
  };

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setSelectedRoom(null);
    setRoomUnits([]);
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-2 w-full max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search room types..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-neutral-900 border-white/10"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            className="h-9 gap-1 bg-orange-600 hover:bg-orange-700 text-white"
          >
            <Link href={`/admin/properties/${propertyId}/rooms/new`}>
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Add Room Type</span>
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-white/10 bg-neutral-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-neutral-900/50">
              <TableHead className="pl-4 uppercase tracking-widest text-xs font-medium text-neutral-400">
                Room Type
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Price/Night
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Capacity
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Units
              </TableHead>
              <TableHead className="text-right pr-4 uppercase tracking-widest text-xs font-medium text-neutral-400">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRooms.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No room types found.
                </TableCell>
              </TableRow>
            ) : (
              filteredRooms.map((room) => (
                <TableRow
                  key={room.id}
                  className="border-white/10 hover:bg-white/5 cursor-pointer"
                  onClick={() => handleOpenRoom(room)}
                >
                  <TableCell className="pl-4 py-3">
                    <div className="flex items-center gap-3">
                      {room.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={room.image}
                          alt={room.name}
                          className="h-10 w-16 object-cover bg-neutral-800 rounded-sm"
                        />
                      ) : (
                        <div className="h-10 w-16 bg-neutral-800 rounded-sm flex items-center justify-center">
                          <Bed className="h-4 w-4 text-neutral-600" />
                        </div>
                      )}
                      <span className="font-medium text-sm text-white">
                        {room.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">
                      ₱{room.price.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-neutral-400">
                      {room.capacity} Guests
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="bg-neutral-800/50 border-white/5 text-neutral-300"
                    >
                      {room._count.units} units
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-white/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenRoom(room);
                        }}
                      >
                        <ChevronRight className="h-4 w-4" />
                        <span className="sr-only">View</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="text-xs text-muted-foreground">
        Showing <strong>{filteredRooms.length}</strong> of{" "}
        <strong>{rooms.length}</strong> room types.
      </div>

      {/* Room Detail Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl bg-neutral-950 border-white/10 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-white">{selectedRoom?.name}</SheetTitle>
            <SheetDescription>
              Room Type in {propertyName}
            </SheetDescription>
          </SheetHeader>

          {selectedRoom && (
            <Tabs defaultValue="details" className="mt-6">
              <TabsList className="grid w-full grid-cols-2 bg-neutral-900/50 border border-white/10">
                <TabsTrigger value="details" className="data-[state=active]:bg-white data-[state=active]:text-black">Details</TabsTrigger>
                <TabsTrigger value="units" className="data-[state=active]:bg-white data-[state=active]:text-black">
                  Room Units ({isLoadingUnits ? "..." : roomUnits.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="mt-4">
                <RoomForm 
                  room={selectedRoom}
                  isEditMode={true}
                  properties={properties}
                  onSuccess={handleCloseSheet}
                />
              </TabsContent>

              <TabsContent value="units" className="mt-4">
                {isLoadingUnits ? (
                  <div className="text-center py-8 text-neutral-400">Loading units...</div>
                ) : (
                  <RoomUnitsTab 
                    roomTypeId={selectedRoom.id}
                    units={roomUnits}
                  />
                )}
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
