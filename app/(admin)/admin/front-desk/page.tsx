import { hasPermission, getCurrentRole } from "@/lib/auth-checks";
import { redirect } from "next/navigation";
import { getFrontDeskData, getDashboardStats } from "@/actions/admin/front-desk";
import { RoomGrid } from "@/components/admin/front-desk/room-grid";
import { FrontDeskView } from "@/components/admin/front-desk/front-desk-view";
import { getCurrentPropertyFilter } from "@/lib/data-access";
import { db } from "@/lib/db";

export default async function FrontDeskPage() {
  // Check permission (Staff or Admin)
  const canView = await hasPermission("bookings:edit"); 
  if (!canView) redirect("/admin");
  const userRole = await getCurrentRole();

  // Get scope (Front Desk usually operates on a single property view)
  const propertyWhere = await getCurrentPropertyFilter();
  
  if (!propertyWhere.id) {
     return (
        <div className="p-8 text-center">
           <h2 className="text-xl font-bold">Please select a property.</h2>
           <p className="text-muted-foreground">Front Desk view requires a specific property context.</p>
        </div>
     );
  }

  // Fetch Data
  const { rooms: rawRooms, unassignedBookings: rawBookings } = await getFrontDeskData(propertyWhere.id as string);

  // Serialize Data for Client Component
  const rooms = rawRooms.map(room => ({
     ...room,
     price: Number(room.price),
     property: {
        ...room.property,
        taxRate: Number(room.property.taxRate),
        serviceChargeRate: Number(room.property.serviceChargeRate),
     },
     units: room.units.map(unit => ({
        ...unit,
        bookingItems: unit.bookingItems.map(item => ({
            ...item,
            pricePerNight: Number(item.pricePerNight),
            booking: {
                ...item.booking,
                totalAmount: Number(item.booking.totalAmount),
                taxAmount: Number(item.booking.taxAmount),
                serviceCharge: Number(item.booking.serviceCharge),
                amountPaid: Number(item.booking.amountPaid),
                amountDue: Number(item.booking.amountDue),
            }
        }))
     }))
  }));

  const unassignedBookings = rawBookings.map(item => ({
      ...item,
      pricePerNight: Number(item.pricePerNight),
      room: {
          ...item.room,
          price: Number(item.room.price)
      },
      booking: {
          ...item.booking,
          totalAmount: Number(item.booking.totalAmount),
          taxAmount: Number(item.booking.taxAmount),
          serviceCharge: Number(item.booking.serviceCharge),
          amountPaid: Number(item.booking.amountPaid),
          amountDue: Number(item.booking.amountDue),
      }
  }));

   // Fetch Staff
   const staffMembers = await db.user.findMany({
      where: { role: 'STAFF' },
      select: { id: true, name: true, employeeId: true },
      orderBy: { name: 'asc' }
   });

  // Fetch Dashboard Stats 
  const stats = await getDashboardStats(propertyWhere.id as string);

  return (
    <div className="space-y-6 pb-20">
       <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Front Desk</h1>
          <p className="text-neutral-400">
             Manage room inventory, check-ins, and walk-in guests.
          </p>
       </div>

       <FrontDeskView 
          rooms={rooms}
          unassignedBookings={unassignedBookings}
          currentUserRole={userRole}
          staffMembers={staffMembers}
          stats={stats}
          propertyId={propertyWhere.id as string}
       />
    </div>
  );
}
