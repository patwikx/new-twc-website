import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { InventoryReportsClient } from "@/components/admin/reports/inventory-reports-client";
import {
  generateStockValuationReport,
  generateLowStockAlertsReport,
  generateBatchExpirationReport,
} from "@/lib/inventory/reporting";

export default async function AdminInventoryReportsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/login");
  }

  // Get current property scope from cookie
  const cookieStore = await cookies();
  const currentScope = cookieStore.get("admin_property_scope")?.value || "ALL";

  // Get properties for filter dropdown
  const properties = await db.property.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  // Get warehouses for movement history filter
  const warehouseWhere = currentScope !== "ALL" ? { propertyId: currentScope } : {};
  const warehouses = await db.warehouse.findMany({
    where: { ...warehouseWhere, isActive: true },
    select: {
      id: true,
      name: true,
      propertyId: true,
    },
    orderBy: { name: "asc" },
  });

  // Determine which property to use for initial reports
  const selectedPropertyId = currentScope !== "ALL" ? currentScope : properties[0]?.id;

  // Generate initial reports if we have a property
  let stockValuationReport = null;
  let lowStockAlertsReport = null;
  let batchExpirationReport = null;

  if (selectedPropertyId) {
    [stockValuationReport, lowStockAlertsReport, batchExpirationReport] = await Promise.all([
      generateStockValuationReport(selectedPropertyId),
      generateLowStockAlertsReport(selectedPropertyId),
      generateBatchExpirationReport(selectedPropertyId, 30),
    ]);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inventory Reports</h1>
        <p className="text-muted-foreground">
          View stock valuation, movement history, low-stock alerts, and expiration reports.
        </p>
      </div>

      <InventoryReportsClient
        properties={properties}
        warehouses={warehouses}
        currentScope={currentScope}
        initialStockValuation={stockValuationReport}
        initialLowStockAlerts={lowStockAlertsReport}
        initialBatchExpiration={batchExpirationReport}
      />
    </div>
  );
}
