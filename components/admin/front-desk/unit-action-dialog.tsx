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
  Loader2, User as UserIcon, Calendar as CalendarIcon, DollarSign, LogOut, CheckCircle, AlertCircle, Sparkles, ArrowRightLeft
} from "lucide-react";
import { 
  checkInBooking, createWalkIn, getBookingFinancials, addCharge, addPayment, checkOutUnit, updateUnitStatus, transferRoom
} from "@/actions/admin/front-desk";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UnitActionDialogProps {
  unit: any; 
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  unassignedBookings: any[];
  roomPrice: number; 
  propertyRates: { taxRate: number; serviceChargeRate: number };
  allRooms: any[];
}

export function UnitActionDialog({ 
  unit, isOpen, onOpenChange, unassignedBookings, roomPrice, propertyRates, allRooms 
}: UnitActionDialogProps) {
  const [activeTab, setActiveTab] = React.useState("check-in");
  const [loading, setLoading] = React.useState(false);
  
  // Walk-in State
  const [walkInGuest, setWalkInGuest] = React.useState({ name: "", email: "" });
  const [walkInCheckIn, setWalkInCheckIn] = React.useState<Date>(new Date());
  const [walkInCheckOut, setWalkInCheckOut] = React.useState<Date>(addDays(new Date(), 1));
  const [additionalCharges, setAdditionalCharges] = React.useState(0);
  const [initialPayment, setInitialPayment] = React.useState(0);

  // Manage State (Folio)
  const [activeBooking, setActiveBooking] = React.useState<any>(null);
  const [folioLoading, setFolioLoading] = React.useState(false);
  
  // Charge/Payment Inputs
  const [chargeAmount, setChargeAmount] = React.useState("");
  const [chargeDesc, setChargeDesc] = React.useState("");
  const [chargeRemarks, setChargeRemarks] = React.useState("");
  const [payAmount, setPayAmount] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState("CASH");
  const [paymentRef, setPaymentRef] = React.useState("");

  // Checkout Confirmation
  const [showCheckoutDialog, setShowCheckoutDialog] = React.useState(false);

  // Room Transfer State
  const [showTransferDialog, setShowTransferDialog] = React.useState(false);
  const [transferTargetId, setTransferTargetId] = React.useState("");
  const [transferReason, setTransferReason] = React.useState("");

  // Calculation Helpers
  const nights = Math.max(1, differenceInDays(walkInCheckOut, walkInCheckIn));
  const roomTotal = roomPrice * nights;
  const taxAmount = roomTotal * propertyRates.taxRate;
  const serviceCharge = roomTotal * propertyRates.serviceChargeRate;
  const grandTotal = roomTotal + taxAmount + serviceCharge + additionalCharges;

  // Determine Default Tab based on Unit Status
  React.useEffect(() => {
    if (unit?.status === 'OCCUPIED') setActiveTab("manage");
    else if (unit?.status === 'DIRTY') setActiveTab("housekeeping");
    else setActiveTab("check-in");
  }, [unit]);

  // Fetch active booking data when opening "Manage" tab
  React.useEffect(() => {
    if (activeTab === "manage" && unit?.status === 'OCCUPIED' && unit?.bookingItems?.length > 0) {
      const activeItem = unit.bookingItems[0];
      if (activeItem?.bookingId) {
        setFolioLoading(true);
        getBookingFinancials(activeItem.bookingId)
          .then(data => setActiveBooking(data))
          .finally(() => setFolioLoading(false));
      }
    }
  }, [activeTab, unit]);

  if (!unit) return null;

  const handleCheckIn = async (bookingItemId: string) => {
    setLoading(true);
    try {
      await checkInBooking(bookingItemId, unit.id);
      toast.success("Guest checked in successfully.");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to check in.");
    } finally {
      setLoading(false);
    }
  };

  const handleWalkIn = async () => {
    setLoading(true);
    try {
      await createWalkIn({
        propertyId: unit.roomType.propertyId,
        roomTypeId: unit.roomTypeId,
        unitId: unit.id,
        guestName: walkInGuest.name,
        guestEmail: walkInGuest.email,
        checkInDate: walkInCheckIn,
        checkOutDate: walkInCheckOut,
        pricePerNight: roomPrice,
        initialPayment
      });
      toast.success("Walk-in created and checked in.");
      onOpenChange(false);
    } catch (error) {
       toast.error("Failed to create walk-in.");
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

  const handleCheckOut = async () => {
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

  const handleHousekeeping = async (status: 'CLEAN' | 'MAINTENANCE') => {
    setLoading(true);
    try {
      await updateUnitStatus(unit.id, status);
      toast.success(`Unit marked as ${status}`);
      onOpenChange(false);
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
              {unassignedBookings.filter(b => b.roomId === unit.roomTypeId).length === 0 ? (
                 <div className="text-center py-8 text-neutral-400">
                    No confirmed online bookings waiting for this room type.
                 </div>
              ) : (
                <div className="space-y-2">
                   {unassignedBookings.filter(b => b.roomId === unit.roomTypeId).map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition">
                         <div>
                            <p className="font-medium text-white">{item.booking.guestFirstName} {item.booking.guestLastName}</p>
                            <p className="text-xs text-neutral-400 font-mono">{item.booking.shortRef} • {format(new Date(item.checkIn), "MMM d")} - {format(new Date(item.checkOut), "MMM d")}</p>
                         </div>
                         <Button size="sm" onClick={() => handleCheckIn(item.id)} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign"}
                         </Button>
                      </div>
                   ))}
                </div>
              )}
           </TabsContent>

           {/* --- TAB: WALK IN --- */}
           <TabsContent value="walk-in" className="space-y-4 pt-4">
              <div className="grid gap-4">
                 {/* Guest Info */}
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label>Guest Name</Label>
                       <Input 
                         placeholder="John Doe" 
                         value={walkInGuest.name}
                         onChange={e => setWalkInGuest({...walkInGuest, name: e.target.value})}
                         className="bg-neutral-900 border-white/10"
                        />
                    </div>
                    <div className="space-y-2">
                       <Label>Email (Optional)</Label>
                       <Input 
                         placeholder="john@example.com" 
                         value={walkInGuest.email} 
                         onChange={e => setWalkInGuest({...walkInGuest, email: e.target.value})}
                         className="bg-neutral-900 border-white/10"
                       />
                    </div>
                 </div>

                 {/* Date Pickers */}
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label>Check-in Date</Label>
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
                       <Label>Check-out Date</Label>
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
                       <Label>Additional Charges (e.g. Extra Bed)</Label>
                       <Input 
                         type="number" 
                         placeholder="0"
                         value={additionalCharges || ""}
                         onChange={e => setAdditionalCharges(Number(e.target.value))}
                         className="bg-neutral-900 border-white/10"
                       />
                    </div>
                    <div className="space-y-2">
                       <Label>Collect Payment Now</Label>
                       <Input 
                         type="number" 
                         placeholder="Amount to collect..."
                         value={initialPayment || ""}
                         onChange={e => setInitialPayment(Number(e.target.value))}
                         className="bg-neutral-900 border-white/10"
                       />
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
                    {additionalCharges > 0 && (
                        <div className="flex justify-between text-neutral-400">
                           <span>Additional Charges</span>
                           <span>₱{additionalCharges.toLocaleString()}</span>
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
                           <h3 className="text-lg font-bold text-white">{activeBooking.guestFirstName} {activeBooking.guestLastName}</h3>
                           <p className="text-sm text-neutral-400 font-mono">{activeBooking.shortRef}</p>
                           <p className="text-xs text-neutral-500 mt-1">Checked In: {format(new Date(), "MMM d, h:mm a")}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-xs text-neutral-400 uppercase tracking-wider">Balance Due</p>
                           <p className={`text-2xl font-bold ${Number(activeBooking.amountDue) > 0 ? "text-red-400" : "text-green-400"}`}>
                              ₱{Number(activeBooking.amountDue).toLocaleString()}
                           </p>
                        </div>
                    </div>
                     {/* Folio Actions */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 p-3 border border-white/10 rounded-lg bg-neutral-900/50">
                           <Label className="text-xs uppercase text-neutral-500">Add Charge</Label>
                           <Input 
                              placeholder="Charge Type (e.g. Minibar, Laundry)" 
                              className="h-8 text-xs bg-neutral-950 border-white/10"
                              value={chargeDesc}
                              onChange={e => setChargeDesc(e.target.value)} 
                           />
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
                           {paymentMethod !== "CASH" && (
                              <Input 
                                 placeholder="Reference No."
                                 className="h-8 text-xs bg-neutral-950 border-white/10"
                                 value={paymentRef}
                                 onChange={e => setPaymentRef(e.target.value)}
                              />
                           )}
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
                               <div key={item.id} className="flex justify-between text-sm">
                                  <span>Room Charge ({item.room.name})</span>
                                  <span>₱{Number(item.pricePerNight).toLocaleString()}</span>
                               </div>
                            ))}
                            {/* Adjustments */}
                            {activeBooking.adjustments.map((adj: any) => (
                               <div key={adj.id} className="flex justify-between text-sm text-red-300">
                                  <span>{adj.description}</span>
                                  <span>₱{Number(adj.amount).toLocaleString()}</span>
                               </div>
                            ))}
                             {/* Payments */}
                             {activeBooking.payments.map((pmt: any) => (
                               <div key={pmt.id} className="flex justify-between text-sm text-green-400">
                                  <span>Payment ({pmt.provider})</span>
                                  <span>-₱{Number(pmt.amount).toLocaleString()}</span>
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
                             <AlertDialogAction onClick={handleCheckOut} className="bg-red-600 hover:bg-red-700 text-white">
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Confirm Checkout
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
      </DialogContent>
    </Dialog>
  );
}
