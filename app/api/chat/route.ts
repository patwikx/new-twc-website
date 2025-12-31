import { GoogleGenerativeAI } from "@google/generative-ai";
import { PROPERTIES, LOCAL_EXPERIENCES } from "@/lib/mock-data"; // Assuming these are sufficient for context
import { NextResponse } from "next/server";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

export async function POST(req: Request) {
  try {
    const { message, propertyName } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ reply: "Configuration Error: Gemini API Key is missing." }, { status: 500 });
    }

    // Build condensed property summaries to reduce token usage
    const propertySummaries = PROPERTIES.map(p => 
      `${p.name} (${p.location}): ${p.rooms.length} rooms from ₱${Math.min(...p.rooms.map(r => r.price)).toLocaleString()} to ₱${Math.max(...p.rooms.map(r => r.price)).toLocaleString()}/night. Rooms: ${p.rooms.map(r => `${r.name} (₱${r.price.toLocaleString()}, ${r.capacity} guests)`).join(', ')}.`
    ).join('\n');

    const experienceSummaries = LOCAL_EXPERIENCES.map(e => 
      `${e.title} (${e.category}): ${e.description} - ${e.distance}`
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
