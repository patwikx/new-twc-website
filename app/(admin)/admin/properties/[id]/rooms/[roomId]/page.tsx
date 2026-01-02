import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoomForm } from "@/components/admin/room-form";
import { getRoomById, getAllPropertiesChoice } from "@/actions/admin/rooms";
import { getRoomUnits } from "@/actions/admin/room-units";
import { redirect } from "next/navigation";
import { RoomUnitsTab } from "@/components/admin/room-units-tab";

interface RoomDetailPageProps {
    params: Promise<{
        id: string;
        roomId: string;
    }>
}

export default async function RoomDetailPage({ params }: RoomDetailPageProps) {
  const { id: propertyId, roomId } = await params;
  const room = await getRoomById(roomId);
  const properties = await getAllPropertiesChoice();
  const units = await getRoomUnits(roomId);

  if (!room) {
      redirect(`/admin/properties/${propertyId}`);
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{room.name}</h1>
        <p className="text-sm text-neutral-400">Room Type Details</p>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-neutral-900/50 border border-white/10 max-w-md">
          <TabsTrigger value="details" className="data-[state=active]:bg-white data-[state=active]:text-black">Details</TabsTrigger>
          <TabsTrigger value="units" className="data-[state=active]:bg-white data-[state=active]:text-black">Room Units ({units.length})</TabsTrigger>
        </TabsList>

        {/* DETAILS TAB */}
        <TabsContent value="details" className="mt-6">
            <RoomForm 
                room={room} 
                isEditMode={true}
                properties={properties}
            />
        </TabsContent>

        {/* ROOM UNITS TAB */}
        <TabsContent value="units" className="mt-6">
            <RoomUnitsTab 
                roomTypeId={roomId}
                units={units}
            />
        </TabsContent>
      </Tabs>
    </div>
  );
}
