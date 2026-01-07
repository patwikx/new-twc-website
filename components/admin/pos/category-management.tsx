"use client";

import * as React from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  GripVertical,
  Loader2,
  UtensilsCrossed,
  Coffee,
  IceCream,
  Pizza,
  Wine,
  Salad,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { 
  createCategory, 
  updateCategory, 
  deleteCategory 
} from "@/lib/pos/menu-category";

// Available icons for categories
const CATEGORY_ICONS = [
  { name: "UtensilsCrossed", icon: UtensilsCrossed, label: "Utensils" },
  { name: "Coffee", icon: Coffee, label: "Coffee" },
  { name: "IceCream", icon: IceCream, label: "Dessert" },
  { name: "Pizza", icon: Pizza, label: "Pizza" },
  { name: "Wine", icon: Wine, label: "Wine" },
  { name: "Salad", icon: Salad, label: "Salad" },
];

// Available colors for categories
const CATEGORY_COLORS = [
  { name: "orange", hex: "#f97316", label: "Orange" },
  { name: "red", hex: "#ef4444", label: "Red" },
  { name: "green", hex: "#22c55e", label: "Green" },
  { name: "blue", hex: "#3b82f6", label: "Blue" },
  { name: "purple", hex: "#a855f7", label: "Purple" },
  { name: "pink", hex: "#ec4899", label: "Pink" },
  { name: "yellow", hex: "#eab308", label: "Yellow" },
  { name: "cyan", hex: "#06b6d4", label: "Cyan" },
];

interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  propertyId: string | null;
  propertyName: string;
  menuItemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Property {
  id: string;
  name: string;
}

interface CategoryManagementProps {
  categories: Category[];
  properties: Property[];
  currentScope: string;
}

export function CategoryManagement({
  categories,
  properties,
  currentScope,
}: CategoryManagementProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<Category | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);

  // Form state
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [color, setColor] = React.useState("orange");
  const [icon, setIcon] = React.useState("UtensilsCrossed");
  const [propertyId, setPropertyId] = React.useState<string>("");
  const [isActive, setIsActive] = React.useState(true);
  const [sortOrder, setSortOrder] = React.useState(0);

  // Reset form
  const resetForm = () => {
    setName("");
    setDescription("");
    setColor("orange");
    setIcon("UtensilsCrossed");
    setPropertyId(currentScope !== "ALL" ? currentScope : "all");
    setIsActive(true);
    setSortOrder(categories.length);
    setEditingCategory(null);
  };

  // Open dialog for new category
  const handleNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  // Open dialog for editing
  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setName(category.name);
    setDescription(category.description || "");
    setColor(category.color || "orange");
    setIcon(category.icon || "UtensilsCrossed");
    setPropertyId(category.propertyId || "all");
    setIsActive(category.isActive);
    setSortOrder(category.sortOrder);
    setIsDialogOpen(true);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Category name is required");
      return;
    }

    setIsLoading(true);
    try {
      if (editingCategory) {
        // Update existing category
        const result = await updateCategory(editingCategory.id, {
          name: name.trim(),
          description: description.trim() || null,
          color,
          icon,
          propertyId: propertyId === "all" ? null : propertyId,
          isActive,
          sortOrder,
        });

        if (result.error) {
          toast.error(result.error);
          return;
        }

        toast.success("Category updated successfully");
      } else {
        // Create new category
        const result = await createCategory({
          name: name.trim(),
          description: description.trim() || null,
          color,
          icon,
          propertyId: propertyId === "all" ? null : propertyId,
          sortOrder,
        });

        if (result.error) {
          toast.error(result.error);
          return;
        }

        toast.success("Category created successfully");
      }

      setIsDialogOpen(false);
      resetForm();
      router.refresh();
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    try {
      const result = await deleteCategory(id);
      
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Category deleted successfully");
      setDeleteConfirmId(null);
      router.refresh();
    } catch {
      toast.error("Failed to delete category");
    }
  };

  // Get icon component by name
  const getIconComponent = (iconName: string | null) => {
    const iconDef = CATEGORY_ICONS.find((i) => i.name === iconName);
    if (iconDef) {
      const IconComponent = iconDef.icon;
      return <IconComponent className="h-4 w-4" />;
    }
    return <UtensilsCrossed className="h-4 w-4" />;
  };

  // Get color hex by name
  const getColorHex = (colorName: string | null) => {
    const colorDef = CATEGORY_COLORS.find((c) => c.name === colorName);
    return colorDef?.hex || "#f97316";
  };

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {categories.length} categories
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      {/* Categories Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Property</TableHead>
              <TableHead className="text-center">Items</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No categories found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell>
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: getColorHex(category.color) + "20" }}
                      >
                        <span style={{ color: getColorHex(category.color) }}>
                          {getIconComponent(category.icon)}
                        </span>
                      </div>
                      <span className="font-medium">{category.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {category.description || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{category.propertyName}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {category.menuItemCount}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={category.isActive ? "default" : "secondary"}>
                      {category.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(category)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {deleteConfirmId === category.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(category.id)}
                            disabled={category.menuItemCount > 0}
                          >
                            Confirm
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirmId(category.id)}
                          disabled={category.menuItemCount > 0}
                          title={category.menuItemCount > 0 ? "Cannot delete category with menu items" : "Delete"}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Category" : "New Category"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Update the category details below."
                : "Create a new menu category."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Appetizers"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={2}
              />
            </div>

            {/* Property */}
            <div className="space-y-2">
              <Label htmlFor="property">Property</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder="All Properties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {properties.map((prop) => (
                    <SelectItem key={prop.id} value={prop.id}>
                      {prop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Color & Icon */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_COLORS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      className={`h-8 w-8 rounded-lg border-2 transition-all ${
                        color === c.name ? "border-white scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.hex }}
                      onClick={() => setColor(c.name)}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Icon</Label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_ICONS.map((i) => {
                    const IconComponent = i.icon;
                    return (
                      <button
                        key={i.name}
                        type="button"
                        className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-all ${
                          icon === i.name
                            ? "border-primary bg-primary/10"
                            : "border-border"
                        }`}
                        onClick={() => setIcon(i.name)}
                        title={i.label}
                      >
                        <IconComponent className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sort Order */}
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Sort Order</Label>
              <Input
                id="sortOrder"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                min={0}
              />
              <p className="text-xs text-muted-foreground">
                Lower numbers appear first
              </p>
            </div>

            {/* Active Status (only for editing) */}
            {editingCategory && (
              <div className="flex items-center justify-between">
                <Label htmlFor="isActive">Active</Label>
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingCategory ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
