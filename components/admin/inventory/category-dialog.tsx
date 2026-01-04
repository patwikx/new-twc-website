"use client";

import { useTransition, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createStockCategory, updateStockCategory } from "@/lib/inventory/stock-category";
import { Loader2, Tag, Lock } from "lucide-react";

interface CategoryData {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  isSystem: boolean;
  isActive: boolean;
  stockItemCount: number;
}

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: CategoryData | null;
}

const COLOR_OPTIONS = [
  { value: "orange", label: "Orange", hex: "#f97316" },
  { value: "blue", label: "Blue", hex: "#3b82f6" },
  { value: "green", label: "Green", hex: "#22c55e" },
  { value: "purple", label: "Purple", hex: "#a855f7" },
  { value: "cyan", label: "Cyan", hex: "#06b6d4" },
  { value: "red", label: "Red", hex: "#ef4444" },
  { value: "yellow", label: "Yellow", hex: "#eab308" },
  { value: "pink", label: "Pink", hex: "#ec4899" },
];

export function CategoryDialog({
  open,
  onOpenChange,
  category,
}: CategoryDialogProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEditMode = !!category;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState<string>("orange");

  // Reset form when dialog opens/closes or category changes
  useEffect(() => {
    if (open) {
      if (category) {
        setName(category.name);
        setDescription(category.description || "");
        setSelectedColor(category.color || "orange");
      } else {
        setName("");
        setDescription("");
        setSelectedColor("orange");
      }
    }
  }, [open, category]);

  const selectedColorInfo = COLOR_OPTIONS.find((c) => c.value === selectedColor);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Category name is required");
      return;
    }

    startTransition(async () => {
      let result;

      if (isEditMode && category?.id) {
        // Check if trying to rename a system category
        if (category.isSystem && name.trim() !== category.name) {
          toast.error("Cannot rename system categories");
          return;
        }

        result = await updateStockCategory(category.id, {
          name: name.trim(),
          description: description.trim() || null,
          color: selectedColor,
        });
      } else {
        result = await createStockCategory({
          name: name.trim(),
          description: description.trim() || undefined,
          color: selectedColor,
        });
      }

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isEditMode ? "Category updated" : "Category created");
        onOpenChange(false);
        router.refresh();
      }
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      setName(category?.name || "");
      setDescription(category?.description || "");
      setSelectedColor(category?.color || "orange");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-neutral-900 border-white/10 sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Tag className="h-5 w-5 text-orange-500" />
              {isEditMode ? "Edit Category" : "Create Category"}
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              {isEditMode
                ? "Update category information."
                : "Add a new stock category to organize your inventory."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* System Category Warning */}
            {isEditMode && category?.isSystem && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-blue-500/10 border border-blue-500/20">
                <Lock className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-blue-400">
                  This is a system category. Name cannot be changed.
                </span>
              </div>
            )}

            {/* Category Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs text-neutral-500 uppercase tracking-widest">
                Category Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Beverages"
                required
                disabled={isEditMode && category?.isSystem}
                className="h-10 bg-neutral-900/50 border-white/10 focus:border-orange-500/50 disabled:opacity-50"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-xs text-neutral-500 uppercase tracking-widest">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description for this category"
                rows={3}
                className="bg-neutral-900/50 border-white/10 focus:border-orange-500/50 resize-none"
              />
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label htmlFor="color" className="text-xs text-neutral-500 uppercase tracking-widest">
                Color
              </Label>
              <Select value={selectedColor} onValueChange={setSelectedColor}>
                <SelectTrigger className="h-10 bg-neutral-900/50 border-white/10 focus:border-orange-500/50">
                  <SelectValue placeholder="Select color">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: selectedColorInfo?.hex }}
                      />
                      <span className="capitalize">{selectedColor}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: color.hex }}
                        />
                        <span>{color.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-neutral-500">
                Color is used for visual identification in the UI.
              </p>
            </div>

            {/* Status (Edit mode only) */}
            {isEditMode && category && (
              <div className="space-y-2">
                <Label className="text-xs text-neutral-500 uppercase tracking-widest">Status</Label>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      category.isActive ? "bg-green-500" : "bg-neutral-500"
                    }`}
                  />
                  <span className="text-sm text-neutral-300">
                    {category.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-xs text-neutral-500">
                  Use the list page to activate/deactivate categories.
                </p>
              </div>
            )}

            {/* Item Count (Edit mode only) */}
            {isEditMode && category && (
              <div className="space-y-2">
                <Label className="text-xs text-neutral-500 uppercase tracking-widest">
                  Associated Items
                </Label>
                <div className="text-sm text-neutral-300">
                  {category.stockItemCount} stock item{category.stockItemCount !== 1 ? "s" : ""}
                </div>
                {category.stockItemCount > 0 && (
                  <p className="text-xs text-neutral-500">
                    Categories with items cannot be deleted.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              className="text-neutral-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-orange-600 hover:bg-orange-700 text-white min-w-[120px]"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isEditMode ? (
                "Save Changes"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
