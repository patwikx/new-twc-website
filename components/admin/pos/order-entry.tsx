"use client";

import * as React from "react";
import { MenuGrid } from "./menu-grid";
import { OrderSummary } from "./order-summary";
import { TableGrid } from "./table-grid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { POSOrderStatus, POSTableStatus } from "@prisma/client";
import {
  createOrder,
  addOrderItem,
  removeOrderItem,
  updateOrderItemQuantity,
  sendToKitchen,
  assignCustomerToOrder
} from "@/lib/pos/order";
import { LayoutGrid, UtensilsCrossed, Loader2, Plus, Minus } from "lucide-react";
import { PaymentDialog } from "./payment-dialog";
import { searchCheckedInGuests, HotelGuest } from "@/lib/pos/guests";
import { DiscountDialog } from "./discount-dialog";
import { VoidDialog } from "./void-dialog";
import { CustomerAssignmentDialog } from "./customer-assignment-dialog";
import { 
  verifyManagerPin, 
  applyOrderDiscount, 
  getDiscountTypes 
} from "@/lib/pos/discount";
import { voidOrder, voidOrderItem } from "@/lib/pos/void";
import { usePOSStore } from "@/store/usePOSStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, PlayCircle } from "lucide-react";
import {
  MenuItemCategory,
  MenuItem,
  TableData,
  OrderItem,
  CurrentOrder,
} from "./types";
import { DiscountType } from "@prisma/client";



interface OrderEntryProps {
  propertyId: string;
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
  propertyId,
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
  const { 
    setShift, 
    activeShift,
    assignCustomer, 
  } = usePOSStore();

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

  // New Dialog States
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = React.useState(false);
  const [isVoidDialogOpen, setIsVoidDialogOpen] = React.useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = React.useState(false);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = React.useState(false);
  
  // Data States
  const [checkedInGuests, setCheckedInGuests] = React.useState<HotelGuest[]>([]);
  const [voidTarget, setVoidTarget] = React.useState<{ type: "order" | "item", itemId?: string, itemName?: string, amount: number } | null>(null);
  const [discountTypes, setDiscountTypes] = React.useState<DiscountType[]>([]);

  // Fetch guests when dialog opens
  React.useEffect(() => {
     if (isCustomerDialogOpen) {
         searchCheckedInGuests().then(setCheckedInGuests);
     }
  }, [isCustomerDialogOpen]);

  // Load discount types on mount
  // Load discount types on mount
  React.useEffect(() => {
    getDiscountTypes(propertyId)
      .then(setDiscountTypes)
      .catch((error) => {
        console.error("Failed to load discount types:", error);
        toast.error("Failed to load discount types");
      });
  }, [propertyId]);

  // Get selected table info
  const selectedTable = tables.find((t) => t.id === selectedTableId);

  // Handle table selection
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
      return;
    }

    // If table is available, open customer assignment dialog immediately without creating order
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
    if (!currentOrder) {
      toast.error("Please select a table and assign a customer first");
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
          menuItemImage: result.data.menuItem.imageUrl,
        };

        setCurrentOrder((prev) => {
          if (!prev) return prev;
          const items = [...prev.items, newItem];
          const subtotal = items.reduce(
            (sum, item) => sum + item.quantity * item.unitPrice,
            0
          );
          // Simplified calc - ideally fetch fresh order
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

  const handleQuantityChange = async (itemId: string, quantity: number) => {
    if (!currentOrder) return;

    if (quantity < 1) {
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

  const handleSendToKitchen = async () => {
    if (!currentOrder) return;

    setIsLoading(true);
    try {
      const result = await sendToKitchen(currentOrder.id);

      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        // Use returned order data to update full state including taxes
        setCurrentOrder((prev) => {
          if (!prev) return prev;
          const returnedOrder = result.data;
          return {
            ...prev,
            status: returnedOrder.status || "SENT_TO_KITCHEN",
            subtotal: returnedOrder.subtotal || prev.subtotal,
            taxAmount: returnedOrder.taxAmount || prev.taxAmount,
            serviceCharge: returnedOrder.serviceCharge || prev.serviceCharge,
            discountAmount: returnedOrder.discountAmount || prev.discountAmount,
            total: returnedOrder.total || prev.total,
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

  const handleSaveDraft = () => {
      // Just clear selection, the order items are already in DB (as PENDING)
      toast.success("Order saved as draft");
      setCurrentOrder(null);
      setSelectedTableId(null);
      setActiveTab("tables");
  };

  const handlePayment = () => {
    if (!currentOrder) return;
    setIsPaymentDialogOpen(true);
  };

  const handlePaymentComplete = () => {
      // Clear order state and return to tables
      setCurrentOrder(null);
      setSelectedTableId(null);
      setActiveTab("tables");
      router.refresh();
  };

  // Discount Handlers
  const handleDiscountRequest = async () => {
    if (!currentOrder) return;
    setIsDiscountDialogOpen(true);
  };

  const handleApplyDiscount = async (data: any) => {
    if (!currentOrder) return;
    setIsLoading(true);
    try {
      await applyOrderDiscount({
        orderId: currentOrder.id,
        ...data
      });
      toast.success("Discount applied");
      setIsDiscountDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error("Failed to apply discount");
    } finally {
      setIsLoading(false);
    }
  };

  // Void Handlers
  const handleVoidRequest = (target: { type: "order", amount: number } | { type: "item", itemId: string, itemName: string, amount: number }) => {
    setVoidTarget(target);
    setIsVoidDialogOpen(true);
  };

  const handleVoidConfirm = async (data: any) => {
    if (!currentOrder || !voidTarget) return;
    setIsLoading(true);
    try {
      if (voidTarget.type === "order") {
        await voidOrder({
          orderId: currentOrder.id,
          ...data
        });
        toast.success("Order voided");
        setCurrentOrder(null);
        setSelectedTableId(null);
        setActiveTab("tables");
      } else if (voidTarget.type === "item" && voidTarget.itemId) {
        await voidOrderItem({
          orderId: currentOrder.id,
          itemId: voidTarget.itemId,
          quantity: 1, 
          ...data
        });
        toast.success("Item voided");
        // Remove item from state or mark as cancelled
        setCurrentOrder(prev => {
            if (!prev) return null;
            return {
                ...prev,
                items: prev.items.filter(i => i.id !== voidTarget.itemId)
            };
        });
      }
      setIsVoidDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error("Failed to void");
    } finally {
      setIsLoading(false);
    }
  };

  // Customer Assignment Handler
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
            tableName: result.data.table?.number || null,
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

  // ... (keep useEffect and handlers)

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      {/* Left Panel - Tables/Menu */}
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
          customerName={currentOrder?.customerName}
          onQuantityChange={handleQuantityChange}
          onRemoveItem={handleRemoveItem}
          onSendToKitchen={handleSendToKitchen}
          onSaveDraft={handleSaveDraft}
          onPayment={handlePayment}
          isLoading={isLoading}
          onDiscount={handleDiscountRequest}
          onVoidOrder={() => currentOrder && handleVoidRequest({ type: "order", amount: currentOrder.total })}
          onVoidItem={currentOrder ? (id, name, amount) => handleVoidRequest({ type: "item", itemId: id, itemName: name, amount }) : undefined}
          onAssignCustomer={() => currentOrder && setIsCustomerDialogOpen(true)}
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
                    <div className="flex items-center gap-2 mb-2">
                        <Badge 
                            variant="secondary" 
                            className="bg-orange-500/20 text-orange-200 border-orange-500/30 hover:bg-orange-500/30 backdrop-blur-sm"
                        >
                            {pendingMenuItem.category.name}
                        </Badge>
                        {pendingMenuItem.availableServings !== undefined && pendingMenuItem.availableServings !== null && pendingMenuItem.availableServings <= 10 && (
                            <span className="text-xs text-amber-400 font-medium bg-black/60 px-2 py-0.5 rounded backdrop-blur-md">
                                {pendingMenuItem.availableServings} left
                            </span>
                        )}
                    </div>
                    <DialogTitle className="text-2xl font-bold text-white shadow-sm">
                        {pendingMenuItem.name}
                    </DialogTitle>
                    {pendingMenuItem.description && (
                        <p className="text-sm text-neutral-300 line-clamp-2 mt-1 shadow-sm">
                            {pendingMenuItem.description}
                        </p>
                    )}
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Quantity Control */}
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-neutral-300">Quantity</span>
                        <span className="text-xs text-neutral-500">How many servings?</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-full border-white/10 bg-transparent hover:bg-white/10 text-white"
                            onClick={() => {
                                const current = parseInt(itemQuantity) || 1;
                                setItemQuantity(Math.max(1, current - 1).toString());
                            }}
                        >
                            <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                            type="number"
                            min="1"
                            value={itemQuantity}
                            onChange={(e) => setItemQuantity(e.target.value)}
                            className="w-16 h-10 text-center bg-transparent border-none text-xl font-bold text-white focus-visible:ring-0 p-0"
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-full border-white/10 bg-transparent hover:bg-white/10 text-white"
                            onClick={() => {
                                const current = parseInt(itemQuantity) || 1;
                                setItemQuantity((current + 1).toString());
                            }}
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="notes" className="text-neutral-300">
                    Special Instructions <span className="text-neutral-500 font-normal">(Optional)</span>
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder="e.g., No onions, extra spicy, sauce on side..."
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.target.value)}
                    className="bg-neutral-800/50 border-white/10 resize-none min-h-[80px] focus:border-orange-500/50 focus:ring-orange-500/20"
                  />
                </div>

                <div className="pt-4 flex items-center gap-3">
                    <div className="flex-1">
                        <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Total Price</p>
                        <p className="text-2xl font-bold text-orange-400">
                             {new Intl.NumberFormat("en-PH", {
                                style: "currency",
                                currency: "PHP",
                              }).format(
                                pendingMenuItem.sellingPrice * (parseInt(itemQuantity) || 1)
                              )}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => setIsAddItemDialogOpen(false)}
                          className="text-neutral-400 hover:text-white hover:bg-white/5"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleAddItem}
                          disabled={isLoading}
                          className="bg-orange-600 hover:bg-orange-700 min-w-[120px]"
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
                    </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Payment Dialog */}
      {currentOrder && (
        <PaymentDialog 
            open={isPaymentDialogOpen}
            onOpenChange={setIsPaymentDialogOpen}
            orderId={currentOrder.id}
            totalAmount={currentOrder.total}
            customerName={currentOrder.customerName}
            onPaymentComplete={handlePaymentComplete}
        />
      )}

      {/* Discount Dialog */}
      <DiscountDialog 
        open={isDiscountDialogOpen}
        onOpenChange={setIsDiscountDialogOpen}
        discountTypes={discountTypes}
        orderSubtotal={currentOrder?.subtotal || 0}
        onApplyDiscount={handleApplyDiscount}
        onVerifyManagerPin={(pin) => verifyManagerPin(pin)}
      />

      {/* Void Dialog */}
      {voidTarget && (
        <VoidDialog
          open={isVoidDialogOpen}
          onOpenChange={setIsVoidDialogOpen}
          voidType={voidTarget.type}
          itemName={voidTarget.type === 'item' ? voidTarget.itemName : undefined}
          amount={voidTarget.amount}
          onVoid={handleVoidConfirm}
          onVerifyManagerPin={(pin) => verifyManagerPin(pin)}
        />
      )}

      {/* Customer Assignment Dialog */}
      <CustomerAssignmentDialog
        open={isCustomerDialogOpen}
        onOpenChange={setIsCustomerDialogOpen}
        tableNumber={selectedTable?.number || ""}
        onAssign={handleAssignCustomer}
        checkedInGuests={checkedInGuests}
        onSearchGuests={searchCheckedInGuests}
      />
    </div>
  );
}
