"use client";

import { useState } from "react";
import { DateRange } from "react-day-picker";
import { addDays } from "date-fns";
import { PROPERTIES } from "@/lib/mock-data";
import { useCartStore } from "@/store/useCartStore";
import { DateRangePicker } from "./DateRangePicker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export function BookingWidget() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 3),
  });
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [guests, setGuests] = useState("2");
  const [isSearching, setIsSearching] = useState(false);
  const [availability, setAvailability] = useState<any[] | null>(null);

  const handleSearch = () => {
    setIsSearching(true);
    setAvailability(null);
    // Mock API call
    setTimeout(() => {
      const property = PROPERTIES.find((p) => p.id === selectedProperty);
      if (property) {
        setAvailability(property.rooms); // Return all rooms as "available" for now
      }
      setIsSearching(false);
    }, 1500);
  };

  const [flyingParticle, setFlyingParticle] = useState<{ x: number; y: number } | null>(null);

  return (
    <div className="w-full max-w-[95%] 2xl:max-w-[1800px] mx-auto p-4 md:px-12 relative">
      <AnimatePresence>
        {flyingParticle && (
          <motion.div
            initial={{ x: flyingParticle.x, y: flyingParticle.y, scale: 1, opacity: 1 }}
            animate={{ 
              x: window.innerWidth - 100, // Approximate top-right navbar position
              y: 40,
              scale: 0.2, 
              opacity: 0 
            }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed z-[99999] w-4 h-4 rounded-full bg-orange-500 pointer-events-none shadow-[0_0_20px_rgba(249,115,22,0.8)]"
          />
        )}
      </AnimatePresence>
      {/* Sleek Minimalist Container - Solid & Compact */}
      <div className="bg-neutral-900 border border-white/10 p-0 shadow-2xl flex flex-col xl:flex-row items-stretch relative overflow-visible group rounded-none">
        
        <div className="grid grid-cols-1 md:grid-cols-3 flex-grow divide-y md:divide-y-0 md:divide-x divide-white/10 border-b xl:border-b-0 xl:border-r border-white/10">
            {/* Destination */}
            <div className="relative group/input hover:bg-white/5 transition-colors h-16 md:h-20 flex flex-col justify-center px-6">
                <label className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-medium mb-1 block">Destination</label>
                <Select onValueChange={setSelectedProperty}>
                    <SelectTrigger className="w-full h-auto p-0 border-0 bg-transparent text-white focus:ring-0 shadow-none text-lg md:text-xl font-serif italic hover:text-orange-400 transition-colors [&>svg]:opacity-50 [&>svg]:w-4 [&>svg]:h-4 shrink-0">
                        <SelectValue placeholder="Select Property" />
                    </SelectTrigger>
                    <SelectContent 
                        className="bg-neutral-900 border border-white/10 text-white rounded-none mt-2 min-w-[300px]" 
                        position="popper" 
                        sideOffset={0}
                    >
                        {PROPERTIES.map((prop) => (
                            <SelectItem key={prop.id} value={prop.id} className="focus:bg-white/10 focus:text-white cursor-pointer py-3 pl-6 rounded-none font-serif text-lg border-b border-white/5 last:border-0 hover:pl-8 transition-all duration-300">
                                {prop.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Check-in/out */}
            <div className="relative hover:bg-white/5 transition-colors h-16 md:h-20 flex flex-col justify-center px-6">
                 <label className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-medium mb-1 block">Dates</label>
                 <DateRangePicker 
                    date={date} 
                    setDate={setDate} 
                    className="h-auto p-0 w-full bg-transparent border-0 text-white hover:bg-transparent rounded-none"
                 />
            </div>

            {/* Guests */}
             <div className="relative hover:bg-white/5 transition-colors h-16 md:h-20 flex flex-col justify-center px-6">
                <label className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-medium mb-1 block">Guests</label>
                <Select value={guests} onValueChange={setGuests}>
                    <SelectTrigger className="w-full h-auto p-0 border-0 bg-transparent text-white focus:ring-0 shadow-none text-lg md:text-xl font-serif italic hover:text-orange-400 transition-colors [&>svg]:opacity-50 [&>svg]:w-4 [&>svg]:h-4 shrink-0">
                        <SelectValue placeholder="Guests" />
                    </SelectTrigger>
                    <SelectContent 
                        className="bg-neutral-900 border border-white/10 text-white rounded-none mt-2 min-w-[200px]"
                        position="popper" 
                        sideOffset={0}
                    >
                        {[1, 2, 3, 4, 5, 6].map((num) => (
                            <SelectItem key={num} value={num.toString()} className="focus:bg-white/10 focus:text-white cursor-pointer py-3 pl-6 rounded-none font-serif text-lg border-b border-white/5 last:border-0 hover:pl-8 transition-all duration-300">
                                {num} Guest{num > 1 ? "s" : ""}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>

        {/* Action Button - High Visibility - Centered Content */}
        <Button 
            className={`w-full xl:w-[280px] rounded-none transition-all duration-300 uppercase tracking-[0.2em] text-[10px] font-bold whitespace-nowrap p-0 h-16 md:h-20
                ${!selectedProperty || !date?.from || !date?.to || isSearching 
                ? "bg-white/10 text-white/30 cursor-not-allowed hover:bg-white/10" 
                : "bg-white text-black hover:bg-neutral-200"}`}
            onClick={handleSearch}
            disabled={!selectedProperty || !date?.from || !date?.to || isSearching}
        >
            <div className="w-full h-full flex items-center justify-center">
               <span className="relative z-10 flex items-center gap-2">
                 {isSearching ? "Checking..." : "Check Availability"}
               </span>
            </div>
        </Button>
      </div>
      
      {/* Availability Results (kept consistent with new style) */}
      <AnimatePresence>
        {availability && (
          <motion.div
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-1 bg-black/90 backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl p-8 z-50 rounded-none border-t-0"
          >
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-2xl font-serif text-white italic">Your Sanctuary Awaits</h3>
               <Button variant="ghost" size="icon" onClick={() => setAvailability(null)} className="text-white/50 hover:text-white rounded-full hover:bg-white/10">
                 ✕
               </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availability.map((room) => {
                 const propertySlug = PROPERTIES.find(p => p.id === selectedProperty)?.slug;
                 if (!propertySlug) return null;

                 return (
                     <div key={room.id} className="relative group/card h-full">
                    <Link 
                       href={`/properties/${propertySlug}/rooms/${room.id}?checkIn=${date?.from?.toISOString()}&checkOut=${date?.to?.toISOString()}`} 
                       className="block h-full"
                    >
                     <div className="group relative rounded-none overflow-hidden cursor-pointer h-full">
                        <div className="aspect-[4/3]">
                           <img src={room.image} alt={room.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-6 flex flex-col justify-end">
                           <h4 className="font-serif text-2xl text-white mb-2">{room.name}</h4>
                           <div className="flex justify-between items-end gap-2">
                               <span className="text-white/90 font-light">₱{room.price.toLocaleString()} <span className="text-xs opacity-70">/ night</span></span>
                               <div className="flex gap-2">
                                  <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white hover:text-black rounded-none uppercase tracking-widest text-[10px] h-8 px-4 font-bold">
                                    Details
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    className="rounded-none bg-white text-black hover:bg-neutral-200 uppercase tracking-widest text-[10px] h-8 px-4 font-bold"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();

                                      // Create flyer
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setFlyingParticle({
                                        x: rect.left + rect.width / 2,
                                        y: rect.top + rect.height / 2,
                                      });

                                      // Add to cart
                                      useCartStore.getState().addToCart({
                                        propertySlug: propertySlug,
                                        roomId: room.id,
                                        checkIn: date?.from || new Date(),
                                        checkOut: date?.to || addDays(new Date(), 1),
                                        guests: parseInt(guests),
                                      });

                                      // Open drawer slightly after animation starts
                                      setTimeout(() => {
                                        useCartStore.getState().setDrawerOpen(true);
                                        setFlyingParticle(null);
                                      }, 800);
                                    }}
                                  >
                                    Select
                                  </Button>
                               </div>
                           </div>
                        </div>
                     </div>
                   </Link>
                   </div>
                  );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
