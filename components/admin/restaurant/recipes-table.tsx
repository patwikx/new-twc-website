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
  ChefHat,
  Clock,
  Utensils,
  CheckCircle,
  XCircle,
  Trash2,
  Package,
} from "lucide-react";
import Link from "next/link";
import { deactivateRecipe, reactivateRecipe, deleteRecipe } from "@/lib/inventory/recipe";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface RecipeData {
  id: string;
  name: string;
  description: string | null;
  yield: number;
  yieldUnit: string;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  isActive: boolean;
  ingredientCount: number;
  subRecipeCount: number;
  menuItemCount: number;
  totalCost: number | null;
  costPerPortion: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface RecipesTableProps {
  recipes: RecipeData[];
}

export function RecipesTable({ recipes }: RecipesTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [isLoading, setIsLoading] = React.useState<string | null>(null);

  // Filter recipes based on search and filters
  const filteredRecipes = React.useMemo(() => {
    let result = recipes;

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        (recipe) =>
          recipe.name.toLowerCase().includes(lowerQuery) ||
          recipe.description?.toLowerCase().includes(lowerQuery)
      );
    }

    if (statusFilter !== "all") {
      const isActive = statusFilter === "active";
      result = result.filter((recipe) => recipe.isActive === isActive);
    }

    return result;
  }, [recipes, searchQuery, statusFilter]);

  const handleDeactivate = async (recipe: RecipeData) => {
    setIsLoading(recipe.id);
    try {
      const result = await deactivateRecipe(recipe.id);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${recipe.name} deactivated`);
        router.refresh();
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsLoading(null);
    }
  };

  const handleReactivate = async (recipe: RecipeData) => {
    setIsLoading(recipe.id);
    try {
      const result = await reactivateRecipe(recipe.id);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${recipe.name} reactivated`);
        router.refresh();
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsLoading(null);
    }
  };

  const handleDelete = async (recipe: RecipeData) => {
    setIsLoading(recipe.id);
    try {
      const result = await deleteRecipe(recipe.id);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${recipe.name} deleted successfully`);
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

  const formatCurrency = (value: number | null) => {
    if (value === null) return "—";
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatTime = (minutes: number | null) => {
    if (minutes === null) return "—";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
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
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-neutral-900 border-white/10"
            />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] bg-neutral-900 border-white/10">
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
            asChild
            size="sm"
            className="h-9 gap-1 bg-orange-600 hover:bg-orange-700 text-white rounded-none uppercase tracking-widest text-xs"
          >
            <Link href="/admin/restaurant/recipes/new">
              <Plus className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Add Recipe
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
                Recipe
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Yield
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Time
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Ingredients
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Cost/Portion
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
            {filteredRecipes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No recipes found.
                </TableCell>
              </TableRow>
            ) : (
              filteredRecipes.map((recipe) => (
                <TableRow
                  key={recipe.id}
                  className="border-white/10 hover:bg-white/5"
                >
                  <TableCell className="pl-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-neutral-800 rounded-md flex items-center justify-center">
                        <ChefHat className="h-5 w-5 text-orange-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm text-white">
                          {recipe.name}
                        </span>
                        <span className="text-xs text-neutral-500 line-clamp-1">
                          {recipe.description || `${recipe.ingredientCount} ingredients`}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-neutral-300">
                      {recipe.yield} {recipe.yieldUnit}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-neutral-500" />
                      <span className="text-sm text-neutral-300">
                        {formatTime((recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0))}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Package className="h-3.5 w-3.5 text-blue-400" />
                        <span className="text-sm text-neutral-300">
                          {recipe.ingredientCount}
                        </span>
                      </div>
                      {recipe.subRecipeCount > 0 && (
                        <div className="flex items-center gap-1">
                          <ChefHat className="h-3.5 w-3.5 text-purple-400" />
                          <span className="text-sm text-neutral-300">
                            +{recipe.subRecipeCount}
                          </span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium text-green-400">
                      {formatCurrency(recipe.costPerPortion)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        recipe.isActive
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : "bg-neutral-500/20 text-neutral-400 border-neutral-500/30"
                      }
                    >
                      {recipe.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {recipe.menuItemCount > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <Utensils className="h-3 w-3 text-neutral-500" />
                        <span className="text-xs text-neutral-500">
                          {recipe.menuItemCount} menu item{recipe.menuItemCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-white/10"
                      >
                        <Link href={`/admin/restaurant/recipes/${recipe.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">Edit</span>
                        </Link>
                      </Button>

                      {recipe.isActive ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-neutral-400 hover:text-yellow-400 hover:bg-yellow-900/10"
                          disabled={isLoading === recipe.id}
                          onClick={() => handleDeactivate(recipe)}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span className="sr-only">Deactivate</span>
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-neutral-400 hover:text-green-400 hover:bg-green-900/10"
                          disabled={isLoading === recipe.id}
                          onClick={() => handleReactivate(recipe)}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span className="sr-only">Reactivate</span>
                        </Button>
                      )}

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-neutral-400 hover:text-red-400 hover:bg-red-900/10"
                            disabled={isLoading === recipe.id || recipe.menuItemCount > 0}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-neutral-900 border-white/10">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Recipe</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete &quot;{recipe.name}&quot;? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-neutral-800 border-white/10 hover:bg-neutral-700">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(recipe)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
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
        Showing <strong>{filteredRecipes.length}</strong> of{" "}
        <strong>{recipes.length}</strong> recipes.
      </div>
    </div>
  );
}
