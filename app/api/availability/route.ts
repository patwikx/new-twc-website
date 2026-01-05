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

export async function GET(request: Request) {
  try {
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
