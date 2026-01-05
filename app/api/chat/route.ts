import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkLimit } from "@/lib/rate-limit";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

/**
 * Extract client IP from request headers
 * Checks x-forwarded-for and x-real-ip headers
 */
function getClientIP(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }
  
  return 'unknown';
}

export async function POST(req: Request) {
  try {
    // Rate limiting check - 10 requests per 60 seconds
    const clientIP = getClientIP(req);
    const rateLimitResult = await checkLimit(clientIP, {
      limit: 10,
      windowMs: 60 * 1000,
      keyPrefix: 'chat'
    });
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          reply: `You're sending messages too quickly. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          retryAfter: rateLimitResult.retryAfter
        },
        { status: 429 }
      );
    }

    const { message, propertyName } = await req.json();

    // 2. Input Validation
    if (!message || typeof message !== 'string') {
        return NextResponse.json({ reply: "Invalid message format." }, { status: 400 });
    }
    if (message.length > 500) {
        return NextResponse.json({ reply: "Please keep your message under 500 characters." }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ reply: "Configuration Error: Gemini API Key is missing." }, { status: 500 });
    }

    // Fetch properties and experiences from database
    const [properties, experiences] = await Promise.all([
      db.property.findMany({
        include: { rooms: true },
        orderBy: { name: "asc" },
      }),
      db.experience.findMany({
        orderBy: { title: "asc" },
      }),
    ]);

    // Build condensed property summaries to reduce token usage
    const propertySummaries = properties.map(p => 
      `${p.name} (${p.location}): ${p.rooms.length} rooms from ₱${Math.min(...p.rooms.map(r => Number(r.price))).toLocaleString()} to ₱${Math.max(...p.rooms.map(r => Number(r.price))).toLocaleString()}/night. Rooms: ${p.rooms.map(r => `${r.name} (₱${Number(r.price).toLocaleString()}, ${r.capacity} guests)`).join(', ')}.`
    ).join('\n');

    const experienceSummaries = experiences.map(e => 
      `${e.title} (${e.category}): ${e.description} - ${e.distance || 'nearby'}`
    ).join('\n');

    // Context Construction - Optimized for fewer tokens
    const systemPrompt = `
You are TWC Assistant, the Virtual Concierge for Tropicana Worldwide Corporation.

PROPERTIES:
${propertySummaries}

LOCAL EXPERIENCES:
${experienceSummaries}

BOOKING PROCESS:
1. Browse properties on homepage or /properties
2. Select a room and click "Add to Cart"
3. Review cart at /cart, adjust dates/guests
4. Proceed to Checkout, fill in guest details
5. Complete payment and receive confirmation

RESPONSE RULES:
• Keep responses concise (2-4 sentences)
• Use bullet points (•) for lists
• Use line breaks between ideas
• Prices are in Philippine Peso (₱)
• Be warm and helpful

User asks: ${message}
`;

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ reply: text });

  } catch (error) {
    console.error("AI Chat Error:", error);
    return NextResponse.json({ reply: "I'm having trouble connecting right now. Please try again later." }, { status: 500 });
  }
}

