import { db } from "@/lib/db";
import { RoomsTable } from "@/components/admin/rooms-table";

export default async function AdminRoomsPage() {
  const rawRooms = await db.room.findMany({
    include: { property: true }
  });

  const rooms = rawRooms.map(room => ({
    ...room,
    price: Number(room.price)
  }));

  return (
    <div className="space-y-4">
       <div>
         <h1 className="text-3xl font-bold tracking-tight">Rooms</h1>
         <p className="text-muted-foreground">Manage room types and pricing across all properties.</p>
       </div>

       <RoomsTable rooms={rooms} />
    </div>
  );
}
