import { db } from "@/lib/db";
import { BookingsTable } from "@/components/admin/bookings-table";
import { hasPermission } from "@/lib/auth-checks";
import { redirect } from "next/navigation";
import { getCurrentPropertyFilter } from "@/lib/data-access";

export default async function AdminBookingsPage() {
  const canView = await hasPermission("bookings:view");
  if (!canView) redirect("/admin");

  const canManage = await hasPermission("bookings:edit");
  const propertyWhere = await getCurrentPropertyFilter();

  const bookingFilter: any = {};
  if (propertyWhere.id) {
       // Filter bookings that have AT LEAST ONE item from this property scope
       bookingFilter.items = {
        some: {
            room: {
                propertyId: propertyWhere.id
            }
        }
    };
  }

  const bookings = await db.booking.findMany({
    where: bookingFilter,
    include: {
        property: true,
        items: {
            include: {
                room: true
            }
        }
    },
    orderBy: {
        createdAt: 'desc'
    }
  });

  const formattedBookings = bookings.map(b => ({
      ...b,
      totalAmount: Number(b.totalAmount),
      taxAmount: Number(b.taxAmount),
      serviceCharge: Number(b.serviceCharge),
      amountPaid: Number(b.amountPaid),
      amountDue: Number(b.amountDue),
      property: b.property ? {
          ...b.property,
          taxRate: Number(b.property.taxRate),
          serviceChargeRate: Number(b.property.serviceChargeRate)
      } : null,
      items: b.items.map(i => ({
          ...i,
          pricePerNight: Number(i.pricePerNight),
          room: i.room ? {
              ...i.room,
              price: Number(i.room.price)
          } : null
      }))
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bookings</h1>
        <p className="text-muted-foreground">
          Manage reservations and payment statuses.
        </p>
      </div>
      <BookingsTable bookings={formattedBookings} canManage={canManage} />
    </div>
  );
}
