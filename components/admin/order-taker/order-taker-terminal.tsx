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
  addOrderItem, 
  createOrder,
  removeOrderItem, 
  sendToKitchen, 
  updateOrderItemQuantity,
  assignCustomerToOrder
} from "@/lib/pos/order";
import { POSTableStatus, POSOrderStatus } from "@prisma/client";
import { CustomerAssignmentDialog } from "../pos/customer-assignment-dialog";
import { searchCheckedInGuests, HotelGuest } from "@/lib/pos/guests";
import { cn } from "@/lib/utils";
import { usePOSStore } from "@/store/usePOSStore";

// Types matching OrderEntry
interface MenuItemCategory {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  category: MenuItemCategory;
  sellingPrice: number;
  isAvailable: boolean;
  unavailableReason: string | null;
  imageUrl?: string | null;
  availableServings?: number | null;
}

interface OrderItem {
  id: string;
  menuItemId: string;
  menuItemName: string;
  menuItemCategory: string;
  quantity: number;
  unitPrice: number;
  modifiers: string | null;
  notes: string | null;
  status: string;
  menuItemImage?: string | null;
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
    subtotal: number;
    taxAmount: number;
    serviceCharge: number;
    discountAmount: number;
    createdAt: Date;
    customerName?: string | null;
    serverName?: string | null;
    items: OrderItem[];
  }[];
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
  customerName?: string | null;
}

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
        <WaiterOrderSummary
          orderId={currentOrder?.id || null}
          orderNumber={currentOrder?.orderNumber || null}
          orderStatus={currentOrder?.status || null}
          tableName={currentOrder?.tableName || tables.find(t=>t.id===selectedTableId)?.number || null}
          serverName={currentOrder?.serverName || serverName}
          items={currentOrder?.items || []}
          subtotal={currentOrder?.subtotal || 0}
          taxAmount={currentOrder?.taxAmount || 0}
          serviceCharge={currentOrder?.serviceCharge || 0}
          total={currentOrder?.total || 0}
          customerName={currentOrder?.customerName}
          onQuantityChange={handleQuantityChange}
          onRemoveItem={handleRemoveItem}
          onSendToKitchen={handleSendToKitchen}
          onAssignCustomer={() => setIsCustomerDialogOpen(true)}
          isLoading={isLoading}
          formatCurrency={formatCurrency}
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

// ----------------------------------------------------------------------------
// Simplified Order Summary (Visual clone of OrderSummary)
// ----------------------------------------------------------------------------
interface WaiterOrderSummaryProps {
  orderId: string | null;
  orderNumber: string | null;
  orderStatus: POSOrderStatus | null;
  tableName: string | null;
  serverName: string | null;
  items: OrderItem[];
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  total: number;
  customerName?: string | null;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onSendToKitchen: () => void;
  onAssignCustomer: () => void;
  isLoading: boolean;
  formatCurrency: (value: number) => string;
}

const STATUS_COLORS: Record<POSOrderStatus, string> = {
  OPEN: "bg-blue-500 text-blue-100",
  SENT_TO_KITCHEN: "bg-orange-500 text-orange-100",
  IN_PROGRESS: "bg-yellow-500 text-yellow-900",
  READY: "bg-green-500 text-green-100",
  SERVED: "bg-purple-500 text-purple-100",
  PAID: "bg-emerald-500 text-emerald-100",
  CANCELLED: "bg-red-500 text-red-100",
  VOID: "bg-neutral-500 text-neutral-100",
  CLOSED: "bg-gray-500 text-gray-100",
} as any;

function WaiterOrderSummary({
  orderId,
  orderNumber,
  orderStatus,
  tableName,
  serverName,
  items,
  subtotal,
  taxAmount,
  serviceCharge,
  total,
  customerName,
  onQuantityChange,
  onRemoveItem,
  onSendToKitchen,
  onAssignCustomer,
  isLoading,
  formatCurrency,
}: WaiterOrderSummaryProps) {
  const activeStatuses = ["OPEN", "SENT_TO_KITCHEN", "IN_PROGRESS", "READY", "SERVED"];
  const canModifyItems = !orderStatus || activeStatuses.includes(orderStatus);
  // Allow sending if there are pending items
  const pendingItems = items.filter((item) => item.status === "PENDING" || item.status === "OPEN"); 
  const sentItems = items.filter((item) => item.status !== "PENDING" && item.status !== "OPEN");
  const canSendToKitchen = (!orderStatus || activeStatuses.includes(orderStatus)) && pendingItems.length > 0;

  return (
    <Card className="flex flex-col h-full bg-neutral-900 border-l border-white/5 shadow-none rounded-none">
      {/* Header - Compact */}
      <div className="px-3 py-2 border-b border-white/5 space-y-1.5">
        <div className="flex items-center justify-between">
            <div>
               <p className="text-[9px] uppercase text-neutral-500 font-semibold tracking-wider">Current Order</p>
                {orderNumber ? (
                  <div className="flex items-baseline gap-2">
                      <h3 className="font-mono text-lg text-white font-medium tracking-tight">#{orderNumber.split('-').pop()}</h3>
                      {orderStatus && (
                        <span className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded font-medium uppercase bg-opacity-10", 
                            STATUS_COLORS[orderStatus]?.replace("bg-", "bg-opacity-10 bg-").replace("border-", "border-opacity-0 ") || "text-neutral-400"
                        )}>
                            {orderStatus.replace("_", " ")}
                        </span>
                      )}
                  </div>
                ) : (
                  <h3 className="font-medium text-neutral-400 text-sm">New Order</h3>
                )}
            </div>
        </div>

        <div className="flex items-center justify-between text-xs bg-white/5 p-2 rounded-md border border-white/5">
            <div className="flex items-center gap-1.5">
                <span className="text-neutral-500">Table</span>
                <span className="text-white font-medium">{tableName || "—"}</span>
            </div>
            <div className="h-3 w-px bg-white/10 mx-2" />
            <div className="flex items-center gap-1.5">
                <span className="text-neutral-500">Guest</span>
                {customerName ? (
                    <span className="text-orange-400 font-medium truncate max-w-[100px]">{customerName}</span>
                ) : (
                    <button 
                        onClick={onAssignCustomer}
                        className="text-orange-400 hover:text-orange-300 hover:underline transition-colors"
                    >
                        + Add
                    </button>
                )}
            </div>
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 text-neutral-500 space-y-3">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-neutral-600" />
            </div>
            <p className="text-sm">No items added yet</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {/* All items in a single list - pending items first, then sent items */}
            {pendingItems.map((item) => (
                <WaiterOrderItemRow
                    key={item.id}
                    item={item}
                    canModify={canModifyItems}
                    onQuantityChange={onQuantityChange}
                    onRemove={onRemoveItem}
                    formatCurrency={formatCurrency}
                />
            ))}
            {sentItems.map((item) => (
                <WaiterOrderItemRow
                    key={item.id}
                    item={item}
                    canModify={false}
                    onQuantityChange={onQuantityChange}
                    onRemove={onRemoveItem}
                    formatCurrency={formatCurrency}
                />
            ))}
          </div>
        )}
      </div>

      {/* Footer Section */}
      <div className="bg-neutral-900 border-t border-white/10 p-4 space-y-4">
        {/* Breakdown */}
        <div className="space-y-1 text-sm">
            {taxAmount > 0 && (
                <div className="flex justify-between text-neutral-500">
                    <span>VAT</span>
                    <span>{formatCurrency(taxAmount)}</span>
                </div>
            )}
            {serviceCharge > 0 && (
                <div className="flex justify-between text-neutral-500">
                    <span>Service Charge</span>
                    <span>{formatCurrency(serviceCharge)}</span>
                </div>
            )}
            <div className="flex justify-between items-end pt-2 mt-2 border-t border-white/5">
                <span className="text-neutral-400 font-medium">Total</span>
                <span className="text-2xl font-bold text-white">{formatCurrency(total)}</span>
            </div>
        </div>

        {/* Actions - SIMPLIFIED: No Pay/Discount/Void */}
        <div className="space-y-3">
            {/* Primary Action: Send to Kitchen */}
            {canSendToKitchen && (
                <Button
                    size="lg"
                    className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-md"
                    onClick={onSendToKitchen}
                    disabled={isLoading}
                >
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 mr-2" />}
                    Place Order ({pendingItems.length})
                </Button>
            )}
        </div>
      </div>
    </Card>
  );
}

interface WaiterOrderItemRowProps {
  item: OrderItem;
  canModify: boolean;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
  formatCurrency: (value: number) => string;
}

function WaiterOrderItemRow({
  item,
  canModify,
  onQuantityChange,
  onRemove,
  formatCurrency,
}: WaiterOrderItemRowProps) {
  const lineTotal = item.quantity * item.unitPrice;

  return (
    <div className="flex gap-3 p-2 items-center hover:bg-white/5 transition-colors group relative border-b border-white/5 last:border-0">
       {/* 1. Image (Left) */}
       {item.menuItemImage ? (
           <div className="h-10 w-10 rounded-lg overflow-hidden bg-neutral-800 border border-white/5 flex-shrink-0">
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img 
                  src={item.menuItemImage} 
                  alt={item.menuItemName}
                  className="h-full w-full object-cover"
               />
           </div>
       ) : (
           <div className="h-10 w-10 rounded-lg bg-neutral-800/50 border border-white/5 flex items-center justify-center flex-shrink-0">
               <span className="text-xs text-neutral-600 font-medium">IMG</span>
           </div>
       )}

       {/* 2. Details (Center) */}
       <div className="flex-1 min-w-0 pr-2 flex flex-col justify-center">
            <div className="flex flex-col">
                <div className="flex justify-between items-start gap-2">
                    <span className="text-sm font-semibold text-white leading-tight">
                        {item.menuItemName}
                    </span>
                </div>
                
                <div className="flex flex-col gap-0.5 mt-0.5">
                    <span className="text-sm font-bold text-white">
                        {formatCurrency(lineTotal)}
                    </span>
                    <div className="text-xs text-neutral-500 font-medium">
                        {item.quantity > 1 && (
                            <span className="whitespace-nowrap bg-white/5 px-1.5 py-0.5 rounded text-[10px] text-neutral-400">
                                {item.quantity} x {formatCurrency(item.unitPrice)}
                            </span>
                        )}
                        {item.modifiers && (
                            <div className="mt-0.5">
                                <span className="text-neutral-400">{item.modifiers}</span>
                            </div>
                        )}
                    </div>
                </div>

                {item.notes && (
                    <div className="mt-1 text-xs text-orange-400/90 italic truncate">
                        "{item.notes}"
                    </div>
                )}
            </div>
       </div>

       {/* 3. Actions (Right Side) */}
       <div className="flex items-center gap-2 pl-2">
            {/* Stepper */}
            <div className="flex items-center bg-neutral-800 rounded-lg border border-white/10 overflow-hidden h-8 shadow-sm shrink-0">
               {canModify ? (
                   <>
                    <button
                        className="h-full w-8 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-colors border-r border-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={() => onQuantityChange(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                    >
                        <Minus className="h-3 w-3" />
                    </button>
                    <div className="h-full w-7 flex items-center justify-center text-sm font-bold text-white bg-neutral-900/50">
                        {item.quantity}
                    </div>
                    <button
                        className="h-full w-8 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-colors border-l border-white/5"
                        onClick={() => onQuantityChange(item.id, item.quantity + 1)}
                    >
                        <Plus className="h-3 w-3" />
                    </button>
                   </>
               ) : (
                    <div className="h-full w-8 flex items-center justify-center text-sm font-bold text-white bg-neutral-800/50 px-2">
                        {item.quantity}
                    </div>
               )}
            </div>

            {/* Trash Button */}
            {canModify && (
                <button 
                    onClick={() => onRemove(item.id)}
                    className="h-10 w-10 flex-shrink-0 flex items-center justify-center text-neutral-500 hover:text-white hover:bg-red-500 rounded-lg transition-all border border-white/5 hover:border-red-500/50 bg-neutral-800/50"
                    title="Remove Item"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            )}
       </div>
    </div>
  );
}
