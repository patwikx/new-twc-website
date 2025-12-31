import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';

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
    const senderEmail = "no-reply@doloreshotels.com"; 

    // Send Admin Notification (Text Only for Reliability)
    console.log(`[DEBUG] API Key Length: ${process.env.RESEND_API_KEY?.length}`);
    console.log(`[DEBUG] Sending to admin for: ${email}`);
    
    const adminEmail = await resend.emails.send({
      from: `Tropicana <${senderEmail}>`,
      to: ['plmiranda@rdrealty.com.ph'], 
      subject: `[New Subscriber] Newsletter - ${email}`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border: 1px solid #e5e5e5;">
              <div style="border-bottom: 2px solid #f97316; padding-bottom: 20px; margin-bottom: 30px;">
                <h1 style="margin: 0; color: #171717; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">New Subscriber</h1>
                <p style="margin: 10px 0 0; color: #737373; font-size: 14px;">A new user has joined the Inner Circle.</p>
              </div>
              
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f4f4f5; color: #737373; width: 100px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Email</td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f4f4f5; color: #171717; font-weight: 500; font-size: 16px;">${email}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f4f4f5; color: #737373; width: 100px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Time</td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f4f4f5; color: #171717; font-weight: 500;">${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</td>
                </tr>
              </table>

              <div style="text-align: center; color: #a3a3a3; font-size: 12px; margin-top: 40px;">
                <p>&copy; ${new Date().getFullYear()} Tropicana Worldwide Corp. Internal Notification.</p>
              </div>
            </div>
          </body>
        </html>
      `
    });

    if (adminEmail.error) {
      console.error("FAILED:", JSON.stringify(adminEmail.error));
      return NextResponse.json({ error: "Failed: " + adminEmail.error.message }, { status: 500 });
    }
    
    console.log("[DEBUG] Admin email sent OK");

    // Send Guest Welcome Email
    console.log(`[DEBUG] Sending Guest Welcome Email to ${email}`);
    const guestEmail = await resend.emails.send({
      from: `Tropicana Worldwide Corp. <${senderEmail}>`,
      to: [email],
      subject: "Welcome to the Inner Circle - Tropicana Worldwide Corp.",
      html: `
        <!DOCTYPE html>
        <html>
          <body style="margin: 0; padding: 0; background-color: #000000; font-family: sans-serif; color: #ffffff;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #111111; padding: 40px; border: 1px solid #333;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">Tropicana</h1>
                <p style="color: #f97316; font-size: 10px; text-transform: uppercase; letter-spacing: 3px; margin-top: 5px;">Worldwide Corp.</p>
              </div>
              
              <div style="border-top: 1px solid #333; padding-top: 30px;">
                <p style="color: #888; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">Welcome to the Inner Circle</p>
                <h2 style="font-weight: 300; font-size: 22px; margin: 15px 0;">Thank you for subscribing.</h2>
                <p style="color: #ccc; line-height: 1.6;">You are now part of an exclusive community of travelers who value luxury and serenity.</p>
                
                <ul style="color: #ccc; line-height: 1.8; padding-left: 20px; margin: 25px 0;">
                   <li>Early access to seasonal offers</li>
                   <li>Invitations to exclusive events</li>
                   <li>Curated travel inspiration</li>
                </ul>

                <a href="https://doloreshotels.com" style="display: inline-block; padding: 12px 25px; background-color: #ffffff; color: #000000; text-decoration: none; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; font-weight: bold; margin-top: 10px;">Visit Website</a>
              </div>

              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #333; text-align: center;">
                 <p style="color: #555; font-size: 12px;">© ${new Date().getFullYear()} Tropicana Worldwide Corp.</p>
              </div>
            </div>
          </body>
        </html>
      `
    });

    if (guestEmail.error) {
        console.error("Guest Welcome Email Error:", guestEmail.error);
        // We log but allow success for the user flow
    } else {
        console.log("Guest Welcome Email Sent Successfully");
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
