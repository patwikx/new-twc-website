/**
 * Availability API - Single Room Type
 * 
 * GET endpoint for checking unit-based availability for a single room type.
 * Returns UnitAvailabilityResult with total units, booked units, available units,
 * and availability flags.
 * 
 * Requirements: 1.1, 1.3, 1.4
 */

import { NextResponse } from "next/server";
import { checkUnitAvailability, UnitAvailabilityResult } from "@/lib/booking/availability";
import { checkLimit } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/client-ip";

/**
 * Handles GET requests to check availability for a single room type within a date range.
 *
 * @returns A JSON response containing a `UnitAvailabilityResult` for the requested `roomTypeId` when successful; if the room type is not found, returns a `UnitAvailabilityResult` with zero units and `available: false`. Returns 400 with an error message for missing or invalid query parameters (roomTypeId, checkIn, checkOut, or invalid/ordered dates), and 500 with a generic error message on unexpected failures.
 */
export async function GET(request: Request) {
  try {
    // Rate limiting check - 30 requests per 60 seconds
    const clientIP = getClientIP(request);
    const rateLimitResult = await checkLimit(clientIP, {
      limit: 30,
      windowMs: 60 * 1000,
      keyPrefix: 'availability'
    });
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: `Too many requests. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          retryAfter: rateLimitResult.retryAfter
        },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const roomTypeId = searchParams.get("roomTypeId");
    const checkInParam = searchParams.get("checkIn");
    const checkOutParam = searchParams.get("checkOut");

    // Validate required parameters
    if (!roomTypeId) {
      return NextResponse.json(
        { error: "roomTypeId is required" },
        { status: 400 }
      );
    }

    if (!checkInParam || !checkOutParam) {
      return NextResponse.json(
        { error: "checkIn and checkOut dates are required" },
        { status: 400 }
      );
    }

    // Parse dates
    const checkIn = new Date(checkInParam);
    const checkOut = new Date(checkOutParam);

    // Validate dates
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Use ISO 8601 format (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    if (checkIn >= checkOut) {
      return NextResponse.json(
        { error: "checkOut must be after checkIn" },
        { status: 400 }
      );
    }

    // Check unit availability
    const results = await checkUnitAvailability([
      { roomTypeId, checkIn, checkOut }
    ]);

    const availability = results[0];

    if (!availability) {
      // Room type not found or has no units
      const result: UnitAvailabilityResult = {
        roomTypeId,
        totalUnits: 0,
        bookedUnits: 0,
        availableUnits: 0,
        available: false,
        limitedAvailability: false
      };
      return NextResponse.json(result);
    }

    return NextResponse.json(availability);
  } catch (error) {
    console.error("Error checking availability:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}