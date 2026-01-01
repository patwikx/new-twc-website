"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROPERTIES, TAX_RATE, SERVICE_CHARGE_RATE, COUPONS, POLICIES } from "@/lib/mock-data";
import { CartItem, useCartStore } from "@/store/useCartStore";
import { motion } from "framer-motion";
import { CreditCard, Lock, Check, X, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useRef } from "react";
import { addDays, differenceInDays, parseISO, format } from "date-fns";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/booking/DateRangePicker";
import { createBooking } from "@/actions/create-booking";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
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
      } else if (!propertySlug && !roomId && storedItems.length > 0) {
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
   const [date, setDate] = useState<DateRange | undefined>({
      from: checkInParam ? parseISO(checkInParam) : new Date(),
      to: checkOutParam ? parseISO(checkOutParam) : addDays(new Date(), 1),
   });

   const property = PROPERTIES.find(p => p.slug === propertySlug);
   const room = property?.rooms.find(r => r.id === roomId);

   const [isLoading, setIsLoading] = useState(false);
   const [paymentError, setPaymentError] = useState("");
   const [pollingBookingId, setPollingBookingId] = useState<string | null>(null);
   const [bookingShortRef, setBookingShortRef] = useState<string | null>(null);
   const clearCart = useCartStore((state) => state.clearCart);

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
   const [appliedCoupon, setAppliedCoupon] = useState<{code: string, amount: number} | null>(null);
   const [couponError, setCouponError] = useState("");

   // Single Room Guest Count
   const [singleGuestCount, setSingleGuestCount] = useState(room?.capacity || 2);

   // Calculations
   const cartSubtotal = cartItems.reduce((acc, item) => {
      const nights = Math.max(1, differenceInDays(item.checkOut, item.checkIn));
      // Need to find price. Item usually has it, but let's look up to be safe or use item if available.
      // Assuming item has price (it does in store)
      const roomPrice = PROPERTIES.find(p => p.slug === item.propertySlug)?.rooms.find(r => r.id === item.roomId)?.price || 0;
      return acc + (roomPrice * nights);
   }, 0);

   const singleNights = date?.from && date?.to ? Math.max(1, differenceInDays(date.to, date.from)) : 1;
   const singleRoomTotal = (room?.price || 0) * singleNights;

   const roomSubtotal = isCartMode ? cartSubtotal : singleRoomTotal;
   const extrasTotal = selectedExtras.reduce((sum, id) => sum + (EXTRAS.find(e => e.id === id)?.price || 0), 0);
   const subtotal = roomSubtotal + extrasTotal;

   // Discount
   let discountAmount = 0;
   if (appliedCoupon) {
       const coupon = COUPONS.find(c => c.code === appliedCoupon.code);
       if (coupon) {
           if (coupon.type === 'percent') {
               discountAmount = subtotal * coupon.value;
           } else {
               discountAmount = coupon.value;
           }
       }
   }

   const discountedSubtotal = Math.max(0, subtotal - discountAmount);
   const serviceCharge = discountedSubtotal * SERVICE_CHARGE_RATE;
   const taxes = discountedSubtotal * TAX_RATE;
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
                  if (property?.name) params.set("propertyName", property.name);
                  if (room?.name) params.set("roomName", room.name);
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
            body: JSON.stringify({ bookingId: bookingResult.bookingId })
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

   const handleApplyCoupon = () => {
      const coupon = COUPONS.find(c => c.code === couponCode.toUpperCase());
      if (coupon) {
         setAppliedCoupon({ code: coupon.code, amount: 0 });
         setCouponError("");
      } else {
         setCouponError("Invalid coupon code");
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
         {/* Form - Second on mobile, first (left) on desktop */}
         <div className="lg:col-span-7 lg:order-1 space-y-6 order-2">
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

             <div className="border-t border-white/10 pt-6">
                <h2 className="text-3xl font-serif italic mb-6">Enhance Your Stay</h2>
                <div className="grid grid-cols-1 gap-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between h-14 bg-neutral-950 border-white/10 text-white hover:bg-white/5 hover:text-white rounded-none uppercase tracking-widest text-xs"
                      >
                        {selectedExtras.length > 0
                          ? `${selectedExtras.length} Item${selectedExtras.length > 1 ? 's' : ''} Selected`
                          : "Select Add-ons (Optional)"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[500px] p-0 bg-neutral-900 border-white/10 rounded-none" align="start">
                      <Command className="bg-transparent text-white">
                        <CommandList>
                          <CommandGroup>
                            {EXTRAS.map((extra) => (
                              <CommandItem
                                key={extra.id}
                                value={extra.label}
                                onSelect={() => toggleExtra(extra.id)}
                                className="cursor-pointer hover:bg-white/10 aria-selected:bg-white/10 py-4"
                              >
                                <div className={cn(
                                  "mr-4 flex h-4 w-4 items-center justify-center border transition-colors border-white/30",
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
                                    <span className="text-sm font-light tracking-wide">{extra.label}</span>
                                    <span className="text-sm font-serif italic text-neutral-400">₱{extra.price.toLocaleString()}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
             </div>
             
             {/* Payment Error Message */}
             {paymentError && (
               <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 border border-red-400/20">
                  <X className="h-4 w-4" />
                  {paymentError}
               </div>
             )}
             
             <Button 
               type="submit" 
               form="booking-form"
               disabled={isLoading || !guestDetails.firstName || !guestDetails.lastName || !guestDetails.email || !guestDetails.phone} 
               className="w-full h-16 rounded-none text-sm uppercase tracking-widest bg-white text-black hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed flex items-center justify-center gap-3" 
             >
               {isLoading ? (
                 <>
                   <Loader2 className="h-5 w-5 animate-spin" />
                   Processing...
                 </>
               ) : (
                 <>
                   <Lock className="h-4 w-4" />
                   Proceed to Secure Payment
                 </>
               )}
             </Button>
             <p className="text-xs text-center text-neutral-500">You will be redirected to PayMongo to complete your payment securely.</p>

             <div className="border-t border-white/10 pt-12">
                <h2 className="text-3xl font-serif italic mb-6">Property Policies</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                    {POLICIES.map((policy, index) => (
                        <div key={index} className="space-y-2">
                            <h4 className="uppercase tracking-widest text-xs text-neutral-500">{policy.title}</h4>
                            <p className="text-neutral-300 font-light leading-relaxed">{policy.description}</p>
                        </div>
                    ))}
                </div>
             </div>
         </div>

         {/* Summary Sidebar - First on mobile, right side on desktop */}
         <div className="lg:col-span-5 lg:order-2 order-1">
            <div className="bg-white/5 border border-white/10 p-8 sticky top-24">
               <h3 className="text-xl font-serif italic mb-6">Your Stay</h3>
               
               {isCartMode ? (
                 <div className="space-y-6 mb-6">
                   {cartItems.map((item, idx) => {
                     // Find details again safe
                     const p = PROPERTIES.find(p => p.slug === item.propertySlug);
                     const r = p?.rooms.find(r => r.id === item.roomId);
                     if (!p || !r) return null;
                     
                     const itemNights = Math.max(1, differenceInDays(item.checkOut, item.checkIn));
                     return (
                       <div key={idx} className="flex gap-4 border-b border-white/10 pb-4 last:border-0 last:pb-0">
                         <div className="h-16 w-16 relative bg-neutral-800 shrink-0">
                           <Image src={r.image || p.image} alt={r.name} fill className="object-cover" />
                         </div>
                         <div className="flex-1">
                           <p className="text-[10px] uppercase tracking-widest text-neutral-500">{p.name}</p>
                           <p className="font-medium text-sm">{r.name}</p>
                           <div className="flex justify-between mt-1 text-xs text-neutral-400">
                             <span>{format(item.checkIn, "MMM d")} - {format(item.checkOut, "MMM d")}</span>
                             <span>{item.guests} Guests</span>
                           </div>
                           <p className="text-right text-sm font-medium mt-1">₱{(r.price * itemNights).toLocaleString()}</p>
                         </div>
                       </div>
                     );
                   })}
                 </div>
               ) : (
                 <>
                   <div className="aspect-video relative rounded-none overflow-hidden mb-6">
                      <Image src={room?.image || property?.image || ""} alt={room?.name || ""} fill className="object-cover" />
                   </div>

                   <div className="space-y-4 border-b border-white/10 pb-6 mb-6">
                      <div>
                         <p className="text-xs uppercase tracking-widest text-neutral-500">Property</p>
                         <p className="font-medium text-lg">{property?.name}</p>
                      </div>
                      <div>
                         <p className="text-xs uppercase tracking-widest text-neutral-500">Room</p>
                         <p className="font-medium">{room?.name}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <p className="text-xs uppercase tracking-widest text-neutral-500 mb-2">
                               Dates <span className="text-orange-500/70 normal-case text-[10px]">(Click to change)</span>
                            </p>
                            <DateRangePicker 
                               date={date} 
                               setDate={setDate}
                               className="text-sm border-white/20"
                            />
                         </div>
                         <div>
                            <p className="text-xs uppercase tracking-widest text-neutral-500 mb-2">
                               Guests <span className="text-orange-500/70 normal-case text-[10px]">(Max {room?.capacity})</span>
                            </p>
                            <select 
                               value={singleGuestCount}
                               onChange={(e) => setSingleGuestCount(Number(e.target.value))}
                               className="w-full bg-neutral-950 border border-white/10 text-white h-10 px-3 text-sm rounded-none focus:border-orange-500/50 focus:ring-0 cursor-pointer"
                            >
                               {Array.from({ length: room?.capacity || 2 }, (_, i) => i + 1).map((num) => (
                                  <option key={num} value={num}>{num} Guest{num > 1 ? 's' : ''}</option>
                               ))}
                            </select>
                         </div>
                      </div>
                   </div>
                 </>
               )}

               <div className="pt-4 border-t border-white/10">
                   <p className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Promo Code</p>
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

               <div className="space-y-2 text-sm mt-6">
                  <div className="flex justify-between">
                     <span className="text-neutral-400">{isCartMode ? 'Full Stay Total' : `Room Rate x ${singleNights} Night${singleNights > 1 ? 's' : ''}`}</span>
                     <span>₱{roomSubtotal.toLocaleString()}</span>
                  </div>
                  {appliedCoupon && (
                     <div className="flex justify-between text-green-500">
                        <span>Discount ({appliedCoupon.code})</span>
                        <span>-₱{discountAmount.toLocaleString()}</span>
                     </div>
                  )}
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
                  <div className="flex justify-between">
                     <span className="text-neutral-400">Service Charge ({(SERVICE_CHARGE_RATE * 100).toFixed(0)}%)</span>
                     <span>₱{serviceCharge.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                     <span className="text-neutral-400">VAT ({(TAX_RATE * 100).toFixed(0)}%)</span>
                     <span>₱{taxes.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-4 mt-4 text-lg font-medium">
                     <span>Total</span>
                     <span className="text-orange-500">₱{total.toLocaleString()}</span>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}

export default function BookingPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white pt-32 pb-24">
       <div className="container mx-auto px-4">
          <motion.div
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             className="mb-12"
          >
             <h1 className="text-4xl md:text-6xl font-serif font-light mb-4">Secure Checkout</h1>
             <p className="text-neutral-400">Complete your reservation.</p>
          </motion.div>

          <Suspense fallback={<div className="text-center p-12">Loading booking details...</div>}>
             <BookingForm />
          </Suspense>
       </div>
    </div>
  );
}
