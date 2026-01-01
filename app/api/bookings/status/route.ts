import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Booking ID required" }, { status: 400 });
    }

    const booking = await db.booking.findUnique({
      where: { id },
      select: { 
        status: true, 
        paymentStatus: true,
        shortRef: true 
      }
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    return NextResponse.json(booking);
  } catch (error) {
    console.error("Error fetching booking status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
