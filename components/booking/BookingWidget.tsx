"use client";

import { useState } from "react";
import { DateRange } from "react-day-picker";
import { addDays } from "date-fns";
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
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Props interface for receiving database properties
interface PropertyForBooking {
  id: string;
  name: string;
  slug: string;
  image: string;
  rooms: {
    id: string;
    name: string;
    image: string;
    price: number;
    capacity: number;
  }[];
}

interface BookingWidgetProps {
  properties: PropertyForBooking[];
}

// Room availability data with unit-based information
interface RoomAvailability {
  roomId: string;
  roomName: string;
  roomImage: string;
  price: number;
  capacity: number;
  availableUnits: number;
  totalUnits: number;
  limitedAvailability: boolean;
}

/**
 * Renders a booking widget that lets users select a property, check-in/check-out dates, and guest count; performs bulk availability checks and displays available rooms.
 *
 * Performs a POST to /api/availability/bulk to fetch availability for all room types of the selected property, shows results with pricing and remaining units, and allows adding a room to the cart (which triggers a small flyer animation and opens the cart drawer).
 *
 * @returns The booking widget UI as JSX.
 */
export function BookingWidget({ properties }: BookingWidgetProps) {
  // Normalize today to avoid time comparison issues (used for defaults)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(new Date().setHours(14,0,0,0)), // Default 2 PM
    to: addDays(new Date().setHours(12,0,0,0), 3), // Default 12 PM (+3 days)
  });
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [guests, setGuests] = useState("2");
  const [isSearching, setIsSearching] = useState(false);
  const [availability, setAvailability] = useState<RoomAvailability[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    setIsSearching(true);
    setAvailability(null);
    setError(null);

    const property = properties.find((p) => p.id === selectedProperty);
    if (!property || !date?.from || !date?.to) {
      setIsSearching(false);
      return;
    }

    try {
      // Build availability checks for all room types at this property
      const checks = property.rooms.map(room => ({
        roomTypeId: room.id,
        checkIn: date.from!.toISOString(),
        checkOut: date.to!.toISOString()
      }));

      // Call bulk availability API
      const response = await fetch('/api/availability/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checks })
      });

      if (!response.ok) {
        throw new Error('Failed to check availability');
      }

      const results = await response.json();

      // Filter and map room types to only show those with availableUnits > 0
      const availableRooms: RoomAvailability[] = filterAvailableRooms(
        property.rooms,
        results
      );

      setAvailability(availableRooms);
    } catch (err) {
      console.error('Error checking availability:', err);
      setError('Unable to check availability. Please try again.');
    } finally {
      setIsSearching(false);
    }
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
        
        <div className="grid grid-cols-1 md:grid-cols-4 flex-grow divide-y md:divide-y-0 md:divide-x divide-white/10 border-b xl:border-b-0 xl:border-r border-white/10">
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
                        {properties.map((prop) => (
                            <SelectItem key={prop.id} value={prop.id} className="focus:bg-white/10 focus:text-white cursor-pointer py-3 pl-6 rounded-none font-serif text-lg border-b border-white/5 last:border-0 hover:pl-8 transition-all duration-300">
                                {prop.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Check-in */}
            <div className="relative hover:bg-white/5 transition-colors h-16 md:h-20 flex flex-col justify-center px-6">
                 <label className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-medium mb-1 block">Check-in</label>
                 <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"ghost"}
                        className={cn(
                          "w-full justify-start text-left font-normal h-auto bg-transparent hover:bg-transparent text-white shadow-none p-0 rounded-none",
                          !date?.from && "text-muted-foreground"
                        )}
                      >
                        <span className="block font-serif text-lg md:text-xl italic hover:text-orange-400 transition-colors truncate">
                          {date?.from ? format(date.from, "MMM dd, y") : <span>Select Date</span>}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-neutral-900 border-neutral-800 text-white" align="start">
                      <Calendar
                        mode="single"
                        selected={date?.from}
                        onSelect={(newDate) => {
                           if (!newDate) return;
                           const newDateNormalized = newDate;
                           // Set Check-in to 2:00 PM (14:00) to prevent UTC back-shift
                           newDateNormalized.setHours(14,0,0,0); 
                           
                           // If new check-in is after existing check-out, clear check-out
                           if (date?.to && newDateNormalized >= date.to) {
                               setDate({ from: newDateNormalized, to: undefined });
                           } else {
                               setDate({ from: newDateNormalized, to: date?.to });
                           }
                        }}
                        disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                        initialFocus
                        className="p-3"
                        classNames={{
                            day_selected: "bg-white text-black hover:bg-white/90 hover:text-black",
                            day_today: "bg-neutral-800 text-white",
                            day: "h-9 w-9 p-0 font-normal text-white hover:bg-neutral-800 rounded-md cursor-pointer",
                            caption_label: "text-white font-medium",
                            nav_button: "text-white hover:bg-neutral-800",
                        }}
                      />
                    </PopoverContent>
                  </Popover>
            </div>

            {/* Check-out */}
            <div className="relative hover:bg-white/5 transition-colors h-16 md:h-20 flex flex-col justify-center px-6">
                 <label className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-medium mb-1 block">Check-out</label>
                 <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"ghost"}
                        className={cn(
                          "w-full justify-start text-left font-normal h-auto bg-transparent hover:bg-transparent text-white shadow-none p-0 rounded-none",
                          !date?.to && "text-muted-foreground"
                        )}
                      >
                        <span className="block font-serif text-lg md:text-xl italic hover:text-orange-400 transition-colors truncate">
                          {date?.to ? format(date.to, "MMM dd, y") : <span>Select Date</span>}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-neutral-900 border-neutral-800 text-white" align="start">
                      <Calendar
                        mode="single"
                        selected={date?.to}
                        onSelect={(newDate) => {
                            if (!newDate) return;
                            const newDateNormalized = newDate;
                            // Set Check-out to 12:00 PM (12:00) to prevent UTC back-shift
                            newDateNormalized.setHours(12,0,0,0);
                            setDate({ from: date?.from, to: newDateNormalized });
                        }}
                        disabled={(day) => {
                            if (!date?.from) return day < new Date(new Date().setHours(0,0,0,0)); // Fallback
                            const nextDay = new Date(date.from);
                            nextDay.setDate(nextDay.getDate() + 1); 
                            // Ensure nextDay comparators are clean
                            nextDay.setHours(0,0,0,0);
                            return day < nextDay;
                        }}
                        initialFocus
                        className="p-3"
                        classNames={{
                            day_selected: "bg-white text-black hover:bg-white/90 hover:text-black",
                            day_today: "bg-neutral-800 text-white",
                            day: "h-9 w-9 p-0 font-normal text-white hover:bg-neutral-800 rounded-md cursor-pointer",
                            caption_label: "text-white font-medium",
                            nav_button: "text-white hover:bg-neutral-800",
                        }}
                      />
                    </PopoverContent>
                  </Popover>
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
              {availability.length === 0 ? (
                <div className="col-span-full text-center py-8">
                  <p className="text-white/70 text-lg">No rooms available for your selected dates.</p>
                  <p className="text-white/50 text-sm mt-2">Try different dates or another property.</p>
                </div>
              ) : (
                availability.map((room) => {
                  const property = properties.find(p => p.id === selectedProperty);
                  if (!property) return null;

                  return (
                    <div key={room.roomId} className="relative group/card h-full">
                      <Link 
                        href={`/properties/${property.slug}/rooms/${room.roomId}?checkIn=${date?.from?.toISOString()}&checkOut=${date?.to?.toISOString()}`} 
                        className="block h-full"
                      >
                        <div className="group relative rounded-none overflow-hidden cursor-pointer h-full">
                          <div className="aspect-[4/3]">
                            <img src={room.roomImage} alt={room.roomName} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                          </div>
                          {/* Limited Availability Badge */}
                          {room.limitedAvailability && (
                            <Badge className="absolute top-4 left-4 bg-orange-500 text-white border-0 rounded-none uppercase tracking-widest text-[10px] font-bold">
                              Limited Availability
                            </Badge>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-6 flex flex-col justify-end">
                            <h4 className="font-serif text-2xl text-white mb-2">{room.roomName}</h4>
                            {/* Available Units Count */}
                            <p className="text-white/60 text-sm mb-2">
                              {room.availableUnits} {room.availableUnits === 1 ? 'room' : 'rooms'} remaining
                            </p>
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

                                    // Add to cart with all required details
                                    useCartStore.getState().addToCart({
                                      propertySlug: property.slug,
                                      propertyName: property.name,
                                      propertyImage: property.image,
                                      roomId: room.roomId,
                                      roomName: room.roomName,
                                      roomImage: room.roomImage,
                                      roomPrice: room.price,
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
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-1 bg-red-900/50 border border-red-500/30 p-4 text-red-200 text-center"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Produce RoomAvailability entries for rooms that have available units.
 *
 * Merges each room's static data with its matching availability result and excludes rooms with no available units.
 *
 * @param rooms - Property room types to evaluate
 * @param availabilityResults - Availability data keyed by `roomTypeId`, including `availableUnits`, `totalUnits`, and `limitedAvailability`
 * @returns Array of `RoomAvailability` objects for rooms with `availableUnits` greater than zero
 */
export function filterAvailableRooms(
  rooms: { id: string; name: string; image: string; price: number; capacity: number }[],
  availabilityResults: { roomTypeId: string; availableUnits: number; totalUnits: number; limitedAvailability: boolean }[]
): RoomAvailability[] {
  // Create a map for quick lookup
  const availabilityMap = new Map(
    availabilityResults.map(result => [result.roomTypeId, result])
  );

  return rooms
    .map(room => {
      const availability = availabilityMap.get(room.id);
      if (!availability || availability.availableUnits <= 0) {
        return null;
      }

      return {
        roomId: room.id,
        roomName: room.name,
        roomImage: room.image,
        price: room.price,
        capacity: room.capacity,
        availableUnits: availability.availableUnits,
        totalUnits: availability.totalUnits,
        limitedAvailability: availability.limitedAvailability
      };
    })
    .filter((room): room is RoomAvailability => room !== null);
}
