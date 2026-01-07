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
  Utensils,
  ChefHat,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { deleteMenuItem, setMenuItemAvailable, setMenuItemUnavailable } from "@/lib/inventory/menu-item";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface MenuItemCategory {
  id: string;
  name: string;
  color: string | null;
}

interface MenuItemData {
  id: string;
  name: string;
  description: string | null;
  category: MenuItemCategory;
  sellingPrice: number;
  isAvailable: boolean;
  unavailableReason: string | null;
  imageUrl: string | null;
  propertyId: string;
  propertyName: string;
  recipe: {
    id: string;
    name: string;
    yield: number;
    yieldUnit: string;
  } | null;
  salesCount: number;
  foodCostPercentage: number | null;
  isAboveTargetCost: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Property {
  id: string;
  name: string;
}

interface Recipe {
  id: string;
  name: string;
}

interface MenuItemsTableProps {
  menuItems: MenuItemData[];
  properties: Property[];
  recipes: Recipe[];
}

// Get color class from category color name
function getCategoryColorClass(color: string | null): string {
  if (!color) return "bg-neutral-500/20 text-neutral-400 border-neutral-500/30";
  
  const colorMap: Record<string, string> = {
    orange: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    red: "bg-red-500/20 text-red-400 border-red-500/30",
    green: "bg-green-500/20 text-green-400 border-green-500/30",
    blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    pink: "bg-pink-500/20 text-pink-400 border-pink-500/30",
    yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    cyan: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  };

  return colorMap[color] || "bg-neutral-500/20 text-neutral-400 border-neutral-500/30";
}

export function MenuItemsTable({ menuItems, properties, recipes }: MenuItemsTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [propertyFilter, setPropertyFilter] = React.useState<string>("all");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [availabilityFilter, setAvailabilityFilter] = React.useState<string>("all");
  const [isLoading, setIsLoading] = React.useState<string | null>(null);
  const [unavailableReason, setUnavailableReason] = React.useState("");

  // Filter menu items based on search and filters
  const filteredItems = React.useMemo(() => {
    let result = menuItems;

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(lowerQuery) ||
          item.description?.toLowerCase().includes(lowerQuery) ||
          item.propertyName.toLowerCase().includes(lowerQuery) ||
          item.recipe?.name.toLowerCase().includes(lowerQuery)
      );
    }

    if (propertyFilter !== "all") {
      result = result.filter((item) => item.propertyId === propertyFilter);
    }

    if (categoryFilter !== "all") {
      result = result.filter((item) => item.category.id === categoryFilter);
    }

    if (availabilityFilter !== "all") {
      const isAvailable = availabilityFilter === "available";
      result = result.filter((item) => item.isAvailable === isAvailable);
    }

    return result;
  }, [menuItems, searchQuery, propertyFilter, categoryFilter, availabilityFilter]);

  // Get unique categories from menu items for the filter dropdown
  const uniqueCategories = React.useMemo(() => {
    const categoryMap = new Map<string, MenuItemCategory>();
    menuItems.forEach((item) => {
      if (!categoryMap.has(item.category.id)) {
        categoryMap.set(item.category.id, item.category);
      }
    });
    return Array.from(categoryMap.values());
  }, [menuItems]);

  // Group items by category for display
  const groupedItems = React.useMemo(() => {
    const groups: Record<string, MenuItemData[]> = {};

    filteredItems.forEach((item) => {
      const categoryName = item.category.name;
      if (!groups[categoryName]) {
        groups[categoryName] = [];
      }
      groups[categoryName].push(item);
    });

    return groups;
  }, [filteredItems]);

  const handleSetUnavailable = async (item: MenuItemData, reason: string) => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for unavailability");
      return;
    }
    
    setIsLoading(item.id);
    try {
      const result = await setMenuItemUnavailable(item.id, reason);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${item.name} marked as unavailable`);
        router.refresh();
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsLoading(null);
      setUnavailableReason("");
    }
  };

  const handleSetAvailable = async (item: MenuItemData) => {
    setIsLoading(item.id);
    try {
      const result = await setMenuItemAvailable(item.id);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${item.name} marked as available`);
        router.refresh();
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsLoading(null);
    }
  };

  const handleDelete = async (item: MenuItemData) => {
    setIsLoading(item.id);
    try {
      const result = await deleteMenuItem(item.id);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${item.name} deleted successfully`);
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
    setPropertyFilter("all");
    setCategoryFilter("all");
    setAvailabilityFilter("all");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number | null) => {
    if (value === null) return "—";
    return `${value.toFixed(1)}%`;
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
              placeholder="Search menu items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-neutral-900 border-white/10"
            />
          </div>

          {/* Property Filter */}
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger className="w-[180px] bg-neutral-900 border-white/10">
              <SelectValue placeholder="All Properties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {properties.map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  {property.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px] bg-neutral-900 border-white/10">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {uniqueCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Availability Filter */}
          <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
            <SelectTrigger className="w-[150px] bg-neutral-900 border-white/10">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="unavailable">Unavailable</SelectItem>
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
            <Link href="/admin/restaurant/menu/new">
              <Plus className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Add Menu Item
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
                Menu Item
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Category
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Price
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Recipe
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Food Cost %
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
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No menu items found.
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow
                  key={item.id}
                  className="border-white/10 hover:bg-white/5"
                >
                  <TableCell className="pl-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-neutral-800 rounded-md flex items-center justify-center">
                        <Utensils className="h-5 w-5 text-neutral-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm text-white">
                          {item.name}
                        </span>
                        <span className="text-xs text-neutral-500 line-clamp-1">
                          {item.description || item.propertyName}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={getCategoryColorClass(item.category.color)}
                    >
                      {item.category.name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium text-green-400">
                      {formatCurrency(item.sellingPrice)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {item.recipe ? (
                      <div className="flex items-center gap-1.5">
                        <ChefHat className="h-3.5 w-3.5 text-orange-400" />
                        <span className="text-sm text-neutral-300">
                          {item.recipe.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-neutral-500">No recipe</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.foodCostPercentage !== null ? (
                      <div className="flex items-center gap-1.5">
                        {item.isAboveTargetCost ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
                        ) : (
                          <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                        )}
                        <span
                          className={`text-sm font-medium ${
                            item.isAboveTargetCost
                              ? "text-yellow-400"
                              : "text-green-400"
                          }`}
                        >
                          {formatPercentage(item.foodCostPercentage)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-neutral-500">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        item.isAvailable
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : "bg-red-500/20 text-red-400 border-red-500/30"
                      }
                    >
                      {item.isAvailable ? "Available" : "Unavailable"}
                    </Badge>
                    {!item.isAvailable && item.unavailableReason && (
                      <p className="text-xs text-neutral-500 mt-1 line-clamp-1">
                        {item.unavailableReason}
                      </p>
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
                        <Link href={`/admin/restaurant/menu/${item.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">Edit</span>
                        </Link>
                      </Button>

                      {item.isAvailable ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-neutral-400 hover:text-red-400 hover:bg-red-900/10"
                              disabled={isLoading === item.id}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              <span className="sr-only">Mark Unavailable</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-neutral-900 border-white/10">
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Mark as Unavailable
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Please provide a reason why &quot;{item.name}&quot; is unavailable.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="py-4">
                              <Input
                                placeholder="e.g., Out of stock, Seasonal item, etc."
                                value={unavailableReason}
                                onChange={(e) => setUnavailableReason(e.target.value)}
                                className="bg-neutral-800 border-white/10"
                              />
                            </div>
                            <AlertDialogFooter>
                              <AlertDialogCancel 
                                className="bg-neutral-800 border-white/10 hover:bg-neutral-700"
                                onClick={() => setUnavailableReason("")}
                              >
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleSetUnavailable(item, unavailableReason)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Mark Unavailable
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-neutral-400 hover:text-green-400 hover:bg-green-900/10"
                          disabled={isLoading === item.id}
                          onClick={() => handleSetAvailable(item)}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span className="sr-only">Mark Available</span>
                        </Button>
                      )}

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-neutral-400 hover:text-red-400 hover:bg-red-900/10"
                            disabled={isLoading === item.id || item.salesCount > 0}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-neutral-900 border-white/10">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Menu Item</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete &quot;{item.name}&quot;? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-neutral-800 border-white/10 hover:bg-neutral-700">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(item)}
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
        Showing <strong>{filteredItems.length}</strong> of{" "}
        <strong>{menuItems.length}</strong> menu items.
      </div>
    </div>
  );
}
