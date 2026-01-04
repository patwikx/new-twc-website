import { db } from "@/lib/db";
import { SuppliersTable } from "@/components/admin/inventory/suppliers-table";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AdminSuppliersPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  // Get suppliers with counts
  const suppliers = await db.supplier.findMany({
    include: {
      _count: {
        select: {
          stockItems: true,
          consignmentReceipts: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Transform data for the table
  const suppliersData = suppliers.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    contactName: supplier.contactName,
    email: supplier.email,
    phone: supplier.phone,
    address: supplier.address,
    isActive: supplier.isActive,
    stockItemCount: supplier._count.stockItems,
    consignmentReceiptCount: supplier._count.consignmentReceipts,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
        <p className="text-muted-foreground">
          Manage your supplier information and view their associated stock items.
        </p>
      </div>

      <SuppliersTable suppliers={suppliersData} />
    </div>
  );
}
