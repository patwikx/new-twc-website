"use client";

import { useTransition, useState, useEffect } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  createRecipe,
  updateRecipe,
  updateRecipeIngredients,
  updateRecipeSubRecipes,
  calculateRecipeCost,
  RecipeCost,
} from "@/lib/inventory/recipe";
import {
  Loader2,
  ChefHat,
  Clock,
  Plus,
  Trash2,
  Package,
  Calculator,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StockItem {
  id: string;
  name: string;
  sku: string | null;
  category: {
    name: string;
  };
  primaryUnit: {
    id: string;
    abbreviation: string;
  };
}

interface UnitOfMeasure {
  id: string;
  name: string;
  abbreviation: string;
}

interface Recipe {
  id: string;
  name: string;
  yield: number;
  yieldUnit: string;
}

interface Ingredient {
  id?: string;
  stockItemId: string;
  stockItemName?: string;
  quantity: number;
  unitId: string;
  unitAbbreviation?: string;
  notes?: string;
}

interface SubRecipe {
  id?: string;
  childRecipeId: string;
  childRecipeName?: string;
  quantity: number;
}

interface RecipeFormProps {
  recipe?: {
    id: string;
    name: string;
    description: string | null;
    yield: number;
    yieldUnitId: string;
    instructions: string | null;
    prepTimeMinutes: number | null;
    cookTimeMinutes: number | null;
    isActive: boolean;
    ingredients: {
      id: string;
      stockItemId: string;
      stockItem: { id: string; name: string; sku: string | null };
      quantity: number;
      unitId: string;
      unit: { id: string; abbreviation: string };
      notes: string | null;
    }[];
    childRecipes: {
      id: string;
      childRecipeId: string;
      childRecipe: { id: string; name: string; yield: number };
      quantity: number;
    }[];
  };
  stockItems: StockItem[];
  units: UnitOfMeasure[];
  availableRecipes: Recipe[];
  warehouseId?: string;
  isEditMode?: boolean;
}

export function RecipeForm({
  recipe,
  stockItems,
  units,
  availableRecipes,
  warehouseId,
  isEditMode = false,
}: RecipeFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  
  // Form state
  const [name, setName] = useState(recipe?.name ?? "");
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [recipeYield, setRecipeYield] = useState(recipe?.yield ?? 1);
  const [yieldUnitId, setYieldUnitId] = useState(recipe?.yieldUnitId ?? "");
  const [instructions, setInstructions] = useState(recipe?.instructions ?? "");
  const [prepTimeMinutes, setPrepTimeMinutes] = useState<number | "">(recipe?.prepTimeMinutes ?? "");
  const [cookTimeMinutes, setCookTimeMinutes] = useState<number | "">(recipe?.cookTimeMinutes ?? "");

  // Ingredients state
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => {
    if (recipe?.ingredients && recipe.ingredients.length > 0) {
      return recipe.ingredients.map((ing) => ({
        id: ing.id,
        stockItemId: ing.stockItemId,
        stockItemName: ing.stockItem.name,
        quantity: Number(ing.quantity),
        unitId: ing.unitId,
        unitAbbreviation: ing.unit.abbreviation,
        notes: ing.notes ?? "",
      }));
    }
    return [{ stockItemId: "", quantity: 0, unitId: "", notes: "" }];
  });

  // Sub-recipes state
  const [subRecipes, setSubRecipes] = useState<SubRecipe[]>(() => {
    if (recipe?.childRecipes && recipe.childRecipes.length > 0) {
      return recipe.childRecipes.map((sr) => ({
        id: sr.id,
        childRecipeId: sr.childRecipeId,
        childRecipeName: sr.childRecipe.name,
        quantity: Number(sr.quantity),
      }));
    }
    return [];
  });

  // Cost calculation state
  const [recipeCost, setRecipeCost] = useState<RecipeCost | null>(null);
  const [isCalculatingCost, setIsCalculatingCost] = useState(false);
  
  // Selected ingredients for bulk actions
  const [selectedIngredients, setSelectedIngredients] = useState<Set<number>>(new Set());

  // Calculate cost when in edit mode and warehouse is available
  useEffect(() => {
    if (isEditMode && recipe?.id && warehouseId) {
      calculateCost();
    }
  }, [isEditMode, recipe?.id, warehouseId]);

  const calculateCost = async () => {
    if (!recipe?.id || !warehouseId) return;
    
    setIsCalculatingCost(true);
    try {
      const result = await calculateRecipeCost(recipe.id, warehouseId);
      if ("error" in result) {
        console.error("Cost calculation error:", result.error);
      } else {
        setRecipeCost(result.data);
      }
    } catch (error) {
      console.error("Failed to calculate cost:", error);
    } finally {
      setIsCalculatingCost(false);
    }
  };

  // Ingredient handlers
  const addIngredient = () => {
    setIngredients([...ingredients, { stockItemId: "", quantity: 0, unitId: "", notes: "" }]);
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, i) => i !== index));
      // Update selected indices after removal
      const newSelected = new Set<number>();
      selectedIngredients.forEach((i) => {
        if (i < index) newSelected.add(i);
        else if (i > index) newSelected.add(i - 1);
      });
      setSelectedIngredients(newSelected);
    }
  };

  // Selection handlers
  const toggleIngredientSelection = (index: number) => {
    const newSelected = new Set(selectedIngredients);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIngredients(newSelected);
  };

  const toggleAllIngredients = () => {
    if (selectedIngredients.size === ingredients.length) {
      setSelectedIngredients(new Set());
    } else {
      setSelectedIngredients(new Set(ingredients.map((_, i) => i)));
    }
  };

  const removeSelectedIngredients = () => {
    if (selectedIngredients.size === 0) return;
    if (selectedIngredients.size === ingredients.length) {
      // Keep at least one empty ingredient
      setIngredients([{ stockItemId: "", quantity: 0, unitId: "", notes: "" }]);
    } else {
      setIngredients(ingredients.filter((_, i) => !selectedIngredients.has(i)));
    }
    setSelectedIngredients(new Set());
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string | number) => {
    const updated = [...ingredients];
    if (field === "stockItemId") {
      const stockItem = stockItems.find((s) => s.id === value);
      updated[index] = {
        ...updated[index],
        stockItemId: value as string,
        stockItemName: stockItem?.name,
        unitId: stockItem?.primaryUnit.id ?? updated[index].unitId,
        unitAbbreviation: stockItem?.primaryUnit.abbreviation,
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setIngredients(updated);
  };

  // Sub-recipe handlers
  const addSubRecipe = () => {
    setSubRecipes([...subRecipes, { childRecipeId: "", quantity: 1 }]);
  };

  const removeSubRecipe = (index: number) => {
    setSubRecipes(subRecipes.filter((_, i) => i !== index));
  };

  const updateSubRecipe = (index: number, field: keyof SubRecipe, value: string | number) => {
    const updated = [...subRecipes];
    if (field === "childRecipeId") {
      const selectedRecipe = availableRecipes.find((r) => r.id === value);
      updated[index] = {
        ...updated[index],
        childRecipeId: value as string,
        childRecipeName: selectedRecipe?.name,
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setSubRecipes(updated);
  };

  // Filter out current recipe from available sub-recipes
  const filteredAvailableRecipes = availableRecipes.filter(
    (r) => r.id !== recipe?.id
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Recipe name is required");
      return;
    }

    if (recipeYield <= 0) {
      toast.error("Yield must be greater than zero");
      return;
    }

    if (!yieldUnitId) {
      toast.error("Yield unit is required");
      return;
    }

    // Validate ingredients
    const validIngredients = ingredients.filter(
      (ing) => ing.stockItemId && ing.quantity > 0 && ing.unitId
    );

    if (validIngredients.length === 0) {
      toast.error("At least one valid ingredient is required");
      return;
    }

    // Validate sub-recipes
    const validSubRecipes = subRecipes.filter(
      (sr) => sr.childRecipeId && sr.quantity > 0
    );

    startTransition(async () => {
      let result;

      if (isEditMode && recipe?.id) {
        // Update recipe basic info
        result = await updateRecipe(recipe.id, {
          name,
          description: description || undefined,
          yield: recipeYield,
          yieldUnitId,
          instructions: instructions || undefined,
          prepTimeMinutes: prepTimeMinutes || undefined,
          cookTimeMinutes: cookTimeMinutes || undefined,
        });

        if (result.error) {
          toast.error(result.error);
          return;
        }

        // Update ingredients
        const ingredientsResult = await updateRecipeIngredients(recipe.id, {
          ingredients: validIngredients.map((ing) => ({
            stockItemId: ing.stockItemId,
            quantity: ing.quantity,
            unitId: ing.unitId,
            notes: ing.notes,
          })),
        });

        if (ingredientsResult.error) {
          toast.error(ingredientsResult.error);
          return;
        }

        // Update sub-recipes
        const subRecipesResult = await updateRecipeSubRecipes(recipe.id, {
          subRecipes: validSubRecipes.map((sr) => ({
            childRecipeId: sr.childRecipeId,
            quantity: sr.quantity,
          })),
        });

        if (subRecipesResult.error) {
          toast.error(subRecipesResult.error);
          return;
        }

        toast.success("Recipe updated successfully");
        router.refresh();
        
        // Recalculate cost after update
        if (warehouseId) {
          calculateCost();
        }
      } else {
        // Create new recipe
        result = await createRecipe({
          name,
          description: description || undefined,
          yield: recipeYield,
          yieldUnitId,
          instructions: instructions || undefined,
          prepTimeMinutes: prepTimeMinutes || undefined,
          cookTimeMinutes: cookTimeMinutes || undefined,
          ingredients: validIngredients.map((ing) => ({
            stockItemId: ing.stockItemId,
            quantity: ing.quantity,
            unitId: ing.unitId,
            notes: ing.notes,
          })),
          subRecipes: validSubRecipes.length > 0
            ? validSubRecipes.map((sr) => ({
                childRecipeId: sr.childRecipeId,
                quantity: sr.quantity,
              }))
            : undefined,
        });

        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Recipe created successfully");
          if (result.data) {
            router.push(`/admin/restaurant/recipes/${result.data.id}`);
          }
          router.refresh();
        }
      }
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">
            {isEditMode ? "Recipe Details" : "Create New Recipe"}
          </h2>
          <p className="text-sm text-neutral-400">
            {isEditMode
              ? "Update recipe information, ingredients, and sub-recipes."
              : "Define a new recipe with ingredients and preparation details."}
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
              "Create Recipe"
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column - Basic Info */}
        <div className="lg:col-span-2 space-y-8">
          {/* Basic Information */}
          <Card className="bg-neutral-900/50 border-white/10">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-neutral-300">
                <ChefHat className="h-4 w-4 text-orange-500" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs text-neutral-500 uppercase tracking-widest">
                    Recipe Name
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Grilled Salmon with Herbs"
                    required
                    className="bg-neutral-900/30 border-white/10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="yield" className="text-xs text-neutral-500 uppercase tracking-widest">
                      Yield
                    </Label>
                    <Input
                      id="yield"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={recipeYield}
                      onChange={(e) => setRecipeYield(parseFloat(e.target.value) || 0)}
                      required
                      className="bg-neutral-900/30 border-white/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="yieldUnit" className="text-xs text-neutral-500 uppercase tracking-widest">
                      Unit
                    </Label>
                    <Select value={yieldUnitId} onValueChange={setYieldUnitId}>
                      <SelectTrigger className="bg-neutral-900/30 border-white/10">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.abbreviation}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-xs text-neutral-500 uppercase tracking-widest">
                  Description (Optional)
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the recipe..."
                  rows={2}
                  className="bg-neutral-900/30 border-white/10 resize-none"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="prepTime" className="text-xs text-neutral-500 uppercase tracking-widest flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Prep Time (min)
                  </Label>
                  <Input
                    id="prepTime"
                    type="number"
                    min="0"
                    value={prepTimeMinutes}
                    onChange={(e) => setPrepTimeMinutes(e.target.value ? parseInt(e.target.value) : "")}
                    placeholder="0"
                    className="bg-neutral-900/30 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cookTime" className="text-xs text-neutral-500 uppercase tracking-widest flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Cook Time (min)
                  </Label>
                  <Input
                    id="cookTime"
                    type="number"
                    min="0"
                    value={cookTimeMinutes}
                    onChange={(e) => setCookTimeMinutes(e.target.value ? parseInt(e.target.value) : "")}
                    placeholder="0"
                    className="bg-neutral-900/30 border-white/10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ingredients */}
          <Card className="bg-neutral-900/50 border-white/10">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-neutral-300">
                  <Package className="h-4 w-4 text-blue-500" />
                  Ingredients
                  {selectedIngredients.size > 0 && (
                    <span className="text-xs text-neutral-500">
                      ({selectedIngredients.size} selected)
                    </span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {selectedIngredients.size > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={removeSelectedIngredients}
                      className="h-8 gap-1 border-red-500/30 text-red-400 hover:bg-red-900/10 hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addIngredient}
                    className="h-8 gap-1 border-white/10 hover:bg-white/5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-white/10">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={selectedIngredients.size === ingredients.length && ingredients.length > 0}
                          onCheckedChange={toggleAllIngredients}
                          className="border-white/20"
                        />
                      </TableHead>
                      <TableHead className="text-xs text-neutral-500 uppercase tracking-widest">
                        Ingredient
                      </TableHead>
                      <TableHead className="w-[100px] text-xs text-neutral-500 uppercase tracking-widest">
                        Qty
                      </TableHead>
                      <TableHead className="w-[100px] text-xs text-neutral-500 uppercase tracking-widest">
                        Unit
                      </TableHead>
                      <TableHead className="text-xs text-neutral-500 uppercase tracking-widest">
                        Notes
                      </TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ingredients.map((ingredient, index) => (
                      <TableRow key={index} className="border-white/10 hover:bg-white/5">
                        <TableCell>
                          <Checkbox
                            checked={selectedIngredients.has(index)}
                            onCheckedChange={() => toggleIngredientSelection(index)}
                            className="border-white/20"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={ingredient.stockItemId}
                            onValueChange={(value) => updateIngredient(index, "stockItemId", value)}
                          >
                            <SelectTrigger className="bg-neutral-900/30 border-white/10 h-9 text-sm">
                              <SelectValue placeholder="Select ingredient" />
                            </SelectTrigger>
                            <SelectContent>
                              {stockItems.map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={ingredient.quantity || ""}
                            onChange={(e) => updateIngredient(index, "quantity", parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="bg-neutral-900/30 border-white/10 h-9 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={ingredient.unitId}
                            onValueChange={(value) => updateIngredient(index, "unitId", value)}
                          >
                            <SelectTrigger className="bg-neutral-900/30 border-white/10 h-9 text-sm">
                              <SelectValue placeholder="Unit" />
                            </SelectTrigger>
                            <SelectContent>
                              {units.map((unit) => (
                                <SelectItem key={unit.id} value={unit.id}>
                                  {unit.abbreviation}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={ingredient.notes || ""}
                            onChange={(e) => updateIngredient(index, "notes", e.target.value)}
                            placeholder="Notes"
                            className="bg-neutral-900/30 border-white/10 h-9 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeIngredient(index)}
                            disabled={ingredients.length === 1}
                            className="h-8 w-8 text-neutral-400 hover:text-red-400 hover:bg-red-900/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-neutral-500 mt-3">
                Select multiple ingredients using checkboxes to remove them in bulk.
              </p>
            </CardContent>
          </Card>

          {/* Sub-Recipes */}
          <Card className="bg-neutral-900/50 border-white/10">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-neutral-300">
                  <ChefHat className="h-4 w-4 text-purple-500" />
                  Sub-Recipes (Optional)
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSubRecipe}
                  disabled={filteredAvailableRecipes.length === 0}
                  className="h-8 gap-1 border-white/10 hover:bg-white/5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {subRecipes.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-4">
                  No sub-recipes added. Sub-recipes allow you to include other recipes as components.
                </p>
              ) : (
                subRecipes.map((subRecipe, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex-1 grid grid-cols-12 gap-2">
                      <div className="col-span-8">
                        <Select
                          value={subRecipe.childRecipeId}
                          onValueChange={(value) => updateSubRecipe(index, "childRecipeId", value)}
                        >
                          <SelectTrigger className="bg-neutral-900/30 border-white/10 h-9 text-sm">
                            <SelectValue placeholder="Select sub-recipe" />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredAvailableRecipes.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name} ({r.yield} {r.yieldUnit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-4">
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={subRecipe.quantity || ""}
                          onChange={(e) => updateSubRecipe(index, "quantity", parseFloat(e.target.value) || 0)}
                          placeholder="Portions"
                          className="bg-neutral-900/30 border-white/10 h-9 text-sm"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSubRecipe(index)}
                      className="h-9 w-9 text-neutral-400 hover:text-red-400 hover:bg-red-900/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
              {filteredAvailableRecipes.length === 0 && (
                <p className="text-xs text-neutral-500">
                  No other recipes available to add as sub-recipes.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card className="bg-neutral-900/50 border-white/10">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-neutral-300">
                Instructions (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Step-by-step preparation instructions..."
                rows={6}
                className="bg-neutral-900/30 border-white/10 resize-none"
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Cost Summary & Guide Cards */}
        <div className="space-y-6">
          {/* Guide Cards (Create Mode) */}
          {!isEditMode && (
            <>
              <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-orange-400">
                    <ChefHat className="h-4 w-4" />
                    Getting Started
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-neutral-400">
                  <p>Create a recipe by defining:</p>
                  <ul className="list-disc list-inside space-y-1 ml-1">
                    <li>A descriptive name</li>
                    <li>Yield (portions produced)</li>
                    <li>Required ingredients with quantities</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-blue-400">
                    <Package className="h-4 w-4" />
                    Ingredients Tips
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-neutral-400">
                  <p>For accurate costing:</p>
                  <ul className="list-disc list-inside space-y-1 ml-1">
                    <li>Use precise quantities</li>
                    <li>Select the correct unit of measure</li>
                    <li>Add notes for special prep (e.g., &quot;diced&quot;)</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-purple-400">
                    <ChefHat className="h-4 w-4" />
                    Sub-Recipes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-neutral-400">
                  <p>Use sub-recipes for:</p>
                  <ul className="list-disc list-inside space-y-1 ml-1">
                    <li>Sauces used in multiple dishes</li>
                    <li>Base preparations (stocks, doughs)</li>
                    <li>Compound ingredients</li>
                  </ul>
                  <p className="mt-2 text-neutral-500">
                    Costs are calculated automatically from sub-recipe ingredients.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-green-400">
                    <Calculator className="h-4 w-4" />
                    Cost Calculation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-neutral-400">
                  <p>After saving, the system will:</p>
                  <ul className="list-disc list-inside space-y-1 ml-1">
                    <li>Calculate total recipe cost</li>
                    <li>Compute cost per portion</li>
                    <li>Track food cost percentage</li>
                  </ul>
                  <p className="mt-2 text-neutral-500">
                    Costs update automatically when ingredient prices change.
                  </p>
                </CardContent>
              </Card>
            </>
          )}

          {/* Cost Calculation */}
          {isEditMode && (
            <Card className="bg-neutral-900/50 border-white/10">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-neutral-300">
                    <Calculator className="h-4 w-4 text-green-500" />
                    Cost Summary
                  </CardTitle>
                  {warehouseId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={calculateCost}
                      disabled={isCalculatingCost}
                      className="h-7 text-xs"
                    >
                      {isCalculatingCost ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Recalculate"
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!warehouseId ? (
                  <div className="flex items-center gap-2 text-sm text-yellow-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span>No kitchen warehouse configured</span>
                  </div>
                ) : isCalculatingCost ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
                  </div>
                ) : recipeCost ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-neutral-800/50 rounded-lg">
                        <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">
                          Total Cost
                        </p>
                        <p className="text-lg font-semibold text-green-400">
                          {formatCurrency(recipeCost.totalCost)}
                        </p>
                      </div>
                      <div className="p-3 bg-neutral-800/50 rounded-lg">
                        <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">
                          Per Portion
                        </p>
                        <p className="text-lg font-semibold text-green-400">
                          {formatCurrency(recipeCost.costPerPortion)}
                        </p>
                      </div>
                    </div>

                    {recipeCost.ingredientCosts.length > 0 && (
                      <div>
                        <p className="text-xs text-neutral-500 uppercase tracking-widest mb-2">
                          Ingredient Breakdown
                        </p>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {recipeCost.ingredientCosts.map((ing, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs py-1 border-b border-white/5"
                            >
                              <span className="text-neutral-400">
                                {ing.stockItemName}
                              </span>
                              <span className="text-neutral-300">
                                {formatCurrency(ing.totalCost)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {recipeCost.subRecipeCosts.length > 0 && (
                      <div>
                        <p className="text-xs text-neutral-500 uppercase tracking-widest mb-2">
                          Sub-Recipe Costs
                        </p>
                        <div className="space-y-1">
                          {recipeCost.subRecipeCosts.map((sr, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs py-1 border-b border-white/5"
                            >
                              <span className="text-neutral-400">
                                {sr.recipeName} (×{sr.quantity})
                              </span>
                              <span className="text-neutral-300">
                                {formatCurrency(sr.totalCost)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500 text-center py-4">
                    Save the recipe to calculate costs
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recipe Info (Edit Mode) */}
          {isEditMode && recipe && (
            <Card className="bg-neutral-900/50 border-white/10">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium text-neutral-300">
                  Recipe Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">Status</span>
                  <span className={recipe.isActive ? "text-green-400" : "text-neutral-400"}>
                    {recipe.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">Ingredients</span>
                  <span className="text-neutral-300">{ingredients.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">Sub-Recipes</span>
                  <span className="text-neutral-300">{subRecipes.length}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </form>
  );
}
