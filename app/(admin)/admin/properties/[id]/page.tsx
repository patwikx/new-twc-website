import { PropertyForm } from "@/components/admin/property-form";
import { getPropertyById } from "@/actions/admin/properties";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Bed, DollarSign, Calendar } from "lucide-react";
import { RoomManagementTabs } from "@/components/admin/room-management-tabs";

interface EditPropertyPageProps {
    params: Promise<{
        id: string;
    }>
}

async function getPropertyStats(propertyId: string) {
    const [roomCount, bookingCount, revenueAgg] = await Promise.all([
        db.room.count({ where: { propertyId } }),
        db.booking.count({ 
            where: { 
                items: { some: { room: { propertyId } } },
                status: { in: ['CONFIRMED', 'COMPLETED'] }
            } 
        }),
        db.bookingItem.findMany({
            where: {
                room: { propertyId },
                booking: { status: { in: ['CONFIRMED', 'COMPLETED'] } }
            },
            select: {
                pricePerNight: true,
                checkIn: true,
                checkOut: true
            }
        })
    ]);

    const totalRevenue = revenueAgg.reduce((acc, item) => {
        const days = Math.max(1, Math.ceil((new Date(item.checkOut).getTime() - new Date(item.checkIn).getTime()) / (1000 * 60 * 60 * 24)));
        return acc + (Number(item.pricePerNight) * days);
    }, 0);

    return { roomCount, bookingCount, totalRevenue };
}

export default async function EditPropertyPage({ params }: EditPropertyPageProps) {
  const { id } = await params;
  const property = await getPropertyById(id);

  if (!property) {
      redirect("/admin/properties");
  }

  const stats = await getPropertyStats(id);

  // Fetch rooms for this property with units
  const rooms = await db.room.findMany({
      where: { propertyId: id },
      include: { 
        units: {
            orderBy: { number: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
  });

  const roomsForFrontend = rooms.map(room => ({
      ...room,
      price: Number(room.price)
  }));

  // Fetch all properties for the room form selector
  const allProperties = await db.property.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
  });

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12">
        {/* Header Hero */}
        <div className="relative rounded-xl overflow-hidden bg-neutral-900 border border-white/10">
            {property.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                    src={property.image} 
                    alt={property.name} 
                    className="absolute inset-0 w-full h-full object-cover opacity-40 blur-sm scale-105"
                />
            ) : null}
            <div className="relative p-8 z-10 bg-gradient-to-t from-neutral-950/90 to-transparent">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">{property.name}</h1>
                        <p className="text-neutral-300 font-medium flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-orange-500" />
                            {property.location}
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <div className="bg-black/50 backdrop-blur border border-white/10 rounded-lg px-4 py-2 text-center min-w-[100px]">
                            <p className="text-xs text-neutral-400 uppercase tracking-wider">Bookings</p>
                            <p className="text-xl font-bold text-white">{stats.bookingCount}</p>
                        </div>
                        <div className="bg-black/50 backdrop-blur border border-white/10 rounded-lg px-4 py-2 text-center min-w-[100px]">
                            <p className="text-xs text-neutral-400 uppercase tracking-wider">Revenue</p>
                            <p className="text-xl font-bold text-green-400">₱{stats.totalRevenue.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="space-y-8">
            {/* Property Details Section */}
            <div>
                <PropertyForm 
                    property={property ? {
                        ...property,
                        taxRate: Number(property.taxRate),
                        serviceChargeRate: Number(property.serviceChargeRate)
                    } : null} 
                    isEditMode={true} 
                />
            </div>

            {/* Room Management Section */}
            <div className="space-y-6">
                 <RoomManagementTabs 
                    rooms={roomsForFrontend}
                    propertyId={id}
                    properties={allProperties}
                 />
            </div>
        </div>
    </div>
  );
}
