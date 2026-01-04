"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
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
import { Search, UtensilsCrossed, AlertCircle } from "lucide-react";
import { MenuCategory } from "@prisma/client";
import { cn } from "@/lib/utils";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  category: MenuCategory;
  sellingPrice: number;
  isAvailable: boolean;
  unavailableReason: string | null;
}

interface MenuGridProps {
  menuItems: MenuItem[];
  onItemSelect: (item: MenuItem) => void;
  selectedCategory?: MenuCategory | null;
}

const CATEGORY_LABELS: Record<MenuCategory, string> = {
  APPETIZER: "Appetizers",
  MAIN_COURSE: "Main Course",
  DESSERT: "Desserts",
  BEVERAGE: "Beverages",
  SIDE_DISH: "Sides",
};

const CATEGORY_COLORS: Record<MenuCategory, string> = {
  APPETIZER: "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30",
  MAIN_COURSE: "bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30",
  DESSERT: "bg-pink-500/20 text-pink-400 border-pink-500/30 hover:bg-pink-500/30",
  BEVERAGE: "bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30",
  SIDE_DISH: "bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30",
};

export function MenuGrid({ menuItems, onItemSelect, selectedCategory }: MenuGridProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>(
    selectedCategory || "all"
  );

  // Filter menu items
  const filteredItems = React.useMemo(() => {
    let result = menuItems;

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(lowerQuery) ||
          item.description?.toLowerCase().includes(lowerQuery)
      );
    }

    if (categoryFilter !== "all") {
      result = result.filter((item) => item.category === categoryFilter);
    }

    return result;
  }, [menuItems, searchQuery, categoryFilter]);

  // Group items by category
  const groupedItems = React.useMemo(() => {
    if (categoryFilter !== "all") {
      return { [categoryFilter]: filteredItems };
    }

    const groups: Partial<Record<MenuCategory, MenuItem[]>> = {};
    filteredItems.forEach((item) => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category]!.push(item);
    });
    return groups;
  }, [filteredItems, categoryFilter]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleItemClick = (item: MenuItem) => {
    if (item.isAvailable) {
      onItemSelect(item);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search and Filter */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 bg-neutral-900 border-white/10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[140px] h-9 bg-neutral-900 border-white/10">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Items</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category Quick Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-7 text-xs",
            categoryFilter === "all"
              ? "bg-white/10 border-white/20"
              : "border-white/10"
          )}
          onClick={() => setCategoryFilter("all")}
        >
          All
        </Button>
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <Button
            key={value}
            variant="outline"
            size="sm"
            className={cn(
              "h-7 text-xs",
              categoryFilter === value
                ? CATEGORY_COLORS[value as MenuCategory]
                : "border-white/10"
            )}
            onClick={() => setCategoryFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Menu Items Grid */}
      <div className="flex-1 overflow-y-auto">
        {Object.keys(groupedItems).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <UtensilsCrossed className="h-12 w-12 text-neutral-600 mb-4" />
            <p className="text-neutral-400">No menu items found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedItems).map(([category, items]) => (
              <div key={category}>
                {categoryFilter === "all" && (
                  <h3 className="text-sm font-medium text-neutral-400 mb-3 uppercase tracking-widest">
                    {CATEGORY_LABELS[category as MenuCategory]}
                  </h3>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {items?.map((item) => (
                    <Card
                      key={item.id}
                      className={cn(
                        "p-3 cursor-pointer transition-all",
                        item.isAvailable
                          ? "hover:scale-[1.02] hover:border-orange-500/50 bg-neutral-900/50 border-white/10"
                          : "opacity-50 cursor-not-allowed bg-neutral-900/30 border-white/5"
                      )}
                      onClick={() => handleItemClick(item)}
                    >
                      <div className="flex flex-col h-full">
                        <div className="flex items-start justify-between mb-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-1.5 py-0",
                              CATEGORY_COLORS[item.category]
                            )}
                          >
                            {CATEGORY_LABELS[item.category]}
                          </Badge>
                          {!item.isAvailable && (
                            <AlertCircle className="h-4 w-4 text-red-400" />
                          )}
                        </div>
                        <h4 className="font-medium text-sm text-white mb-1 line-clamp-2">
                          {item.name}
                        </h4>
                        {item.description && (
                          <p className="text-xs text-neutral-500 line-clamp-2 mb-2 flex-1">
                            {item.description}
                          </p>
                        )}
                        <div className="mt-auto">
                          <span className="text-sm font-bold text-green-400">
                            {formatCurrency(item.sellingPrice)}
                          </span>
                        </div>
                        {!item.isAvailable && item.unavailableReason && (
                          <p className="text-[10px] text-red-400 mt-1 line-clamp-1">
                            {item.unavailableReason}
                          </p>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
