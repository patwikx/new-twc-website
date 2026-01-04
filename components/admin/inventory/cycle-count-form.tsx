"use client";

import { useTransition, useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createCycleCount, populateCountItems } from "@/lib/inventory/cycle-count";
import { Loader2, Warehouse, Search, ClipboardCheck, CalendarIcon, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface StockItem {
  id: string;
  name: string;
  itemCode: string;
  primaryUnit: { id: string; abbreviation: string };
  stockLevels: Record<string, number>;
}

interface WarehouseOption {
  id: string;
  name: string;
  type: string;
}

interface CycleCountFormProps {
  stockItems: StockItem[];
  warehouses: WarehouseOption[];
  userId: string;
}

export function CycleCountForm({ stockItems, warehouses, userId }: CycleCountFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [warehouseId, setWarehouseId] = useState("");
  const [blindCount, setBlindCount] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return stockItems;
    const query = searchQuery.toLowerCase();
    return stockItems.filter((item) => item.name.toLowerCase().includes(query) || item.itemCode.toLowerCase().includes(query));
  }, [stockItems, searchQuery]);

  useEffect(() => {
    if (warehouseId) {
      setSelectedItems(new Set(stockItems.map((item) => item.id)));
    } else {
      setSelectedItems(new Set());
    }
  }, [warehouseId, stockItems]);

  const toggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) { newSelected.delete(itemId); } else { newSelected.add(itemId); }
    setSelectedItems(newSelected);
  };

  const toggleAll = () => {
    if (selectedItems.size === filteredItems.length) { setSelectedItems(new Set()); } 
    else { setSelectedItems(new Set(filteredItems.map((item) => item.id))); }
  };

  const getStockQty = (item: StockItem) => {
    if (!warehouseId) return 0;
    return item.stockLevels[warehouseId] ?? 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!warehouseId) { toast.error("Please select a warehouse"); return; }
    if (selectedItems.size === 0) { toast.error("Please select at least one item to count"); return; }

    startTransition(async () => {
      const result = await createCycleCount({
        warehouseId, type: "SPOT", blindCount,
        scheduledAt: scheduledAt || undefined,
        notes: notes.trim() || undefined,
        itemIds: Array.from(selectedItems),
        createdById: userId,
      });
      if (result.error) { toast.error(result.error); return; }
      if (result.data) {
        const populateResult = await populateCountItems(result.data.id, { itemIds: Array.from(selectedItems) });
        if (populateResult.error) { toast.error("Cycle count created but failed to populate items: " + populateResult.error); }
        else { toast.success("Cycle count created with " + (populateResult.data?.itemsCreated ?? 0) + " items"); }
      } else { toast.success("Cycle count created successfully"); }
      router.push("/admin/inventory/cycle-counts");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
            <ClipboardCheck className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">New Cycle Count</h2>
            <p className="text-sm text-neutral-400">Create a new inventory cycle count session.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" type="button" onClick={() => router.back()} className="text-neutral-400 hover:text-white">Cancel</Button>
          <Button type="submit" disabled={isPending || !warehouseId || selectedItems.size === 0} className="bg-orange-600 hover:bg-orange-700 text-white min-w-[160px]">
            {isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>) : "Create Cycle Count"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-widest"><Warehouse className="h-3 w-3" />1. Select Warehouse</Label>
        <Select value={warehouseId} onValueChange={setWarehouseId}>
          <SelectTrigger className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 max-w-md"><SelectValue placeholder="Select warehouse" /></SelectTrigger>
          <SelectContent>{warehouses.map((w) => (<SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>))}</SelectContent>
        </Select>
        <p className="text-xs text-neutral-500">Where will the count be performed?</p>
      </div>

      {warehouseId && (
        <div className="space-y-4 p-4 bg-orange-500/5 rounded-lg border border-orange-500/20">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs text-orange-400 uppercase tracking-widest"><Search className="h-3 w-3" />2. Items to Count</Label>
            <Input placeholder="Search by name or item code..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50" />
          </div>
          <div className="border border-white/10 rounded-lg overflow-hidden max-h-[300px] overflow-y-auto bg-neutral-900/30">
            <Table>
              <TableHeader><TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="w-12"><Checkbox checked={filteredItems.length > 0 && selectedItems.size === filteredItems.length} onCheckedChange={toggleAll} disabled={filteredItems.length === 0} /></TableHead>
                <TableHead className="text-neutral-400">Item</TableHead>
                <TableHead className="text-neutral-400 w-28 text-right">System Qty</TableHead>
                <TableHead className="text-neutral-400 w-20">Unit</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const isSelected = selectedItems.has(item.id);
                  const qty = getStockQty(item);
                  return (<TableRow key={item.id} className={"border-white/10 cursor-pointer " + (isSelected ? "bg-orange-500/10" : "")} onClick={() => toggleItem(item.id)}>
                    <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={isSelected} onCheckedChange={() => toggleItem(item.id)} /></TableCell>
                    <TableCell><div><p className="text-white font-medium">{item.name}</p><p className="text-xs text-neutral-500 font-mono">{item.itemCode}</p></div></TableCell>
                    <TableCell className="text-right"><span className={qty > 0 ? "text-white font-medium" : "text-neutral-500"}>{qty}</span></TableCell>
                    <TableCell><span className="text-sm text-neutral-400">{item.primaryUnit.abbreviation}</span></TableCell>
                  </TableRow>);
                })}
                {filteredItems.length === 0 && (<TableRow><TableCell colSpan={4} className="text-center text-neutral-500 py-8">{searchQuery ? "No items match your search" : "No stock items available"}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </div>
          <p className="text-sm text-orange-400 font-medium">{selectedItems.size} of {stockItems.length} item(s) selected</p>
        </div>
      )}

      {warehouseId && (
        <div className="space-y-4">
          <Label className="text-xs text-neutral-500 uppercase tracking-widest">3. Optional Settings</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-neutral-900/30 rounded-lg border border-white/10 space-y-3">
              <Label className="flex items-center gap-2 text-sm text-white"><CalendarIcon className="h-4 w-4 text-neutral-400" />Schedule Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" type="button" className={cn("w-full justify-start text-left font-normal bg-neutral-900/50 border-white/10 hover:bg-neutral-800/50", !scheduledAt && "text-neutral-500")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />{scheduledAt ? format(scheduledAt, "PPP") : "Pick a date (optional)"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-neutral-900 border-white/10"><Calendar mode="single" selected={scheduledAt} onSelect={setScheduledAt} disabled={(date) => date < new Date()} /></PopoverContent>
              </Popover>
              {scheduledAt && (<Button type="button" variant="ghost" size="sm" onClick={() => setScheduledAt(undefined)} className="text-xs text-neutral-400 hover:text-white h-6 px-2">Clear date</Button>)}
              <p className="text-xs text-neutral-500">Leave empty to create as draft</p>
            </div>
            <div className="p-4 bg-neutral-900/30 rounded-lg border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm text-white"><EyeOff className="h-4 w-4 text-neutral-400" />Blind Count</Label>
                <Switch checked={blindCount} onCheckedChange={setBlindCount} />
              </div>
              <p className="text-xs text-neutral-500">Hide system quantities from counters to ensure unbiased counts.</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-neutral-500 uppercase tracking-widest">Notes (Optional)</Label>
            <Textarea placeholder="Add any notes or special instructions..." value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 min-h-[80px]" />
          </div>
        </div>
      )}

      {warehouseId && selectedItems.size > 0 && (
        <div className="flex justify-between items-center p-4 bg-neutral-900/50 rounded-lg border border-white/10">
          <div className="flex flex-col gap-1">
            <span className="text-neutral-400 text-sm">Warehouse: <span className="text-white font-medium">{warehouses.find((w) => w.id === warehouseId)?.name}</span></span>
            <span className="text-neutral-400 text-sm">Items: <span className="text-orange-400 font-medium">{selectedItems.size} item(s) to count</span></span>
          </div>
          <div className="flex flex-col items-end gap-1">
            {blindCount && (<span className="text-xs text-neutral-500 flex items-center gap-1"><EyeOff className="h-3 w-3" />Blind count enabled</span>)}
            {scheduledAt && (<span className="text-xs text-neutral-500 flex items-center gap-1"><CalendarIcon className="h-3 w-3" />Scheduled for {format(scheduledAt, "MMM d, yyyy")}</span>)}
          </div>
        </div>
      )}
    </form>
  );
}