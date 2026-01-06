"use client";

import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, isWithinInterval } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { AddEventDialog } from "@/components/admin/calendar/add-event-dialog";
import { EventDetailsDialog } from "@/components/admin/calendar/event-details-dialog";



interface CalendarEvent {
    id: string;
    title: string;
    startDate: Date | string;
    endDate: Date | string;
    status: string; // TENTATIVE, CONFIRMED
    description?: string;
    // Extended fields
    guestCount?: number;
    roomCount?: number;
    menuDetails?: any;
    bookings?: any[];
}

interface CalendarBooking {
  id: string;
  guestName: string;
  roomName: string;
  unitNumber: string;
  status: string;
}

interface CalendarDayData {
  date: Date;
  total: number;
  occupied: number;
  available: number;
  bookings: CalendarBooking[];
}

interface BookingCalendarProps {
  days: CalendarDayData[]; 
  events: CalendarEvent[];
  currentDate: Date;
  onMonthChange: (date: Date) => void;
  isLoading?: boolean;
  propertyId?: string; // For Add Event dialog later
}

export function BookingCalendar({ days, events, currentDate, onMonthChange, isLoading, propertyId }: BookingCalendarProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Heatmap Color Logic
  const getOccupancyColor = (occupied: number, total: number) => {
    if (total === 0) return "bg-neutral-900 border-white/5 opacity-50"; 
    const percentage = occupied / total;
    
    if (percentage >= 0.9) return "bg-red-500/10 border-red-500/30 hover:border-red-500/50";
    if (percentage >= 0.7) return "bg-orange-500/10 border-orange-500/30 hover:border-orange-500/50";
    if (percentage >= 0.4) return "bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-500/50";
    return "bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50";
  };

  const getStatusColor = (status: string) => {
      switch (status) {
          case 'CONFIRMED': return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/20';
          case 'PENDING': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/20';
          case 'CHECKED_IN': return 'bg-blue-500/20 text-blue-500 border-blue-500/20';
          default: return 'bg-neutral-500/20 text-neutral-500';
      }
  };

  // Event Helper
  const getEventsForDay = (date: Date) => {
      return events.filter(e => {
          const start = new Date(e.startDate);
          const end = new Date(e.endDate);
          start.setHours(0,0,0,0);
          end.setHours(23,59,59,999);
          const current = new Date(date);
          current.setHours(12,0,0,0); // Mid-day check to handle boundaries safely
          return current >= start && current <= end;
      });
  };

  return (
    <div className="border border-white/10 rounded-xl bg-neutral-900/50 backdrop-blur mb-8 overflow-hidden">

      
      {/* Event Details Dialog */}
      <EventDetailsDialog 
        event={selectedEvent} 
        open={!!selectedEvent} 
        onOpenChange={(open) => !open && setSelectedEvent(null)} 
      />

      <div className="flex items-center justify-between p-4 bg-neutral-900/50">
          <div className="flex items-center gap-4">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />}
              {propertyId && (
                  <AddEventDialog 
                      propertyId={propertyId} 
                      trigger={
                          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5">
                              <Plus className="h-3.5 w-3.5" />
                              Create Event
                          </Button>
                      } 
                  />
              )}
          </div>
          
          <div className="flex items-center gap-2">
              <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => onMonthChange(subMonths(currentDate, 1))}
                  className="h-8 w-8 hover:bg-white/10 text-white"
              >
                  <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium w-32 text-center select-none">
                  {format(currentDate, "MMMM yyyy")}
              </div>
              <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => onMonthChange(addMonths(currentDate, 1))}
                  className="h-8 w-8 hover:bg-white/10 text-white"
              >
                  <ChevronRight className="h-4 w-4" />
              </Button>
          </div>
      </div>

      <div className="p-6 border-t border-white/10">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
              <div key={day} className="text-[10px] uppercase tracking-widest text-neutral-500 text-center py-2">
                  {day}
              </div>
              ))}
          </div>
          
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
              {/* Padding for start of month */}
              {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-32 bg-transparent" />
              ))}

              {calendarDays.map((day) => {
              const dayData = days.find(d => {
                  const dDate = new Date(d.date); 
                  return dDate.getDate() === day.getDate() && 
                          dDate.getMonth() === day.getMonth() && 
                          dDate.getFullYear() === day.getFullYear();
              });

              const total = dayData?.total || 0;
              const occupied = dayData?.occupied || 0;
              const available = dayData?.available || 0;
              const bookings = dayData?.bookings || [];
              const dayEvents = getEventsForDay(day);

              return (
                  <Popover key={day.toISOString()}>
                      <PopoverTrigger asChild>
                          <div className={cn(
                              "h-32 p-2 rounded-xl border flex flex-col justify-between cursor-pointer select-none relative overflow-hidden group transition-all",
                              getOccupancyColor(occupied, total),
                              isToday(day) && "ring-2 ring-white ring-offset-2 ring-offset-black"
                          )}>
                              {/* Date & Indicator */}
                              <div className="flex justify-between items-start z-10">
                                  <span className={cn("text-lg font-bold", isToday(day) ? "text-white" : "text-white/70")}>
                                      {format(day, "d")}
                                  </span>
                                  {total > 0 && available === 0 && (
                                      <div className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                                  )}
                              </div>

                              {/* Events Stack */}
                              <div className="flex flex-col gap-1 z-10 mt-1 flex-1 overflow-hidden">
                                  {dayEvents.map(event => (
                                     <div 
                                        key={event.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedEvent(event);
                                        }}
                                        className={cn(
                                         "text-[9px] px-1.5 py-0.5 rounded truncate font-medium hover:brightness-110 cursor-pointer transition-all",
                                         event.status === 'CONFIRMED' ? "bg-indigo-500 text-white" : "bg-neutral-600/50 text-neutral-300 border border-white/10 border-dashed"
                                     )}>
                                         {event.title}
                                     </div>
                                  ))}
                              </div>
                              
                              {/* Occupancy Stats (Bottom) */}
                              <div className="space-y-0.5 z-10 pt-2 border-t border-white/5 mt-auto">
                                  <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider">
                                      <span className="text-white/40">Booked</span>
                                      <span className={cn(occupied > 0 ? "text-orange-400" : "text-white/60")}>{occupied}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider">
                                      <span className="text-white/40">Avail</span>
                                      <span className="text-emerald-400">{available}</span>
                                  </div>
                              </div>
                          </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0 bg-black border-white/20 text-white shadow-2xl z-50" align="start">
                          <div className="p-4 border-b border-white/10 bg-neutral-900/50">
                              <h4 className="font-bold text-sm">Details for {format(day, "MMM d, yyyy")}</h4>
                          </div>
                          <div className="max-h-[300px] overflow-y-auto p-2 space-y-2">
                              {/* Events Section */}
                              {dayEvents.length > 0 && (
                                  <div className="mb-2">
                                      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold px-2 py-1">Events</div>
                                      {dayEvents.map(event => (
                                          <div 
                                            key={event.id} 
                                            className="p-2 rounded bg-white/5 border border-white/5 mb-1 cursor-pointer hover:bg-white/10 transition-colors"
                                            onClick={() => setSelectedEvent(event)}
                                          >
                                              <div className="font-bold text-xs text-indigo-300">{event.title}</div>
                                              <div className="text-[10px] text-neutral-400">{event.status}</div>
                                              {event.description && <div className="text-[9px] text-neutral-500 mt-1 truncate">{event.description}</div>}
                                          </div>
                                      ))}
                                  </div>
                              )}

                              {/* Bookings Section */}
                              <div>
                                  <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold px-2 py-1">Bookings ({bookings.length})</div>
                                  {bookings.length === 0 ? (
                                      <div className="p-2 text-center text-xs text-neutral-500 italic">No bookings.</div>
                                  ) : (
                                      bookings.map((booking) => (
                                          <div key={booking.id} className="p-2 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors">
                                              <div className="flex justify-between items-start mb-0.5">
                                                  <span className="font-bold text-xs truncate">{booking.guestName}</span>
                                                  <Badge variant="outline" className={cn("text-[9px] h-4 px-1 rounded", getStatusColor(booking.status))}>
                                                      {booking.status}
                                                  </Badge>
                                              </div>
                                              <div className="flex justify-between items-center text-[10px] text-neutral-400">
                                                  <span>{booking.roomName}</span>
                                                  <span className="font-mono text-white/60">{booking.unitNumber}</span>
                                              </div>
                                          </div>
                                      ))
                                  )}
                              </div>
                          </div>
                      </PopoverContent>
                  </Popover>
              );
              })}
          </div>
      </div>
    </div>
  );
}
