import { RoomForm } from "@/components/admin/room-form";
import { getRoomById, getAllPropertiesChoice } from "@/actions/admin/rooms";
import { redirect } from "next/navigation";

interface EditRoomPageProps {
    params: {
        id: string;
    }
}

export default async function EditRoomPage({ params }: EditRoomPageProps) {
  const { id } = await params;
  const room = await getRoomById(id);
  const properties = await getAllPropertiesChoice();

  if (!room) {
      redirect("/admin/rooms");
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Edit Room</h1>
        <p className="text-sm text-neutral-400">Update room details and pricing</p>
      </div>

      <RoomForm 
        room={room} 
        isEditMode={true} 
        properties={properties}
      />
    </div>
  );
}
