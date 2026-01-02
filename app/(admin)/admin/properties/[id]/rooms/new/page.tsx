import { RoomForm } from "@/components/admin/room-form";
import { getAllPropertiesChoice } from "@/actions/admin/rooms";

interface NewRoomPageProps {
    params: Promise<{
        id: string;
    }>
}

export default async function NewRoomPage({ params }: NewRoomPageProps) {
  const { id: propertyId } = await params;
  const properties = await getAllPropertiesChoice();

  // Pre-select the current property
  const preselectedRoom = {
      id: "",
      name: "",
      propertyId: propertyId,
      description: "",
      capacity: 2,
      price: 0,
      image: null
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Create Room Type</h1>
        <p className="text-sm text-neutral-400">Add a new room type to this property</p>
      </div>

      <RoomForm 
          room={preselectedRoom}
          properties={properties}
      />
    </div>
  );
}
