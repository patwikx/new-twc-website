/**
 * Cron Endpoint: Expire Stale Bookings
 * 
 * This endpoint is designed to be called by an external cron service
 * (e.g., Vercel Cron, AWS EventBridge, etc.) to expire stale bookings.
 * 
 * Security: Protected by CRON_SECRET header validation
 */

import { NextRequest, NextResponse } from "next/server";
import { expireStaleBookings } from "@/lib/booking/expiration";

/**
 * Validate the cron secret header
 */
function validateCronSecret(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  
  // If no secret is configured, reject all requests
  if (!cronSecret) {
    console.error("CRON_SECRET environment variable is not configured");
    return false;
  }
  
  const providedSecret = req.headers.get("x-cron-secret") || 
                         req.headers.get("authorization")?.replace("Bearer ", "");
  
  return providedSecret === cronSecret;
}

export async function POST(req: NextRequest) {
  // Validate cron secret
  if (!validateCronSecret(req)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const result = await expireStaleBookings();
    
    console.log("Booking expiration job completed", {
      expiredCount: result.expiredCount,
      bookingIds: result.bookingIds,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      expiredCount: result.expiredCount,
      bookingIds: result.bookingIds
    });

  } catch (error) {
    console.error("Booking expiration job failed:", error);
    
    return NextResponse.json(
      { error: "Failed to expire bookings" },
      { status: 500 }
    );
  }
}

// Also support GET for simpler cron services
export async function GET(req: NextRequest) {
  return POST(req);
}
