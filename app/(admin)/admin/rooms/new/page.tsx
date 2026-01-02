import { RoomForm } from "@/components/admin/room-form";
import { getAllPropertiesChoice } from "@/actions/admin/rooms";

export default async function NewRoomPage() {
  const properties = await getAllPropertiesChoice();

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Create Room</h1>
        <p className="text-sm text-neutral-400">Add a new room type to a property</p>
      </div>

      <RoomForm properties={properties} />
    </div>
  );
}
