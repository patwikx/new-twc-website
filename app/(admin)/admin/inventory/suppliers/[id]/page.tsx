import { db } from "@/lib/db";
import { SupplierForm } from "@/components/admin/inventory/supplier-form";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";

interface SupplierPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminSupplierPage({ params }: SupplierPageProps) {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  const { id } = await params;

  // Get supplier details
  const supplier = await db.supplier.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      contactName: true,
      email: true,
      phone: true,
      address: true,
      isActive: true,
      _count: {
        select: {
          stockItems: true,
          consignmentReceipts: true,
          consignmentSettlements: true,
          purchaseOrders: true,
        },
      },
    },
  });

  if (!supplier) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <SupplierForm supplier={supplier} isEditMode={true} />

      {/* Related Items Summary */}
      <div className="border-t border-white/10 pt-6">
        <h3 className="text-sm font-medium text-neutral-300 mb-4">
          Related Records
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-neutral-900/30 rounded-lg border border-white/10">
            <div className="text-2xl font-bold text-white">
              {supplier._count.stockItems}
            </div>
            <div className="text-xs text-neutral-500 uppercase tracking-widest">
              Stock Items
            </div>
          </div>
          <div className="p-4 bg-neutral-900/30 rounded-lg border border-white/10">
            <div className="text-2xl font-bold text-white">
              {supplier._count.purchaseOrders}
            </div>
            <div className="text-xs text-neutral-500 uppercase tracking-widest">
              Purchase Orders
            </div>
          </div>
          <div className="p-4 bg-neutral-900/30 rounded-lg border border-white/10">
            <div className="text-2xl font-bold text-white">
              {supplier._count.consignmentReceipts}
            </div>
            <div className="text-xs text-neutral-500 uppercase tracking-widest">
              Consignment Receipts
            </div>
          </div>
          <div className="p-4 bg-neutral-900/30 rounded-lg border border-white/10">
            <div className="text-2xl font-bold text-white">
              {supplier._count.consignmentSettlements}
            </div>
            <div className="text-xs text-neutral-500 uppercase tracking-widest">
              Settlements
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
