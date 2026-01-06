"use client";

import { useCartStore } from "@/store/useCartStore";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { X, Calendar, User, ShoppingBag, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { useState } from "react";

export function ReservationDrawer({ children }: { children?: React.ReactNode }) {
  const { items, removeFromCart, getCartSubtotal, toggleDrawer, isDrawerOpen, setDrawerOpen } = useCartStore();
  const subtotal = getCartSubtotal();
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Sheet open={isDrawerOpen} onOpenChange={setDrawerOpen}>
      {children && <SheetTrigger asChild>{children}</SheetTrigger>}
      <SheetContent className="w-full sm:max-w-md bg-neutral-950 border-white/10 text-white flex flex-col p-0">
        <SheetHeader className="p-6 border-b border-white/10 space-y-1">
          <div className="flex items-center gap-2 text-orange-500 uppercase tracking-widest text-xs font-bold">
            <ShoppingBag className="w-4 h-4" />
            <span>My Stay</span>
          </div>
          <SheetTitle className="text-3xl font-serif font-light text-white">Your Reservation</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
              <Calendar className="w-8 h-8 text-neutral-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-white">No rooms selected</h3>
              <p className="text-sm text-neutral-400 max-w-xs">
                Browse our curated collection of sanctuaries and select a room to begin your journey.
              </p>
            </div>
            <SheetClose asChild>
              <Button variant="outline" className="mt-4 border-white/20 text-white hover:bg-white hover:text-black rounded-none uppercase tracking-widest text-xs">
                Explore Properties
              </Button>
            </SheetClose>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                {items.map((item) => {
                  // Normalize dates to midnight for consistent nights calculation
                  const checkInNormalized = new Date(item.checkIn);
                  const checkOutNormalized = new Date(item.checkOut);
                  checkInNormalized.setHours(0, 0, 0, 0);
                  checkOutNormalized.setHours(0, 0, 0, 0);
                  const nights = Math.max(1, Math.round((checkOutNormalized.getTime() - checkInNormalized.getTime()) / (24 * 60 * 60 * 1000)));

                  return (
                    <div key={item.id} className="group relative flex gap-4 animate-in fade-in slide-in-from-right-4 duration-500">
                      {/* Tiny Image Thumbnail */}
                      <div className="relative w-20 h-24 flex-shrink-0 bg-neutral-800 border border-white/10">
                          {item.roomImage ? (
                            <Image 
                               src={item.roomImage} 
                               alt={item.roomName || "Room"} 
                               fill 
                               className="object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-500 text-xs">
                              No Image
                            </div>
                          )}
                      </div>
                      
                      <div className="flex-1 space-y-2">
                        <div className="flex justify-between items-start">
                          <h4 className="font-serif text-lg leading-tight tracking-tight break-words pr-2">{item.roomName}</h4>
                          <button 
                            onClick={() => removeFromCart(item.id)}
                            className="text-neutral-500 hover:text-white transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="space-y-1">
                            <p className="text-xs text-orange-500 uppercase tracking-wider font-medium">
                                {item.propertyName}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-neutral-400">
                                <Calendar className="w-3 h-3" />
                                <span>
                                  {format(new Date(item.checkIn), "MMM d")} - {format(new Date(item.checkOut), "MMM d")} ({nights} {nights === 1 ? 'night' : 'nights'})
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-neutral-400">
                                <User className="w-3 h-3" />
                                <span>{item.guests} Guest{Number(item.guests) > 1 ? 's' : ''}</span>
                            </div>
                        </div>
                        
                        <p className="text-sm font-medium pt-1">₱{(item.roomPrice * nights).toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 border-t border-white/10 space-y-6 bg-neutral-900/50 backdrop-blur-sm">
                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-neutral-400">
                        <span>Subtotal</span>
                        <span>₱{subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm text-neutral-400">
                        <span>Taxes & Fees</span>
                        <span>Calculated at checkout</span>
                    </div>
                    <Separator className="bg-white/10 my-2" />
                    <div className="flex justify-between text-lg font-serif">
                        <span>Total Est.</span>
                        <span>₱{subtotal.toLocaleString()}</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <Link 
                      href={`/book?cart=${encodeURIComponent(JSON.stringify(items))}`} 
                      className="w-full block" 
                      onClick={(e) => {
                         if (isLoading) e.preventDefault();
                         else {
                            setIsLoading(true);
                            // Allow navigation to happen
                            setTimeout(() => setDrawerOpen(false), 500); 
                         }
                      }}
                    >
                        <Button disabled={isLoading} className="w-full h-12 bg-white text-black hover:bg-neutral-200 rounded-none uppercase tracking-widest text-xs font-bold flex justify-between items-center px-6 group">
                            {isLoading ? (
                               <span className="flex items-center gap-2">
                                  <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                               </span>
                            ) : (
                               <>
                                  <span>Complete Booking</span>
                                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                               </>
                            )}
                        </Button>
                    </Link>
                    <SheetClose asChild>
                        <Button disabled={isLoading} variant="outline" className="w-full h-10 border-white/10 text-neutral-400 hover:text-white hover:bg-white/5 rounded-none uppercase tracking-widest text-[10px]">
                            Add Another Room
                        </Button>
                    </SheetClose>
                </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

