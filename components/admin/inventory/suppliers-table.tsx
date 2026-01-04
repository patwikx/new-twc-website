"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Pencil,
  Search,
  Truck,
  Power,
  PowerOff,
  Package,
  FileText,
  Mail,
  Phone,
  Download,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { deactivateSupplier, reactivateSupplier } from "@/lib/inventory/supplier";
import { exportSuppliers } from "@/lib/bulk/export";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface SupplierData {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  stockItemCount: number;
  consignmentReceiptCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface SuppliersTableProps {
  suppliers: SupplierData[];
}

export function SuppliersTable({ suppliers }: SuppliersTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [isLoading, setIsLoading] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  // Filter suppliers based on search and filters
  const filteredSuppliers = React.useMemo(() => {
    let result = suppliers;

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        (supplier) =>
          supplier.name.toLowerCase().includes(lowerQuery) ||
          supplier.contactName?.toLowerCase().includes(lowerQuery) ||
          supplier.email?.toLowerCase().includes(lowerQuery) ||
          supplier.phone?.toLowerCase().includes(lowerQuery)
      );
    }

    if (statusFilter !== "all") {
      const isActive = statusFilter === "active";
      result = result.filter((supplier) => supplier.isActive === isActive);
    }

    return result;
  }, [suppliers, searchQuery, statusFilter]);

  const handleToggleStatus = async (supplier: SupplierData) => {
    setIsLoading(supplier.id);
    try {
      const result = supplier.isActive
        ? await deactivateSupplier(supplier.id)
        : await reactivateSupplier(supplier.id);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          supplier.isActive
            ? "Supplier deactivated successfully"
            : "Supplier reactivated successfully"
        );
        router.refresh();
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsLoading(null);
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportSuppliers();

      if (!result.success) {
        toast.error(result.error || "Export failed");
        return;
      }

      // Create and download the file
      const blob = new Blob([result.data], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${result.rowCount} suppliers`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export suppliers");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Filters Row */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex flex-1 flex-wrap items-center gap-2 w-full">
          {/* Search */}
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search suppliers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-neutral-900 border-white/10"
            />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] bg-neutral-900 border-white/10">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={resetFilters}
          >
            Reset
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Export Button */}
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1 bg-neutral-800 border-white/10 hover:bg-neutral-700 text-white rounded-none uppercase tracking-widest text-xs"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Export
            </span>
          </Button>

          <Button
            asChild
            size="sm"
            className="h-9 gap-1 bg-orange-600 hover:bg-orange-700 text-white rounded-none uppercase tracking-widest text-xs"
          >
            <Link href="/admin/inventory/suppliers/new">
              <Plus className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Add Supplier
              </span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-white/10 bg-neutral-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-neutral-900/50">
              <TableHead className="w-[280px] pl-4 uppercase tracking-widest text-xs font-medium text-neutral-400">
                Supplier
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Contact
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Items
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Status
              </TableHead>
              <TableHead className="text-right pr-4 uppercase tracking-widest text-xs font-medium text-neutral-400">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSuppliers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No suppliers found.
                </TableCell>
              </TableRow>
            ) : (
              filteredSuppliers.map((supplier) => (
                <TableRow
                  key={supplier.id}
                  className="border-white/10 hover:bg-white/5"
                >
                  <TableCell className="pl-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-neutral-800 rounded-md flex items-center justify-center">
                        <Truck className="h-5 w-5 text-neutral-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm text-white">
                          {supplier.name}
                        </span>
                        {supplier.contactName && (
                          <span className="text-xs text-neutral-500">
                            {supplier.contactName}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {supplier.email && (
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                          <Mail className="h-3 w-3" />
                          <span>{supplier.email}</span>
                        </div>
                      )}
                      {supplier.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                          <Phone className="h-3 w-3" />
                          <span>{supplier.phone}</span>
                        </div>
                      )}
                      {!supplier.email && !supplier.phone && (
                        <span className="text-xs text-neutral-500">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                        <Package className="h-3 w-3" />
                        <span>{supplier.stockItemCount} items</span>
                      </div>
                      {supplier.consignmentReceiptCount > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                          <FileText className="h-3 w-3" />
                          <span>{supplier.consignmentReceiptCount} receipts</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        supplier.isActive
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : "bg-neutral-500/20 text-neutral-400 border-neutral-500/30"
                      }
                    >
                      {supplier.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-white/10"
                      >
                        <Link href={`/admin/inventory/suppliers/${supplier.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">Edit</span>
                        </Link>
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${
                              supplier.isActive
                                ? "text-neutral-400 hover:text-red-400 hover:bg-red-900/10"
                                : "text-neutral-400 hover:text-green-400 hover:bg-green-900/10"
                            }`}
                            disabled={isLoading === supplier.id}
                          >
                            {supplier.isActive ? (
                              <PowerOff className="h-3.5 w-3.5" />
                            ) : (
                              <Power className="h-3.5 w-3.5" />
                            )}
                            <span className="sr-only">
                              {supplier.isActive ? "Deactivate" : "Reactivate"}
                            </span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-neutral-900 border-white/10">
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {supplier.isActive
                                ? "Deactivate Supplier"
                                : "Reactivate Supplier"}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {supplier.isActive
                                ? `Are you sure you want to deactivate "${supplier.name}"? This will prevent new purchase orders but preserve all historical data.`
                                : `Are you sure you want to reactivate "${supplier.name}"? This will make them available for new purchase orders.`}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-neutral-800 border-white/10 hover:bg-neutral-700">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleToggleStatus(supplier)}
                              className={
                                supplier.isActive
                                  ? "bg-red-600 hover:bg-red-700"
                                  : "bg-green-600 hover:bg-green-700"
                              }
                            >
                              {supplier.isActive ? "Deactivate" : "Reactivate"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground">
        Showing <strong>{filteredSuppliers.length}</strong> of{" "}
        <strong>{suppliers.length}</strong> suppliers.
      </div>
    </div>
  );
}
