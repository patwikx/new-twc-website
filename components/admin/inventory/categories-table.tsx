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
  Tag,
  Power,
  PowerOff,
  Trash2,
  Package,
  Lock,
} from "lucide-react";
import { updateStockCategory, deleteStockCategory } from "@/lib/inventory/stock-category";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CategoryDialog } from "./category-dialog";

interface CategoryData {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  isSystem: boolean;
  isActive: boolean;
  stockItemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CategoriesTableProps {
  categories: CategoryData[];
}

export function CategoriesTable({ categories }: CategoriesTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [isLoading, setIsLoading] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<CategoryData | null>(null);

  // Filter categories based on search and filters
  const filteredCategories = React.useMemo(() => {
    let result = categories;

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        (category) =>
          category.name.toLowerCase().includes(lowerQuery) ||
          category.description?.toLowerCase().includes(lowerQuery)
      );
    }

    if (statusFilter !== "all") {
      const isActive = statusFilter === "active";
      result = result.filter((category) => category.isActive === isActive);
    }

    return result;
  }, [categories, searchQuery, statusFilter]);

  const handleToggleStatus = async (category: CategoryData) => {
    if (category.isSystem) {
      toast.error("Cannot modify system categories");
      return;
    }

    setIsLoading(category.id);
    try {
      const result = await updateStockCategory(category.id, {
        isActive: !category.isActive,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          category.isActive
            ? "Category deactivated successfully"
            : "Category activated successfully"
        );
        router.refresh();
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsLoading(null);
    }
  };

  const handleDelete = async (category: CategoryData) => {
    if (category.isSystem) {
      toast.error("Cannot delete system categories");
      return;
    }

    if (category.stockItemCount > 0) {
      toast.error("Cannot delete category with existing stock items");
      return;
    }

    setIsLoading(category.id);
    try {
      const result = await deleteStockCategory(category.id);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Category deleted successfully");
        router.refresh();
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsLoading(null);
    }
  };

  const handleEdit = (category: CategoryData) => {
    setEditingCategory(category);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingCategory(null);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingCategory(null);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
  };

  const getColorStyle = (color: string | null) => {
    if (!color) return {};
    // Handle both named colors and hex colors
    if (color.startsWith("#")) {
      return { backgroundColor: color };
    }
    // Map named colors to tailwind-like colors
    const colorMap: Record<string, string> = {
      orange: "#f97316",
      blue: "#3b82f6",
      green: "#22c55e",
      purple: "#a855f7",
      cyan: "#06b6d4",
      red: "#ef4444",
      yellow: "#eab308",
      pink: "#ec4899",
    };
    return { backgroundColor: colorMap[color] || "#6b7280" };
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
              placeholder="Search categories..."
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
          <Button
            onClick={handleCreate}
            size="sm"
            className="h-9 gap-1 bg-orange-600 hover:bg-orange-700 text-white rounded-none uppercase tracking-widest text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Add Category
            </span>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-white/10 bg-neutral-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-neutral-900/50">
              <TableHead className="w-[280px] pl-4 uppercase tracking-widest text-xs font-medium text-neutral-400">
                Category
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Description
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
            {filteredCategories.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No categories found.
                </TableCell>
              </TableRow>
            ) : (
              filteredCategories.map((category) => (
                <TableRow
                  key={category.id}
                  className="border-white/10 hover:bg-white/5"
                >
                  <TableCell className="pl-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-md flex items-center justify-center"
                        style={getColorStyle(category.color)}
                      >
                        <Tag className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-white">
                            {category.name}
                          </span>
                          {category.isSystem && (
                            <Lock className="h-3 w-3 text-neutral-500" />
                          )}
                        </div>
                        {category.color && (
                          <span className="text-xs text-neutral-500 capitalize">
                            {category.color}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-neutral-400">
                      {category.description || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                      <Package className="h-3 w-3" />
                      <span>{category.stockItemCount} items</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          category.isActive
                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : "bg-neutral-500/20 text-neutral-400 border-neutral-500/30"
                        }
                      >
                        {category.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {category.isSystem && (
                        <Badge
                          variant="outline"
                          className="bg-blue-500/20 text-blue-400 border-blue-500/30"
                        >
                          System
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-white/10"
                        onClick={() => handleEdit(category)}
                        disabled={isLoading === category.id}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit</span>
                      </Button>

                      {!category.isSystem && (
                        <>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 ${
                                  category.isActive
                                    ? "text-neutral-400 hover:text-red-400 hover:bg-red-900/10"
                                    : "text-neutral-400 hover:text-green-400 hover:bg-green-900/10"
                                }`}
                                disabled={isLoading === category.id}
                              >
                                {category.isActive ? (
                                  <PowerOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Power className="h-3.5 w-3.5" />
                                )}
                                <span className="sr-only">
                                  {category.isActive ? "Deactivate" : "Activate"}
                                </span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-neutral-900 border-white/10">
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {category.isActive
                                    ? "Deactivate Category"
                                    : "Activate Category"}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {category.isActive
                                    ? `Are you sure you want to deactivate "${category.name}"? This will hide it from selection lists but preserve all associated data.`
                                    : `Are you sure you want to activate "${category.name}"? This will make it available for use again.`}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-neutral-800 border-white/10 hover:bg-neutral-700">
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleToggleStatus(category)}
                                  className={
                                    category.isActive
                                      ? "bg-red-600 hover:bg-red-700"
                                      : "bg-green-600 hover:bg-green-700"
                                  }
                                >
                                  {category.isActive ? "Deactivate" : "Activate"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          {category.stockItemCount === 0 && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-neutral-400 hover:text-red-400 hover:bg-red-900/10"
                                  disabled={isLoading === category.id}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-neutral-900 border-white/10">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Category</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete &quot;{category.name}&quot;? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-neutral-800 border-white/10 hover:bg-neutral-700">
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(category)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground">
        Showing <strong>{filteredCategories.length}</strong> of{" "}
        <strong>{categories.length}</strong> categories.
      </div>

      {/* Category Dialog */}
      <CategoryDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        category={editingCategory}
      />
    </div>
  );
}
