/**
 * Availability API - Calendar Data
 * 
 * GET endpoint for fetching daily availability data for calendar display.
 * Returns DateAvailability[] for the specified month.
 * 
 * Requirements: 2.1
 */

import { NextResponse } from "next/server";
import { getDateRangeAvailability } from "@/lib/booking/availability";

/**
 * Return daily availability data for the specified room type and month.
 *
 * The request URL must include `roomTypeId` and `month` search parameters.
 *
 * @param request - Incoming Request whose URL search params must include `roomTypeId` and `month` (format: `YYYY-MM`)
 * @returns An array of daily availability objects (`DateAvailability[]`) covering the requested month
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomTypeId = searchParams.get("roomTypeId");
    const month = searchParams.get("month"); // Format: YYYY-MM

    // Validate required parameters
    if (!roomTypeId) {
      return NextResponse.json(
        { error: "roomTypeId is required" },
        { status: 400 }
      );
    }

    if (!month) {
      return NextResponse.json(
        { error: "month is required (format: YYYY-MM)" },
        { status: 400 }
      );
    }

    // Parse month parameter
    const monthMatch = month.match(/^(\d{4})-(\d{2})$/);
    if (!monthMatch) {
      return NextResponse.json(
        { error: "Invalid month format. Use YYYY-MM (e.g., 2026-01)" },
        { status: 400 }
      );
    }

    const year = parseInt(monthMatch[1], 10);
    const monthNum = parseInt(monthMatch[2], 10);

    // Validate month range
    if (monthNum < 1 || monthNum > 12) {
      return NextResponse.json(
        { error: "Month must be between 01 and 12" },
        { status: 400 }
      );
    }

    // Calculate start and end dates for the month
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 1); // First day of next month

    // Get daily availability for the month
    const availability = await getDateRangeAvailability(
      roomTypeId,
      startDate,
      endDate
    );

    return NextResponse.json(availability);
  } catch (error) {
    console.error("Error fetching calendar availability:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}