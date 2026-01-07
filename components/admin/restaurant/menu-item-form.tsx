"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createMenuItem, updateMenuItem } from "@/lib/inventory/menu-item";
import { 
  Loader2, 
  Utensils, 
  Building2, 
  ChefHat, 
  DollarSign, 
  ImageIcon,
  X,
  AlertTriangle,
} from "lucide-react";
import { FileUpload } from "@/components/file-upload";

interface Property {
  id: string;
  name: string;
}

interface Recipe {
  id: string;
  name: string;
  yield: number;
  yieldUnit: string;
  minimumServingsThreshold: number;
}

interface Category {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

interface MenuItemFormProps {
  menuItem?: {
    id: string;
    name: string;
    description: string | null;
    categoryId: string;
    sellingPrice: number;
    recipeId: string | null;
    imageUrl: string | null;
    isAvailable: boolean;
    unavailableReason: string | null;
    availableServings: number | null;
    propertyId: string;
  };
  properties: Property[];
  recipes: Recipe[];
  categories: Category[];
  isEditMode?: boolean;
  currentPropertyId?: string | null;
  currentPropertyName?: string;
}

export function MenuItemForm({
  menuItem,
  properties,
  recipes,
  categories,
  isEditMode = false,
  currentPropertyId,
  currentPropertyName,
}: MenuItemFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    menuItem?.propertyId ?? currentPropertyId ?? ""
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    menuItem?.categoryId ?? ""
  );
  const [selectedRecipeId, setSelectedRecipeId] = useState(
    menuItem?.recipeId ?? ""
  );
  const [imageUrl, setImageUrl] = useState(menuItem?.imageUrl ?? "");

  // Determine if we should show property selector
  const showPropertySelector = !isEditMode && !currentPropertyId;

  // Get the selected recipe for display
  const selectedRecipe = recipes.find(r => r.id === selectedRecipeId);
  const selectedCategory = categories.find(c => c.id === selectedCategoryId);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const sellingPrice = parseFloat(formData.get("sellingPrice") as string);
    const propertyId = formData.get("propertyId") as string;

    if (!name.trim()) {
      toast.error("Menu item name is required");
      return;
    }

    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      toast.error("Selling price must be greater than zero");
      return;
    }

    if (!selectedCategoryId) {
      toast.error("Please select a category");
      return;
    }

    startTransition(async () => {
      let result;

      if (isEditMode && menuItem?.id) {
        result = await updateMenuItem(menuItem.id, {
          name,
          description: description || undefined,
          categoryId: selectedCategoryId,
          sellingPrice,
          recipeId: selectedRecipeId || null,
          imageUrl: imageUrl || null,
        });
      } else {
        result = await createMenuItem({
          name,
          description: description || undefined,
          categoryId: selectedCategoryId,
          sellingPrice,
          propertyId,
          recipeId: selectedRecipeId ? selectedRecipeId : undefined,
          imageUrl: imageUrl || undefined,
        });
      }

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isEditMode ? "Menu item updated" : "Menu item created");
        if (!isEditMode && result.data) {
          router.push(`/admin/restaurant/menu/${result.data.id}`);
        }
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">
            {isEditMode ? "Menu Item Details" : "Create New Menu Item"}
          </h2>
          <p className="text-sm text-neutral-400">
            {isEditMode
              ? "Update menu item information and recipe association."
              : "Add a new item to your restaurant menu."}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            type="button"
            onClick={() => router.back()}
            className="text-neutral-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="bg-orange-600 hover:bg-orange-700 text-white min-w-[140px]"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : isEditMode ? (
              "Save Changes"
            ) : (
              "Create Item"
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Basic Information */}
        <div className="space-y-6">
          <Label className="flex items-center gap-2 text-sm font-medium text-neutral-300 border-b border-white/10 pb-2">
            <Utensils className="h-4 w-4 text-orange-500" />
            Basic Information
          </Label>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="name"
                className="text-xs text-neutral-500 uppercase tracking-widest"
              >
                Item Name
              </Label>
              <Input
                id="name"
                name="name"
                defaultValue={menuItem?.name}
                placeholder="e.g. Grilled Salmon"
                required
                className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="description"
                className="text-xs text-neutral-500 uppercase tracking-widest"
              >
                Description (Optional)
              </Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={menuItem?.description ?? ""}
                placeholder="Describe the dish, ingredients, or preparation style..."
                rows={3}
                className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20 resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="category"
                className="text-xs text-neutral-500 uppercase tracking-widest"
              >
                Category
              </Label>
              <Select 
                value={selectedCategoryId}
                onValueChange={setSelectedCategoryId}
              >
                <SelectTrigger className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.length === 0 ? (
                    <SelectItem value="" disabled>
                      No categories available
                    </SelectItem>
                  ) : (
                    categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center gap-2">
                          {category.color && (
                            <div 
                              className="h-3 w-3 rounded-full" 
                              style={{ backgroundColor: category.color }}
                            />
                          )}
                          {category.name}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {categories.length === 0 && (
                <p className="text-xs text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  No categories found. Create categories first.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Pricing & Property */}
        <div className="space-y-6">
          <Label className="flex items-center gap-2 text-sm font-medium text-neutral-300 border-b border-white/10 pb-2">
            <DollarSign className="h-4 w-4 text-orange-500" />
            Pricing & Property
          </Label>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="sellingPrice"
                className="text-xs text-neutral-500 uppercase tracking-widest"
              >
                Selling Price (PHP)
              </Label>
              <Input
                id="sellingPrice"
                name="sellingPrice"
                type="number"
                min="0"
                step="0.01"
                defaultValue={menuItem?.sellingPrice ?? ""}
                placeholder="0.00"
                required
                className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20"
              />
              <p className="text-xs text-neutral-500">
                The price customers will pay for this item.
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="propertyId"
                className="text-xs text-neutral-500 uppercase tracking-widest"
              >
                Property
              </Label>
              {showPropertySelector ? (
                <Select
                  name="propertyId"
                  defaultValue={selectedPropertyId}
                  onValueChange={setSelectedPropertyId}
                >
                  <SelectTrigger className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20">
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <input type="hidden" name="propertyId" value={selectedPropertyId} />
                  <div className="flex items-center gap-2 h-10 px-3 bg-neutral-900/30 border border-white/10 rounded-md">
                    <Building2 className="h-4 w-4 text-neutral-500" />
                    <span className="text-sm text-white">
                      {currentPropertyName || properties.find(p => p.id === selectedPropertyId)?.name || "Unknown Property"}
                    </span>
                  </div>
                  {isEditMode && (
                    <p className="text-xs text-neutral-500">
                      Property cannot be changed after creation.
                    </p>
                  )}
                  {!isEditMode && currentPropertyId && (
                    <p className="text-xs text-neutral-500">
                      Item will be created for the currently selected property.
                    </p>
                  )}
                </>
              )}
            </div>

            {isEditMode && menuItem && (
              <div className="space-y-2">
                <Label className="text-xs text-neutral-500 uppercase tracking-widest">
                  Availability Status
                </Label>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      menuItem.isAvailable ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <span className="text-sm text-neutral-300">
                    {menuItem.isAvailable ? "Available" : "Unavailable"}
                  </span>
                  {menuItem.availableServings !== null && (
                    <span className="text-xs text-neutral-500">
                      ({menuItem.availableServings} servings in stock)
                    </span>
                  )}
                </div>
                {!menuItem.isAvailable && menuItem.unavailableReason && (
                  <p className="text-xs text-red-400">
                    {menuItem.unavailableReason}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Upload */}
      <div className="space-y-6">
        <Label className="flex items-center gap-2 text-sm font-medium text-neutral-300 border-b border-white/10 pb-2">
          <ImageIcon className="h-4 w-4 text-orange-500" />
          Menu Item Image
        </Label>

        <div className="space-y-4">
          {imageUrl ? (
            <div className="relative w-48 h-48 rounded-lg overflow-hidden border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Menu item"
                className="w-full h-full object-cover"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6"
                onClick={() => setImageUrl("")}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="max-w-md">
              <FileUpload
                accept=".jpg,.jpeg,.png,.webp"
                maxSize={5}
                onUploadComplete={(result) => {
                  setImageUrl(result.fileUrl);
                  toast.success("Image uploaded");
                }}
                onUploadError={(error) => {
                  toast.error(error);
                }}
              />
              <p className="text-xs text-neutral-500 mt-2">
                Recommended: Square image, 400x400px or larger
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recipe Association */}
      <div className="space-y-6">
        <Label className="flex items-center gap-2 text-sm font-medium text-neutral-300 border-b border-white/10 pb-2">
          <ChefHat className="h-4 w-4 text-orange-500" />
          Recipe Association
        </Label>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label
              htmlFor="recipeId"
              className="text-xs text-neutral-500 uppercase tracking-widest"
            >
              Associated Recipe
            </Label>
            <Select 
              value={selectedRecipeId || "none"}
              onValueChange={(value) => setSelectedRecipeId(value === "none" ? "" : value)}
            >
              <SelectTrigger className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20">
                <SelectValue placeholder="Select a recipe (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No recipe</SelectItem>
                {recipes.map((recipe) => (
                  <SelectItem key={recipe.id} value={recipe.id}>
                    {recipe.name} ({recipe.yield} {recipe.yieldUnit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-neutral-500">
              Link to a recipe for automatic cost calculation and inventory-based availability.
            </p>
          </div>

          {!selectedRecipeId && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">No Recipe Linked</span>
              </div>
              <p className="text-xs text-amber-300/80 mt-1">
                Without a recipe, this item&apos;s availability won&apos;t be tracked based on ingredient stock.
              </p>
            </div>
          )}

          {selectedRecipe && (
            <div className="p-4 bg-neutral-900/30 rounded-lg border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <ChefHat className="h-4 w-4 text-orange-400" />
                <span className="text-sm font-medium text-white">
                  {selectedRecipe.name}
                </span>
              </div>
              <div className="space-y-1 text-xs text-neutral-400">
                <p>Yield: {selectedRecipe.yield} {selectedRecipe.yieldUnit} per batch</p>
                <p>Availability Threshold: {selectedRecipe.minimumServingsThreshold} servings minimum</p>
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                This menu item will become unavailable when available servings drop below the threshold.
              </p>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
