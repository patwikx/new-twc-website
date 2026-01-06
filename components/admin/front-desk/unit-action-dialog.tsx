"use client";

import * as React from "react";
import { format, differenceInDays, addDays } from "date-fns";
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, User as UserIcon, Calendar as CalendarIcon, DollarSign, LogOut, CheckCircle, AlertCircle, Sparkles, ArrowRightLeft,
  Pencil, Printer, Trash2, Plus, Check, ChevronsUpDown
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { 
  checkInBooking, createWalkIn, getBookingFinancials, addCharge, addPayment, checkOutUnit, updateUnitStatus, transferRoom,
  updateGuestDetails, extendStay, voidCharge, voidPayment, verifySupervisorCredentials
} from "@/actions/admin/front-desk";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FileUpload, UploadedFileDisplay } from "@/components/file-upload";

const CHARGE_TYPES = ["Extra Bed", "Extra Person", "Early Check-in", "Late Check-out", "Breakfast", "Minibar", "Laundry", "Damages", "Other"];

interface UnitActionDialogProps {
  unit: any; 
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  unassignedBookings: any[];
  roomPrice: number; 
  propertyRates: { taxRate: number; serviceChargeRate: number };
  allRooms: any[];
  currentUserRole?: string | null;
  staffMembers?: any[];
}

export function UnitActionDialog({ 
  unit, isOpen, onOpenChange, unassignedBookings, roomPrice, propertyRates, allRooms, currentUserRole, staffMembers = []
}: UnitActionDialogProps) {
  const [activeTab, setActiveTab] = React.useState("check-in");
  const [loading, setLoading] = React.useState(false);
  
  // Walk-in State
  // Walk-in State
  const [walkInGuest, setWalkInGuest] = React.useState({ name: "", email: "", phone: "", address: "" });
  const [idScans, setIdScans] = React.useState<{ url: string; name: string }[]>([]);
  const [walkInCheckIn, setWalkInCheckIn] = React.useState<Date>(new Date());
  const [walkInCheckOut, setWalkInCheckOut] = React.useState<Date>(addDays(new Date(), 1));
  const [processingBookingId, setProcessingBookingId] = React.useState<string | null>(null);
  
  // Walk-in Financials
  const [addChargeAmount, setAddChargeAmount] = React.useState(0);
  const [addChargeType, setAddChargeType] = React.useState("");
  const [openChargeType, setOpenChargeType] = React.useState(false);
  
  const [initialPayment, setInitialPayment] = React.useState(0);
  const [initialPaymentMethod, setInitialPaymentMethod] = React.useState("CASH");
  const [initialPaymentRef, setInitialPaymentRef] = React.useState("");

  // Manage State (Folio)
  const [activeBooking, setActiveBooking] = React.useState<any>(null);
  const [folioLoading, setFolioLoading] = React.useState(false);
  
  // Charge/Payment Inputs
  const [chargeAmount, setChargeAmount] = React.useState("");
  const [chargeDesc, setChargeDesc] = React.useState("");
  const [openManageCharge, setOpenManageCharge] = React.useState(false);
  const [chargeRemarks, setChargeRemarks] = React.useState("");
  const [payAmount, setPayAmount] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState("CASH");
  const [paymentRef, setPaymentRef] = React.useState("");

  // Checkout Confirmation
  const [showCheckoutDialog, setShowCheckoutDialog] = React.useState(false);

  // Check-In Confirmation
  const [confirmCheckInOpen, setConfirmCheckInOpen] = React.useState(false);
  const [selectedCheckInBookingId, setSelectedCheckInBookingId] = React.useState<string | null>(null);

  // Room Transfer State
  const [showTransferDialog, setShowTransferDialog] = React.useState(false);
  const [transferTargetId, setTransferTargetId] = React.useState("");
  const [transferReason, setTransferReason] = React.useState("");

  // New Features State
  const [editGuestOpen, setEditGuestOpen] = React.useState(false);
  const [guestEditData, setGuestEditData] = React.useState({ firstName: "", lastName: "", email: "", phone: "", specialRequests: "" });
  const [extendStayOpen, setExtendStayOpen] = React.useState(false);
  const [showExtendConfirmDialog, setShowExtendConfirmDialog] = React.useState(false);
  const [newCheckOutDate, setNewCheckOutDate] = React.useState<Date | undefined>(undefined);
  const [housekeepingNote, setHousekeepingNote] = React.useState("");

  // Void / Supervisor Auth State
  const [voidConfirmOpen, setVoidConfirmOpen] = React.useState(false);
  const [supervisorAuthOpen, setSupervisorAuthOpen] = React.useState(false);
  const [voidTarget, setVoidTarget] = React.useState<{ id: string, type: 'CHARGE' | 'PAYMENT' } | null>(null);
  const [supervisorCreds, setSupervisorCreds] = React.useState({ identifier: "", password: "" });
  const [supervisorAuthAction, setSupervisorAuthAction] = React.useState<'VOID' | 'CHECKOUT' | null>(null);
  
  // Staff Selection State
  const [openStaffSelect, setOpenStaffSelect] = React.useState(false);
  


  // Calculation Helpers
  const nights = Math.max(1, differenceInDays(walkInCheckOut, walkInCheckIn));
  const roomTotal = roomPrice * nights;
  const taxAmount = roomTotal * propertyRates.taxRate;
  const serviceCharge = roomTotal * propertyRates.serviceChargeRate;
  const grandTotal = roomTotal + taxAmount + serviceCharge + addChargeAmount;

  // Determine Default Tab based on Unit Status
  React.useEffect(() => {
    if (unit?.status === 'OCCUPIED') setActiveTab("manage");
    else if (unit?.status === 'DIRTY') setActiveTab("housekeeping");
    else setActiveTab("check-in");
  }, [unit]);

  // Reset state when unit changes or dialog closes
  React.useEffect(() => {
    setActiveBooking(null);
    setFolioLoading(false);
    // Reset other temporary states if needed
    setChargeAmount("");
    setPayAmount("");
  }, [unit?.id, isOpen]);

  // Fetch active booking data when opening "Manage" tab
  React.useEffect(() => {
    // Only fetch if we don't already have the CORRECT booking loaded (to prevent loop if we set it)
    // Actually, just checking activeBooking is null is enough if we reset it above.
    if (activeTab === "manage" && unit?.status === 'OCCUPIED' && unit?.bookingItems?.length > 0) {
      const activeItem = unit.bookingItems[0];
      if (activeItem?.bookingId) {
        setFolioLoading(true);
        // Clear previous booking immediately to avoid flash of old data
        setActiveBooking(null); 
        
        getBookingFinancials(activeItem.bookingId)
          .then(data => setActiveBooking(data))
          .catch(e => {
             console.error("Failed to load folio:", e);
             toast.error("Failed to load booking details");
          })
          .finally(() => setFolioLoading(false));
      }
    }
  }, [activeTab, unit]);

  if (!unit) return null;

  const handleCheckIn = (bookingItemId: string) => {
      setSelectedCheckInBookingId(bookingItemId);
      setConfirmCheckInOpen(true);
  };

  const executeCheckIn = async () => {
    if (!selectedCheckInBookingId) return;
    setLoading(true);
    try {
      await checkInBooking(selectedCheckInBookingId, unit.id);
      toast.success("Guest checked in successfully.");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to check in.");
    } finally {
      setLoading(false);
      setConfirmCheckInOpen(false);
      setSelectedCheckInBookingId(null);
    }
  };

  const handleProcessArrival = (bookingItem: any) => {
     setProcessingBookingId(bookingItem.id);
     setWalkInGuest({
        name: `${bookingItem.booking.guestFirstName} ${bookingItem.booking.guestLastName}`,
        email: bookingItem.booking.guestEmail,
        phone: bookingItem.booking.guestPhone || "",
        address: "" 
     });
     setWalkInCheckIn(new Date(bookingItem.checkIn));
     setWalkInCheckOut(new Date(bookingItem.checkOut));
     setInitialPayment(0); // Reset or set to balance if needed
     setActiveTab("walk-in");
  };

  const handleWalkIn = async () => {
    setLoading(true);
    try {
      if (processingBookingId) {
          await checkInBooking(processingBookingId, unit.id, {
             guestPhone: walkInGuest.phone,
             guestAddress: walkInGuest.address,
             idScans: idScans.map(s => s.url),
             initialPayment: initialPayment,
             initialPaymentMethod: initialPaymentMethod,
             initialPaymentRef: initialPaymentRef
          });
          toast.success("Online booking checked in successfully.");
      } else {
          await createWalkIn({
            propertyId: unit.roomType.propertyId,
            roomTypeId: unit.roomTypeId,
            unitId: unit.id,
            guestName: walkInGuest.name,
            guestEmail: walkInGuest.email,
            guestPhone: walkInGuest.phone,
            guestAddress: walkInGuest.address,
            idScans: idScans.map(s => s.url),
            checkInDate: walkInCheckIn,
            checkOutDate: walkInCheckOut,
            pricePerNight: roomPrice,
            initialPayment,
            initialPaymentMethod,
            initialPaymentRef,
            additionalChargeAmount: addChargeAmount > 0 ? addChargeAmount : undefined,
            additionalChargeDesc: addChargeAmount > 0 ? (addChargeType || "Additional Charge") : undefined
          });
          toast.success("Walk-in completed successfully.");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(processingBookingId ? "Failed to check in booking." : "Failed to create walk-in.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCharge = async () => {
    if (!activeBooking || !chargeAmount) return;
    setFolioLoading(true);
    try {
      // Combine description and remarks
      const fullDescription = chargeRemarks 
        ? `${chargeDesc || "Additional Charge"} - ${chargeRemarks}`
        : chargeDesc || "Additional Charge";
      
      await addCharge(activeBooking.id, Number(chargeAmount), fullDescription);
      const updated = await getBookingFinancials(activeBooking.id);
      setActiveBooking(updated);
      setChargeAmount("");
      setChargeDesc("");
      setChargeRemarks("");
      toast.success("Charge Added");
    } finally {
      setFolioLoading(false);
    }
  };

  const handleAddPayment = async () => {
    if (!activeBooking || !payAmount) return;
    setFolioLoading(true);
    try {
      await addPayment(activeBooking.id, Number(payAmount), paymentMethod, paymentRef || undefined);
      const updated = await getBookingFinancials(activeBooking.id);
      setActiveBooking(updated);
      setPayAmount("");
      setPaymentRef("");
      toast.success("Payment Recorded");
    } finally {
      setFolioLoading(false);
    }
  };

  const executeCheckOut = async () => {
    if (!activeBooking) return;

    setLoading(true);
    setShowCheckoutDialog(false);
    try {
      await checkOutUnit(activeBooking.id, unit.id);
      toast.success("Checked Out. Unit is now Dirty.");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const initiateCheckOut = () => {
      if (Number(activeBooking?.amountDue) > 0) {
          // Require Supervisor Override
          setSupervisorAuthAction('CHECKOUT');
          setSupervisorCreds({ identifier: "", password: "" });
          setSupervisorAuthOpen(true);
      } else {
          executeCheckOut();
      }
  };

  const handleTransfer = async () => {
    if (!activeBooking || !transferTargetId) return;

    setLoading(true);
    try {
      // Find the booking item for this unit
      const bookingItem = activeBooking.items.find((i: any) => i.roomUnitId === unit.id);
      if (!bookingItem) {
        toast.error("Could not find current room assignment");
        return;
      }

      const result = await transferRoom({
        bookingItemId: bookingItem.id,
        fromUnitId: unit.id,
        toUnitId: transferTargetId,
        reason: transferReason
      });

      if (result.success) {
        toast.success(`Guest transferred to ${result.toRoom} #${result.toUnit}`);
        onOpenChange(false); // Close dialog as the unit has changed
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to transfer guest");
    } finally {
      setLoading(false);
      setShowTransferDialog(false);
    }
  };

  const handleUpdateGuest = async () => {
    if (!activeBooking) return;
    setLoading(true);
    try {
      await updateGuestDetails(activeBooking.id, guestEditData);
      toast.success("Guest details updated");
      setEditGuestOpen(false);
      const updated = await getBookingFinancials(activeBooking.id);
      setActiveBooking(updated);
    } catch (error) {
      toast.error("Failed to update guest");
    } finally {
      setLoading(false);
    }
  };

  const handleExtendStay = async () => {
    if (!activeBooking || !newCheckOutDate) return;
    setLoading(true);
    try {
      await extendStay(activeBooking.id, newCheckOutDate);
      toast.success("Stay extended");
      setExtendStayOpen(false);
      const updated = await getBookingFinancials(activeBooking.id);
      setActiveBooking(updated);
    } catch (error: any) {
      toast.error(error.message || "Failed to extend stay");
    } finally {
      setLoading(false);
    }
  };

  const executeVoidCharge = async (adjustmentId: string) => {
    // Confirmation handled by dialog
    setFolioLoading(true);
    try {
      await voidCharge(activeBooking.id, adjustmentId);
      toast.success("Charge voided");
      const updated = await getBookingFinancials(activeBooking.id);
      setActiveBooking(updated);
    } catch (error) {
      toast.error("Failed to void charge");
    } finally {
      setFolioLoading(false);
    }
  };

  const executeVoidPayment = async (paymentId: string) => {
    // Confirmation handled by dialog
    setFolioLoading(true);
    try {
      await voidPayment(activeBooking.id, paymentId);
      toast.success("Payment voided");
      const updated = await getBookingFinancials(activeBooking.id);
      setActiveBooking(updated);
    } catch (error) {
       toast.error("Failed to void payment");
    } finally {
      setFolioLoading(false);
    }
  };

  const handlePrintInvoice = () => {
    // Escape HTML to prevent XSS
    const escapeHtml = (unsafe: string | number | null | undefined) => {
      if (unsafe === null || unsafe === undefined) return "";
      return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
    };

    const formatCurrency = (amount: number | string) => {
       return Number(amount).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    };

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const { shortRef, guestFirstName, guestLastName, totalAmount, amountPaid, amountDue, items, adjustments } = activeBooking;

      const itemsHtml = items.map((i: any) => 
        `<tr>
           <td>Room Charge - ${escapeHtml(i.room.name)} (${escapeHtml(i.guests)} pax)</td>
           <td>${escapeHtml(formatCurrency(i.pricePerNight))}</td>
         </tr>`
      ).join('');

      const adjustmentsHtml = adjustments.map((a: any) => {
         const description = escapeHtml(a.description);
         const amount = escapeHtml(formatCurrency(a.amount));
         const voidIndicator = a.isVoided ? ` <span style="font-size: 0.8em; color: #ff0000;">(VOID)</span>` : "";
         
         const descStyle = a.isVoided ? "text-decoration: line-through; color: #999;" : "";
         const amtStyle = a.isVoided ? "text-decoration: line-through; color: #999;" : "";

         return `<tr>
           <td style="${descStyle}">${description}${voidIndicator}</td>
           <td style="${amtStyle}">${amount}</td>
         </tr>`;
      }).join('');

      printWindow.document.write(`
        <html>
          <head>
            <title>Invoice - ${escapeHtml(shortRef)}</title>
            <style>
              body { font-family: sans-serif; padding: 20px; color: #000; }
              .header { text-align: center; margin-bottom: 30px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              .total { margin-top: 20px; text-align: right; font-weight: bold; }
              .status-void { color: red; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Invoice</h1>
              <p>Booking Ref: ${escapeHtml(shortRef)}</p>
              <p>Guest: ${escapeHtml(guestFirstName)} ${escapeHtml(guestLastName)}</p>
            </div>
            <table>
              <thead><tr><th>Description</th><th>Amount</th></tr></thead>
              <tbody>
                ${itemsHtml}
                ${adjustmentsHtml}
              </tbody>
            </table>
            <div class="total">
              <p>Total: ${escapeHtml(formatCurrency(totalAmount))}</p>
              <p>Paid: ${escapeHtml(formatCurrency(amountPaid))}</p>
              <p>Balance Due: ${escapeHtml(formatCurrency(amountDue))}</p>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const handleHousekeeping = async (status: 'CLEAN' | 'MAINTENANCE') => {
    setLoading(true);
    try {
      await updateUnitStatus(unit.id, status, housekeepingNote);
      toast.success(`Unit marked as ${status}`);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const initiateVoid = (id: string, type: 'CHARGE' | 'PAYMENT') => {
     setVoidTarget({ id, type });
     setChargeRemarks(""); 
     // Always require supervisor authentication for voiding
     setSupervisorAuthAction('VOID');
     setSupervisorCreds({ identifier: "", password: "" });
     setSupervisorAuthOpen(true);
  };

  const handleSupervisorVerify = async () => {
    if (!supervisorCreds.identifier || !supervisorCreds.password) {
       toast.error("Please enter credentials");
       return;
    }
    setLoading(true);

    try {
      const result = await verifySupervisorCredentials({ 
          identifier: supervisorCreds.identifier,
          password: supervisorCreds.password 
      });
      
      if (result.success) {
         toast.success(`Verified: ${result.supervisorName}`);
         setSupervisorAuthOpen(false);
         
         // Perform Action
         if (supervisorAuthAction === 'VOID') {
             setVoidConfirmOpen(true);
         } else if (supervisorAuthAction === 'CHECKOUT') {
             setShowCheckoutDialog(false); // Close the confirm dialog if open
             executeCheckOut();
         }
      } else {
         toast.error(result.message || "Verification failed");
      }
    } catch (error) {
       toast.error("An error occurred during verification");
    } finally {
       setLoading(false);
    }
  };

  const confirmVoid = async () => {
     if (!voidTarget) return;
     setLoading(true);
     try {
        if (voidTarget.type === 'CHARGE') {
           await executeVoidCharge(voidTarget.id);
        } else {
           await executeVoidPayment(voidTarget.id);
        }
        setVoidConfirmOpen(false);
        setVoidTarget(null);
        toast.success("Transaction voided successfully");
     } finally {
        setLoading(false);
     }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] bg-neutral-950 border-white/10 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
           <DialogTitle className="text-xl flex items-center gap-2">
              Unit {unit.number}
              <Badge variant="outline" className={`
                 ${unit.status === 'CLEAN' ? 'text-green-400 border-green-500/30' : 
                   unit.status === 'OCCUPIED' ? 'text-orange-400 border-orange-500/30' : 
                   'text-neutral-400 border-white/10'}
              `}>
                {unit.status}
              </Badge>
           </DialogTitle>
           <DialogDescription>
             {unit.roomType.name}
           </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
           <TabsList className="w-full grid grid-cols-4 bg-neutral-900/50">
             <TabsTrigger value="check-in" disabled={unit.status !== 'CLEAN'}>Check In</TabsTrigger>
             <TabsTrigger value="walk-in" disabled={unit.status !== 'CLEAN'}>Walk In</TabsTrigger>
             <TabsTrigger value="manage" disabled={unit.status !== 'OCCUPIED'}>Manage</TabsTrigger>
             <TabsTrigger value="housekeeping">Status</TabsTrigger>
           </TabsList>

           {/* --- TAB: CHECK IN --- */}
           <TabsContent value="check-in" className="space-y-4 pt-4">
              {unit.status !== 'CLEAN' && (
                  <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg flex items-center gap-3 mb-4">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      <div>
                          <p className="text-red-400 font-medium">Unit is not Clean</p>
                          <p className="text-red-400/80 text-xs">This unit must be marked as CLEAN before checking in guests.</p>
                      </div>
                      <Button size="sm" variant="outline" className="ml-auto border-red-500/20 text-red-400 hover:bg-red-500/10" onClick={() => setActiveTab("housekeeping")}>
                          Go to Status
                      </Button>
                  </div>
              )}

              {/* 1. Unit Arrivals (Confirmed bookings assigned to this unit) */}
              {unit.bookingItems && unit.bookingItems.filter((b: any) => b.booking.status === 'CONFIRMED').length > 0 && (
                  <div className="space-y-2 mb-6">
                     <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest px-1">Expected Today</h4>
                     {unit.bookingItems.filter((b: any) => b.booking.status === 'CONFIRMED').map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10 transition">
                            <div>
                               <p className="font-medium text-white">{item.booking.guestFirstName} {item.booking.guestLastName}</p>
                               <div className="flex items-center gap-2 text-xs text-neutral-400 mt-1">
                                  <Badge variant="secondary" className="bg-orange-500/20 text-orange-400 border-0 h-5 px-1.5 text-[10px]">
                                     {item.booking.shortRef}
                                  </Badge>
                                  <span>{format(new Date(item.checkIn), "MMM d")} - {format(new Date(item.checkOut), "MMM d")}</span>
                               </div>
                            </div>
                            <Button 
                               size="sm" 
                               className="bg-white text-black hover:bg-neutral-200 font-medium"
                               onClick={() => handleProcessArrival(item)}
                            >
                               Process Check-In
                            </Button>
                        </div>
                     ))}
                  </div>
              )}

              {/* 2. Unassigned Bookings (General Pool) */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest px-1">Unassigned Bookings</h4>
                {unassignedBookings.filter(b => b.roomId === unit.roomTypeId).length === 0 ? (
                    <div className="text-center py-6 text-neutral-500 text-sm border border-dashed border-white/10 rounded-lg">
                        No unassigned bookings available.
                    </div>
                ) : (
                    unassignedBookings.filter(b => b.roomId === unit.roomTypeId).map(item => (
                        <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition">
                            <div>
                                <p className="font-medium text-white">{item.booking.guestFirstName} {item.booking.guestLastName}</p>
                                <div className="flex items-center gap-2 text-xs text-neutral-400 mt-1">
                                    <span className="font-mono">{item.booking.shortRef}</span>
                                    <span>•</span>
                                    <span>{format(new Date(item.checkIn), "MMM d")} - {format(new Date(item.checkOut), "MMM d")}</span>
                                </div>
                            </div>
                            <Button 
                                size="sm" 
                                variant="secondary"
                                onClick={() => handleCheckIn(item.id)}
                            >
                                Assign
                            </Button>
                        </div>
                    ))
                )}
              </div>

           </TabsContent>

           {/* --- TAB: WALK IN --- */}
           <TabsContent value="walk-in" className="space-y-4 pt-4">
              <div className="grid gap-4">
                 {/* Guest Info */}
                 <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <Label>Guest Name <span className="text-red-500">*</span></Label>
                          <Input 
                            placeholder="John Doe" 
                            value={walkInGuest.name}
                            onChange={e => setWalkInGuest({...walkInGuest, name: e.target.value})}
                            className="bg-neutral-900 border-white/10"
                           />
                       </div>
                       <div className="space-y-2">
                          <Label>Email</Label>
                          <Input 
                            placeholder="john@example.com" 
                            value={walkInGuest.email} 
                            onChange={e => setWalkInGuest({...walkInGuest, email: e.target.value})}
                            className="bg-neutral-900 border-white/10"
                          />
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <Label>Phone <span className="text-red-500">*</span></Label>
                          <Input 
                            placeholder="+63 9XX XXX XXXX" 
                            value={walkInGuest.phone} 
                            onChange={e => setWalkInGuest({...walkInGuest, phone: e.target.value})}
                            className="bg-neutral-900 border-white/10"
                          />
                       </div>
                       <div className="space-y-2">
                          <Label>Address</Label>
                          <Input 
                            placeholder="City, Province" 
                            value={walkInGuest.address} 
                            onChange={e => setWalkInGuest({...walkInGuest, address: e.target.value})}
                            className="bg-neutral-900 border-white/10"
                          />
                       </div>
                    </div>

                       <div className="space-y-2">
                          <Label>ID Scan / Documents</Label>
                          <div className="grid grid-cols-2 gap-3 h-24">
                             {idScans.map((scan, idx) => (
                                <UploadedFileDisplay 
                                   key={idx}
                                   fileName={scan.name}
                                   name={scan.name}
                                   fileUrl={scan.url}
                                   variant="banner"
                                   onRemove={() => setIdScans(prev => prev.filter((_, i) => i !== idx))}
                                />
                             ))}
                             {idScans.length < 2 && (
                                <FileUpload 
                                   onUploadComplete={(res) => setIdScans(prev => [...prev, { url: res.fileUrl, name: res.name }])}
                                   onUploadError={(err) => toast.error(err)}
                                   className={cn(
                                      "h-full transition-all border-dashed border-2", 
                                      idScans.length === 0 ? "col-span-2" : "col-span-1"
                                   )}
                                   maxFiles={2}
                                />
                             )}
                          </div>
                       </div>
                 </div>

                 {/* Date Pickers */}
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label>Check-in Date <span className="text-red-500">*</span></Label>
                       <Popover>
                          <PopoverTrigger asChild>
                             <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-neutral-900 border-white/10", !walkInCheckIn && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {walkInCheckIn ? format(walkInCheckIn, "PPP") : "Pick a date"}
                             </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 bg-neutral-950 border-white/10">
                             <Calendar mode="single" selected={walkInCheckIn} onSelect={(d) => d && setWalkInCheckIn(d)} initialFocus />
                          </PopoverContent>
                       </Popover>
                    </div>
                    <div className="space-y-2">
                       <Label>Check-out Date <span className="text-red-500">*</span></Label>
                       <Popover>
                          <PopoverTrigger asChild>
                             <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-neutral-900 border-white/10", !walkInCheckOut && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {walkInCheckOut ? format(walkInCheckOut, "PPP") : "Pick a date"}
                             </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 bg-neutral-950 border-white/10">
                             <Calendar mode="single" selected={walkInCheckOut} onSelect={(d) => d && setWalkInCheckOut(d)} disabled={(date) => date < walkInCheckIn} initialFocus />
                          </PopoverContent>
                       </Popover>
                    </div>
                 </div>

                 {/* Pricing */}
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label>Additional Charge (Optional)</Label>
                       <div className="flex gap-2">
                           <Popover open={openChargeType} onOpenChange={setOpenChargeType}>
                             <PopoverTrigger asChild>
                               <Button variant="outline" className="w-[140px] justify-between bg-neutral-900 border-white/10 text-xs text-muted-foreground">
                                 {addChargeType || "Type..."}
                                 <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
                               </Button>
                             </PopoverTrigger>
                             <PopoverContent className="w-[200px] p-0 bg-neutral-950 border-white/10">
                               <Command>
                                 <CommandInput placeholder="Search charge type..." className="h-8" />
                                 <CommandList>
                                   <CommandEmpty>No charge type found.</CommandEmpty>
                                   <CommandGroup>
                                     {CHARGE_TYPES.map((type) => (
                                       <CommandItem
                                         key={type}
                                         value={type}
                                         onSelect={(currentValue) => {
                                            setAddChargeType(currentValue);
                                            setOpenChargeType(false);
                                         }}
                                       >
                                         <Check className={cn("mr-2 h-4 w-4", addChargeType === type ? "opacity-100" : "opacity-0")} />
                                         {type}
                                       </CommandItem>
                                     ))}
                                   </CommandGroup>
                                 </CommandList>
                               </Command>
                             </PopoverContent>
                           </Popover>
                           <Input 
                             type="number" 
                             placeholder="Amount"
                             value={addChargeAmount || ""}
                             onChange={e => setAddChargeAmount(Number(e.target.value))}
                             className="bg-neutral-900 border-white/10"
                           />
                       </div>
                    </div>
                    <div className="space-y-2">
                       <Label>Collect Payment Now</Label>
                       <div className="grid grid-cols-2 gap-2">
                          <Input 
                             type="number" 
                             placeholder="Amount"
                             value={initialPayment || ""}
                             onChange={e => setInitialPayment(Number(e.target.value))}
                             className="bg-neutral-900 border-white/10 col-span-2"
                          />
                          <Select value={initialPaymentMethod} onValueChange={setInitialPaymentMethod}>
                             <SelectTrigger className="h-9 bg-neutral-900 border-white/10"><SelectValue placeholder="Method" /></SelectTrigger>
                             <SelectContent>
                                <SelectItem value="CASH">Cash</SelectItem>
                                <SelectItem value="CARD">Card</SelectItem>
                                <SelectItem value="GCASH">GCash</SelectItem>
                                <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                             </SelectContent>
                          </Select>
                          <Input 
                             placeholder="Ref/Remarks"
                             value={initialPaymentRef}
                             onChange={e => setInitialPaymentRef(e.target.value)}
                             className="bg-neutral-900 border-white/10 h-9"
                          />
                       </div>
                    </div>
                 </div>

                 {/* Summary */}
                 <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-2 text-sm">
                    <div className="flex justify-between text-neutral-400">
                       <span>Room ({nights} night{nights > 1 ? 's' : ''} × ₱{roomPrice.toLocaleString()})</span>
                       <span>₱{roomTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                       <span>Tax ({(propertyRates.taxRate * 100).toFixed(0)}%)</span>
                       <span>₱{taxAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                       <span>Service Charge ({(propertyRates.serviceChargeRate * 100).toFixed(0)}%)</span>
                       <span>₱{serviceCharge.toLocaleString()}</span>
                    </div>
                    {addChargeAmount > 0 && (
                        <div className="flex justify-between text-neutral-400">
                           <span>{addChargeType || "Additional Charge"}</span>
                           <span>₱{addChargeAmount.toLocaleString()}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-white font-bold border-t border-white/10 pt-2 mt-2">
                       <span>Grand Total</span>
                       <span>₱{grandTotal.toLocaleString()}</span>
                    </div>
                 </div>

                 <Button onClick={handleWalkIn} disabled={loading || !walkInGuest.name} className="w-full bg-orange-600 hover:bg-orange-700">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Complete Walk-In
                 </Button>
              </div>
           </TabsContent>

           {/* --- TAB: MANAGE --- */}
           <TabsContent value="manage" className="space-y-6 pt-4">
              {folioLoading && !activeBooking ? (
                 <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-neutral-500" /></div>
              ) : activeBooking ? (
                 <>
                    {/* Header */}
                    <div className="flex justify-between items-start bg-white/5 p-4 rounded-lg border border-white/10">
                        <div>
                           <div className="flex items-center gap-2">
                              <h3 className="text-lg font-bold text-white">{activeBooking.guestFirstName} {activeBooking.guestLastName}</h3>
                              <Popover open={editGuestOpen} onOpenChange={setEditGuestOpen}>
                                <PopoverTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-6 w-6 text-neutral-400 hover:text-white" onClick={() => setGuestEditData({
                                    firstName: activeBooking.guestFirstName,
                                    lastName: activeBooking.guestLastName,
                                    email: activeBooking.guestEmail,
                                    phone: activeBooking.guestPhone,
                                    specialRequests: activeBooking.specialRequests || ""
                                  })}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 bg-neutral-950 border-white/10 p-4 space-y-3">
                                  <h4 className="font-semibold text-white">Edit Guest Details</h4>
                                  <div className="grid grid-cols-2 gap-2">
                                    <Input placeholder="First Name" value={guestEditData.firstName} onChange={e => setGuestEditData({...guestEditData, firstName: e.target.value})} className="bg-neutral-900 border-white/10 h-8 text-xs"/>
                                    <Input placeholder="Last Name" value={guestEditData.lastName} onChange={e => setGuestEditData({...guestEditData, lastName: e.target.value})} className="bg-neutral-900 border-white/10 h-8 text-xs"/>
                                  </div>
                                  <Input placeholder="Email" value={guestEditData.email} onChange={e => setGuestEditData({...guestEditData, email: e.target.value})} className="bg-neutral-900 border-white/10 h-8 text-xs"/>
                                  <Input placeholder="Phone" value={guestEditData.phone} onChange={e => setGuestEditData({...guestEditData, phone: e.target.value})} className="bg-neutral-900 border-white/10 h-8 text-xs"/>
                                  <Input placeholder="Special Requests" value={guestEditData.specialRequests} onChange={e => setGuestEditData({...guestEditData, specialRequests: e.target.value})} className="bg-neutral-900 border-white/10 h-8 text-xs"/>
                                  <Button size="sm" onClick={handleUpdateGuest} disabled={loading} className="w-full bg-orange-600 hover:bg-orange-700">Save Changes</Button>
                                </PopoverContent>
                              </Popover>
                           </div>
                           <p className="text-sm text-neutral-400 font-mono">{activeBooking.shortRef}</p>
                           <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-neutral-500">
                                {activeBooking.items && activeBooking.items.length > 0 
                                  ? `${format(new Date(activeBooking.items[0].checkIn), "MMM d")} - ${format(new Date(activeBooking.items[0].checkOut), "MMM d")}` 
                                  : "Dates N/A"}
                              </p>
                              <Popover open={extendStayOpen} onOpenChange={setExtendStayOpen}>
                                <PopoverTrigger asChild>
                                  <Button size="sm" variant="outline" className="h-5 text-[10px] px-2 border-white/10 hover:bg-white/10 text-orange-400">
                                    Extend
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-neutral-950 border-white/10">
                                  <Calendar 
                                    mode="single" 
                                    selected={newCheckOutDate} 
                                    onSelect={setNewCheckOutDate} 
                                    disabled={(date) => date <= new Date(activeBooking.items?.[0]?.checkOut || new Date())}
                                    initialFocus 
                                  />
                                  <div className="p-3 border-t border-white/10">
                                    <Button size="sm" onClick={() => setShowExtendConfirmDialog(true)} disabled={loading || !newCheckOutDate} className="w-full bg-orange-600 hover:bg-orange-700">
                                      Save New Dates
                                    </Button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                              
                              <AlertDialog open={showExtendConfirmDialog} onOpenChange={setShowExtendConfirmDialog}>
                                <AlertDialogContent className="bg-neutral-950 border-white/10 text-white">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirm Stay Modification</AlertDialogTitle>
                                    <AlertDialogDescription className="text-neutral-400">
                                      {newCheckOutDate && activeBooking.items?.[0] && (
                                        <>
                                          This will change the checkout date from 
                                          <span className="font-bold text-white"> {format(new Date(activeBooking.items[0].checkOut), "MMM d, yyyy")} </span>
                                          to 
                                          <span className="font-bold text-white"> {format(newCheckOutDate, "MMM d, yyyy")}</span>.
                                          <br /><br />
                                          {(() => {
                                            const daysDiff = Math.ceil((newCheckOutDate.getTime() - new Date(activeBooking.items[0].checkOut).getTime()) / (1000 * 60 * 60 * 24));
                                            return (
                                              <span>It will {daysDiff > 0 ? "add" : "remove"} <span className="font-bold text-white">{Math.abs(daysDiff)} night{Math.abs(daysDiff) !== 1 ? 's' : ''}</span>.</span>
                                            );
                                          })()}
                                          <br />
                                          Room charges and taxes will be automatically recalculated.
                                        </>
                                      )}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-neutral-800 border-white/10 text-white hover:bg-neutral-700">Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleExtendStay} className="bg-orange-600 hover:bg-orange-700 text-white">
                                      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                      Confirm
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="text-xs text-neutral-400 uppercase tracking-wider">Balance Due</p>
                           <p className={`text-2xl font-bold ${Number(activeBooking.amountDue) > 0 ? "text-red-400" : "text-green-400"}`}>
                              ₱{Number(activeBooking.amountDue).toLocaleString()}
                           </p>
                           <Button size="sm" variant="ghost" onClick={handlePrintInvoice} className="mt-1 h-6 text-neutral-500 hover:text-white">
                             <Printer className="h-3 w-3 mr-1" /> Print Invoice
                           </Button>
                        </div>
                    </div>

                     {/* Folio Actions */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 p-3 border border-white/10 rounded-lg bg-neutral-900/50">
                           <Label className="text-xs uppercase text-neutral-500">Add Charge</Label>
                           <Popover open={openManageCharge} onOpenChange={setOpenManageCharge}>
                             <PopoverTrigger asChild>
                               <Button variant="outline" className="w-full justify-between bg-neutral-950 border-white/10 text-xs text-muted-foreground h-8">
                                 {chargeDesc || "Select Charge Type..."}
                                 <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
                               </Button>
                             </PopoverTrigger>
                             <PopoverContent className="w-[240px] p-0 bg-neutral-950 border-white/10">
                               <Command>
                                 <CommandInput placeholder="Search charge type..." className="h-8" />
                                 <CommandList>
                                   <CommandEmpty>No charge type found.</CommandEmpty>
                                   <CommandGroup>
                                     {CHARGE_TYPES.map((type) => (
                                       <CommandItem
                                         key={type}
                                         value={type}
                                         onSelect={(currentValue) => {
                                            setChargeDesc(currentValue);
                                            setOpenManageCharge(false);
                                         }}
                                       >
                                         <Check className={cn("mr-2 h-4 w-4", chargeDesc === type ? "opacity-100" : "opacity-0")} />
                                         {type}
                                       </CommandItem>
                                     ))}
                                   </CommandGroup>
                                 </CommandList>
                               </Command>
                             </PopoverContent>
                           </Popover>
                           <Input 
                              placeholder="Remarks (optional)" 
                              className="h-8 text-xs bg-neutral-950 border-white/10"
                              value={chargeRemarks}
                              onChange={e => setChargeRemarks(e.target.value)} 
                           />
                           <div className="flex gap-2">
                              <Input 
                                 type="number" 
                                 placeholder="Amount" 
                                 className="h-8 text-xs bg-neutral-950 border-white/10" 
                                 value={chargeAmount}
                                 onChange={e => setChargeAmount(e.target.value)}
                              />
                              <Button size="sm" variant="secondary" className="h-8" onClick={handleAddCharge} disabled={folioLoading}>
                                 <DollarSign className="h-3 w-3" />
                              </Button>
                           </div>
                        </div>

                        <div className="space-y-2 p-3 border border-white/10 rounded-lg bg-neutral-900/50">
                           <Label className="text-xs uppercase text-neutral-500">Add Payment</Label>
                           <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                              <SelectTrigger className="h-8 text-xs bg-neutral-950 border-white/10 w-full">
                                 <SelectValue placeholder="Payment Method" />
                              </SelectTrigger>
                              <SelectContent className="bg-neutral-950 border-white/10">
                                 <SelectItem value="CASH">Cash</SelectItem>
                                 <SelectItem value="CARD">Card</SelectItem>
                                 <SelectItem value="GCASH">GCash</SelectItem>
                                 <SelectItem value="PAYMAYA">PayMaya</SelectItem>
                                 <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                              </SelectContent>
                           </Select>
                            <Input 
                               placeholder="Reference / Remarks"
                               className="h-8 text-xs bg-neutral-950 border-white/10"
                               value={paymentRef}
                               onChange={e => setPaymentRef(e.target.value)}
                            />
                           <div className="flex gap-2">
                              <Input 
                                 type="number" 
                                 placeholder="Amount" 
                                 className="h-8 text-xs bg-neutral-950 border-white/10" 
                                 value={payAmount}
                                 onChange={e => setPayAmount(e.target.value)}
                              />
                              <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700" onClick={handleAddPayment} disabled={folioLoading}>
                                 <CheckCircle className="h-3 w-3" />
                              </Button>
                           </div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                       <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
                          <DialogTrigger asChild>
                             <Button className="flex-1 bg-neutral-800 text-orange-400 hover:bg-neutral-700 hover:text-orange-300 border border-white/10" disabled={loading}>
                                <ArrowRightLeft className="mr-2 h-4 w-4" /> Transfer Room
                             </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-neutral-950 border-white/10 text-white max-w-md">
                             <DialogHeader>
                                <DialogTitle>Transfer Guest Room</DialogTitle>
                                <DialogDescription className="text-neutral-400">
                                   Move guest to another available unit.
                                </DialogDescription>
                             </DialogHeader>
                             <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                   <Label>Move to Unit</Label>
                                   <Select value={transferTargetId} onValueChange={setTransferTargetId}>
                                      <SelectTrigger className="bg-neutral-900 border-white/10">
                                         <SelectValue placeholder="Select available unit..." />
                                      </SelectTrigger>
                                      <SelectContent className="bg-neutral-950 border-white/10 max-h-[300px]">
                                         {allRooms.map((room: any) => (
                                            <div key={room.id} className="p-2 border-b border-white/5 last:border-0">
                                               <p className="text-xs font-bold text-neutral-500 uppercase px-2 py-1">{room.name}</p>
                                               {room.units
                                                  .filter((u: any) => u.status === 'CLEAN' && u.id !== unit.id)
                                                  .map((u: any) => (
                                                     <SelectItem key={u.id} value={u.id}>
                                                        Unit {u.number} 
                                                        {room.id !== unit.roomTypeId && " (Upgrade/Change)"}
                                                     </SelectItem>
                                                  ))}
                                               {room.units.filter((u: any) => u.status === 'CLEAN' && u.id !== unit.id).length === 0 && (
                                                  <p className="text-xs text-neutral-600 px-4 py-1 italic">No units available</p>
                                               )}
                                            </div>
                                         ))}
                                      </SelectContent>
                                   </Select>
                                </div>
                                <div className="space-y-2">
                                   <Label>Reason for Transfer</Label>
                                   <Input 
                                      placeholder="e.g. AC Problem, Room Upgrade..." 
                                      className="bg-neutral-900 border-white/10"
                                      value={transferReason}
                                      onChange={e => setTransferReason(e.target.value)}
                                   />
                                </div>
                             </div>
                             <DialogFooter>
                                <Button variant="outline" onClick={() => setShowTransferDialog(false)} className="bg-neutral-900 border-white/10">Cancel</Button>
                                <Button onClick={handleTransfer} disabled={loading || !transferTargetId} className="bg-orange-600 hover:bg-orange-700">
                                   {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                   Confirm Transfer
                                </Button>
                             </DialogFooter>
                          </DialogContent>
                       </Dialog>
                    </div>

                    {/* Transaction List */}
                    <div className="h-[200px] border border-white/10 rounded-lg bg-neutral-900/30 p-4 overflow-y-auto">
                        <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Transactions</h4>
                        <div className="space-y-2">
                            {/* Room Charges */}
                            {activeBooking.items.map((item: any) => (
                               <div key={item.id} className="flex justify-between text-sm group">
                                  <span>Room Charge ({item.room.name})</span>
                                  <span>₱{Number(item.pricePerNight).toLocaleString()}</span>
                               </div>
                            ))}
                            {activeBooking.adjustments.map((adj: any) => (
                               <div key={adj.id} className={`flex justify-between text-sm items-center group ${adj.isVoided ? "opacity-50" : "text-red-300"}`}>
                                  <span className={`flex items-center gap-2 ${adj.isVoided ? "line-through" : ""}`}>
                                     {adj.description}
                                     {adj.isVoided && <Badge variant="outline" className="text-[10px] h-4 px-1 border-white/20 text-neutral-400">VOID</Badge>}
                                  </span>
                                  <div className="flex items-center gap-2">
                                     <span className={adj.isVoided ? "line-through" : ""}>₱{Number(adj.amount).toLocaleString()}</span>
                                     {/* Allow voiding if not already voided */}
                                     {!adj.isVoided && Number(adj.amount) > 0 && (
                                       <Button size="icon" variant="ghost" className="h-4 w-4 opacity-0 group-hover:opacity-100 text-red-500" onClick={() => initiateVoid(adj.id, 'CHARGE')}>
                                          <Trash2 className="h-3 w-3" />
                                       </Button>
                                     )}
                                  </div>
                               </div>
                            ))}
                             {/* Payments */}
                             {activeBooking.payments.map((pmt: any) => (
                               <div key={pmt.id} className={`flex justify-between text-sm items-center group ${pmt.status === 'VOIDED' ? "opacity-50" : "text-green-400"}`}>
                                  <span className={pmt.status === 'VOIDED' ? "line-through" : ""}>
                                    Payment ({pmt.provider}) <span className="text-xs opacity-50">{pmt.status}</span>
                                  </span>
                                  <div className="flex items-center gap-2">
                                     <span className={pmt.status === 'VOIDED' ? "line-through" : ""}>-₱{Number(pmt.amount).toLocaleString()}</span>
                                     {pmt.status !== 'VOIDED' && (
                                       <Button size="icon" variant="ghost" className="h-4 w-4 opacity-0 group-hover:opacity-100 text-red-500" onClick={() => initiateVoid(pmt.id, 'PAYMENT')}>
                                          <Trash2 className="h-3 w-3" />
                                       </Button>
                                     )}
                                  </div>
                               </div>
                            ))}
                        </div>
                    </div>

                    <Button 
                       className="w-full bg-neutral-800 text-red-400 hover:bg-neutral-700 hover:text-red-300 border border-white/10" 
                       onClick={() => setShowCheckoutDialog(true)} 
                       disabled={loading}
                    >
                       <LogOut className="mr-2 h-4 w-4" /> Check Out Guest
                    </Button>

                    {/* Checkout Confirmation AlertDialog */}
                    <AlertDialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
                       <AlertDialogContent className="bg-neutral-950 border-white/10 text-white">
                          <AlertDialogHeader>
                             <AlertDialogTitle>Confirm Check Out</AlertDialogTitle>
                             <AlertDialogDescription className="text-neutral-400">
                                {Number(activeBooking?.amountDue) > 0 ? (
                                   <>
                                      This booking has an outstanding balance of{" "}
                                      <span className="text-red-400 font-bold">₱{Number(activeBooking?.amountDue).toLocaleString()}</span>.
                                      <br />Are you sure you want to proceed with checkout?
                                   </>
                                ) : (
                                   "Are you sure you want to check out this guest? The unit will be marked as Dirty."
                                )}
                             </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                             <AlertDialogCancel className="bg-neutral-800 border-white/10 text-white hover:bg-neutral-700">Cancel</AlertDialogCancel>
                             <AlertDialogAction 
                                onClick={(e) => {
                                   e.preventDefault(); // Prevent auto-close if we need to show another dialog?
                                   // Actually Shadcn AlertDialogAction closes on click. 
                                   // But if we want to open another dialog (Supervisor), closing this one is fine.
                                   initiateCheckOut();
                                }} 
                                className={`text-white ${Number(activeBooking?.amountDue) > 0 ? "bg-red-800 hover:bg-red-900" : "bg-red-600 hover:bg-red-700"}`}
                             >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                {Number(activeBooking?.amountDue) > 0 ? "Override & Checkout" : "Confirm Checkout"}
                             </AlertDialogAction>
                          </AlertDialogFooter>
                       </AlertDialogContent>
                    </AlertDialog>
                 </>
              ) : (
                <div className="text-center text-neutral-500 italic">No Active Booking Data</div>
              )}
           </TabsContent>

           {/* --- TAB: HOUSEKEEPING --- */}
           <TabsContent value="housekeeping" className="space-y-6 pt-4">
              <div className="flex flex-col items-center justify-center space-y-4 py-8">
                 <div className={`p-4 rounded-full ${unit.status === 'CLEAN' ? 'bg-green-500/10' : 'bg-neutral-800'}`}>
                    <Sparkles className={`h-8 w-8 ${unit.status === 'CLEAN' ? 'text-green-500' : 'text-neutral-400'}`} /> 
                 </div>
                 <p className="text-center text-neutral-400 max-w-xs">
                    Current status is <strong>{unit.status}</strong>. 
                    {unit.status === 'DIRTY' && " Housekeeping should mark this as clean once ready."}
                 </p>

                 <div className="w-full max-w-xs space-y-2">
                    <Label>Assigned Staff / Notes</Label>
                    <Popover open={openStaffSelect} onOpenChange={setOpenStaffSelect}>
                       <PopoverTrigger asChild>
                         <Button
                           variant="outline"
                           role="combobox"
                           aria-expanded={openStaffSelect}
                           className="w-full justify-between bg-neutral-900 border-white/10"
                         >
                           {housekeepingNote
                             ? staffMembers.find((staff) => staff.name === housekeepingNote || staff.employeeId === housekeepingNote)?.name || housekeepingNote
                             : "Select staff..."}
                           <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                         </Button>
                       </PopoverTrigger>
                       <PopoverContent className="w-[300px] p-0 bg-neutral-950 border-white/10">
                         <Command>
                           <CommandInput placeholder="Search staff by name or ID..." className="h-9" />
                           <CommandList>
                             <CommandEmpty>No staff found.</CommandEmpty>
                             <CommandGroup>
                               {staffMembers.map((staff) => (
                                 <CommandItem
                                   key={staff.id}
                                   value={staff.name}
                                   onSelect={(currentValue) => {
                                     setHousekeepingNote(currentValue === housekeepingNote ? "" : currentValue);
                                     setOpenStaffSelect(false);
                                   }}
                                 >
                                   <div className="flex flex-col">
                                       <span>{staff.name}</span>
                                       {staff.employeeId && <span className="text-[10px] text-neutral-500">{staff.employeeId}</span>}
                                   </div>
                                   <Check
                                     className={cn(
                                       "ml-auto h-4 w-4",
                                       housekeepingNote === staff.name ? "opacity-100" : "opacity-0"
                                     )}
                                   />
                                 </CommandItem>
                               ))}
                             </CommandGroup>
                           </CommandList>
                         </Command>
                       </PopoverContent>
                     </Popover>
                 </div>
                 
                 <div className="flex gap-4">
                    <Button 
                       variant="outline" 
                       className="border-white/10 hover:bg-yellow-900/20 hover:text-yellow-500 hover:border-yellow-500/50"
                       onClick={() => handleHousekeeping('MAINTENANCE')}
                       disabled={loading}
                    >
                       <AlertCircle className="mr-2 h-4 w-4" /> Maintenance
                    </Button>
                    <Button 
                       className="bg-green-600 hover:bg-green-700 text-white"
                       onClick={() => handleHousekeeping('CLEAN')}
                       disabled={loading}
                    >
                       <CheckCircle className="mr-2 h-4 w-4" /> Mark as Clean
                    </Button>
                 </div>
              </div>
           </TabsContent>
        </Tabs>

        {/* Void Confirmation Dialog */}
        <AlertDialog open={voidConfirmOpen} onOpenChange={setVoidConfirmOpen}>
           <AlertDialogContent className="bg-neutral-950 border-white/10 text-white">
              <AlertDialogHeader>
                 <AlertDialogTitle>Confirm Void Transaction</AlertDialogTitle>
                 <AlertDialogDescription className="text-neutral-400">
                    Are you sure you want to void this {voidTarget?.type.toLowerCase()}? This action cannot be undone.
                 </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                 <AlertDialogCancel className="bg-neutral-800 border-white/10 text-white hover:bg-neutral-700">Cancel</AlertDialogCancel>
                 <AlertDialogAction onClick={confirmVoid} className="bg-red-600 hover:bg-red-700 text-white">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Confirm Void
                 </AlertDialogAction>
              </AlertDialogFooter>
           </AlertDialogContent>
        </AlertDialog>

        {/* Supervisor Authentication Dialog */}
        <Dialog open={supervisorAuthOpen} onOpenChange={setSupervisorAuthOpen}>
           <DialogContent className="bg-neutral-950 border-white/10 text-white sm:max-w-md">
              <DialogHeader>
                 <DialogTitle>Supervisor Approval Required</DialogTitle>
                 <DialogDescription className="text-neutral-400">
                    You do not have permission to void transactions. Please enter supervisor credentials to proceed.
                 </DialogDescription>
              </DialogHeader>
               <div className="space-y-4 py-4">
                 <div className="space-y-2">
                    <Label>Email or Employee ID</Label>
                    <Input 
                       placeholder="M-001 or admin@example.com" 
                       value={supervisorCreds.identifier}
                       onChange={e => setSupervisorCreds({...supervisorCreds, identifier: e.target.value})}
                       className="bg-neutral-900 border-white/10"
                    />
                 </div>
                 <div className="space-y-2">
                    <Label>Password</Label>
                    <Input 
                       type="password"
                       placeholder="••••••••" 
                       value={supervisorCreds.password}
                       onChange={e => setSupervisorCreds({...supervisorCreds, password: e.target.value})}
                       className="bg-neutral-900 border-white/10"
                    />
                 </div>
              </div>
              <DialogFooter>
                 <Button variant="outline" onClick={() => setSupervisorAuthOpen(false)} className="bg-neutral-900 border-white/10">Cancel</Button>
                 <Button onClick={handleSupervisorVerify} disabled={loading} className="bg-orange-600 hover:bg-orange-700 text-white">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Verify & Proceed
                 </Button>
              </DialogFooter>
           </DialogContent>
        </Dialog>

        {/* Check-In Confirmation Alert */}
        <AlertDialog open={confirmCheckInOpen} onOpenChange={setConfirmCheckInOpen}>
           <AlertDialogContent className="bg-neutral-900 border-white/10 text-white">
               <AlertDialogHeader>
                   <AlertDialogTitle>Confirm Check-In</AlertDialogTitle>
                   <AlertDialogDescription className="text-neutral-400">
                       Are you sure you want to check in this guest to Unit {unit?.number}?
                       This will mark the unit as OCCUPIED.
                   </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                   <AlertDialogCancel className="bg-transparent border-white/10 hover:bg-white/10 hover:text-white">Cancel</AlertDialogCancel>
                   <AlertDialogAction onClick={executeCheckIn} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                       {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Check-In"}
                   </AlertDialogAction>
               </AlertDialogFooter>
           </AlertDialogContent>
        </AlertDialog>

      </DialogContent>
    </Dialog>
  );
}
