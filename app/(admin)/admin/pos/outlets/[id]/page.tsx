import { db } from "@/lib/db";
import { OutletForm } from "@/components/admin/pos/outlet-form";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";

interface EditOutletPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditOutletPage({ params }: EditOutletPageProps) {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  const { id } = await params;

  // Get the outlet
  const outlet = await db.salesOutlet.findUnique({
    where: { id },
    include: {
      property: {
        select: {
          id: true,
          name: true,
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
  });

  if (!outlet) {
    notFound();
  }

  // Get current property scope from cookie
  const cookieStore = await cookies();
  const currentScope = cookieStore.get("admin_property_scope")?.value || "ALL";

  // Get properties for dropdown (just the outlet's property for edit mode)
  const properties = await db.property.findMany({
    where: { id: outlet.propertyId },
    select: {
      id: true,
      name: true,
    },
  });

  // Get warehouses for dropdown (filtered by outlet's property)
  const warehouses = await db.warehouse.findMany({
    where: {
      isActive: true,
      propertyId: outlet.propertyId,
    },
    select: {
      id: true,
      name: true,
      type: true,
      propertyId: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <OutletForm
        outlet={{
          id: outlet.id,
          name: outlet.name,
          type: outlet.type,
          warehouseId: outlet.warehouseId,
          isActive: outlet.isActive,
          propertyId: outlet.propertyId,
        }}
        properties={properties}
        warehouses={warehouses}
        isEditMode={true}
        currentPropertyId={outlet.propertyId}
        currentPropertyName={outlet.property.name}
      />
    </div>
  );
}
