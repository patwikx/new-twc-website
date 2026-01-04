import { db } from "@/lib/db";
import { StockItemForm } from "@/components/admin/inventory/stock-item-form";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function NewStockItemPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  // Get current property scope from cookie
  const cookieStore = await cookies();
  const currentScope = cookieStore.get("admin_property_scope")?.value;

  // Get properties for dropdown (fallback if no scope selected)
  const properties = await db.property.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  // Determine the current property ID
  // If scope is "ALL" or not set, we need to show a property selector
  // Otherwise, use the scoped property
  const currentPropertyId = currentScope && currentScope !== "ALL" ? currentScope : null;
  
  // Get the current property details if we have a scope
  const currentProperty = currentPropertyId 
    ? properties.find(p => p.id === currentPropertyId) 
    : null;

  // Get active categories for dropdown
  const categories = await db.stockCategory.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
    },
    orderBy: { name: "asc" },
  });

  // Get units of measure for dropdown
  const units = await db.unitOfMeasure.findMany({
    select: {
      id: true,
      name: true,
      abbreviation: true,
    },
    orderBy: { name: "asc" },
  });

  // Get active suppliers for dropdown
  const suppliers = await db.supplier.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      contactName: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <StockItemForm
        properties={properties}
        categories={categories}
        units={units}
        suppliers={suppliers}
        warehouses={[]}
        isEditMode={false}
        currentPropertyId={currentPropertyId}
        currentPropertyName={currentProperty?.name}
      />
    </div>
  );
}
