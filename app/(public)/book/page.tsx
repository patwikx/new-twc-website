"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCouponByCode } from "@/actions/public/coupons";
import { getGlobalConfig } from "@/actions/public/properties";
import { CartItem, useCartStore } from "@/store/useCartStore";
import { Lock, Check, X, Loader2, AlertCircle } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useCallback } from "react";
import { addDays, differenceInDays, parseISO, format } from "date-fns";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/booking/DateRangePicker";
import { Calendar } from "@/components/ui/calendar";
import { createBooking } from "@/actions/create-booking";
import {
   Command,
   CommandGroup,
   CommandItem,
   CommandList,
} from "@/components/ui/command";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ChevronsUpDown } from "lucide-react";
import { useSession } from "next-auth/react";

// Availability validation types
interface AvailabilityResult {
   roomTypeId: string;
   totalUnits: number;
   bookedUnits: number;
   availableUnits: number;
   available: boolean;
   limitedAvailability: boolean;
}

interface CartItemAvailability {
   itemId: string;
   roomId: string;
   available: boolean;
   availableUnits: number;
   error?: string;
}


/**
 * Renders the booking checkout UI and manages the end-to-end booking flow for cart and single-room modes.
 *
 * The component displays guest details, editable stay items (dates, guests), add-ons, promo code handling, and a price breakdown.
 * It validates availability via the bulk availability API, computes subtotals, discounts, taxes, and service charges, creates bookings,
 * initiates a PayMongo checkout session, and polls booking/payment status to redirect to a confirmation page.
 *
 * @returns The BookingForm React element that includes the booking form, summary, availability indicators, and payment submission controls.
 */
function BookingForm() {
   const router = useRouter();
   const searchParams = useSearchParams();
   const { data: session } = useSession();

   const propertySlug = searchParams.get("property");
   const roomId = searchParams.get("room");
   const checkInParam = searchParams.get("checkIn");
   const checkOutParam = searchParams.get("checkOut");
   const cartParam = searchParams.get("cart");

   const [cartItems, setCartItems] = useState<CartItem[]>([]);
   const [isCartMode, setIsCartMode] = useState(false);

   // Zustand store
   const storedItems = useCartStore((state) => state.items);
   
   // Configuration State
   const [config, setConfig] = useState({
      taxRate: 0.12,
      serviceChargeRate: 0.10,
      policies: [] as { title: string; description: string }[]
   });

   useEffect(() => {
      getGlobalConfig().then(setConfig);
   }, []);

   useEffect(() => {
      if (cartParam) {
         try {
            const decoded = JSON.parse(decodeURIComponent(cartParam));
            setCartItems(decoded.map((item: any) => ({
               ...item,
               checkIn: new Date(item.checkIn),
               checkOut: new Date(item.checkOut)
            })));
            setIsCartMode(true);
         } catch (e) {
            console.error("Failed to parse cart", e);
         }
      }
   }, [cartParam]);

   useEffect(() => {
      if (!cartParam && !propertySlug && !roomId && storedItems.length > 0) {
         // If no direct booking params, try loading from store
         setCartItems(storedItems.map(item => ({
            ...item,
            checkIn: new Date(item.checkIn),
            checkOut: new Date(item.checkOut)
         })));
         setIsCartMode(true);
      }
   }, [cartParam, propertySlug, roomId, storedItems]);

   // Single Room State
   const [date, setDate] = useState<DateRange | undefined>(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return {
         from: checkInParam ? parseISO(checkInParam) : today,
         to: checkOutParam ? parseISO(checkOutParam) : addDays(today, 1),
      };
   });

   const property = propertySlug ? null : null; // Property lookup moved to cart item embedded data
   const room = roomId ? null : null; // Room lookup moved to cart item embedded data

   // For single room booking from URL, we need to get room data from somewhere
   // This is a fallback case - normally users go through cart
   const singleRoomPrice = 0; // Would need to be fetched if supporting direct URL booking

   const [isLoading, setIsLoading] = useState(false);
   const [paymentError, setPaymentError] = useState("");
   const [pollingBookingId, setPollingBookingId] = useState<string | null>(null);
   const clearCart = useCartStore((state) => state.clearCart);
   const updateCartItem = useCartStore((state) => state.updateItem);

   const [guestDetails, setGuestDetails] = useState({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      specialRequests: ""
   });

   // Pre-fill guest details when user is logged in
   useEffect(() => {
      if (session?.user) {
         const nameParts = session.user.name?.split(' ') || [];
         setGuestDetails(prev => ({
            ...prev,
            firstName: prev.firstName || nameParts[0] || '',
            lastName: prev.lastName || nameParts.slice(1).join(' ') || '',
            email: prev.email || session.user.email || ''
         }));
      }
   }, [session]);

   // Extras & Coupons (Global)
   const EXTRAS = [
      { id: 'airport-pickup', label: 'Airport Pickup (One Way)', price: 1500 },
      { id: 'breakfast', label: 'Daily Breakfast Buffet', price: 850 },
      { id: 'extra-bed', label: 'Extra Bed', price: 1200 },
      { id: 'romantic-setup', label: 'Romantic Room Setup', price: 2500 },
   ];
   const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
   const [couponCode, setCouponCode] = useState("");
   const [appliedCoupon, setAppliedCoupon] = useState<{ code: string, type: 'percent' | 'fixed', value: number } | null>(null);
   const [couponError, setCouponError] = useState("");

   // Single Room Guest Count
   const [singleGuestCount, setSingleGuestCount] = useState(2);

   // Availability validation state
   const [availabilityLoading, setAvailabilityLoading] = useState(false);
   const [singleRoomAvailability, setSingleRoomAvailability] = useState<AvailabilityResult | null>(null);
   const [cartItemsAvailability, setCartItemsAvailability] = useState<CartItemAvailability[]>([]);
   const [availabilityError, setAvailabilityError] = useState<string | null>(null);

   // Check availability for a single room type
   const checkSingleRoomAvailability = useCallback(async (
      roomTypeId: string,
      checkIn: Date,
      checkOut: Date
   ) => {
      if (!roomTypeId || !checkIn || !checkOut) return;
      
      setAvailabilityLoading(true);
      setAvailabilityError(null);
      
      try {
         const response = await fetch('/api/availability/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               checks: [{
                  roomTypeId,
                  checkIn: checkIn.toISOString(),
                  checkOut: checkOut.toISOString()
               }]
            })
         });

         if (!response.ok) {
            throw new Error('Failed to check availability');
         }

         const results: AvailabilityResult[] = await response.json();
         if (results.length > 0) {
            setSingleRoomAvailability(results[0]);
            if (!results[0].available) {
               setAvailabilityError('This room type is fully booked for your selected dates');
            }
         }
      } catch (error) {
         console.error('Error checking availability:', error);
         setAvailabilityError('Unable to verify availability. Please try again.');
      } finally {
         setAvailabilityLoading(false);
      }
   }, []);

   // Check availability for all cart items independently
   const checkCartItemsAvailability = useCallback(async (items: CartItem[]) => {
      if (items.length === 0) return;
      
      setAvailabilityLoading(true);
      setAvailabilityError(null);
      
      try {
         // Build checks for all cart items
         const checks = items.map(item => ({
            roomTypeId: item.roomId,
            checkIn: new Date(item.checkIn).toISOString(),
            checkOut: new Date(item.checkOut).toISOString()
         }));

         const response = await fetch('/api/availability/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checks })
         });

         if (!response.ok) {
            throw new Error('Failed to check availability');
         }

         const results: AvailabilityResult[] = await response.json();
         
         // Map results to cart items
         const itemAvailability: CartItemAvailability[] = items.map((item, index) => {
            const result = results[index];
            return {
               itemId: item.id,
               roomId: item.roomId,
               available: result?.available ?? false,
               availableUnits: result?.availableUnits ?? 0,
               error: result?.available === false 
                  ? `${item.roomName || 'This room'} is fully booked for your selected dates`
                  : undefined
            };
         });

         setCartItemsAvailability(itemAvailability);
         
         // Set global error if any items are unavailable
         const unavailableItems = itemAvailability.filter(a => !a.available);
         if (unavailableItems.length > 0) {
            setAvailabilityError(
               unavailableItems.length === 1
                  ? unavailableItems[0].error!
                  : `${unavailableItems.length} items in your cart are no longer available`
            );
         }
      } catch (error) {
         console.error('Error checking cart availability:', error);
         setAvailabilityError('Unable to verify availability. Please try again.');
      } finally {
         setAvailabilityLoading(false);
      }
   }, []);

   // Check availability when dates change for single room mode
   useEffect(() => {
      if (!isCartMode && roomId && date?.from && date?.to) {
         checkSingleRoomAvailability(roomId, date.from, date.to);
      }
   }, [isCartMode, roomId, date?.from, date?.to, checkSingleRoomAvailability]);

   // Check availability when cart items change
   useEffect(() => {
      if (isCartMode && cartItems.length > 0) {
         checkCartItemsAvailability(cartItems);
      }
   }, [isCartMode, cartItems, checkCartItemsAvailability]);

   // Helper to get availability for a specific cart item
   const getCartItemAvailability = (itemId: string): CartItemAvailability | undefined => {
      return cartItemsAvailability.find(a => a.itemId === itemId);
   };

   // Check if booking can proceed (all items available)
   const canProceedWithBooking = isCartMode
      ? cartItemsAvailability.length > 0 && cartItemsAvailability.every(a => a.available)
      : singleRoomAvailability?.available ?? true;

   // Calculations
   const cartSubtotal = cartItems.reduce((acc, item) => {
      const nights = Math.max(1, differenceInDays(item.checkOut, item.checkIn));
      // Use roomPrice from cart item (embedded data)
      return acc + ((item.roomPrice || 0) * nights);
   }, 0);

   const singleNights = date?.from && date?.to ? Math.max(1, differenceInDays(date.to, date.from)) : 1;
   const singleRoomTotal = singleRoomPrice * singleNights; // Using embedded or fetched price

   const roomSubtotal = isCartMode ? cartSubtotal : singleRoomTotal;
   const extrasTotal = selectedExtras.reduce((sum, id) => sum + (EXTRAS.find(e => e.id === id)?.price || 0), 0);
   const subtotal = roomSubtotal + extrasTotal;

   // Discount - use stored coupon value
   let discountAmount = 0;
   if (appliedCoupon) {
      if (appliedCoupon.type === 'percent') {
         discountAmount = subtotal * appliedCoupon.value;
      } else {
         discountAmount = appliedCoupon.value;
      }
   }

   const discountedSubtotal = Math.max(0, subtotal - discountAmount);
   const serviceCharge = discountedSubtotal * config.serviceChargeRate;
   const taxes = discountedSubtotal * config.taxRate;
   const total = discountedSubtotal + taxes + serviceCharge;

   // Polling for booking status (placed after all dependencies are declared)
   useEffect(() => {
      if (!pollingBookingId) return;

      const pollInterval = setInterval(async () => {
         try {
            const statusRes = await fetch(`/api/bookings/status?id=${pollingBookingId}`);
            if (statusRes.ok) {
               const statusData = await statusRes.json();
               // Check if payment is successful
               if (statusData.status === 'CONFIRMED' || statusData.paymentStatus === 'PAID' || statusData.paymentStatus === 'PARTIALLY_PAID') {
                  clearInterval(pollInterval);

                  // Construct confirmation URL with necessary details
                  const params = new URLSearchParams();
                  params.set("ref", statusData.shortRef || 'confirmed');
                  // Use first cart item for property/room names or URL params
                  const firstItem = cartItems[0];
                  if (firstItem?.propertyName) params.set("propertyName", firstItem.propertyName);
                  if (firstItem?.roomName) params.set("roomName", firstItem.roomName);
                  if (date?.from) params.set("checkIn", date.from.toISOString());
                  if (date?.to) params.set("checkOut", date.to.toISOString());
                  params.set("total", total.toString());
                  params.set("firstName", guestDetails.firstName);
                  params.set("lastName", guestDetails.lastName);
                  params.set("email", guestDetails.email);

                  router.push(`/book/confirmation?${params.toString()}`);
               }
            }
         } catch (e) {
            console.error("Polling error", e);
         }
      }, 3000);

      // Stop polling after 5 minutes (user requested timeout)
      const timeoutId = setTimeout(() => {
         clearInterval(pollInterval);
         setPollingBookingId(null);
         setPaymentError("Payment session expired or timed out. Please try again.");
         setIsLoading(false);
      }, 5 * 60 * 1000);

      return () => {
         clearInterval(pollInterval);
         clearTimeout(timeoutId);
      };
   }, [pollingBookingId, router, property, room, date, total, guestDetails]);

   const handleBooking = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isCartMode && (!property || !room)) return;

      setPaymentError("");
      setIsLoading(true);

      try {
         // Build cart items for booking
         const itemsToBook = isCartMode
            ? cartItems.map(item => ({
               propertySlug: item.propertySlug,
               roomId: item.roomId,
               checkIn: new Date(item.checkIn),
               checkOut: new Date(item.checkOut),
               guests: item.guests
            }))
            : [{
               propertySlug: propertySlug!,
               roomId: roomId!,
               checkIn: date?.from || new Date(),
               checkOut: date?.to || addDays(new Date(), 1),
               guests: singleGuestCount
            }];

         // Create booking
         const bookingResult = await createBooking(itemsToBook, {
            firstName: guestDetails.firstName,
            lastName: guestDetails.lastName,
            email: guestDetails.email,
            phone: guestDetails.phone,
            specialRequests: guestDetails.specialRequests
         });

         if (!bookingResult.success) {
            setPaymentError(bookingResult.error);
            setIsLoading(false);
            return;
         }

         // Create PayMongo checkout session
         const checkoutResponse = await fetch('/api/payments/create-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
               bookingId: bookingResult.bookingId,
               verificationToken: bookingResult.verificationToken 
            })
         });

         const checkoutData = await checkoutResponse.json();

         if (!checkoutResponse.ok || checkoutData.error) {
            setPaymentError(checkoutData.error || 'Failed to create payment session');
            setIsLoading(false);
            return;
         }

         // Clear cart and open PayMongo checkout in new tab
         clearCart();
         window.location.href = checkoutData.checkoutUrl;

         // Start polling
         setPollingBookingId(bookingResult.bookingId);
         // Keep loading state true to show "Processing..." UI

      } catch (error) {
         console.error('Booking error:', error);
         setPaymentError('An unexpected error occurred. Please try again.');
         setIsLoading(false);
      }
   };

   if (!isCartMode && (!property || !room)) {
      return (
         <div className="text-center py-24">
            <h1 className="text-3xl font-serif">Details not found</h1>
            <p className="text-muted-foreground mt-4">Please select a room to start your booking.</p>
            <Button onClick={() => router.push("/properties")} className="mt-8 rounded-none uppercase tracking-widest text-xs">
               Browse Properties
            </Button>
         </div>
      );
   }

   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setGuestDetails(prev => ({ ...prev, [name]: value }));
   };

   const toggleExtra = (id: string) => {
      setSelectedExtras(prev =>
         prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
      );
   };

   const handleApplyCoupon = async () => {
      try {
         const coupon = await getCouponByCode(couponCode);
         if (coupon) {
            setAppliedCoupon({ code: coupon.code, type: coupon.type, value: coupon.value });
            setCouponError("");
         } else {
            setCouponError("Invalid or expired coupon code");
            setAppliedCoupon(null);
         }
      } catch (error) {
         setCouponError("Error validating coupon");
         setAppliedCoupon(null);
      }
   };

   const handleRemoveCoupon = () => {
      setAppliedCoupon(null);
      setCouponCode("");
      setCouponError("");
   };

   return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
         {/* Left Column - Guest Details Form */}
         <div className="lg:col-span-7 lg:order-1 space-y-6 order-2">
            <div className="mb-12">
               <h1 className="text-4xl md:text-6xl font-serif font-light mb-4">Secure Checkout</h1>
               <p className="text-neutral-400">Complete your reservation.</p>
            </div>
            
            {/* Guest Details Form */}
            <div>
               <h2 className="text-3xl font-serif italic mb-6">Guest Details</h2>
               <form id="booking-form" onSubmit={handleBooking} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest text-neutral-500">First Name <span className="text-red-500">*</span></label>
                        <Input name="firstName" value={guestDetails.firstName} onChange={handleInputChange} required className="bg-neutral-950 border-white/10 text-white h-12 rounded-none focus:border-orange-500/50 focus:ring-0 transition-colors" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest text-neutral-500">Last Name <span className="text-red-500">*</span></label>
                        <Input name="lastName" value={guestDetails.lastName} onChange={handleInputChange} required className="bg-neutral-950 border-white/10 text-white h-12 rounded-none focus:border-orange-500/50 focus:ring-0 transition-colors" />
                     </div>
                  </div>
                  <div className="space-y-2">
                     <label className="text-xs uppercase tracking-widest text-neutral-500">Email Address <span className="text-red-500">*</span></label>
                     <Input name="email" value={guestDetails.email} onChange={handleInputChange} type="email" required className="bg-neutral-950 border-white/10 text-white h-12 rounded-none focus:border-orange-500/50 focus:ring-0 transition-colors" />
                  </div>
                  <div className="space-y-2">
                     <label className="text-xs uppercase tracking-widest text-neutral-500">Phone Number <span className="text-red-500">*</span></label>
                     <Input name="phone" value={guestDetails.phone} onChange={handleInputChange} type="tel" required className="bg-neutral-950 border-white/10 text-white h-12 rounded-none focus:border-orange-500/50 focus:ring-0 transition-colors" />
                  </div>
                  <div className="space-y-2">
                     <label className="text-xs uppercase tracking-widest text-neutral-500">Special Requests</label>
                     <Input name="specialRequests" value={guestDetails.specialRequests} onChange={handleInputChange} className="bg-neutral-950 border-white/10 text-white h-12 rounded-none focus:border-orange-500/50 focus:ring-0 transition-colors" placeholder="Dietary restrictions, early check-in, etc." />
                  </div>
               </form>
            </div>

            {/* Payment Error Message */}
            {paymentError && (
               <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 border border-red-400/20">
                  <X className="h-4 w-4" />
                  {paymentError}
               </div>
            )}

            {/* Availability Error Message */}
            {availabilityError && !paymentError && (
               <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 border border-red-400/20">
                  <AlertCircle className="h-4 w-4" />
                  {availabilityError}
               </div>
            )}

            {/* Payment Button */}
            <Button
               type="submit"
               form="booking-form"
               disabled={isLoading || availabilityLoading || !canProceedWithBooking || !guestDetails.firstName || !guestDetails.lastName || !guestDetails.email || !guestDetails.phone}
               className="w-full h-16 rounded-none text-sm uppercase tracking-widest bg-white text-black hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
               {isLoading ? (
                  <>
                     <Loader2 className="h-5 w-5 animate-spin" />
                     Processing...
                  </>
               ) : availabilityLoading ? (
                  <>
                     <Loader2 className="h-5 w-5 animate-spin" />
                     Checking Availability...
                  </>
               ) : !canProceedWithBooking ? (
                  <>
                     <AlertCircle className="h-4 w-4" />
                     Room Unavailable
                  </>
               ) : (
                  <>
                     <Lock className="h-4 w-4" />
                     Proceed to Secure Payment
                  </>
               )}
            </Button>
            <p className="text-xs text-center text-neutral-500">You will be redirected to PayMongo to complete your payment securely.</p>
         </div>
         {/* Right Column - Booking Summary */}
         <div className="lg:col-span-5 lg:order-2 order-1">
            <div className="sticky top-32 bg-neutral-900/50 border border-white/10 p-6 space-y-6">
               <h3 className="text-lg font-medium border-b border-white/10 pb-4">Booking Summary</h3>

               {/* Your Stay - Room Details with Dates & Guests */}
               <div className="space-y-4">
                  <h4 className="text-xs uppercase tracking-widest text-neutral-500">Your Stay</h4>
                  
                  {/* Room Items */}
                  {isCartMode ? (
                     <div className="space-y-4">
                        {cartItems.map((item, index) => (
                           <div key={item.id || index} className="bg-neutral-900/50 border border-white/5 overflow-hidden">
                              {/* Room Image */}
                              {item.roomImage && (
                                 <div className="relative h-32 w-full">
                                    <Image
                                       src={item.roomImage}
                                       alt={item.roomName || 'Room'}
                                       fill
                                       className="object-cover"
                                    />
                                 </div>
                              )}
                              <div className="p-3 space-y-3">
                                 <div className="flex justify-between items-start">
                                    <div>
                                       <p className="font-medium text-sm">{item.roomName || 'Room'}</p>
                                       <p className="text-xs text-neutral-400">{item.propertyName || 'Property'}</p>
                                    </div>
                                    <span className="text-sm font-medium">₱{((item.roomPrice || 0) * Math.max(1, differenceInDays(item.checkOut, item.checkIn))).toLocaleString()}</span>
                                 </div>
                                 
                                 {/* Editable Dates & Guests */}
                                 <div className="space-y-3">
                                    <div className="grid grid-cols-3 gap-2">
                                       <div className="space-y-1">
                                          <p className="text-xs uppercase tracking-widest text-neutral-500">Check-in</p>
                                          <Popover>
                                             <PopoverTrigger asChild>
                                                <Button
                                                   variant={"outline"}
                                                   className={cn(
                                                      "w-full justify-start text-left font-normal bg-transparent border-white/20 text-white h-9 px-3 text-xs rounded-none hover:bg-white/5",
                                                      !item.checkIn && "text-muted-foreground"
                                                   )}
                                                >
                                                   {item.checkIn ? format(new Date(item.checkIn), "MMM dd, y") : <span>Pick date</span>}
                                                </Button>
                                             </PopoverTrigger>
                                             <PopoverContent className="w-auto p-0 bg-neutral-900 border-neutral-800" align="start">
                                                <Calendar
                                                   mode="single"
                                                   selected={new Date(item.checkIn)}
                                                   onSelect={(date) => {
                                                      if (!date) return;
                                                      const newDate = date;
                                                      newDate.setHours(0,0,0,0);
                                                      
                                                      const currentCheckOut = new Date(item.checkOut);
                                                      let newCheckOut = currentCheckOut;
                                                      if (newDate >= currentCheckOut) {
                                                         newCheckOut = addDays(newDate, 1);
                                                      }

                                                      const updatedItems = cartItems.map((ci, i) => 
                                                         i === index ? { ...ci, checkIn: newDate, checkOut: newCheckOut } : ci
                                                      );
                                                      setCartItems(updatedItems);
                                                      if (item.id) {
                                                         updateCartItem(item.id, { checkIn: newDate, checkOut: newCheckOut });
                                                      }
                                                   }}
                                                   disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                                                   initialFocus
                                                   className="text-white"
                                                   classNames={{
                                                      day_selected: "bg-white text-black hover:bg-white/90 hover:text-black",
                                                      day_today: "bg-neutral-800 text-white",
                                                      day: "h-9 w-9 p-0 font-normal text-white hover:bg-neutral-800 rounded-md cursor-pointer",
                                                   }}
                                                />
                                             </PopoverContent>
                                          </Popover>
                                       </div>
                                       <div className="space-y-1">
                                          <p className="text-xs uppercase tracking-widest text-neutral-500">Check-out</p>
                                          <Popover>
                                             <PopoverTrigger asChild>
                                                <Button
                                                   variant={"outline"}
                                                   className={cn(
                                                      "w-full justify-start text-left font-normal bg-transparent border-white/20 text-white h-9 px-3 text-xs rounded-none hover:bg-white/5",
                                                      !item.checkOut && "text-muted-foreground"
                                                   )}
                                                >
                                                   {item.checkOut ? format(new Date(item.checkOut), "MMM dd, y") : <span>Pick date</span>}
                                                </Button>
                                             </PopoverTrigger>
                                             <PopoverContent className="w-auto p-0 bg-neutral-900 border-neutral-800" align="start">
                                                <Calendar
                                                   mode="single"
                                                   selected={new Date(item.checkOut)}
                                                   onSelect={(date) => {
                                                      if (!date) return;
                                                      const newDate = date;
                                                      newDate.setHours(0,0,0,0);

                                                      const updatedItems = cartItems.map((ci, i) => 
                                                         i === index ? { ...ci, checkOut: newDate } : ci
                                                      );
                                                      setCartItems(updatedItems);
                                                      if (item.id) {
                                                         updateCartItem(item.id, { checkOut: newDate });
                                                      }
                                                   }}
                                                   disabled={(date) => {
                                                      const checkIn = new Date(item.checkIn);
                                                      return date <= checkIn;
                                                   }}
                                                   initialFocus
                                                   className="text-white"
                                                   classNames={{
                                                      day_selected: "bg-white text-black hover:bg-white/90 hover:text-black",
                                                      day_today: "bg-neutral-800 text-white",
                                                      day: "h-9 w-9 p-0 font-normal text-white hover:bg-neutral-800 rounded-md cursor-pointer",
                                                   }}
                                                />
                                             </PopoverContent>
                                          </Popover>
                                       </div>
                                    <div className="space-y-1">
                                       <p className="text-xs uppercase tracking-widest text-neutral-500">Guests</p>
                                       <select
                                          value={item.guests}
                                          onChange={(e) => {
                                             const newGuests = Number(e.target.value);
                                             const updatedItems = cartItems.map((ci, i) => 
                                                i === index ? { ...ci, guests: newGuests } : ci
                                             );
                                             setCartItems(updatedItems);
                                             if (item.id) {
                                                updateCartItem(item.id, { guests: newGuests });
                                             }
                                          }}
                                          className="w-full bg-neutral-950 border border-white/10 text-white h-10 px-3 text-sm rounded-none focus:border-orange-500/50 focus:ring-0 cursor-pointer"
                                       >
                                          {Array.from({ length: 6 }, (_, i) => i + 1).map((num) => (
                                             <option key={num} value={num}>{num} Guest{num > 1 ? 's' : ''}</option>
                                          ))}
                                       </select>
                                    </div>
                                 </div>
                                 </div>
                                 
                                 {/* Per-item availability status */}
                                 {(() => {
                                    const itemAvailability = getCartItemAvailability(item.id);
                                    if (itemAvailability) {
                                       if (!itemAvailability.available) {
                                          return (
                                             <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/10 p-2 border border-red-400/20">
                                                <AlertCircle className="h-3 w-3" />
                                                <span>{itemAvailability.error || 'Not available for selected dates'}</span>
                                             </div>
                                          );
                                       } else if (itemAvailability.availableUnits > 0) {
                                          return (
                                             <div className="flex items-center gap-2 text-xs">
                                                <span className={cn(
                                                   "px-2 py-1",
                                                   itemAvailability.availableUnits <= 2 
                                                      ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                                                      : "bg-green-500/10 text-green-400 border border-green-500/20"
                                                )}>
                                                   {itemAvailability.availableUnits} unit{itemAvailability.availableUnits !== 1 ? 's' : ''} available
                                                </span>
                                             </div>
                                          );
                                       }
                                    }
                                    return null;
                                 })()}
                                 
                                 <div className="flex justify-between items-center text-xs pt-2 border-t border-white/5">
                                    <span className="text-neutral-400">{Math.max(1, differenceInDays(item.checkOut, item.checkIn))} Night{Math.max(1, differenceInDays(item.checkOut, item.checkIn)) > 1 ? 's' : ''}</span>
                                    <span className="text-neutral-400">₱{(item.roomPrice || 0).toLocaleString()}/night</span>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  ) : (
                     <div className="bg-neutral-900/50 border border-white/5 overflow-hidden">
                        <div className="relative h-32 w-full bg-neutral-800">
                           <div className="absolute inset-0 flex items-center justify-center text-neutral-500 text-sm">
                              Room Preview
                           </div>
                        </div>
                        <div className="p-3 space-y-3">
                           <p className="font-medium text-sm">Selected Room</p>
                           
                           {/* Editable Dates & Guests */}
                           <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                 <div className="space-y-1">
                                    <p className="text-xs uppercase tracking-widest text-neutral-500">Check-in</p>
                                    <Popover>
                                       <PopoverTrigger asChild>
                                          <Button
                                             variant={"outline"}
                                             className={cn(
                                                "w-full justify-start text-left font-normal bg-transparent border-white/20 text-white h-9 px-3 text-xs rounded-none hover:bg-white/5",
                                                !date?.from && "text-muted-foreground"
                                             )}
                                          >
                                             {date?.from ? format(date.from, "MMM dd, y") : <span>Pick date</span>}
                                          </Button>
                                       </PopoverTrigger>
                                       <PopoverContent className="w-auto p-0 bg-neutral-900 border-neutral-800" align="start">
                                          <Calendar
                                             mode="single"
                                             selected={date?.from}
                                             onSelect={(newDate) => {
                                                if (!newDate) return;
                                                const newDateNormalized = newDate;
                                                newDateNormalized.setHours(0,0,0,0);
                                                
                                                if (date?.to && newDateNormalized >= date.to) {
                                                   setDate({ from: newDateNormalized, to: addDays(newDateNormalized, 1) });
                                                } else {
                                                   setDate({ ...date, from: newDateNormalized });
                                                }
                                             }}
                                             disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                                             initialFocus
                                             className="text-white"
                                             classNames={{
                                                day_selected: "bg-white text-black hover:bg-white/90 hover:text-black",
                                                day_today: "bg-neutral-800 text-white",
                                                day: "h-9 w-9 p-0 font-normal text-white hover:bg-neutral-800 rounded-md cursor-pointer",
                                             }}
                                          />
                                       </PopoverContent>
                                    </Popover>
                                 </div>
                                 <div className="space-y-1">
                                    <p className="text-xs uppercase tracking-widest text-neutral-500">Check-out</p>
                                    <Popover>
                                       <PopoverTrigger asChild>
                                          <Button
                                             variant={"outline"}
                                             className={cn(
                                                "w-full justify-start text-left font-normal bg-transparent border-white/20 text-white h-9 px-3 text-xs rounded-none hover:bg-white/5",
                                                !date?.to && "text-muted-foreground"
                                             )}
                                          >
                                             {date?.to ? format(date.to, "MMM dd, y") : <span>Pick date</span>}
                                          </Button>
                                       </PopoverTrigger>
                                       <PopoverContent className="w-auto p-0 bg-neutral-900 border-neutral-800" align="start">
                                          <Calendar
                                             mode="single"
                                             selected={date?.to}
                                             onSelect={(newDate) => {
                                                if (!newDate) return;
                                                const newDateNormalized = newDate;
                                                newDateNormalized.setHours(0,0,0,0);
                                                setDate({ ...date, to: newDateNormalized, from: date?.from });
                                             }}
                                             disabled={(day) => {
                                                if (!date?.from) return false;
                                                return day <= date.from;
                                             }}
                                             initialFocus
                                             className="text-white"
                                             classNames={{
                                                day_selected: "bg-white text-black hover:bg-white/90 hover:text-black",
                                                day_today: "bg-neutral-800 text-white",
                                                day: "h-9 w-9 p-0 font-normal text-white hover:bg-neutral-800 rounded-md cursor-pointer",
                                             }}
                                          />
                                       </PopoverContent>
                                    </Popover>
                                 </div>
                              </div>
                              <div className="space-y-1">
                                 <p className="text-xs uppercase tracking-widest text-neutral-500">Guests</p>
                                 <select
                                    value={singleGuestCount}
                                    onChange={(e) => setSingleGuestCount(Number(e.target.value))}
                                    className="w-full bg-neutral-950 border border-white/10 text-white h-10 px-3 text-sm rounded-none focus:border-orange-500/50 focus:ring-0 cursor-pointer"
                                 >
                                    {Array.from({ length: 6 }, (_, i) => i + 1).map((num) => (
                                       <option key={num} value={num}>{num} Guest{num > 1 ? 's' : ''}</option>
                                    ))}
                                 </select>
                              </div>
                           </div>
                           
                           {/* Single room availability status */}
                           {singleRoomAvailability && (
                              <div className="pt-2">
                                 {!singleRoomAvailability.available ? (
                                    <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/10 p-2 border border-red-400/20">
                                       <AlertCircle className="h-3 w-3" />
                                       <span>Not available for selected dates</span>
                                    </div>
                                 ) : (
                                    <div className="flex items-center gap-2 text-xs">
                                       <span className={cn(
                                          "px-2 py-1",
                                          singleRoomAvailability.availableUnits <= 2 
                                             ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                                             : "bg-green-500/10 text-green-400 border border-green-500/20"
                                       )}>
                                          {singleRoomAvailability.availableUnits} unit{singleRoomAvailability.availableUnits !== 1 ? 's' : ''} available
                                       </span>
                                    </div>
                                 )}
                              </div>
                           )}
                           {availabilityLoading && (
                              <div className="flex items-center gap-2 text-xs text-neutral-400">
                                 <Loader2 className="h-3 w-3 animate-spin" />
                                 <span>Checking availability...</span>
                              </div>
                           )}
                        </div>
                     </div>
                  )}
               </div>

               {/* Add-ons Section */}
               <div className="border-t border-white/10 pt-4 space-y-3">
                  <h4 className="text-xs uppercase tracking-widest text-neutral-500">Enhance Your Stay</h4>
                  <Popover>
                     <PopoverTrigger asChild>
                        <Button
                           variant="outline"
                           role="combobox"
                           className="w-full justify-between h-12 bg-neutral-950 border-white/10 text-white hover:bg-white/5 hover:text-white rounded-none text-xs"
                        >
                           {selectedExtras.length > 0
                              ? `${selectedExtras.length} Add-on${selectedExtras.length > 1 ? 's' : ''} Selected`
                              : "Select Add-ons (Optional)"}
                           <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                     </PopoverTrigger>
                     <PopoverContent className="w-[300px] p-0 bg-neutral-900 border-white/10 rounded-none" align="start">
                        <Command className="bg-transparent text-white">
                           <CommandList>
                              <CommandGroup>
                                 {EXTRAS.map((extra) => (
                                    <CommandItem
                                       key={extra.id}
                                       value={extra.label}
                                       onSelect={() => toggleExtra(extra.id)}
                                       className="cursor-pointer hover:bg-white/10 aria-selected:bg-white/10 py-3"
                                    >
                                       <div className={cn(
                                          "mr-3 flex h-4 w-4 items-center justify-center border transition-colors border-white/30",
                                          selectedExtras.includes(extra.id) ? "bg-orange-500 border-orange-500" : "bg-transparent"
                                       )}>
                                          <Check
                                             className={cn(
                                                "h-3 w-3 text-black",
                                                selectedExtras.includes(extra.id) ? "opacity-100" : "opacity-0"
                                             )}
                                          />
                                       </div>
                                       <div className="flex flex-1 justify-between items-center">
                                          <span className="text-xs">{extra.label}</span>
                                          <span className="text-xs text-neutral-400">₱{extra.price.toLocaleString()}</span>
                                       </div>
                                    </CommandItem>
                                 ))}
                              </CommandGroup>
                           </CommandList>
                        </Command>
                     </PopoverContent>
                  </Popover>
               </div>

               {/* Promo Code Section */}
               <div className="border-t border-white/10 pt-4 space-y-3">
                  <h4 className="text-xs uppercase tracking-widest text-neutral-500">Promo Code</h4>
                  {appliedCoupon ? (
                     <div className="flex justify-between items-center bg-white/5 p-3 border border-white/10">
                        <div className="flex items-center gap-2">
                           <Check className="h-4 w-4 text-green-500" />
                           <span className="text-sm font-medium">{appliedCoupon.code}</span>
                        </div>
                        <Button
                           variant="ghost"
                           size="sm"
                           onClick={handleRemoveCoupon}
                           className="h-auto p-0 text-neutral-400 hover:text-white hover:bg-transparent"
                        >
                           <X className="h-4 w-4" />
                        </Button>
                     </div>
                  ) : (
                     <div className="space-y-2">
                        <div className="flex gap-2">
                           <Input
                              value={couponCode}
                              onChange={(e) => setCouponCode(e.target.value)}
                              placeholder="Enter code"
                              className="bg-neutral-950 border-white/10 text-white h-10 text-xs rounded-none focus:border-orange-500/50"
                           />
                           <Button
                              onClick={handleApplyCoupon}
                              disabled={!couponCode}
                              className="h-10 px-4 bg-white text-black text-xs uppercase tracking-widest rounded-none hover:bg-neutral-200"
                           >
                              Apply
                           </Button>
                        </div>
                        {couponError && <p className="text-red-500 text-[10px]">{couponError}</p>}
                     </div>
                  )}
               </div>

               {/* Price Breakdown */}
               <div className="space-y-2 text-sm border-t border-white/10 pt-4">
                  <div className="flex justify-between">
                     <span className="text-neutral-400">{isCartMode ? 'Room Total' : `Room Rate x ${singleNights} Night${singleNights > 1 ? 's' : ''}`}</span>
                     <span>₱{roomSubtotal.toLocaleString()}</span>
                  </div>
                  {selectedExtras.length > 0 && (
                     <div className="py-2 space-y-1 border-t border-white/5 my-2">
                        {selectedExtras.map(id => {
                           const extra = EXTRAS.find(e => e.id === id);
                           return (
                              <div key={id} className="flex justify-between text-neutral-300">
                                 <span>{extra?.label}</span>
                                 <span>₱{extra?.price.toLocaleString()}</span>
                              </div>
                           );
                        })}
                     </div>
                  )}
                  {appliedCoupon && (
                     <div className="flex justify-between text-green-500">
                        <span>Discount ({appliedCoupon.code})</span>
                        <span>-₱{discountAmount.toLocaleString()}</span>
                     </div>
                  )}
                  <div className="flex justify-between">
                     <span className="text-neutral-400">Service Charge ({(config.serviceChargeRate * 100).toFixed(0)}%)</span>
                     <span>₱{serviceCharge.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                     <span className="text-neutral-400">VAT ({(config.taxRate * 100).toFixed(0)}%)</span>
                     <span>₱{taxes.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-4 mt-4 text-lg font-medium">
                     <span>Total</span>
                     <span className="text-orange-500">₱{total.toLocaleString()}</span>
                  </div>
               </div>

               {/* Property Policies */}
               {config.policies.length > 0 && (
                  <div className="border-t border-white/10 pt-4 space-y-3">
                     <h4 className="text-xs uppercase tracking-widest text-neutral-500">Property Policies</h4>
                     <div className="space-y-2 text-xs">
                        {config.policies.map((policy, index) => (
                           <div key={index}>
                              <p className="text-neutral-400 font-medium">{policy.title}</p>
                              <p className="text-neutral-500">{policy.description}</p>
                           </div>
                        ))}
                     </div>
                  </div>
               )}
            </div>
         </div>
      </div>
   );
}

export default function BookingPage() {
   return (
      <div className="min-h-screen bg-neutral-950 text-white pt-32 pb-24">
         <div className="container mx-auto px-4">
            <Suspense fallback={<div className="text-center p-12">Loading booking details...</div>}>
               <BookingForm />
            </Suspense>
         </div>
      </div>
   );
}