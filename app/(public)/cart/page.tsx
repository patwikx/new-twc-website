"use client";

import { useCartStore } from "@/store/useCartStore";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { differenceInDays, format } from "date-fns";
import { TAX_RATE, SERVICE_CHARGE_RATE } from "@/lib/mock-data";
import { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CartPage() {
  const { items, removeFromCart, updateItem, clearCart, getCartSubtotal } = useCartStore();
  
  // Hydration safety
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const subtotal = mounted ? getCartSubtotal() : 0;
  const currentItems = mounted ? items : [];
  const serviceCharge = subtotal * SERVICE_CHARGE_RATE;
  const taxes = subtotal * TAX_RATE;
  const total = subtotal + serviceCharge + taxes;

  const toDate = (d: string | Date) => (typeof d === "string" ? new Date(d) : d);

  if (currentItems.length === 0 && mounted) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white pt-32 pb-24">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto space-y-8"
          >
            <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mx-auto">
              <ShoppingBag className="h-10 w-10 text-neutral-500" />
            </div>
            <h1 className="text-4xl font-serif font-light">Your Cart is Empty</h1>
            <p className="text-neutral-400 font-light">
              Explore our properties and add rooms to start planning your getaway.
            </p>
            <Link href="/properties">
              <Button className="rounded-none px-12 py-6 uppercase tracking-widest text-xs bg-white text-black hover:bg-neutral-200">
                Browse Properties
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  // Serialize cart data for checkout
  const checkoutUrl = `/book?cart=${encodeURIComponent(JSON.stringify(currentItems))}`;

  return (
    <div className="min-h-screen bg-neutral-950 text-white pt-32 pb-24">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-4xl md:text-6xl font-serif font-light mb-4">Your Cart</h1>
          <p className="text-neutral-400">Review your selections before proceeding to checkout.</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Cart Items */}
          <div className="lg:col-span-8 space-y-6">
            {currentItems.map((item, index) => {
              const checkIn = toDate(item.checkIn);
              const checkOut = toDate(item.checkOut);
              const nights = Math.max(1, differenceInDays(checkOut, checkIn));
              const itemTotal = item.roomPrice * nights;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white/5 border border-white/10 p-6 flex flex-col md:flex-row gap-6 relative"
                >
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="absolute top-4 right-4 p-2 text-neutral-500 hover:text-red-500 transition-colors z-10"
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>

                  <div className="aspect-video md:w-48 relative shrink-0 overflow-hidden">
                    <Image
                      src={item.roomImage || item.propertyImage}
                      alt={item.roomName}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <p className="text-xs text-orange-500 uppercase tracking-widest">{item.propertyName}</p>
                      <h3 className="text-xl font-serif">{item.roomName}</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Check-in Date */}
                      <div className="space-y-1">
                        <label className="text-xs text-neutral-500 uppercase tracking-widest">Check-in</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full justify-start text-left font-normal h-10 bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white",
                                !checkIn && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {checkIn ? format(checkIn, "MMM d, yyyy") : <span>Pick a date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 bg-neutral-900 border-white/10 text-white" align="start">
                            <Calendar
                              mode="single"
                              selected={checkIn}
                              onSelect={(date) => date && updateItem(item.id, { checkIn: date })}
                              initialFocus
                              className="bg-neutral-900 text-white"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Check-out Date */}
                      <div className="space-y-1">
                         <label className="text-xs text-neutral-500 uppercase tracking-widest">Check-out</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full justify-start text-left font-normal h-10 bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white",
                                !checkOut && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {checkOut ? format(checkOut, "MMM d, yyyy") : <span>Pick a date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 bg-neutral-900 border-white/10 text-white" align="start">
                            <Calendar
                              mode="single"
                              selected={checkOut}
                              onSelect={(date) => date && updateItem(item.id, { checkOut: date })}
                              initialFocus
                              className="bg-neutral-900 text-white"
                              disabled={(date) => date <= checkIn}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Guests */}
                      <div className="space-y-1">
                        <label className="text-xs text-neutral-500 uppercase tracking-widest">Guests</label>
                        <div className="relative">
                          <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                          <Input 
                            type="number" 
                            min={1} 
                          max={10}
                            value={item.guests} 
                            onChange={(e) => updateItem(item.id, { guests: parseInt(e.target.value) || 1 })}
                            className="pl-9 h-10 bg-transparent border-white/20 text-white focus:border-white/40" 
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-white/5">
                      <p className="text-neutral-400 text-sm">
                        ₱{item.roomPrice.toLocaleString()} x {nights} night{nights > 1 ? "s" : ""}
                      </p>
                      <p className="text-lg font-medium">₱{itemTotal.toLocaleString()}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            <Button
              variant="ghost"
              onClick={clearCart}
              className="text-neutral-500 hover:text-red-500 hover:bg-transparent uppercase tracking-widest text-xs"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Clear Cart
            </Button>
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-4">
            <div className="bg-white/5 border border-white/10 p-8 sticky top-32">
              <h3 className="text-xl font-serif italic mb-6">Order Summary</h3>
              
              <div className="space-y-3 text-sm border-b border-white/10 pb-6 mb-6">
                <div className="flex justify-between">
                  <span className="text-neutral-400">{currentItems.length} Room{currentItems.length > 1 ? "s" : ""}</span>
                  <span>₱{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Service Charge ({(SERVICE_CHARGE_RATE * 100).toFixed(0)}%)</span>
                  <span>₱{serviceCharge.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">VAT ({(TAX_RATE * 100).toFixed(0)}%)</span>
                  <span>₱{taxes.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-between text-lg font-medium mb-8">
                <span>Total</span>
                <span className="text-orange-500">₱{total.toLocaleString()}</span>
              </div>

              <Link href={checkoutUrl} className="block">
                <Button className="w-full h-14 rounded-none uppercase tracking-widest text-xs bg-white text-black hover:bg-neutral-200">
                  Proceed to Checkout <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              
              <p className="text-xs text-center text-neutral-500 mt-4">
                Taxes and service charges are estimated.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
