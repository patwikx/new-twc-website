"use client";

import * as React from "react";
import { MenuGrid } from "./menu-grid";
import { OrderSummary } from "./order-summary";
import { TableGrid } from "./table-grid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { POSOrderStatus, POSTableStatus, MenuCategory } from "@prisma/client";
import {
  createOrder,
  addOrderItem,
  removeOrderItem,
  updateOrderItemQuantity,
  sendToKitchen,
} from "@/lib/pos/order";
import { LayoutGrid, UtensilsCrossed, Loader2 } from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  category: MenuCategory;
  sellingPrice: number;
  isAvailable: boolean;
  unavailableReason: string | null;
}

interface TableData {
  id: string;
  number: string;
  capacity: number;
  status: POSTableStatus;
  positionX: number | null;
  positionY: number | null;
  orders: {
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    createdAt: Date;
  }[];
}

interface OrderItem {
  id: string;
  menuItemId: string;
  menuItemName: string;
  menuItemCategory: MenuCategory;
  quantity: number;
  unitPrice: number;
  modifiers: string | null;
  notes: string | null;
  status: string;
}

interface CurrentOrder {
  id: string;
  orderNumber: string;
  status: POSOrderStatus;
  tableId: string | null;
  tableName: string | null;
  serverName: string | null;
  items: OrderItem[];
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  discountAmount: number;
  total: number;
}

interface OrderEntryProps {
  outletId: string;
  outletName: string;
  tables: TableData[];
  menuItems: MenuItem[];
  serverId: string;
  serverName: string;
  initialOrder?: CurrentOrder | null;
  onPaymentRequest?: (orderId: string) => void;
}

export function OrderEntry({
  outletId,
  outletName,
  tables,
  menuItems,
  serverId,
  serverName,
  initialOrder,
  onPaymentRequest,
}: OrderEntryProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<string>("tables");
  const [selectedTableId, setSelectedTableId] = React.useState<string | null>(
    initialOrder?.tableId || null
  );
  const [currentOrder, setCurrentOrder] = React.useState<CurrentOrder | null>(
    initialOrder || null
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = React.useState(false);
  const [pendingMenuItem, setPendingMenuItem] = React.useState<MenuItem | null>(null);
  const [itemQuantity, setItemQuantity] = React.useState("1");
  const [itemNotes, setItemNotes] = React.useState("");

  // Get selected table info
  const selectedTable = tables.find((t) => t.id === selectedTableId);

  // Handle table selection
  const handleTableSelect = async (tableId: string) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    // If table has an active order, load it
    if (table.orders.length > 0 && table.status === "OCCUPIED") {
      // In a real app, we'd fetch the full order details here
      toast.info(`Table ${table.number} has an active order`);
      setSelectedTableId(tableId);
      setActiveTab("menu");
      return;
    }

    // If table is available, create a new order
    if (table.status === "AVAILABLE") {
      setIsLoading(true);
      try {
        const result = await createOrder({
          outletId,
          serverId,
          tableId,
        });

        if (result.error) {
          toast.error(result.error);
        } else if (result.data) {
          setCurrentOrder({
            id: result.data.id,
            orderNumber: result.data.orderNumber,
            status: result.data.status,
            tableId: result.data.tableId,
            tableName: result.data.table?.number || null,
            serverName: result.data.server?.name || serverName,
            items: [],
            subtotal: 0,
            taxAmount: 0,
            serviceCharge: 0,
            discountAmount: 0,
            total: 0,
          });
          setSelectedTableId(tableId);
          setActiveTab("menu");
          toast.success(`Order created for Table ${table.number}`);
          router.refresh();
        }
      } catch {
        toast.error("Failed to create order");
      } finally {
        setIsLoading(false);
      }
    } else {
      toast.info(`Table ${table.number} is ${table.status.toLowerCase().replace("_", " ")}`);
    }
  };

  // Handle menu item selection
  const handleMenuItemSelect = (item: MenuItem) => {
    if (!currentOrder) {
      toast.error("Please select a table first");
      setActiveTab("tables");
      return;
    }

    setPendingMenuItem(item);
    setItemQuantity("1");
    setItemNotes("");
    setIsAddItemDialogOpen(true);
  };

  // Add item to order
  const handleAddItem = async () => {
    if (!currentOrder || !pendingMenuItem) return;

    const qty = parseInt(itemQuantity);
    if (isNaN(qty) || qty < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }

    setIsLoading(true);
    try {
      const result = await addOrderItem({
        orderId: currentOrder.id,
        menuItemId: pendingMenuItem.id,
        quantity: qty,
        notes: itemNotes || undefined,
      });

      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        // Add item to local state
        const newItem: OrderItem = {
          id: result.data.id,
          menuItemId: result.data.menuItemId,
          menuItemName: result.data.menuItem.name,
          menuItemCategory: result.data.menuItem.category,
          quantity: result.data.quantity,
          unitPrice: Number(result.data.unitPrice),
          modifiers: result.data.modifiers,
          notes: result.data.notes,
          status: result.data.status,
        };

        setCurrentOrder((prev) => {
          if (!prev) return prev;
          const items = [...prev.items, newItem];
          const subtotal = items.reduce(
            (sum, item) => sum + item.quantity * item.unitPrice,
            0
          );
          return {
            ...prev,
            items,
            subtotal,
            total: subtotal + prev.taxAmount + prev.serviceCharge - prev.discountAmount,
          };
        });

        toast.success(`Added ${pendingMenuItem.name}`);
        setIsAddItemDialogOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("Failed to add item");
    } finally {
      setIsLoading(false);
    }
  };

  // Update item quantity
  const handleQuantityChange = async (itemId: string, quantity: number) => {
    if (!currentOrder) return;

    if (quantity < 1) {
      // Remove item if quantity is 0
      handleRemoveItem(itemId);
      return;
    }

    setIsLoading(true);
    try {
      const result = await updateOrderItemQuantity(currentOrder.id, itemId, quantity);

      if (result.error) {
        toast.error(result.error);
      } else {
        setCurrentOrder((prev) => {
          if (!prev) return prev;
          const items = prev.items.map((item) =>
            item.id === itemId ? { ...item, quantity } : item
          );
          const subtotal = items.reduce(
            (sum, item) => sum + item.quantity * item.unitPrice,
            0
          );
          return {
            ...prev,
            items,
            subtotal,
            total: subtotal + prev.taxAmount + prev.serviceCharge - prev.discountAmount,
          };
        });
        router.refresh();
      }
    } catch {
      toast.error("Failed to update quantity");
    } finally {
      setIsLoading(false);
    }
  };

  // Remove item from order
  const handleRemoveItem = async (itemId: string) => {
    if (!currentOrder) return;

    setIsLoading(true);
    try {
      const result = await removeOrderItem(currentOrder.id, itemId);

      if (result.error) {
        toast.error(result.error);
      } else {
        setCurrentOrder((prev) => {
          if (!prev) return prev;
          const items = prev.items.filter((item) => item.id !== itemId);
          const subtotal = items.reduce(
            (sum, item) => sum + item.quantity * item.unitPrice,
            0
          );
          return {
            ...prev,
            items,
            subtotal,
            total: subtotal + prev.taxAmount + prev.serviceCharge - prev.discountAmount,
          };
        });
        toast.success("Item removed");
        router.refresh();
      }
    } catch {
      toast.error("Failed to remove item");
    } finally {
      setIsLoading(false);
    }
  };

  // Send order to kitchen
  const handleSendToKitchen = async () => {
    if (!currentOrder) return;

    setIsLoading(true);
    try {
      const result = await sendToKitchen(currentOrder.id);

      if (result.error) {
        toast.error(result.error);
      } else {
        setCurrentOrder((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: "SENT_TO_KITCHEN",
            items: prev.items.map((item) =>
              item.status === "PENDING" ? { ...item, status: "SENT" } : item
            ),
          };
        });
        toast.success("Order sent to kitchen");
        router.refresh();
      }
    } catch {
      toast.error("Failed to send to kitchen");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle payment request
  const handlePayment = () => {
    if (!currentOrder) return;

    if (onPaymentRequest) {
      onPaymentRequest(currentOrder.id);
    }
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      {/* Left Panel - Tables/Menu */}
      <div className="flex-1 flex flex-col min-w-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 bg-neutral-900 border border-white/10">
            <TabsTrigger
              value="tables"
              className="data-[state=active]:bg-orange-600 data-[state=active]:text-white"
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              Tables
            </TabsTrigger>
            <TabsTrigger
              value="menu"
              className="data-[state=active]:bg-orange-600 data-[state=active]:text-white"
            >
              <UtensilsCrossed className="h-4 w-4 mr-2" />
              Menu
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tables" className="flex-1 mt-4">
            <TableGrid
              tables={tables}
              outletId={outletId}
              outletName={outletName}
              onTableSelect={handleTableSelect}
              selectedTableId={selectedTableId}
            />
          </TabsContent>

          <TabsContent value="menu" className="flex-1 mt-4 overflow-hidden">
            <MenuGrid
              menuItems={menuItems}
              onItemSelect={handleMenuItemSelect}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Right Panel - Order Summary */}
      <div className="w-96 flex-shrink-0">
        <OrderSummary
          orderId={currentOrder?.id || null}
          orderNumber={currentOrder?.orderNumber || null}
          orderStatus={currentOrder?.status || null}
          tableName={currentOrder?.tableName || selectedTable?.number || null}
          serverName={currentOrder?.serverName || serverName}
          items={currentOrder?.items || []}
          subtotal={currentOrder?.subtotal || 0}
          taxAmount={currentOrder?.taxAmount || 0}
          serviceCharge={currentOrder?.serviceCharge || 0}
          discountAmount={currentOrder?.discountAmount || 0}
          total={currentOrder?.total || 0}
          onQuantityChange={handleQuantityChange}
          onRemoveItem={handleRemoveItem}
          onSendToKitchen={handleSendToKitchen}
          onPayment={handlePayment}
          isLoading={isLoading}
        />
      </div>

      {/* Add Item Dialog */}
      <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
        <DialogContent className="bg-neutral-900 border-white/10">
          <DialogHeader>
            <DialogTitle>Add to Order</DialogTitle>
            <DialogDescription>
              {pendingMenuItem?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={itemQuantity}
                onChange={(e) => setItemQuantity(e.target.value)}
                className="bg-neutral-800 border-white/10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Special Instructions (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="e.g., No onions, extra spicy..."
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                className="bg-neutral-800 border-white/10 resize-none"
                rows={2}
              />
            </div>

            {pendingMenuItem && (
              <div className="flex justify-between items-center pt-2 border-t border-white/10">
                <span className="text-neutral-400">Line Total</span>
                <span className="text-lg font-bold text-green-400">
                  {new Intl.NumberFormat("en-PH", {
                    style: "currency",
                    currency: "PHP",
                  }).format(
                    pendingMenuItem.sellingPrice * (parseInt(itemQuantity) || 1)
                  )}
                </span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsAddItemDialogOpen(false)}
              className="text-neutral-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddItem}
              disabled={isLoading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add to Order"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
