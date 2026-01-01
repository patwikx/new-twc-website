import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { db } from '@/lib/db';

const resend = new Resend(process.env.RESEND_API_KEY);

const NewsletterSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function POST(request: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
        console.error("CRITICAL: RESEND_API_KEY is not set!");
        return NextResponse.json({ error: "Server configuration error: Email service not configured." }, { status: 500 });
    }
    
    const body = await request.json();
    
    // Validate form data
    const result = NewsletterSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation Failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { email } = result.data;

    // Check if already subscribed
    const existingSubscriber = await db.newsletterSubscriber.findUnique({
      where: { email }
    });

    if (existingSubscriber) {
      if (!existingSubscriber.isActive) {
        // Reactivate subscription
        await db.newsletterSubscriber.update({
          where: { email },
          data: { isActive: true }
        });
      }
      // Already subscribed, but still send success
    } else {
      // Create new subscriber
      await db.newsletterSubscriber.create({
        data: { email }
      });
    }

    const senderEmail = "no-reply@doloreshotels.com"; 
    const primaryColor = "#f97316"; // Orange-500

    // Send Admin Notification
    console.log(`[DEBUG] API Key Length: ${process.env.RESEND_API_KEY?.length}`);
    console.log(`[DEBUG] Attempting to send newsletter notification to plmiranda@rdrealty.com.ph`);
    
    const adminEmail = await resend.emails.send({
      from: `Tropicana <${senderEmail}>`,
      to: ['plmiranda@rdrealty.com.ph'], 
      subject: `[New Subscriber] Newsletter - ${email}`,
      text: `New subscriber: ${email}`,
    });

    if (adminEmail.error) {
      console.error("FAILED to send Newsletter Notification:", adminEmail.error);
      return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
    }

    // Send Guest Welcome Email
    const guestEmail = await resend.emails.send({
      from: `Tropicana Worldwide Corp. <${senderEmail}>`,
      to: [email],
      subject: "Welcome to the Inner Circle - Tropicana Worldwide Corp.",
      html: `
        <!DOCTYPE html>
        <html>
          <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'Times New Roman', serif;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #171717; color: #ffffff;">
              <!-- Header -->
              <div style="padding: 40px 40px; text-align: center; border-bottom: 1px solid #333;">
                 <h1 style="margin: 0; color: #ffffff; font-size: 28px; text-transform: uppercase; letter-spacing: 3px; font-weight: 400;">Tropicana</h1>
                 <p style="margin: 5px 0 0; color: ${primaryColor}; font-size: 10px; letter-spacing: 4px; text-transform: uppercase;">Worldwide Corp.</p>
              </div>

              <!-- Content -->
              <div style="padding: 40px;">
                <p style="color: #a3a3a3; font-family: sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px;">Welcome to the Inner Circle</p>
                
                <h2 style="color: #ffffff; font-size: 24px; font-weight: 300; margin-bottom: 20px; line-height: 1.4;">Thank you for subscribing.</h2>
                
                <p style="color: #d4d4d4; font-family: sans-serif; font-size: 16px; line-height: 1.8; margin-bottom: 30px;">
                  You are now part of an exclusive community of travelers who value luxury, serenity, and unparalleled experiences.
                </p>

                <p style="color: #d4d4d4; font-family: sans-serif; font-size: 16px; line-height: 1.8; margin-bottom: 30px;">
                  As a member, you will receive:
                </p>
                
                <ul style="color: #d4d4d4; font-family: sans-serif; font-size: 14px; line-height: 1.8; margin-bottom: 40px; padding-left: 20px;">
                   <li style="margin-bottom: 10px;">Early access to seasonal offers and packages</li>
                   <li style="margin-bottom: 10px;">Invitations to exclusive culinary events at Cafe Rodrigo</li>
                   <li style="margin-bottom: 10px;">Curated travel guides and inspiration</li>
                </ul>

                <div style="text-align: center; margin-bottom: 20px;">
                  <a href="https://doloreshotels.com" style="display: inline-block; padding: 15px 30px; background-color: #ffffff; color: #000000; text-decoration: none; font-family: sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Explore Our Destinations</a>
                </div>
              </div>

              <!-- Footer -->
              <div style="background-color: #0a0a0a; padding: 30px 40px; text-align: center; border-top: 1px solid #333;">
                <p style="margin: 0; color: #525252; font-family: sans-serif; font-size: 12px;">
                  &copy; ${new Date().getFullYear()} Tropicana Worldwide Corp.<br>
                  General Santos City, Philippines
                </p>
                <div style="margin-top: 15px;">
                   <a href="#" style="color: #525252; text-decoration: none; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Unsubscribe</a>
                </div>
              </div>
            </div>
          </body>
        </html>
      `
    });

    if (guestEmail.error) {
        console.error("Guest Welcome Email Error:", guestEmail.error);
        // We don't return an error here so the user subscription still counts as successful
    }

    return NextResponse.json({ success: true, message: "Subscribed successfully" });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
