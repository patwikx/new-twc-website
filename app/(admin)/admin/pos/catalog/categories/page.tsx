import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { CategoryManagement } from "@/components/admin/pos/category-management";

export default async function CategoriesPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  // Get current property scope from cookie
  const cookieStore = await cookies();
  const currentScope = cookieStore.get("admin_property_scope")?.value || "ALL";

  // Get categories for the current property scope
  const categories = await db.menuCategory.findMany({
    where: {
      ...(currentScope !== "ALL" ? { propertyId: currentScope } : {}),
    },
    include: {
      property: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          menuItems: true,
        },
      },
    },
    orderBy: [
      { sortOrder: "asc" },
      { name: "asc" },
    ],
  });

  // Get properties for dropdown
  const properties = await db.property.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  // Transform for client
  const categoryData = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    description: cat.description,
    color: cat.color,
    icon: cat.icon,
    sortOrder: cat.sortOrder,
    isActive: cat.isActive,
    propertyId: cat.propertyId,
    propertyName: cat.property?.name || "All Properties",
    menuItemCount: cat._count.menuItems,
    createdAt: cat.createdAt,
    updatedAt: cat.updatedAt,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Menu Categories</h1>
        <p className="text-muted-foreground">
          Manage menu categories for organizing your menu items.
        </p>
      </div>

      <CategoryManagement 
        categories={categoryData}
        properties={properties}
        currentScope={currentScope}
      />
    </div>
  );
}
