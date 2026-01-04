import { db } from "@/lib/db";
import { CategoriesTable } from "@/components/admin/inventory/categories-table";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AdminCategoriesPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  // Get categories with item counts
  const categories = await db.stockCategory.findMany({
    include: {
      _count: {
        select: {
          stockItems: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Transform data for the table
  const categoriesData = categories.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    color: category.color,
    isSystem: category.isSystem,
    isActive: category.isActive,
    stockItemCount: category._count.stockItems,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Stock Categories</h1>
        <p className="text-muted-foreground">
          Manage stock categories to organize your inventory items effectively.
        </p>
      </div>

      <CategoriesTable categories={categoriesData} />
    </div>
  );
}
