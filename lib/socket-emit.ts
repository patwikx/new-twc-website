/**
 * Server-side utility to emit socket events via HTTP
 * Used from API routes and webhooks
 */

const SOCKET_SERVER_URL = process.env.SOCKET_SERVER_URL || "https://socket.doloreshotels.com";

export async function emitBookingUpdate(
  bookingId: string,
  status: string,
  paymentStatus: string
): Promise<boolean> {
  try {
    const response = await fetch(`${SOCKET_SERVER_URL}/emit/booking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bookingId,
        status,
        paymentStatus,
      }),
    });

    if (!response.ok) {
      console.error(`[Socket Emit] Failed to emit booking update: ${response.status}`);
      return false;
    }

    console.log(`[Socket Emit] Booking update emitted: ${bookingId} -> ${status}`);
    return true;
  } catch (error) {
    console.error("[Socket Emit] Error emitting booking update:", error);
    return false;
  }
}
