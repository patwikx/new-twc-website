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
import { cn } from "@/lib/utils";

interface MenuCategory {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  category: MenuCategory;
  sellingPrice: number;
  isAvailable: boolean;
  unavailableReason: string | null;
  imageUrl?: string | null;
  availableServings?: number | null;
}

interface MenuGridProps {
  menuItems: MenuItem[];
  onItemSelect: (item: MenuItem) => void;
  selectedCategoryId?: string | null;
}

// Default color when no category color is set
const DEFAULT_CATEGORY_COLOR = "bg-neutral-500/20 text-neutral-400 border-neutral-500/30 hover:bg-neutral-500/30";

// Generate category color classes from hex color
function getCategoryColorClasses(color: string | null): string {
  if (!color) return DEFAULT_CATEGORY_COLOR;
  
  // Map named colors to Tailwind classes
  const colorMap: Record<string, string> = {
    orange: "bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30",
    red: "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30",
    green: "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30",
    blue: "bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30",
    purple: "bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30",
    pink: "bg-pink-500/20 text-pink-400 border-pink-500/30 hover:bg-pink-500/30",
    yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30",
    cyan: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30",
  };

  return colorMap[color] || DEFAULT_CATEGORY_COLOR;
}

export function MenuGrid({ menuItems, onItemSelect, selectedCategoryId }: MenuGridProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>(
    selectedCategoryId || "all"
  );

  // Get unique categories from menu items
  const uniqueCategories = React.useMemo(() => {
    const categoryMap = new Map<string, MenuCategory>();
    menuItems.forEach((item) => {
      if (!categoryMap.has(item.category.id)) {
        categoryMap.set(item.category.id, item.category);
      }
    });
    return Array.from(categoryMap.values());
  }, [menuItems]);

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
      result = result.filter((item) => item.category.id === categoryFilter);
    }

    return result;
  }, [menuItems, searchQuery, categoryFilter]);

  // Group items by category
  const groupedItems = React.useMemo(() => {
    if (categoryFilter !== "all") {
      const category = uniqueCategories.find(c => c.id === categoryFilter);
      return category ? { [category.name]: filteredItems } : {};
    }

    const groups: Record<string, MenuItem[]> = {};
    filteredItems.forEach((item) => {
      const categoryName = item.category.name;
      if (!groups[categoryName]) {
        groups[categoryName] = [];
      }
      groups[categoryName].push(item);
    });
    return groups;
  }, [filteredItems, categoryFilter, uniqueCategories]);

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
    <div className="flex flex-col h-full min-h-0">
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
          <SelectTrigger className="w-[160px] h-9 bg-neutral-900 border-white/10">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Items</SelectItem>
            {uniqueCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
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
        {uniqueCategories.map((cat) => (
          <Button
            key={cat.id}
            variant="outline"
            size="sm"
            className={cn(
              "h-7 text-xs",
              categoryFilter === cat.id
                ? getCategoryColorClasses(cat.color)
                : "border-white/10"
            )}
            onClick={() => setCategoryFilter(cat.id)}
          >
            {cat.name}
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
            {Object.entries(groupedItems).map(([categoryName, items]) => (
              <div key={categoryName}>
                {categoryFilter === "all" && (
                  <h3 className="text-sm font-medium text-neutral-400 mb-3 uppercase tracking-widest">
                    {categoryName}
                  </h3>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                  {items?.map((item) => (
                    <Card
                      key={item.id}
                      className={cn(
                        "p-0 cursor-pointer transition-all overflow-hidden h-32",
                        item.isAvailable
                          ? "hover:scale-[1.02] hover:border-orange-500/50 bg-neutral-900/50 border-white/10"
                          : "opacity-50 cursor-not-allowed bg-neutral-900/30 border-white/5"
                      )}
                      onClick={() => handleItemClick(item)}
                    >
                      <div className="flex h-full">
                        {/* Optional Image - Left Side */}
                        {item.imageUrl && (
                          <div className="w-28 h-full flex-shrink-0 overflow-hidden relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                            {/* Gradient Overlay for better integration */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/10" />
                          </div>
                        )}
                        
                        <div className="flex flex-col flex-1 min-w-0 p-3">
                          <div className="flex items-start justify-between mb-1">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0",
                                getCategoryColorClasses(item.category.color)
                              )}
                            >
                              {item.category.name}
                            </Badge>
                            {!item.isAvailable && (
                              <AlertCircle className="h-4 w-4 text-red-400" />
                            )}
                          </div>
                          
                          <h4 className="font-medium text-sm text-white mb-0.5 leading-tight line-clamp-1">
                            {item.name}
                          </h4>
                          
                          <p className="text-xs text-neutral-400 line-clamp-2 mb-auto leading-relaxed">
                            {item.description}
                          </p>

                          <div className="flex items-end justify-between mt-1">
                            <span className="font-semibold text-white">
                                {formatCurrency(item.sellingPrice)}
                            </span>
                             {item.availableServings !== null && 
                              item.availableServings !== undefined && 
                              item.availableServings <= 10 && (
                                <span className={cn(
                                    "text-[10px] font-medium px-1.5 rounded",
                                    item.availableServings === 0 ? "text-red-400 bg-red-500/10" : "text-amber-400 bg-amber-500/10"
                                )}>
                                    {item.availableServings} left
                                </span>
                             )}
                          </div>
                           {!item.isAvailable && item.unavailableReason && (
                            <p className="text-[10px] text-red-400 mt-1 line-clamp-1">
                              {item.unavailableReason}
                            </p>
                          )}
                        </div>
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
