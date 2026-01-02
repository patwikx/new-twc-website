import { hasPermission } from "@/lib/auth-checks";
import { redirect } from "next/navigation";
import { getFrontDeskData } from "@/actions/admin/front-desk";
import { RoomGrid } from "@/components/admin/front-desk/room-grid";
import { getCurrentPropertyFilter } from "@/lib/data-access";

export default async function FrontDeskPage() {
  // Check permission (Staff or Admin)
  const canView = await hasPermission("bookings:edit"); 
  if (!canView) redirect("/admin");

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

  return (
    <div className="space-y-6 pb-20">
       <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Front Desk</h1>
          <p className="text-neutral-400">
             Manage room inventory, check-ins, and walk-in guests.
          </p>
       </div>

       <RoomGrid 
          rooms={rooms}
          unassignedBookings={unassignedBookings}
       />
    </div>
  );
}
