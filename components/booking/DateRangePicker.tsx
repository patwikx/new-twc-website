"use client";

import { format, isSameDay } from "date-fns";
import { DateRange, DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DateAvailabilityInfo {
  date: Date;
  availableUnits: number;
  totalUnits: number;
  status: 'available' | 'limited' | 'unavailable';
}

export interface DateRangePickerProps {
  className?: string;
  date: DateRange | undefined;
  setDate: (date: DateRange | undefined) => void;
  disabledDates?: Date[];
  limitedDates?: Date[];
  availabilityMap?: Map<string, DateAvailabilityInfo>;
  loading?: boolean;
  onMonthChange?: (month: Date) => void;
}

/**
 * Renders a dual-calendar date range picker with separate check-in and check-out DayPicker calendars.
 *
 * The check-in calendar disables dates before today. The check-out calendar disables dates before the day after the selected check-in (or today if no check-in). Clicking an already-selected check-in or check-out date clears that selection. Selecting a new check-in on or after the current check-out clears the check-out.
 *
 * @param className - Optional container className applied to the outer wrapper
 * @param date - The currently selected date range (`from` and/or `to`)
 * @param setDate - Setter invoked to update the selected date range
 * @param loading - When true, shows a loading label in the trigger instead of date text
 * @returns The DateRangePicker React element
 */
export function DateRangePicker({
  className,
  date,
  setDate,
  loading = false,
}: DateRangePickerProps) {
  // Handle check-in day click - toggle if same date, otherwise select
  const handleCheckInDayClick = (clickedDate: Date) => {
    // If clicking the same date that's already selected, deselect it
    if (date?.from && isSameDay(clickedDate, date.from)) {
      setDate({ from: undefined, to: date?.to });
      return;
    }
    
    // If check-out is before or equal to new check-in, clear check-out
    if (date?.to && clickedDate >= date.to) {
      setDate({ from: clickedDate, to: undefined });
    } else {
      setDate({ from: clickedDate, to: date?.to });
    }
  };

  // Handle check-out day click - toggle if same date, otherwise select
  const handleCheckOutDayClick = (clickedDate: Date) => {
    // If clicking the same date that's already selected, deselect it
    if (date?.to && isSameDay(clickedDate, date.to)) {
      setDate({ from: date?.from, to: undefined });
      return;
    }
    
    setDate({ from: date?.from, to: clickedDate });
  };

  // Disable dates before today for check-in
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkInDisabled = { before: today };
  
  // Disable dates before check-in for the check-out calendar
  const checkOutDisabled = date?.from 
    ? { before: new Date(date.from.getTime() + 86400000) } // Day after check-in
    : { before: today };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"ghost"}
            className={cn(
              "w-full justify-start text-left font-normal h-auto bg-transparent hover:bg-transparent text-white shadow-none p-0 rounded-none",
              !date && "text-muted-foreground"
            )}
          >
            <div className="text-left w-full">
              <span className="block font-serif text-2xl italic hover:text-orange-400 transition-colors truncate">
                {loading ? (
                  <span className="text-white/50 italic">Loading...</span>
                ) : date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "MMM dd")} <span className="text-white/30 mx-2">|</span> {format(date.to, "MMM dd")}
                    </>
                  ) : (
                    format(date.from, "MMM dd, y")
                  )
                ) : (
                  <span className="text-white/50 italic">Select Dates</span>
                )}
              </span>
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-neutral-900 border-neutral-800 text-white" align="start">
          <div className="flex flex-col md:flex-row">
            {/* Check-in Calendar */}
            <div className="border-b md:border-b-0 md:border-r border-neutral-800">
              <div className="px-4 py-2 border-b border-neutral-800">
                <span className="text-xs uppercase tracking-widest text-white/50">Check-in</span>
              </div>
              <DayPicker
                mode="single"
                selected={date?.from}
                onDayClick={handleCheckInDayClick}
                defaultMonth={date?.from || new Date()}
                disabled={checkInDisabled}
                showOutsideDays={false}
                className="p-3"
                classNames={{
                  months: "flex flex-col",
                  month: "space-y-4",
                  caption: "flex justify-center pt-1 relative items-center",
                  caption_label: "text-sm font-medium text-white",
                  nav: "space-x-1 flex items-center",
                  nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-white",
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex",
                  head_cell: "text-neutral-500 rounded-md w-9 font-normal text-[0.8rem]",
                  row: "flex w-full mt-2",
                  cell: "h-9 w-9 text-center text-sm p-0 relative",
                  day: "h-9 w-9 p-0 font-normal text-white hover:bg-neutral-800 rounded-md cursor-pointer",
                  day_selected: "bg-white text-black hover:bg-white/90 hover:text-black",
                  day_today: "bg-neutral-800 text-white",
                  day_outside: "text-neutral-600 opacity-50",
                  day_disabled: "text-neutral-600 opacity-50 cursor-not-allowed",
                  day_hidden: "invisible",
                }}
              />
            </div>
            
            {/* Check-out Calendar */}
            <div>
              <div className="px-4 py-2 border-b border-neutral-800">
                <span className="text-xs uppercase tracking-widest text-white/50">Check-out</span>
              </div>
              <DayPicker
                mode="single"
                selected={date?.to}
                onDayClick={handleCheckOutDayClick}
                defaultMonth={date?.to || date?.from || new Date()}
                disabled={checkOutDisabled}
                showOutsideDays={false}
                className="p-3"
                classNames={{
                  months: "flex flex-col",
                  month: "space-y-4",
                  caption: "flex justify-center pt-1 relative items-center",
                  caption_label: "text-sm font-medium text-white",
                  nav: "space-x-1 flex items-center",
                  nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-white",
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex",
                  head_cell: "text-neutral-500 rounded-md w-9 font-normal text-[0.8rem]",
                  row: "flex w-full mt-2",
                  cell: "h-9 w-9 text-center text-sm p-0 relative",
                  day: "h-9 w-9 p-0 font-normal text-white hover:bg-neutral-800 rounded-md cursor-pointer",
                  day_selected: "bg-white text-black hover:bg-white/90 hover:text-black",
                  day_today: "bg-neutral-800 text-white",
                  day_outside: "text-neutral-600 opacity-50",
                  day_disabled: "text-neutral-600 opacity-50 cursor-not-allowed",
                  day_hidden: "invisible",
                }}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}