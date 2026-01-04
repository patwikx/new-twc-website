import { db } from "@/lib/db";
import { OutletForm } from "@/components/admin/pos/outlet-form";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function NewOutletPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  // Get current property scope from cookie
  const cookieStore = await cookies();
  const currentScope = cookieStore.get("admin_property_scope")?.value || "ALL";

  // Get properties for dropdown
  const properties = await db.property.findMany({
    where: currentScope !== "ALL" ? { id: currentScope } : undefined,
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  // Get warehouses for dropdown (filtered by property scope)
  const warehouses = await db.warehouse.findMany({
    where: {
      isActive: true,
      ...(currentScope !== "ALL" ? { propertyId: currentScope } : {}),
    },
    select: {
      id: true,
      name: true,
      type: true,
      propertyId: true,
    },
    orderBy: { name: "asc" },
  });

  // Determine current property context
  const currentPropertyId = currentScope !== "ALL" ? currentScope : null;
  const currentProperty = currentPropertyId 
    ? properties.find(p => p.id === currentPropertyId) 
    : null;

  return (
    <div className="space-y-6">
      <OutletForm
        properties={properties}
        warehouses={warehouses}
        currentPropertyId={currentPropertyId}
        currentPropertyName={currentProperty?.name}
      />
    </div>
  );
}
