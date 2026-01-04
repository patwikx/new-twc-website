"use client";

import { useState, useCallback, useEffect, useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { recordBulkCounts } from "@/lib/inventory/cycle-count";
import {
  CountEntryRow,
  CountEntryRowItem,
} from "./count-entry-row";
import {
  Loader2,
  Save,
  Search,
  Filter,
  CheckCircle,
  Circle,
  EyeOff,
  Package,
  ArrowUp,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CountEntryFormProps {
  cycleCountId: string;
  items: CountEntryRowItem[];
  blindCount: boolean;
  userId: string;
  onSaveComplete?: () => void;
}

type FilterOption = "all" | "counted" | "uncounted";

export function CountEntryForm({
  cycleCountId,
  items,
  blindCount,
  userId,
  onSaveComplete,
}: CountEntryFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // State for count quantities and notes
  const [countQuantities, setCountQuantities] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    items.forEach((item) => {
      if (item.countedQuantity !== null) {
        initial[item.id] = item.countedQuantity.toString();
      }
    });
    return initial;
  });

  const [countNotes, setCountNotes] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    items.forEach((item) => {
      if (item.notes) {
        initial[item.id] = item.notes;
      }
    });
    return initial;
  });

  // State for filtering and search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOption, setFilterOption] = useState<FilterOption>("all");

  // State for auto-save
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate progress
  const totalItems = items.length;
  const countedItems = items.filter((item) => {
    const qty = countQuantities[item.id];
    return qty !== undefined && qty !== "" && !isNaN(parseFloat(qty));
  }).length;
  const progressPercent = totalItems > 0 ? Math.round((countedItems / totalItems) * 100) : 0;

  // Filter items based on search and filter option
  const filteredItems = items.filter((item) => {
    // Apply search filter
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      searchQuery === "" ||
      item.stockItem.name.toLowerCase().includes(searchLower) ||
      item.stockItem.itemCode.toLowerCase().includes(searchLower) ||
      (item.stockItem.sku && item.stockItem.sku.toLowerCase().includes(searchLower)) ||
      (item.batch && item.batch.batchNumber.toLowerCase().includes(searchLower)) ||
      (item.stockItem.category && item.stockItem.category.name.toLowerCase().includes(searchLower));

    if (!matchesSearch) return false;

    // Apply filter option
    const qty = countQuantities[item.id];
    const isCounted = qty !== undefined && qty !== "" && !isNaN(parseFloat(qty));

    switch (filterOption) {
      case "counted":
        return isCounted;
      case "uncounted":
        return !isCounted;
      default:
        return true;
    }
  });

  // Handle quantity change
  const handleQuantityChange = useCallback((itemId: string, value: string) => {
    setCountQuantities((prev) => ({
      ...prev,
      [itemId]: value,
    }));
    setPendingChanges((prev) => new Set(prev).add(itemId));
  }, []);

  // Handle notes change
  const handleNotesChange = useCallback((itemId: string, value: string) => {
    setCountNotes((prev) => ({
      ...prev,
      [itemId]: value,
    }));
    setPendingChanges((prev) => new Set(prev).add(itemId));
  }, []);

  // Auto-save with debounce
  useEffect(() => {
    if (pendingChanges.size === 0) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save (2 seconds debounce)
    saveTimeoutRef.current = setTimeout(() => {
      handleSave(true);
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [pendingChanges]);

  // Save counts
  const handleSave = useCallback(
    async (isAutoSave: boolean = false) => {
      // Build counts array from pending changes or all entered quantities
      const itemsToSave = isAutoSave
        ? Array.from(pendingChanges)
        : Object.keys(countQuantities).filter(
            (id) => countQuantities[id] !== "" && countQuantities[id] !== undefined
          );

      const counts = itemsToSave
        .filter((itemId) => {
          const qty = countQuantities[itemId];
          return qty !== undefined && qty !== "" && !isNaN(parseFloat(qty));
        })
        .map((itemId) => ({
          cycleCountItemId: itemId,
          countedQuantity: parseFloat(countQuantities[itemId]),
          notes: countNotes[itemId] || undefined,
        }));

      if (counts.length === 0) {
        if (!isAutoSave) {
          toast.error("No counts to save");
        }
        return;
      }

      // Validate quantities
      for (const count of counts) {
        if (count.countedQuantity < 0) {
          toast.error("Quantities cannot be negative");
          return;
        }
      }

      setIsSaving(true);

      startTransition(async () => {
        const result = await recordBulkCounts(cycleCountId, counts, userId);

        setIsSaving(false);

        if (result.error) {
          toast.error(result.error);
        } else {
          setPendingChanges(new Set());
          setLastSaved(new Date());

          if (!isAutoSave) {
            toast.success(`Saved ${result.data?.updatedCount || 0} count(s)`);
          }

          onSaveComplete?.();
          router.refresh();
        }
      });
    },
    [cycleCountId, countQuantities, countNotes, pendingChanges, userId, router, onSaveComplete]
  );

  // Manual save button handler
  const handleManualSave = () => {
    // Clear auto-save timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    handleSave(false);
  };

  // Scroll to top
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-4">
      {/* Header with Progress */}
      <div className="sticky top-0 z-10 bg-neutral-950/95 backdrop-blur-sm p-4 -mx-4 border-b border-white/10">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <Package className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Count Entry</h2>
              <p className="text-sm text-neutral-400">
                {countedItems} of {totalItems} items counted
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {blindCount && (
              <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">
                <EyeOff className="h-3 w-3 mr-1" />
                Blind Count
              </Badge>
            )}
            <Button
              onClick={handleManualSave}
              disabled={isPending || isSaving || pendingChanges.size === 0}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isPending || isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Progress
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <Progress value={progressPercent} className="h-2" />
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>{progressPercent}% complete</span>
            {lastSaved && (
              <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
            )}
            {isSaving && (
              <span className="flex items-center gap-1 text-orange-400">
                <div className="h-2 w-2 bg-orange-500 rounded-full animate-pulse" />
                Auto-saving...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <Input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-neutral-900/50 border-white/10"
          />
        </div>
        <Select value={filterOption} onValueChange={(v) => setFilterOption(v as FilterOption)}>
          <SelectTrigger className="w-[160px] bg-neutral-900/50 border-white/10">
            <Filter className="h-4 w-4 mr-2 text-neutral-500" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-neutral-900 border-white/10">
            <SelectItem value="all">All Items</SelectItem>
            <SelectItem value="uncounted">
              <span className="flex items-center gap-2">
                <Circle className="h-3 w-3" />
                Uncounted
              </span>
            </SelectItem>
            <SelectItem value="counted">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                Counted
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Items List */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            {searchQuery || filterOption !== "all"
              ? "No items match your search or filter"
              : "No items to count"}
          </div>
        ) : (
          filteredItems.map((item) => (
            <CountEntryRow
              key={item.id}
              item={item}
              blindCount={blindCount}
              quantity={countQuantities[item.id] || ""}
              notes={countNotes[item.id] || ""}
              onQuantityChange={handleQuantityChange}
              onNotesChange={handleNotesChange}
              isSaving={isSaving && pendingChanges.has(item.id)}
              lastSaved={lastSaved}
            />
          ))
        )}
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={scrollToTop}
          className="h-12 w-12 rounded-full bg-neutral-900 border-white/10 shadow-lg"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
        {pendingChanges.size > 0 && (
          <Button
            onClick={handleManualSave}
            disabled={isPending || isSaving}
            className="h-12 w-12 rounded-full bg-orange-600 hover:bg-orange-700 shadow-lg"
          >
            {isPending || isSaving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
          </Button>
        )}
      </div>

      {/* Bottom Padding for FAB */}
      <div className="h-20" />
    </div>
  );
}
