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
import { acknowledgePickup, getReadyItems } from "@/lib/pos/kitchen";
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
import { usePOSSocket } from "@/lib/socket";
import { ReadyForPickupDialog, ReadyItem } from "../pos/ready-for-pickup-dialog";

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
  
  // Socket.io for real-time sync
  const { emitTableUpdate, emitOrderUpdate, emitKitchenUpdate, onTableUpdate, onOrderUpdate, onTablesRefreshAll, onKitchenUpdate } = usePOSSocket(outletId);

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
  const [readyOrders, setReadyOrders] = React.useState<ReadyItem[]>([]);

  // Socket.io listeners for real-time sync
  React.useEffect(() => {
    // Initial fetch of ready items
    const fetchReadyItems = async () => {
        try {
            const items = await getReadyItems(outletId);
            if (items && items.length > 0) {
                console.log("Found existing ready items:", items);
                // Fix: map the server-side items to ReadyItem type to ensure compatibility
                setReadyOrders(prev => {
                    // Filter out duplicates
                    const newItems = items.filter(item => !prev.some(p => p.id === item.id));
                    return [...prev, ...newItems];
                });
            }
        } catch (error) {
            console.error("Failed to fetch ready items:", error);
        }
    };
    
    fetchReadyItems();

    const unsubTableUpdate = onTableUpdate((data) => {
      console.log("[Socket] Table update received:", data);
      router.refresh();
    });

    const unsubOrderUpdate = onOrderUpdate((data) => {
      console.log("[Socket] Order update received:", data);
      
      // If the current order was paid or voided, clear local state and return to tables
      if (currentOrder?.id === data.orderId && (data.action === "paid" || data.action === "voided")) {
        console.log("[Socket] Current order was settled, clearing state");
        setCurrentOrder(null);
        setSelectedTableId(null);
        setActiveTab("tables");
      }
      
      router.refresh();
    });

    const unsubRefreshAll = onTablesRefreshAll(() => {
      console.log("[Socket] Refresh all command received");
      router.refresh();
    });

    const unsubKitchenUpdate = onKitchenUpdate((data) => {
      console.log("[Socket] Kitchen update received:", data);
      
      if (data.action === "item_ready" && data.data) {
        console.log("[Socket] Valid item_ready event:", data.data);
        // data.data is the order item with order and table
        const item = data.data;
        // Transform to ReadyItem
        const readyItem: ReadyItem = {
           id: item.id,
           name: item.menuItem.name,
           quantity: item.quantity,
           tableNumber: item.order?.table?.number || null,
           orderNumber: item.order?.orderNumber || "Unknown",
           orderId: item.order?.id || ""
        };
        
        // Add to queue if not already there
        setReadyOrders(prev => {
           const exists = prev.find(i => i.id === readyItem.id);
           if (exists) {
             console.log("[Socket] Item already in ready queue:", readyItem.id);
             return prev;
           }
           console.log("[Socket] Adding item to ready queue:", readyItem);
           return [...prev, readyItem];
        });
      }
      
      router.refresh();
    });

    return () => {
      unsubTableUpdate();
      unsubOrderUpdate();
      unsubRefreshAll();
      unsubKitchenUpdate();
    };
  }, [onTableUpdate, onOrderUpdate, onTablesRefreshAll, onKitchenUpdate, router, currentOrder?.id, outletId]);

  // Fetch guests when dialog opens
  React.useEffect(() => {
    if (!isCustomerDialogOpen) return;
    
    let isMounted = true;
    
    searchCheckedInGuests()
      .then((guests) => {
        if (isMounted) setCheckedInGuests(guests);
      })
      .catch((error) => {
        console.error("Failed to fetch guests:", error);
        if (isMounted) setCheckedInGuests([]);
      });

    return () => { isMounted = false; };
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
         } else if ("data" in result && result.data) {
             const newItem = result.data;
             // Use order totals from backend for accurate VAT and service charge
             const totals = result.orderTotals;
             
             setCurrentOrder((prev) => {
                if (!prev) return prev;
                
                // Check if item already exists (merged by backend)
                const existingItemIndex = prev.items.findIndex(i => i.id === newItem.id);
                let newItems = [...prev.items];

                if (existingItemIndex >= 0) {
                    // Update existing item
                    newItems[existingItemIndex] = {
                        ...newItems[existingItemIndex],
                        quantity: newItem.quantity, // Backend returns total qty
                        unitPrice: Number(newItem.unitPrice),
                        modifiers: newItem.modifiers,
                        notes: newItem.notes
                    };
                } else {
                    // Add new item
                    newItems.push({
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
                    });
                }

                return {
                    ...prev,
                    items: newItems,
                    subtotal: totals?.subtotal || prev.subtotal,
                    taxAmount: totals?.taxAmount || prev.taxAmount,
                    serviceCharge: totals?.serviceCharge || prev.serviceCharge,
                    discountAmount: totals?.discountAmount || prev.discountAmount,
                    total: totals?.total || prev.total
                };
             });
             toast.success(`Added ${quantity}x ${pendingMenuItem.name}`);
             
             // Emit socket event for real-time sync
             emitOrderUpdate(orderIdToUse, "item_added", { menuItem: pendingMenuItem.name, quantity });
             
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
         } else if ("data" in result && result.data) {
             const newItem = result.data;
             // Use order totals from addOrderItem for accurate VAT and service charge
             const totals = result.orderTotals;
             const subtotal = totals?.subtotal ?? (newItem.quantity * Number(newItem.unitPrice));
             
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
                taxAmount: totals?.taxAmount ?? 0,
                serviceCharge: totals?.serviceCharge ?? 0,
                discountAmount: totals?.discountAmount ?? 0,
                total: totals?.total ?? subtotal,
             });
             toast.success(`Order created with ${quantity}x ${pendingMenuItem.name}`);
             
             // Emit socket events for real-time sync
             emitTableUpdate(selectedTableId, "OCCUPIED", orderResult.data.id);
             emitOrderUpdate(orderResult.data.id, "created", { orderNumber: orderResult.data.orderNumber });
             
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
      
      // Emit socket event for real-time sync
      emitOrderUpdate(currentOrder.id, "quantity_changed", { itemId, quantity });
      
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

      // Update local state first, then refresh
      const updatedItems = currentOrder.items.filter((item) => item.id !== itemId);
      
      if (updatedItems.length === 0) {
        setCurrentOrder(prev => prev ? { ...prev, items: [] } : null);
      } else {
        setCurrentOrder(prev => prev ? { ...prev, items: updatedItems } : null);
      }

      router.refresh();
      toast.success("Item removed");
      
      // Emit socket event for real-time sync
      emitOrderUpdate(currentOrder.id, "item_removed", { itemId });
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
      setCurrentOrder(prev => {
        if (!prev) return null;
        return {
           ...prev,
           status: result.data?.status || POSOrderStatus.SENT_TO_KITCHEN,
           items: prev.items.map(item => 
              item.status === "PENDING" || item.status === "OPEN" ? { ...item, status: "SENT" } : item
           )
        };
      });

      toast.success("Order sent to kitchen!");
      
      // Emit socket event for real-time sync
      emitOrderUpdate(currentOrder.id, "sent_to_kitchen");
      emitKitchenUpdate(currentOrder.id, "new_order", { orderNumber: currentOrder.orderNumber });
      
      router.refresh();
    } catch (error) {
      console.error("Send to kitchen error:", error);
      toast.error("Failed to send order to kitchen");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle customer assignment - move store update to success branch
  const handleAssignCustomer = async (customer: any) => {
    // Case 1: Existing Order (Assign to active order)
    if (currentOrder) {
        setIsLoading(true);
        try {
            const result = await assignCustomerToOrder(currentOrder.id, customer);
            
            if (result.error) {
                toast.error(result.error);
            } else {
                // Only update store on success
                assignCustomer(customer);
                toast.success("Customer assigned");
             
                // Update local state with customer name
                setCurrentOrder(prev => prev ? { ...prev, customerName: customer.name } : null);
                
                // Emit socket event for real-time sync
                emitOrderUpdate(currentOrder.id, "customer_assigned", { customerName: customer.name });

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
          
          // Emit socket events for real-time sync
          emitTableUpdate(selectedTableId, "OCCUPIED", result.data.id);
          emitOrderUpdate(result.data.id, "created", { orderNumber: result.data.orderNumber, customerName: customer.name });
          
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
                      onClick={() => {
                        let qty = parseInt(itemQuantity, 10);
                        if (Number.isNaN(qty) || qty < 0) qty = 1;
                        setItemQuantity(String(Math.max(1, qty - 1)));
                      }}
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
                      onClick={() => {
                        let qty = parseInt(itemQuantity, 10);
                        if (Number.isNaN(qty) || qty < 0) qty = 0;
                        setItemQuantity(String(qty + 1));
                      }}
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
      <ReadyForPickupDialog 
        readyItem={readyOrders.length > 0 ? readyOrders[0] : null}
        onClose={() => {
           // Do nothing for now
        }}
        onAcknowledge={async (itemId: string) => {
           // Call server action to update status to PICKED_UP
           try {
              // Find the item to get details for socket
              const item = readyOrders.find(i => i.id === itemId);
              
              const result = await acknowledgePickup(itemId);
              if (result.success) {
                  toast.success("Item picked up");
                  setReadyOrders(prev => prev.filter(i => i.id !== itemId));
                  
                  // Emit socket event to update KDS
                  if (item) {
                      emitKitchenUpdate(item.orderId, "item_picked_up", { itemId });
                  }
                  
                  router.refresh();
              } else {
                  toast.error(result.error || "Failed to acknowledge pickup");
              }
           } catch (error) {
              console.error("Acknowledge error:", error);
              toast.error("Failed to acknowledge");
           }
        }}
      />
    </div>
  );
}


