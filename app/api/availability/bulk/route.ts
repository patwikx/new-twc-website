/**
 * Availability API - Bulk Check
 * 
 * POST endpoint for checking unit-based availability for multiple room types.
 * Returns availability for all room types at a property for the specified dates.
 * 
 * Requirements: 3.1
 */

import { NextResponse } from "next/server";
import { checkUnitAvailability, UnitAvailabilityCheck, UnitAvailabilityResult } from "@/lib/booking/availability";

interface BulkAvailabilityRequest {
  checks: UnitAvailabilityCheck[];
}

/**
 * Handle POST /bulk availability requests by validating input checks and returning unit-based availability per room type.
 *
 * @param request - HTTP request whose JSON body must be a BulkAvailabilityRequest: { checks: UnitAvailabilityCheck[] }
 * @returns An array of UnitAvailabilityResult corresponding to each input check. If a room type is not found its result contains zeros and `available: false`. On malformed input the endpoint responds with a JSON error and HTTP 400; on internal failures it responds with a JSON error and HTTP 500.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as BulkAvailabilityRequest;

    // Validate request body
    if (!body.checks || !Array.isArray(body.checks)) {
      return NextResponse.json(
        { error: "checks array is required" },
        { status: 400 }
      );
    }

    if (body.checks.length === 0) {
      return NextResponse.json([]);
    }

    // Validate and parse each check
    const parsedChecks: UnitAvailabilityCheck[] = [];
    for (let i = 0; i < body.checks.length; i++) {
      const check = body.checks[i];

      if (!check.roomTypeId) {
        return NextResponse.json(
          { error: `checks[${i}].roomTypeId is required` },
          { status: 400 }
        );
      }

      if (!check.checkIn || !check.checkOut) {
        return NextResponse.json(
          { error: `checks[${i}].checkIn and checkOut are required` },
          { status: 400 }
        );
      }

      const checkIn = new Date(check.checkIn);
      const checkOut = new Date(check.checkOut);

      if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
        return NextResponse.json(
          { error: `checks[${i}] has invalid date format. Use ISO 8601 format` },
          { status: 400 }
        );
      }

      if (checkIn >= checkOut) {
        return NextResponse.json(
          { error: `checks[${i}].checkOut must be after checkIn` },
          { status: 400 }
        );
      }

      parsedChecks.push({
        roomTypeId: check.roomTypeId,
        checkIn,
        checkOut
      });
    }

    // Check availability for all room types
    const resultsMap = await checkUnitAvailability(parsedChecks);

    // Convert map to array, ensuring all requested room types are included
    const results: UnitAvailabilityResult[] = parsedChecks.map(check => {
      const availability = resultsMap.get(check.roomTypeId);
      if (availability) {
        return availability;
      }
      // Room type not found or has no units
      return {
        roomTypeId: check.roomTypeId,
        totalUnits: 0,
        bookedUnits: 0,
        availableUnits: 0,
        available: false,
        limitedAvailability: false
      };
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error checking bulk availability:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}