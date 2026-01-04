import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Clock, FileText, Truck } from "lucide-react";

interface SettlementDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SettlementDetailPage({
  params,
}: SettlementDetailPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/login");
  }

  const { id } = await params;

  // Get settlement with all details
  const settlement = await db.consignmentSettlement.findUnique({
    where: { id },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          contactName: true,
          email: true,
          phone: true,
        },
      },
      sales: {
        orderBy: { soldAt: "asc" },
      },
    },
  });

  if (!settlement) {
    notFound();
  }

  // Fetch stock item details for sales
  const stockItemIds = [...new Set(settlement.sales.map((s) => s.stockItemId))];
  const stockItems = await db.stockItem.findMany({
    where: { id: { in: stockItemIds } },
    select: {
      id: true,
      name: true,
      itemCode: true,
      primaryUnit: {
        select: {
          abbreviation: true,
        },
      },
    },
  });
  const stockItemMap = new Map(stockItems.map((item) => [item.id, item]));

  const isPaid = settlement.settledAt !== null;
  const totalSales = Number(settlement.totalSales);
  const totalSupplierDue = Number(settlement.totalSupplierDue);
  const margin = totalSales - totalSupplierDue;
  const marginPercentage = totalSales > 0 ? (margin / totalSales) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/inventory/consignment/settlements">
            <Button variant="ghost" size="icon" className="text-neutral-400">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
              <FileText className="h-6 w-6 text-orange-500" />
              Settlement Details
            </h1>
            <p className="text-sm text-neutral-400 mt-1">
              {format(new Date(settlement.periodStart), "MMM d")} -{" "}
              {format(new Date(settlement.periodEnd), "MMM d, yyyy")}
            </p>
          </div>
        </div>
        {isPaid ? (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 px-4 py-2">
            <CheckCircle className="h-4 w-4 mr-2" />
            Paid on {format(new Date(settlement.settledAt!), "MMM d, yyyy")}
          </Badge>
        ) : (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 px-4 py-2">
            <Clock className="h-4 w-4 mr-2" />
            Pending Payment
          </Badge>
        )}
      </div>

      {/* Supplier Info & Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Supplier Info */}
        <div className="bg-neutral-900/50 border border-white/10 rounded-lg p-6">
          <h2 className="text-lg font-medium text-white flex items-center gap-2 mb-4">
            <Truck className="h-5 w-5 text-orange-500" />
            Supplier Information
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-neutral-500">Name</p>
              <p className="text-white font-medium">{settlement.supplier.name}</p>
            </div>
            {settlement.supplier.contactName && (
              <div>
                <p className="text-sm text-neutral-500">Contact</p>
                <p className="text-neutral-300">{settlement.supplier.contactName}</p>
              </div>
            )}
            {settlement.supplier.email && (
              <div>
                <p className="text-sm text-neutral-500">Email</p>
                <p className="text-neutral-300">{settlement.supplier.email}</p>
              </div>
            )}
            {settlement.supplier.phone && (
              <div>
                <p className="text-sm text-neutral-500">Phone</p>
                <p className="text-neutral-300">{settlement.supplier.phone}</p>
              </div>
            )}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="bg-neutral-900/50 border border-white/10 rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">
            Financial Summary
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-neutral-400">Total Sales</span>
              <span className="text-white font-medium">₱{totalSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-400">Supplier Due</span>
              <span className="text-orange-400 font-medium">
                ₱{totalSupplierDue.toFixed(2)}
              </span>
            </div>
            <div className="border-t border-white/10 pt-4 flex justify-between items-center">
              <span className="text-neutral-400">Margin</span>
              <div className="text-right">
                <span className="text-green-400 font-medium">
                  ₱{margin.toFixed(2)}
                </span>
                <span className="text-neutral-500 text-sm ml-2">
                  ({marginPercentage.toFixed(1)}%)
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-400">Sales Count</span>
              <span className="text-white">{settlement.sales.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sales Details */}
      <div className="bg-neutral-900/50 border border-white/10 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-lg font-medium text-white">Sales Details</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-neutral-400">Date</TableHead>
              <TableHead className="text-neutral-400">Item</TableHead>
              <TableHead className="text-neutral-400 text-right">Quantity</TableHead>
              <TableHead className="text-neutral-400 text-right">Selling Price</TableHead>
              <TableHead className="text-neutral-400 text-right">Supplier Cost</TableHead>
              <TableHead className="text-neutral-400 text-right">Total Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settlement.sales.map((sale) => {
              const stockItem = stockItemMap.get(sale.stockItemId);
              const quantity = Number(sale.quantity);
              const sellingPrice = Number(sale.sellingPrice);
              const supplierCost = Number(sale.supplierCost);
              const totalDue = quantity * supplierCost;

              return (
                <TableRow key={sale.id} className="border-white/10">
                  <TableCell className="text-neutral-300">
                    {format(new Date(sale.soldAt), "MMM d, yyyy h:mm a")}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-white font-medium">
                        {stockItem?.name || "Unknown Item"}
                      </p>
                      <p className="text-xs text-neutral-500 font-mono">
                        {stockItem?.itemCode} • {stockItem?.primaryUnit.abbreviation}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-neutral-300">
                    {quantity}
                  </TableCell>
                  <TableCell className="text-right text-neutral-300">
                    ₱{sellingPrice.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-neutral-300">
                    ₱{supplierCost.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-orange-400 font-medium">
                    ₱{totalDue.toFixed(2)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
