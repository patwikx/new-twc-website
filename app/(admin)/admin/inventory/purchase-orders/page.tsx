import { getPurchaseOrders } from "@/lib/inventory/purchase-order";
import { PurchaseOrdersTable } from "@/components/admin/inventory/purchase-orders-table";
import { FileText } from "lucide-react";
import { db } from "@/lib/db";

// Force dynamic rendering since this page uses headers() through property context
export const dynamic = 'force-dynamic';

export default async function PurchaseOrdersPage() {
  const result = await getPurchaseOrders();
  const rawPurchaseOrders = result.success ? result.data ?? [] : [];
  
  // Get the first property for export (in a real app, this would come from property context)
  const property = await db.property.findFirst({
    select: { id: true },
    orderBy: { name: "asc" },
  });
  
  // Serialize Decimal values to numbers for client component
  const purchaseOrders = rawPurchaseOrders.map(po => ({
    ...po,
    subtotal: Number(po.subtotal),
    taxAmount: Number(po.taxAmount),
    total: Number(po.total),
  }));

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
          <FileText className="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-white">Purchase Orders</h1>
          <p className="text-sm text-neutral-400">
            Manage purchase orders for inventory procurement
          </p>
        </div>
      </div>

      {/* Table */}
      <PurchaseOrdersTable purchaseOrders={purchaseOrders} propertyId={property?.id} />
    </div>
  );
}
