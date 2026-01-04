import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { RestaurantReportsClient } from "@/components/admin/reports/restaurant-reports-client";
import {
  generateCOGSReport,
  generateRecipeProfitabilityReport,
  generateWasteAnalysisReport,
} from "@/lib/inventory/reporting";

export default async function AdminRestaurantReportsPage() {
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

  // Get warehouses (kitchen type preferred for restaurant reports)
  const warehouseWhere = currentScope !== "ALL" ? { propertyId: currentScope } : {};
  const warehouses = await db.warehouse.findMany({
    where: { ...warehouseWhere, isActive: true },
    select: {
      id: true,
      name: true,
      propertyId: true,
      type: true,
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  // Determine which property to use for initial reports
  const selectedPropertyId = currentScope !== "ALL" ? currentScope : properties[0]?.id;

  // Find a kitchen warehouse for the selected property (preferred for recipe costs)
  const kitchenWarehouse = warehouses.find(
    (w) => w.propertyId === selectedPropertyId && w.type === "KITCHEN"
  );
  const selectedWarehouseId = kitchenWarehouse?.id || warehouses.find((w) => w.propertyId === selectedPropertyId)?.id;

  // Calculate date range (last 30 days)
  const endDate = new Date();
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Generate initial reports if we have a property
  let cogsReport = null;
  let recipeProfitabilityReport = null;
  let wasteAnalysisReport = null;

  if (selectedPropertyId) {
    const reportPromises: Promise<unknown>[] = [
      generateCOGSReport(selectedPropertyId, startDate, endDate),
      generateWasteAnalysisReport(selectedPropertyId, startDate, endDate),
    ];

    if (selectedWarehouseId) {
      reportPromises.push(
        generateRecipeProfitabilityReport(selectedPropertyId, selectedWarehouseId, 35)
      );
    }

    const results = await Promise.all(reportPromises);
    cogsReport = results[0] as Awaited<ReturnType<typeof generateCOGSReport>>;
    wasteAnalysisReport = results[1] as Awaited<ReturnType<typeof generateWasteAnalysisReport>>;
    if (results[2]) {
      recipeProfitabilityReport = results[2] as Awaited<ReturnType<typeof generateRecipeProfitabilityReport>>;
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Restaurant Reports</h1>
        <p className="text-muted-foreground">
          View COGS analysis, recipe profitability, and waste analysis reports.
        </p>
      </div>

      <RestaurantReportsClient
        properties={properties}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, propertyId: w.propertyId }))}
        currentScope={currentScope}
        initialCOGSReport={cogsReport}
        initialRecipeProfitability={recipeProfitabilityReport}
        initialWasteAnalysis={wasteAnalysisReport}
      />
    </div>
  );
}
