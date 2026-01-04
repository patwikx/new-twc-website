import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getPurchaseOrder } from "@/lib/inventory/purchase-order";
import { PurchaseOrderDetail } from "@/components/admin/inventory/purchase-order-detail";
import { POStatus } from "@prisma/client";

interface PurchaseOrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PurchaseOrderDetailPage({
  params,
}: PurchaseOrderDetailPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const { id } = await params;
  const result = await getPurchaseOrder(id);

  if (result.error || !result.data) {
    notFound();
  }

  // Serialize Decimal values to numbers for client component
  const purchaseOrder = {
    ...result.data,
    subtotal: Number(result.data.subtotal),
    taxAmount: Number(result.data.taxAmount),
    total: Number(result.data.total),
    items: result.data.items.map(item => ({
      ...item,
      quantity: Number(item.quantity),
      unitCost: Number(item.unitCost),
      receivedQty: Number(item.receivedQty),
    })),
    receipts: result.data.receipts.map(receipt => ({
      ...receipt,
      items: receipt.items.map(item => ({
        ...item,
        quantity: Number(item.quantity),
      })),
    })),
  } as {
    id: string;
    poNumber: string;
    status: POStatus;
    subtotal: number;
    taxAmount: number;
    total: number;
    expectedDate: Date | null;
    notes: string | null;
    sentAt: Date | null;
    approvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    property: { id: string; name: string };
    supplier: { id: string; name: string; email: string | null; phone: string | null };
    warehouse: { id: string; name: string; type: string };
    createdBy: { id: string; name: string | null; email: string | null };
    approvedBy: { id: string; name: string | null; email: string | null } | null;
    items: Array<{
      id: string;
      stockItemId: string;
      quantity: number;
      unitCost: number;
      receivedQty: number;
      stockItem: {
        id: string;
        name: string;
        itemCode: string;
        primaryUnit: { abbreviation: string };
      };
    }>;
    receipts: Array<{
      id: string;
      notes: string | null;
      createdAt: Date;
      receivedBy: { id: string; name: string | null };
      items: Array<{
        id: string;
        quantity: number;
        batchNumber: string | null;
        expirationDate: Date | null;
        stockItem: { id: string; name: string };
      }>;
    }>;
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <PurchaseOrderDetail
        purchaseOrder={purchaseOrder}
        userId={session.user.id}
      />
    </div>
  );
}
