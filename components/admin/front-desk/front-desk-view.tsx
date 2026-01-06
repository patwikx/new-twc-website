"use client";

import { RoomGrid } from "@/components/admin/front-desk/room-grid";
import { DashboardStats } from "@/components/admin/front-desk/dashboard-stats";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface FrontDeskViewProps {
  rooms: any[];
  unassignedBookings: any[];
  currentUserRole: string | undefined;
  staffMembers: any[];
  stats: any;
  propertyId: string;
}

export function FrontDeskView({ 
    rooms, 
    unassignedBookings, 
    currentUserRole, 
    staffMembers,
    stats,
    propertyId
}: FrontDeskViewProps) {
    const [activeFilter, setActiveFilter] = useState<string | null>(null);

    // Filter Logic for Room Grid
    // We filter the passed 'unassignedBookings' and potentially 'rooms' display based on filter.
    // However, RoomGrid expects full data internally usually.
    // Let's implement a simple filter:
    
    // ARRIVALS: unassignedBookings is already effectively our arrivals list.
    // IN_HOUSE: Filter rooms -> units where status === OCCUPIED.
    // AVAILABLE: Filter rooms -> units where status === CLEAN.
    // DEPARTURES: Harder, implies current bookings ending today. RoomGrid might not easily show this unless we pass a specific prop.
    
    // For now, let's pass the 'activeFilter' to RoomGrid and let it handle visibility highlighting?
    // Or we filter the props we pass to it.
    
    // Let's filter the props. 
    
    let filteredRooms = rooms;
    let filteredBookings = unassignedBookings;

    if (activeFilter === 'ARRIVALS') {
        // Show only rooms that match the unassigned bookings' room types? No, unassigned bookings are separate.
        // Maybe just highlight unassigned bookings section.
        // Actually, RoomGrid shows Unassigned Bookings at the top?
        // Let's pass 'activeFilter' to RoomGrid if we want it to react nicely.
        // But RoomGrid definition is separate. 
        // Simplest: If filter is 'ARRIVALS', maybe we hide the room list and only show unassigned?
        // Let's just pass `activeFilter` to RoomGrid and modify it to handle highlighting.
    } 

    return (
        <div className="space-y-8">
            <DashboardStats 
                stats={stats} 
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
            />

            <div className="space-y-4">
                <h2 className="text-xl font-bold tracking-tight">Room Status</h2>
                <RoomGrid 
                    rooms={rooms}
                    unassignedBookings={unassignedBookings}
                    currentUserRole={currentUserRole}
                    staffMembers={staffMembers}
                    // We can add a 'highlight' prop to RoomGrid later for the filter interaction
                    // For now, just rendering it below is fine.
                />
            </div>
        </div>
    );
}
