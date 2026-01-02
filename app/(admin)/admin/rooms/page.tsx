import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Home } from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

export default async function AdminRoomsPage() {
  const rooms = await db.room.findMany({
    include: { property: true }
  });

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-serif font-medium">Rooms</h1>
            <p className="text-neutral-400">Manage room types and pricing across all properties.</p>
          </div>
          <Button className="rounded-none uppercase tracking-widest text-xs h-10 gap-2 bg-orange-600 hover:bg-orange-700 text-white">
             <Plus className="h-4 w-4" /> Add Room
          </Button>
       </div>

       <div className="bg-white/5 border border-white/10">
          <Table>
             <TableHeader>
                <TableRow className="border-white/10 hover:bg-white/5">
                   <TableHead className="text-neutral-400 uppercase tracking-widest text-xs">Room Name</TableHead>
                   <TableHead className="text-neutral-400 uppercase tracking-widest text-xs">Property</TableHead>
                   <TableHead className="text-neutral-400 uppercase tracking-widest text-xs">Price</TableHead>
                   <TableHead className="text-neutral-400 uppercase tracking-widest text-xs">Capacity</TableHead>
                   <TableHead className="text-neutral-400 uppercase tracking-widest text-xs text-right">Actions</TableHead>
                </TableRow>
             </TableHeader>
             <TableBody>
                {rooms.map((room) => (
                   <TableRow key={room.id} className="border-white/10 hover:bg-white/5 bg-neutral-900/50">
                      <TableCell className="font-medium">
                         <div className="flex items-center gap-3">
                            {room.image && (
                               // eslint-disable-next-line @next/next/no-img-element
                               <img src={room.image} alt={room.name} className="h-10 w-16 object-cover bg-neutral-800" />
                            )}
                            {room.name}
                         </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex items-center gap-2 text-neutral-300">
                            <Home className="h-3 w-3" />
                            {room.property.name}
                         </div>
                      </TableCell>
                      <TableCell>₱{Number(room.price).toLocaleString()}</TableCell>
                      <TableCell>{room.capacity} Guests</TableCell>
                      <TableCell className="text-right space-x-2">
                         <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-900/20 hover:text-blue-400">
                            <Pencil className="h-4 w-4" />
                         </Button>
                         <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-900/20 hover:text-red-400">
                            <Trash2 className="h-4 w-4" />
                         </Button>
                      </TableCell>
                   </TableRow>
                ))}
                {rooms.length === 0 && (
                   <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-neutral-500">
                         No rooms found.
                      </TableCell>
                   </TableRow>
                )}
             </TableBody>
          </Table>
       </div>
    </div>
  );
}
