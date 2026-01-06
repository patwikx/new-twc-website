"use client";

import { useTransition, useState, useEffect } from "react";
import { BookingCalendar } from "@/components/admin/front-desk/booking-calendar";
import { getCalendarData } from "@/actions/admin/front-desk";
import { startOfMonth } from "date-fns";

interface CalendarViewProps {
  initialData: any;
  propertyId: string;
}

export function CalendarView({ initialData, propertyId }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  // initialData is now { days: [], events: [] }
  const [calendarData, setCalendarData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  const handleMonthChange = (newDate: Date) => {
    setCurrentMonth(newDate);
    startTransition(async () => {
      const newData = await getCalendarData(propertyId, newDate);
      setCalendarData(newData);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Booking Calendar</h1>
                <p className="text-neutral-500">Overview of room occupancy and events.</p>
            </div>
      </div>

      <BookingCalendar
        days={calendarData.days || []}
        events={calendarData.events || []}
        currentDate={currentMonth}
        onMonthChange={handleMonthChange}
        isLoading={isPending}
        propertyId={propertyId}
      />
    </div>
  );
}
