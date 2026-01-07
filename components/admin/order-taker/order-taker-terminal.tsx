"use client";

import * as React from "react";
import { MenuGrid } from "../pos/menu-grid";
import { TableGrid } from "../pos/table-grid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  LayoutGrid, 
  UtensilsCrossed, 
  Minus, 
  Plus, 
  Loader2,
  Trash2,
  ChefHat,
  Send,
  UserPlus
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  createOrder,
  addOrderItem,
  removeOrderItem,
  updateOrderItemQuantity,
  sendToKitchen,
  assignCustomerToOrder
} from "@/lib/pos/order";
import { OrderSummary } from "@/components/admin/pos/order-summary";
import { 
  CurrentOrder, 
  MenuItem, 
  MenuItemCategory, 
  OrderItem, 
  TableData 
} from "@/components/admin/pos/types";
import { POSTableStatus, POSOrderStatus } from "@prisma/client";
import { CustomerAssignmentDialog } from "../pos/customer-assignment-dialog";
import { searchCheckedInGuests, HotelGuest } from "@/lib/pos/guests";
import { cn } from "@/lib/utils";
import { usePOSStore } from "@/store/usePOSStore";

// Types matching OrderEntry


interface OrderTakerTerminalProps {
  outletId: string;
  outletName: string;
  tables: TableData[];
  menuItems: MenuItem[];
  serverId: string;
  serverName: string;
  checkedInGuests?: HotelGuest[];
}

export function OrderTakerTerminal({
  outletId,
  outletName,
  tables,
  menuItems,
  serverId,
  serverName,
  checkedInGuests: initialGuests = [],
}: OrderTakerTerminalProps) {
  const router = useRouter();
  const { assignCustomer } = usePOSStore();

  const [activeTab, setActiveTab] = React.useState<string>("tables");
  const [selectedTableId, setSelectedTableId] = React.useState<string | null>(null);
  const [currentOrder, setCurrentOrder] = React.useState<CurrentOrder | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = React.useState(false);
  const [pendingMenuItem, setPendingMenuItem] = React.useState<MenuItem | null>(null);
  const [itemQuantity, setItemQuantity] = React.useState("1");
  const [itemNotes, setItemNotes] = React.useState("");
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = React.useState(false);
  const [checkedInGuests, setCheckedInGuests] = React.useState<HotelGuest[]>(initialGuests);

  // Fetch guests when dialog opens
  React.useEffect(() => {
    if (isCustomerDialogOpen) {
      searchCheckedInGuests().then(setCheckedInGuests);
    }
  }, [isCustomerDialogOpen]);

  // Handle table selection - EXACT match of OrderEntry logic
  const handleTableSelect = async (tableId: string) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    // If table has an active order, load it
    if (table.orders.length > 0 && table.status === "OCCUPIED") {
      const activeOrder = table.orders[0];
      
      setCurrentOrder({
        id: activeOrder.id,
        orderNumber: activeOrder.orderNumber,
        status: activeOrder.status as POSOrderStatus,
        tableId: table.id,
        tableName: table.number,
        serverName: activeOrder.serverName || serverName,
        items: activeOrder.items,
        subtotal: activeOrder.subtotal,
        taxAmount: activeOrder.taxAmount,
        serviceCharge: activeOrder.serviceCharge,
        discountAmount: activeOrder.discountAmount,
        total: activeOrder.total,
        customerName: activeOrder.customerName,
      });

      setSelectedTableId(tableId);
      // Switch to menu tab
      setActiveTab("menu");
      return;
    }

    // If table is available, open customer assignment dialog immediately
    if (table.status === "AVAILABLE") {
       setSelectedTableId(tableId);
       // Clear any previous order state
       setCurrentOrder(null);
       setIsCustomerDialogOpen(true);
       return;
    }
  };

  // Handle menu item selection
  const handleMenuItemSelect = (item: MenuItem) => {
    // If no order is active and no table selected, can't add items
    if (!currentOrder && !selectedTableId) {
      toast.error("Please select a table first");
      setActiveTab("tables");
      return;
    }

    if (!item.isAvailable) {
      toast.error(`${item.name} is not available: ${item.unavailableReason || "Out of stock"}`);
      return;
    }
    setPendingMenuItem(item);
    setItemQuantity("1");
    setItemNotes("");
    setIsAddItemDialogOpen(true);
  };

  // Add item to order
  const handleAddItem = async () => {
    if (!pendingMenuItem) return;

    setIsLoading(true);
    try {
      const quantity = parseInt(itemQuantity) || 1;

      // Logic branch: Add to existing order OR create new one + add
      const orderIdToUse = currentOrder?.id;
      
      if (orderIdToUse) {
         // ADD TO EXISTING
         const result = await addOrderItem({
            orderId: orderIdToUse,
            menuItemId: pendingMenuItem.id,
            quantity,
            notes: itemNotes || undefined,
         });

         if (result.error) {
            toast.error(result.error);
         } else if (result.data) {
             const newItem = result.data;
             // Update local state
             setCurrentOrder((prev) => {
                if (!prev) return prev;
                // Simple recalculation for UI responsiveness
                const items = [...prev.items, {
                    id: newItem.id,
                    menuItemId: newItem.menuItemId,
                    menuItemName: newItem.menuItem.name,
                    menuItemCategory: newItem.menuItem.category?.name || "Uncategorized",
                    quantity: newItem.quantity,
                    unitPrice: Number(newItem.unitPrice),
                    modifiers: newItem.modifiers,
                    notes: newItem.notes,
                    status: newItem.status,
                    menuItemImage: newItem.menuItem.imageUrl
                }];
                const subtotal = items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
                return {
                    ...prev,
                    items,
                    subtotal,
                    // Rough total update, server refresh will fix exact tax/service
                    total: subtotal + prev.taxAmount + prev.serviceCharge - prev.discountAmount
                };
             });
             toast.success(`Added ${quantity}x ${pendingMenuItem.name}`);
             router.refresh();
         }
      } else if (selectedTableId) {
         // Create order first (if we have a table but no order yet - e.g. skipped guest assign)
         const orderResult = await createOrder({
            outletId,
            serverId,
            tableId: selectedTableId,
         });

         if (orderResult.error || !orderResult.data) {
            toast.error(orderResult.error || "Failed to create order");
            return;
         }

         // Then add item
         const result = await addOrderItem({
            orderId: orderResult.data.id,
            menuItemId: pendingMenuItem.id,
            quantity,
            notes: itemNotes || undefined,
         });

         if (result.error) {
            toast.error(result.error);
         } else if (result.data) {
             const newItem = result.data;
             const subtotal = newItem.quantity * Number(newItem.unitPrice);
             
             setCurrentOrder({
                id: orderResult.data.id,
                orderNumber: orderResult.data.orderNumber,
                status: orderResult.data.status,
                tableId: selectedTableId,
                tableName: tables.find(t => t.id === selectedTableId)?.number || null,
                serverName,
                items: [{
                    id: newItem.id,
                    menuItemId: newItem.menuItemId,
                    menuItemName: newItem.menuItem.name,
                    menuItemCategory: newItem.menuItem.category?.name || "Uncategorized",
                    quantity: newItem.quantity,
                    unitPrice: Number(newItem.unitPrice),
                    modifiers: newItem.modifiers,
                    notes: newItem.notes,
                    status: newItem.status,
                    menuItemImage: newItem.menuItem.imageUrl
                }],
                subtotal,
                taxAmount: Number(orderResult.data.taxAmount) || 0,
                serviceCharge: Number(orderResult.data.serviceCharge) || 0,
                discountAmount: 0,
                total: Number(orderResult.data.total) || subtotal,
             });
             toast.success(`Order created with ${quantity}x ${pendingMenuItem.name}`);
             router.refresh();
         }
      }

    } catch (error) {
      console.error("Add item error:", error);
      toast.error("Failed to add item");
    } finally {
      setIsLoading(false);
      setIsAddItemDialogOpen(false);
      setPendingMenuItem(null);
    }
  };

  // Handle quantity change
  const handleQuantityChange = async (itemId: string, quantity: number) => {
    if (!currentOrder) return;
    if (quantity < 1) return;

    setIsLoading(true);
    try {
      const result = await updateOrderItemQuantity(currentOrder.id, itemId, quantity);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.data) {
        // Update the item in local state
        setCurrentOrder((prev) => {
          if (!prev) return prev;
          const items = prev.items.map((item) => 
            item.id === itemId 
              ? { ...item, quantity: result.data.quantity }
              : item
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
      }
      
      router.refresh();
    } catch (error) {
      console.error("Quantity change error:", error);
      toast.error("Failed to update quantity");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle remove item
  const handleRemoveItem = async (itemId: string) => {
    if (!currentOrder) return;

    setIsLoading(true);
    try {
      const result = await removeOrderItem(currentOrder.id, itemId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      // Update local state
      router.refresh();
      const updatedItems = currentOrder.items.filter((item) => item.id !== itemId);
      
      if (updatedItems.length === 0) {
        // If order empty? Keep order but empty items
        setCurrentOrder(prev => prev ? { ...prev, items: [] } : null);
      } else {
        setCurrentOrder(prev => prev ? { ...prev, items: updatedItems } : null);
      }

      toast.success("Item removed");
    } catch (error) {
      console.error("Remove item error:", error);
      toast.error("Failed to remove item");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle send to kitchen
  const handleSendToKitchen = async () => {
    if (!currentOrder) return;

    setIsLoading(true);
    try {
      const result = await sendToKitchen(currentOrder.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      
      // Manually update local state to reflect changes immediately
      // (Backend transaction returns order before items are updated, so items in result might be stale)
      setCurrentOrder(prev => {
        if (!prev) return null;
        return {
           ...prev,
           status: result.data?.status || "SENT_TO_KITCHEN",
           items: prev.items.map(item => 
              item.status === "PENDING" ? { ...item, status: "SENT" } : item
           )
        };
      });

      toast.success("Order sent to kitchen!");
      router.refresh();
    } catch (error) {
      console.error("Send to kitchen error:", error);
      toast.error("Failed to send order to kitchen");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle customer assignment - EXACT Copy of OrderEntry logic
  const handleAssignCustomer = async (customer: any) => {
    // Case 1: Existing Order (Assign to active order)
    if (currentOrder) {
        setIsLoading(true);
        try {
            assignCustomer(customer); // Update Store
            const result = await assignCustomerToOrder(currentOrder.id, customer);
            
            if (result.error) {
                toast.error(result.error);
            } else {
                 toast.success("Customer assigned");
             
             // Update local state with customer name
             setCurrentOrder(prev => prev ? { ...prev, customerName: customer.name } : null);

             setIsCustomerDialogOpen(false);
             router.refresh();
            }
        } catch (error) {
            toast.error("Failed to assign customer");
        } finally {
            setIsLoading(false);
        }
        return;
    }

    // Case 2: New Order (Create order THEN assign/create with details)
    if (!selectedTableId) {
        toast.error("No table selected");
        return; 
    }

    setIsLoading(true);
    try {
        // Prepare notes for walk-in if needed
        let initialNotes = undefined;
        let bookingId = undefined;
        let guestId = undefined;

        if (customer.type === "WALKIN") {
             const notePrefix = "Customer: ";
             initialNotes = `${notePrefix}${customer.name}${customer.phone ? ` (${customer.phone})` : ""}`;
        } else if (customer.type === "HOTEL_GUEST") {
            bookingId = customer.bookingId;
            guestId = customer.guestId;
        }

        const result = await createOrder({
          outletId,
          serverId,
          tableId: selectedTableId,
          notes: initialNotes,
          bookingId,
          guestId
        });

        if (result.error) {
          toast.error(result.error);
        } else if (result.data) {
          // Update Store
          assignCustomer(customer);

          setCurrentOrder({
            id: result.data.id,
            orderNumber: result.data.orderNumber,
            status: result.data.status,
            tableId: result.data.tableId,
            tableName: tables.find(t => t.id === selectedTableId)?.number || null,
            serverName: result.data.server?.name || serverName,
            items: [],
            subtotal: 0,
            taxAmount: 0,
            serviceCharge: 0,
            discountAmount: 0,
            total: 0,
            customerName: customer.name,
          });
          
          toast.success(`Order created for Table`);
          setIsCustomerDialogOpen(false);
          setActiveTab("menu"); 
          router.refresh(); 
        }
    } catch (error) {
        toast.error("Failed to create order");
    } finally {
        setIsLoading(false);
    }
  };

  // Currency formatter
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Count pending items
  const pendingItemsCount = currentOrder?.items.filter((i) => i.status === "PENDING").length || 0;

  return (
    <div className="flex gap-4 h-[calc(100vh-180px)]">
      {/* Left Panel - Tables & Menu */}
      <div className="flex-1 flex flex-col min-w-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
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

          <TabsContent value="menu" className="flex-1 mt-4 overflow-hidden min-h-0 flex flex-col">
            <MenuGrid menuItems={menuItems} onItemSelect={handleMenuItemSelect} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Right Panel - Waiter Order Summary (Visual Match of OrderSummary) */}
      <div className="w-96 flex-shrink-0">
        <OrderSummary
          orderId={currentOrder?.id || null}
          orderNumber={currentOrder?.orderNumber || null}
          orderStatus={currentOrder?.status || null}
          tableName={currentOrder?.tableName || tables.find(t=>t.id===selectedTableId)?.number || null}
          serverName={currentOrder?.serverName || serverName}
          items={currentOrder?.items || []}
          subtotal={currentOrder?.subtotal || 0}
          taxAmount={currentOrder?.taxAmount || 0}
          serviceCharge={currentOrder?.serviceCharge || 0}
          discountAmount={currentOrder?.discountAmount || 0}
          total={currentOrder?.total || 0}
          customerName={currentOrder?.customerName}
          onQuantityChange={handleQuantityChange}
          onRemoveItem={handleRemoveItem}
          onSendToKitchen={handleSendToKitchen}
          onAssignCustomer={() => setIsCustomerDialogOpen(true)}
          isLoading={isLoading}
        />
      </div>

      {/* Add Item Dialog */}
      <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 gap-0 bg-neutral-900 border-white/10 overflow-hidden">
          {pendingMenuItem && (
            <>
              {/* Image Banner */}
              <div className="relative h-56 w-full bg-neutral-800">
                {pendingMenuItem.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pendingMenuItem.imageUrl}
                    alt={pendingMenuItem.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-700">
                    <UtensilsCrossed className="h-16 w-16" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-transparent to-transparent opacity-90" />
                
                <div className="absolute bottom-4 left-6 right-6">
                  <Badge 
                    variant="secondary" 
                    className="bg-orange-500/20 text-orange-200 border-orange-500/30 mb-2"
                  >
                    {pendingMenuItem.category.name}
                  </Badge>
                  <DialogTitle className="text-2xl font-bold text-white">
                    {pendingMenuItem.name}
                  </DialogTitle>
                  <DialogDescription className="text-neutral-300 mt-1">
                    {formatCurrency(pendingMenuItem.sellingPrice)}
                  </DialogDescription>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* Quantity */}
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setItemQuantity(String(Math.max(1, parseInt(itemQuantity) - 1)))}
                      className="border-white/10"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
                      className="w-20 text-center bg-neutral-800 border-white/10"
                      min="1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setItemQuantity(String(parseInt(itemQuantity) + 1))}
                      className="border-white/10"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <span className="text-lg font-semibold text-orange-400 ml-auto">
                      {formatCurrency(pendingMenuItem.sellingPrice * (parseInt(itemQuantity) || 1))}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Special Instructions</Label>
                  <Textarea
                    placeholder="e.g., No onions, extra spicy..."
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.target.value)}
                    className="bg-neutral-800 border-white/10 resize-none"
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter className="p-6 pt-0">
                <Button
                  variant="ghost"
                  onClick={() => setIsAddItemDialogOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddItem}
                  disabled={isLoading}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Add to Order
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Customer Assignment Dialog */}
      <CustomerAssignmentDialog
        open={isCustomerDialogOpen}
        onOpenChange={(open) => {
            setIsCustomerDialogOpen(open);
            // If closed without action, checking activeTab to decide if switch back?
            // OrderEntry doesn't do anything special here.
        }}
        tableNumber={tables.find(t=>t.id===selectedTableId)?.number || ""}
        checkedInGuests={checkedInGuests}
        onAssign={handleAssignCustomer}
      />
    </div>
  );
}


