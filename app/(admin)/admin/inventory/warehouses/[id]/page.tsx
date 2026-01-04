import { db } from "@/lib/db";
import { WarehouseStockTable } from "@/components/admin/inventory/warehouse-stock-table";
import { WarehouseAccessManager } from "@/components/admin/inventory/warehouse-access-manager";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, DollarSign, Layers, AlertTriangle, Warehouse, Building2, Users } from "lucide-react";
import { isWarehouseAdmin, getWarehouseUsers } from "@/lib/inventory/user-warehouse-access";

interface EditWarehousePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditWarehousePage({ params }: EditWarehousePageProps) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const { id } = await params;
  const userId = session.user.id;

  // Get warehouse with stock levels
  const warehouse = await db.warehouse.findUnique({
    where: { id },
    include: {
      property: {
        select: {
          id: true,
          name: true,
        },
      },
      stockLevels: {
        include: {
          stockItem: {
            select: {
              id: true,
              name: true,
              sku: true,
              category: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
              primaryUnit: {
                select: {
                  abbreviation: true,
                },
              },
            },
          },
        },
        orderBy: {
          stockItem: {
            name: "asc",
          },
        },
      },
      parLevels: {
        select: {
          stockItemId: true,
          parLevel: true,
        },
      },
    },
  });

  if (!warehouse) {
    notFound();
  }


  // Check if current user has ADMIN access to this warehouse (Requirement 2.4)
  const canManageAccess = await isWarehouseAdmin(userId, id);

  // Get users with access to this warehouse
  const usersWithAccess = await getWarehouseUsers(id);

  // Get all users for the grant access dialog (only if user can manage access)
  let availableUsers: Array<{
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  }> = [];

  if (canManageAccess) {
    availableUsers = await db.user.findMany({
      where: {
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
      orderBy: { name: "asc" },
    });
  }

  // Calculate statistics
  const totalValue = warehouse.stockLevels.reduce((sum, level) => {
    return sum + Number(level.quantity) * Number(level.averageCost);
  }, 0);

  const totalItems = warehouse.stockLevels.length;

  // Create a map of par levels for easy lookup
  const parLevelMap = new Map(
    warehouse.parLevels.map((pl) => [pl.stockItemId, Number(pl.parLevel)])
  );

  // Count low stock items
  const lowStockCount = warehouse.stockLevels.filter((level) => {
    const parLevel = parLevelMap.get(level.stockItemId);
    return parLevel !== undefined && Number(level.quantity) < parLevel;
  }).length;

  // Group by category
  const categoryCount = warehouse.stockLevels.reduce((acc, level) => {
    const categoryId = level.stockItem.category.id;
    acc[categoryId] = (acc[categoryId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get active categories for filter dropdown
  const categoriesData = await db.stockCategory.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      color: true,
    },
    orderBy: { name: "asc" },
  });

  // Serialize categories to plain objects
  const categories = categoriesData.map((cat) => ({
    id: cat.id,
    name: cat.name,
    color: cat.color,
  }));

  // Prepare stock levels data for the table
  const stockLevelsData = warehouse.stockLevels.map((level) => ({
    id: level.id,
    stockItemId: level.stockItemId,
    stockItemName: level.stockItem.name,
    stockItemSku: level.stockItem.sku,
    category: {
      id: level.stockItem.category.id,
      name: level.stockItem.category.name,
      color: level.stockItem.category.color,
    },
    quantity: Number(level.quantity),
    averageCost: Number(level.averageCost),
    totalValue: Number(level.quantity) * Number(level.averageCost),
    unit: level.stockItem.primaryUnit.abbreviation,
    parLevel: parLevelMap.get(level.stockItemId),
  }));

  const WAREHOUSE_TYPE_LABELS: Record<string, string> = {
    MAIN_STOCKROOM: "Main Stockroom",
    KITCHEN: "Kitchen",
    HOUSEKEEPING: "Housekeeping",
    BAR: "Bar",
    MINIBAR: "Minibar",
  };


  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-neutral-800 rounded-lg flex items-center justify-center">
            <Warehouse className="h-6 w-6 text-orange-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{warehouse.name}</h1>
              <Badge
                variant="outline"
                className={
                  warehouse.isActive
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : "bg-neutral-500/20 text-neutral-400 border-neutral-500/30"
                }
              >
                {warehouse.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>{warehouse.property.name}</span>
              <span>•</span>
              <span>{WAREHOUSE_TYPE_LABELS[warehouse.type] || warehouse.type}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-neutral-900/50 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-neutral-400">
              Total Items
            </CardTitle>
            <Package className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{totalItems}</div>
            <p className="text-xs text-neutral-500">
              {Object.keys(categoryCount).length} categories
            </p>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900/50 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-neutral-400">
              Total Value
            </CardTitle>
            <DollarSign className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              ₱{totalValue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-neutral-500">Current inventory value</p>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900/50 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-neutral-400">
              Categories
            </CardTitle>
            <Layers className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {Object.keys(categoryCount).length}
            </div>
            <p className="text-xs text-neutral-500">Stock categories</p>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900/50 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-neutral-400">
              Low Stock
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${lowStockCount > 0 ? "text-red-400" : "text-white"}`}>
              {lowStockCount}
            </div>
            <p className="text-xs text-neutral-500">Items below par level</p>
          </CardContent>
        </Card>
      </div>


      {/* Tabs for Stock Levels and User Access */}
      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList className="bg-neutral-900/50 border border-white/10">
          <TabsTrigger
            value="stock"
            className="data-[state=active]:bg-orange-600 data-[state=active]:text-white"
          >
            <Package className="h-4 w-4 mr-2" />
            Stock Levels
          </TabsTrigger>
          <TabsTrigger
            value="access"
            className="data-[state=active]:bg-orange-600 data-[state=active]:text-white"
          >
            <Users className="h-4 w-4 mr-2" />
            User Access
            {usersWithAccess.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 bg-neutral-700 text-neutral-300 text-xs"
              >
                {usersWithAccess.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Stock Levels Tab */}
        <TabsContent value="stock" className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Stock Levels</h2>
            <p className="text-sm text-neutral-400">
              Current inventory in this warehouse
            </p>
          </div>
          <WarehouseStockTable stockLevels={stockLevelsData} categories={categories} />
        </TabsContent>

        {/* User Access Tab */}
        <TabsContent value="access" className="space-y-4">
          <WarehouseAccessManager
            warehouseId={id}
            warehouseName={warehouse.name}
            usersWithAccess={usersWithAccess}
            availableUsers={availableUsers}
            canManageAccess={canManageAccess}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
