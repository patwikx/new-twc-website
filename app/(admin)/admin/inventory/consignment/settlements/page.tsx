import { db } from "@/lib/db";
import { ConsignmentSettlementsTable } from "@/components/admin/inventory/consignment-settlements-table";
import { GenerateSettlementForm } from "@/components/admin/inventory/generate-settlement-form";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { FileText } from "lucide-react";

export default async function ConsignmentSettlementsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/login");
  }

  // Get current property scope from cookie
  const cookieStore = await cookies();
  const currentScope = cookieStore.get("admin_property_scope")?.value;

  // Build where clause based on scope
  const propertyFilter =
    currentScope && currentScope !== "ALL" ? { propertyId: currentScope } : {};

  // Get suppliers that have consignment items
  const suppliers = await db.supplier.findMany({
    where: {
      isActive: true,
      stockItems: {
        some: {
          isConsignment: true,
          isActive: true,
          ...propertyFilter,
        },
      },
    },
    select: {
      id: true,
      name: true,
      contactName: true,
    },
    orderBy: { name: "asc" },
  });

  // Get all settlements
  const settlements = await db.consignmentSettlement.findMany({
    where: {
      supplier: {
        stockItems: {
          some: {
            ...propertyFilter,
          },
        },
      },
    },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          sales: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <FileText className="h-6 w-6 text-orange-500" />
            Consignment Settlements
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Generate and manage settlement reports for consignment suppliers.
          </p>
        </div>
        <GenerateSettlementForm suppliers={suppliers} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-neutral-900/50 border border-white/10 rounded-lg p-4">
          <p className="text-sm text-neutral-400">Total Settlements</p>
          <p className="text-2xl font-bold text-white">{settlements.length}</p>
        </div>
        <div className="bg-neutral-900/50 border border-white/10 rounded-lg p-4">
          <p className="text-sm text-neutral-400">Pending Settlements</p>
          <p className="text-2xl font-bold text-yellow-400">
            {settlements.filter((s) => !s.settledAt).length}
          </p>
        </div>
        <div className="bg-neutral-900/50 border border-white/10 rounded-lg p-4">
          <p className="text-sm text-neutral-400">Total Pending Amount</p>
          <p className="text-2xl font-bold text-orange-400">
            ₱
            {settlements
              .filter((s) => !s.settledAt)
              .reduce((sum, s) => sum + Number(s.totalSupplierDue), 0)
              .toFixed(2)}
          </p>
        </div>
      </div>

      {/* Settlements Table */}
      <ConsignmentSettlementsTable settlements={settlements} />
    </div>
  );
}
