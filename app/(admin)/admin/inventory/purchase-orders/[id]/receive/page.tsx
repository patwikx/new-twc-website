import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getPurchaseOrder } from "@/lib/inventory/purchase-order";
import { POReceiveForm } from "@/components/admin/inventory/po-receive-form";
import { POStatus } from "@prisma/client";

interface POReceivePageProps {
  params: Promise<{ id: string }>;
}

export default async function POReceivePage({
  params,
}: POReceivePageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const { id } = await params;
  const result = await getPurchaseOrder(id);

  if (result.error || !result.data) {
    notFound();
  }

  // Check if PO is in a receivable status
  if (!["SENT", "PARTIALLY_RECEIVED"].includes(result.data.status)) {
    redirect(`/admin/inventory/purchase-orders/${id}`);
  }

  // Serialize Decimal values to numbers for client component
  const purchaseOrder = {
    id: result.data.id,
    poNumber: result.data.poNumber,
    status: result.data.status as POStatus,
    property: result.data.property,
    supplier: { id: result.data.supplier.id, name: result.data.supplier.name },
    warehouse: { id: result.data.warehouse.id, name: result.data.warehouse.name },
    items: result.data.items.map(item => ({
      id: item.id,
      stockItemId: item.stockItemId,
      quantity: Number(item.quantity),
      unitCost: Number(item.unitCost),
      receivedQty: Number(item.receivedQty),
      stockItem: item.stockItem,
    })),
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <POReceiveForm
        purchaseOrder={purchaseOrder}
        userId={session.user.id}
      />
    </div>
  );
}
