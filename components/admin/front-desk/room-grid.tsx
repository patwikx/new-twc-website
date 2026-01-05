"use client";

import * as React from "react";
import { UnitCard } from "./unit-card";
import { UnitActionDialog } from "./unit-action-dialog";

interface RoomGridProps {
  rooms: any[];
  unassignedBookings: any[];
  currentUserRole: string | undefined | null;
  staffMembers: any[];
}

export function RoomGrid({ rooms, unassignedBookings, currentUserRole, staffMembers }: RoomGridProps) {
  const [selectedUnit, setSelectedUnit] = React.useState<any>(null);

  const getPrice = (roomTypeId: string) => {
    const room = rooms.find(r => r.id === roomTypeId);
    return room ? Number(room.price) : 0;
  };

  const getPropertyRates = (roomTypeId: string) => {
    const room = rooms.find(r => r.id === roomTypeId);
    return room?.property ? {
       taxRate: Number(room.property.taxRate),
       serviceChargeRate: Number(room.property.serviceChargeRate)
    } : { taxRate: 0, serviceChargeRate: 0 };
  };

  return (
    <div className="space-y-8">
      {rooms.map((room) => (
        <div key={room.id} className="space-y-4">
           {/* Section Header */}
           <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div>
                  <h3 className="text-lg font-semibold text-white">{room.name}</h3>
                  <p className="text-sm text-neutral-400">{room.units.length} Units • {room.capacity} Pax</p>
              </div>
              <div className="text-sm text-neutral-500">
                  {room.units.filter((u: any) => u.status === 'CLEAN').length} Available
              </div>
           </div>
           
           {/* Grid */}
           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {room.units.map((unit: any) => (
                 <UnitCard 
                    key={unit.id} 
                    unit={{...unit, roomType: room}} // Pass roomType down for context 
                    onClick={() => setSelectedUnit({...unit, roomType: room})} 
                 />
              ))}
              {room.units.length === 0 && (
                  <div className="col-span-full py-8 text-center border border-dashed border-white/10 rounded-xl text-neutral-500">
                      No units configured for this room type.
                  </div>
              )}
           </div>
        </div>
      ))}

      {/* Dialog */}
      <UnitActionDialog 
         unit={selectedUnit}
         isOpen={!!selectedUnit}
         onOpenChange={(open: boolean) => !open && setSelectedUnit(null)}
         unassignedBookings={unassignedBookings}
         roomPrice={selectedUnit ? getPrice(selectedUnit.roomTypeId) : 0}
         propertyRates={selectedUnit ? getPropertyRates(selectedUnit.roomTypeId) : { taxRate: 0, serviceChargeRate: 0 }}
         allRooms={rooms} 
         currentUserRole={currentUserRole}
         staffMembers={staffMembers}
      />
    </div>
  );
}
