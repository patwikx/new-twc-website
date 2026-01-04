"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  MessageSquare,
  ChevronDown,
  Check,
} from "lucide-react";

export interface CountEntryRowItem {
  id: string;
  stockItemId: string;
  batchId: string | null;
  systemQuantity: number;
  countedQuantity: number | null;
  variance: number | null;
  variancePercent: number | null;
  notes: string | null;
  stockItem: {
    id: string;
    name: string;
    itemCode: string;
    sku: string | null;
    primaryUnit: {
      id: string;
      name: string;
      abbreviation: string;
    };
    category: {
      id: string;
      name: string;
      color: string | null;
    } | null;
  };
  batch: {
    id: string;
    batchNumber: string;
    expirationDate: Date | null;
  } | null;
}

interface CountEntryRowProps {
  item: CountEntryRowItem;
  blindCount: boolean;
  quantity: string;
  notes: string;
  onQuantityChange: (itemId: string, value: string) => void;
  onNotesChange: (itemId: string, value: string) => void;
  isSaving?: boolean;
  lastSaved?: Date | null;
}

export function CountEntryRow({
  item,
  blindCount,
  quantity,
  notes,
  onQuantityChange,
  onNotesChange,
  isSaving,
  lastSaved,
}: CountEntryRowProps) {
  const [isNotesOpen, setIsNotesOpen] = useState(!!notes);
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate variance for display (only if not blind count and quantity entered)
  const showVariance = !blindCount && quantity !== "";
  const countedQty = parseFloat(quantity) || 0;
  const variance = showVariance ? countedQty - item.systemQuantity : null;
  const variancePercent = showVariance && item.systemQuantity !== 0
    ? ((countedQty - item.systemQuantity) / item.systemQuantity) * 100
    : showVariance && item.systemQuantity === 0 && countedQty !== 0
    ? 100
    : null;

  const getVarianceColor = (v: number | null) => {
    if (v === null || v === 0) return "text-neutral-400";
    if (v > 0) return "text-green-400";
    return "text-red-400";
  };

  const getVarianceIcon = (v: number | null) => {
    if (v === null || v === 0) return Minus;
    if (v > 0) return TrendingUp;
    return TrendingDown;
  };

  const VarianceIcon = getVarianceIcon(variance);
  const hasNotes = notes.trim().length > 0;
  const isCounted = quantity !== "" && !isNaN(parseFloat(quantity));

  return (
    <div className="p-4 bg-neutral-900/50 rounded-lg border border-white/10 space-y-3">
      {/* Item Info Row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-medium truncate">{item.stockItem.name}</h3>
            {isCounted && (
              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs font-mono text-neutral-500">
              {item.stockItem.itemCode}
            </span>
            {item.stockItem.sku && (
              <span className="text-xs text-neutral-500">
                SKU: {item.stockItem.sku}
              </span>
            )}
            {item.batch && (
              <Badge variant="outline" className="text-xs border-white/10">
                Batch: {item.batch.batchNumber}
              </Badge>
            )}
            {item.stockItem.category && (
              <span
                className="px-1.5 py-0.5 rounded text-xs"
                style={{
                  backgroundColor: item.stockItem.category.color
                    ? `${item.stockItem.category.color}20`
                    : undefined,
                  color: item.stockItem.category.color || undefined,
                }}
              >
                {item.stockItem.category.name}
              </span>
            )}
          </div>
        </div>

        {/* System Quantity (hidden in blind count mode) */}
        {!blindCount && (
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-neutral-500 uppercase tracking-wider">System</p>
            <p className="text-neutral-300 font-medium">
              {item.systemQuantity.toFixed(3)} {item.stockItem.primaryUnit.abbreviation}
            </p>
          </div>
        )}
      </div>

      {/* Count Input Row */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              type="number"
              min="0"
              step="0.001"
              value={quantity}
              onChange={(e) => onQuantityChange(item.id, e.target.value)}
              placeholder="Enter count..."
              className="h-12 text-lg bg-neutral-800 border-white/10 focus:border-orange-500/50"
              inputMode="decimal"
            />
            <span className="text-sm text-neutral-400 flex-shrink-0 w-12">
              {item.stockItem.primaryUnit.abbreviation}
            </span>
          </div>
        </div>

        {/* Variance Indicator */}
        {showVariance && variance !== null && (
          <div className={`text-right flex-shrink-0 min-w-[80px] ${getVarianceColor(variance)}`}>
            <div className="flex items-center justify-end gap-1">
              <VarianceIcon className="h-4 w-4" />
              <span className="font-medium">
                {variance > 0 ? "+" : ""}{variance.toFixed(3)}
              </span>
            </div>
            {variancePercent !== null && (
              <p className="text-xs">
                {variancePercent > 0 ? "+" : ""}{variancePercent.toFixed(1)}%
              </p>
            )}
          </div>
        )}
      </div>

      {/* Notes Section */}
      <Collapsible open={isNotesOpen} onOpenChange={setIsNotesOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`w-full justify-between text-neutral-400 hover:text-white ${
              hasNotes ? "text-orange-400" : ""
            }`}
          >
            <span className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {hasNotes ? "Notes added" : "Add notes"}
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${isNotesOpen ? "rotate-180" : ""}`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <Textarea
            value={notes}
            onChange={(e) => onNotesChange(item.id, e.target.value)}
            placeholder="Add notes about this count..."
            className="bg-neutral-800 border-white/10 min-h-[80px] resize-none"
          />
        </CollapsibleContent>
      </Collapsible>

      {/* Save Status Indicator */}
      {isSaving && (
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <div className="h-2 w-2 bg-orange-500 rounded-full animate-pulse" />
          Saving...
        </div>
      )}
    </div>
  );
}
