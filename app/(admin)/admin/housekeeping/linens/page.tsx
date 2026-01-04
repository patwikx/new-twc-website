import { db } from "@/lib/db";
import { LinensTable } from "@/components/admin/housekeeping/linens-table";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function AdminHousekeepingLinensPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  // Get current property scope from cookie
  const cookieStore = await cookies();
  const currentScope = cookieStore.get("admin_property_scope")?.value || "ALL";

  // Housekeeping requires a specific property to be selected
  if (currentScope === "ALL") {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Housekeeping Linens</h1>
          <p className="text-muted-foreground">
            Manage linen inventory, track status, and handle lifecycle operations.
          </p>
        </div>
        <div className="flex items-center justify-center h-64 border border-dashed border-white/10 rounded-lg bg-neutral-900/50">
          <div className="text-center">
            <p className="text-lg text-neutral-400">Please select a property</p>
            <p className="text-sm text-neutral-500 mt-1">
              Use the property switcher in the sidebar to select a specific property.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Get linen items for the selected property only
  const linenItems = await db.linenItem.findMany({
    where: {
      stockItem: {
        propertyId: currentScope,
      },
    },
    include: {
      stockItem: {
        select: {
          id: true,
          name: true,
          sku: true,
          itemCode: true,
          property: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      warehouse: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
    orderBy: [
      { status: "asc" },
      { type: "asc" },
      { createdAt: "desc" },
    ],
  });

  // Get warehouses for the selected property only
  const warehouses = await db.warehouse.findMany({
    where: {
      isActive: true,
      propertyId: currentScope,
    },
    select: {
      id: true,
      name: true,
      type: true,
    },
    orderBy: { name: "asc" },
  });

  // Get rooms for the selected property only
  const rooms = await db.roomUnit.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      roomType: {
        property: {
          id: currentScope,
        },
      },
    },
    select: {
      id: true,
      number: true,
      floor: true,
      roomType: {
        select: {
          name: true,
          property: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: [
      { number: "asc" },
    ],
  });

  // Transform linen items for the table
  const linensData = linenItems.map((item) => ({
    id: item.id,
    stockItemId: item.stockItemId,
    stockItemName: item.stockItem.name,
    stockItemCode: item.stockItem.itemCode,
    propertyId: item.stockItem.property.id,
    propertyName: item.stockItem.property.name,
    serialNumber: item.serialNumber,
    type: item.type,
    size: item.size,
    condition: item.condition,
    status: item.status,
    warehouseId: item.warehouseId,
    warehouseName: item.warehouse.name,
    warehouseType: item.warehouse.type,
    assignedRoomId: item.assignedRoomId,
    purchaseDate: item.purchaseDate,
    lastLaundryDate: item.lastLaundryDate,
    cycleCount: item.cycleCount,
    damageNotes: item.damageNotes,
    retiredAt: item.retiredAt,
    retiredReason: item.retiredReason,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));

  // Transform rooms for the issue dialog
  const roomsData = rooms.map((room) => ({
    id: room.id,
    number: room.number,
    floor: room.floor,
    roomTypeName: room.roomType.name,
    propertyId: room.roomType.property.id,
    propertyName: room.roomType.property.name,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Housekeeping Linens</h1>
        <p className="text-muted-foreground">
          Manage linen inventory, track status, and handle lifecycle operations.
        </p>
      </div>

      <LinensTable 
        linens={linensData}
        warehouses={warehouses}
        rooms={roomsData}
      />
    </div>
  );
}
