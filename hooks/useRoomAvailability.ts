/**
 * useRoomAvailability Hook
 * 
 * Fetches availability data for a room type and provides:
 * - disabledDates: Dates with no availability
 * - limitedDates: Dates with limited availability
 * - availabilityMap: Map of date string to availability info
 * - loading state
 * 
 * Requirements: 2.1
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { format, addMonths } from "date-fns";

export interface DateAvailabilityInfo {
  date: Date;
  availableUnits: number;
  totalUnits: number;
  status: 'available' | 'limited' | 'unavailable';
}

export interface UseRoomAvailabilityOptions {
  roomTypeId?: string;
  visibleMonth?: Date;
  numberOfMonths?: number;
}

export interface UseRoomAvailabilityResult {
  disabledDates: Date[];
  limitedDates: Date[];
  availabilityMap: Map<string, DateAvailabilityInfo>;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}


/**
 * Hook to fetch and manage room availability data for calendar display.
 * 
 * @param options - Configuration options
 * @returns Availability data including disabled dates, limited dates, and loading state
 */
export function useRoomAvailability(
  options: UseRoomAvailabilityOptions
): UseRoomAvailabilityResult {
  const { roomTypeId, visibleMonth = new Date(), numberOfMonths = 2 } = options;

  const [availabilityMap, setAvailabilityMap] = useState<Map<string, DateAvailabilityInfo>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // Normalize visibleMonth to the start of the month to avoid instability from inline "new Date()" calls
  const normalizedMonth = useMemo(() => {
    return new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  }, [visibleMonth.getFullYear(), visibleMonth.getMonth()]);

  // Calculate which months to fetch based on normalized visible month
  const monthsToFetch = useMemo(() => {
    const months: string[] = [];
    for (let i = 0; i < numberOfMonths; i++) {
      const month = addMonths(normalizedMonth, i);
      months.push(format(month, "yyyy-MM"));
    }
    return months;
  }, [normalizedMonth, numberOfMonths]);

  const fetchAvailability = useCallback(async () => {
    if (!roomTypeId) {
      setAvailabilityMap(new Map());
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newMap = new Map<string, DateAvailabilityInfo>();

      // Fetch availability for each month
      await Promise.all(
        monthsToFetch.map(async (month) => {
          const response = await fetch(
            `/api/availability/calendar?roomTypeId=${encodeURIComponent(roomTypeId)}&month=${month}`
          );

          if (!response.ok) {
            throw new Error(`Failed to fetch availability for ${month}`);
          }

          const data: DateAvailabilityInfo[] = await response.json();
          
          // Add each day's availability to the map
          for (const day of data) {
            const dateKey = format(new Date(day.date), "yyyy-MM-dd");
            newMap.set(dateKey, {
              ...day,
              date: new Date(day.date)
            });
          }
        })
      );

      setAvailabilityMap(newMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch availability");
    } finally {
      setLoading(false);
    }
  }, [roomTypeId, monthsToFetch]);

  // Fetch availability when dependencies change
  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability, fetchTrigger]);

  // Refetch function for manual refresh
  const refetch = useCallback(() => {
    setFetchTrigger(prev => prev + 1);
  }, []);


  // Compute disabled dates (unavailable)
  const disabledDates = useMemo(() => {
    const dates: Date[] = [];
    availabilityMap.forEach((info) => {
      if (info.status === 'unavailable') {
        dates.push(info.date);
      }
    });
    return dates;
  }, [availabilityMap]);

  // Compute limited availability dates
  const limitedDates = useMemo(() => {
    const dates: Date[] = [];
    availabilityMap.forEach((info) => {
      if (info.status === 'limited') {
        dates.push(info.date);
      }
    });
    return dates;
  }, [availabilityMap]);

  return {
    disabledDates,
    limitedDates,
    availabilityMap,
    loading,
    error,
    refetch
  };
}
