"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoomForm } from "@/components/admin/room-form";
import { RoomUnitsTable } from "@/components/admin/room-units-table";
import { Button } from "@/components/ui/button";
import { Plus, Bed, Pencil, Users, DollarSign, ImageIcon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

interface Room {
  id: string;
  name: string;
  propertyId: string;
  description: string;
  capacity: number;
  price: number;
  image: string | null;
  units: any[];
}

interface RoomManagementTabsProps {
  rooms: Room[];
  propertyId: string;
  properties: { id: string; name: string }[];
}

export function RoomManagementTabs({ rooms, propertyId, properties }: RoomManagementTabsProps) {
    const router = useRouter();
    const [selectedTab, setSelectedTab] = React.useState<string>(rooms[0]?.id || "new");
    const [isAddRoomOpen, setIsAddRoomOpen] = React.useState(false);
    const [editingRoom, setEditingRoom] = React.useState<Room | null>(null);

    React.useEffect(() => {
        if (rooms.length > 0 && selectedTab === "new") {
            setSelectedTab(rooms[0].id);
        }
    }, [rooms, selectedTab]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-white">Room Types</h2>
                    <p className="text-sm text-neutral-400">Manage room configurations and inventory.</p>
                </div>
                <Button 
                    onClick={() => setIsAddRoomOpen(true)}
                    className="bg-neutral-800 hover:bg-neutral-700 text-white border border-white/10"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Room Type
                </Button>
            </div>

            {rooms.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/20 p-12 text-center bg-neutral-900/30">
                    <div className="mx-auto h-12 w-12 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center mb-4">
                        <Bed className="h-6 w-6 text-neutral-400" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">No Room Types</h3>
                    <p className="text-neutral-400 mb-6">Create your first room type to start adding inventory.</p>
                    <Button onClick={() => setIsAddRoomOpen(true)} className="bg-orange-600 hover:bg-orange-700">
                        Create Room Type
                    </Button>
                </div>
            ) : (
                <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
                    <div className="overflow-x-auto pb-2 mb-6 hide-scrollbar">
                        <TabsList className="bg-transparent h-auto p-0 gap-2 inline-flex">
                            {rooms.map((room) => (
                                <TabsTrigger 
                                    key={room.id} 
                                    value={room.id}
                                    className="data-[state=active]:bg-orange-600/10 data-[state=active]:text-orange-500 data-[state=active]:border-orange-500/50 bg-neutral-900/50 border border-white/10 text-neutral-400 rounded-lg px-4 py-2 h-auto transition-all hover:border-white/20 hover:text-white"
                                >
                                    {room.name}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>

                    {rooms.map((room) => (
                        <TabsContent key={room.id} value={room.id} className="space-y-12 animate-in fade-in-50 duration-300">
                            {/* Room Summary (Flat Layout) */}
                            <div className="flex flex-col md:flex-row gap-8">
                                {/* Image Section */}
                                <div className="w-full md:w-[300px] aspect-video relative rounded-xl overflow-hidden bg-neutral-950 border border-white/10 group">
                                    {room.image ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img 
                                            src={room.image} 
                                            alt={room.name} 
                                            className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-neutral-700">
                                            <ImageIcon className="h-8 w-8" />
                                        </div>
                                    )}
                                </div>
                                
                                {/* Details Section */}
                                <div className="flex-1 flex flex-col justify-between py-2">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="text-2xl font-bold text-white mb-2">{room.name}</h3>
                                                <p className="text-neutral-400 max-w-2xl text-lg leading-relaxed">{room.description || "No description provided."}</p>
                                            </div>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="gap-2 border-white/10 bg-transparent hover:bg-white hover:text-black hover:border-white text-neutral-400"
                                                onClick={() => setEditingRoom(room)}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                                Edit Details
                                            </Button>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-8 text-base border-t border-white/10 pt-6 mt-6">
                                        <div className="flex items-center gap-3 text-neutral-300">
                                            <div className="p-2 rounded-full bg-green-500/10 text-green-500">
                                                 <DollarSign className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <span className="block text-xs text-neutral-500 uppercase tracking-wider">Price</span>
                                                <span className="font-semibold text-white">₱{room.price.toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 text-neutral-300">
                                            <div className="p-2 rounded-full bg-blue-500/10 text-blue-500">
                                                <Users className="h-4 w-4" />
                                            </div>
                                             <div>
                                                <span className="block text-xs text-neutral-500 uppercase tracking-wider">Capacity</span>
                                                <span className="font-semibold text-white">{room.capacity} Guests</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 text-neutral-300">
                                             <div className="p-2 rounded-full bg-orange-500/10 text-orange-500">
                                                <Bed className="h-4 w-4" />
                                             </div>
                                             <div>
                                                <span className="block text-xs text-neutral-500 uppercase tracking-wider">Inventory</span>
                                                <span className="font-semibold text-white">{room.units.length} Units</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Inventory Table Container (Flat) */}
                            <div>
                                <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
                                     <div>
                                        <h4 className="text-lg font-semibold text-white">Unit Inventory</h4>
                                        <p className="text-sm text-neutral-400">Manage individual room units and status.</p>
                                    </div>
                                    {/* Action button is inside table component, but header is here for structure */}
                                </div>
                                <RoomUnitsTable 
                                    roomTypeId={room.id}
                                    units={room.units}
                                />
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>
            )}

            {/* Edit Room Sheet */}
            <Sheet open={!!editingRoom} onOpenChange={(open) => !open && setEditingRoom(null)}>
                <SheetContent side="right" className="w-full sm:max-w-xl bg-neutral-950 border-white/10 overflow-y-auto p-8">
                    {editingRoom && (
                        <RoomForm 
                            room={editingRoom}
                            isEditMode={true}
                            properties={properties}
                            onSuccess={() => {
                                setEditingRoom(null);
                                router.refresh();
                            }}
                            onCancel={() => setEditingRoom(null)}
                        />
                    )}
                </SheetContent>
            </Sheet>

            {/* Add Room Sheet */}
            <Sheet open={isAddRoomOpen} onOpenChange={setIsAddRoomOpen}>
                <SheetContent side="right" className="w-full sm:max-w-xl bg-neutral-950 border-white/10 overflow-y-auto p-8">
                    <RoomForm 
                        properties={properties}
                        room={{ 
                            propertyId, 
                            name: "", 
                            description: "", 
                            capacity: 2, 
                            price: 0, 
                            image: null, 
                            id: "" 
                        }}
                        onSuccess={() => {
                            setIsAddRoomOpen(false);
                            router.refresh();
                        }}
                        onCancel={() => setIsAddRoomOpen(false)}
                    />
                </SheetContent>
            </Sheet>
        </div>
    );
}
