"use client";

import * as React from "react";
import { addDays, format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function DateRangePicker({
  className,
  date,
  setDate,
}: {
  className?: string;
  date: DateRange | undefined;
  setDate: (date: DateRange | undefined) => void;
}) {
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
                {date?.from ? (
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
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
            showOutsideDays={false}
            className="rounded-md border-neutral-800"
            classNames={{
              day_selected: "bg-white text-black hover:bg-white/90 hover:text-black focus:bg-white focus:text-black",
              day_today: "bg-neutral-800 text-white",
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
