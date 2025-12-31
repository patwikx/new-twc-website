import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';

const resend = new Resend(process.env.RESEND_API_KEY);

const ContactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  contactNumber: z.string().min(1, "Contact number is required"),
  subject: z.string().optional(),
  message: z.string().min(1, "Message is required"),
});

export async function POST(request: Request) {
  try {
    console.log("API Key Present?", !!process.env.RESEND_API_KEY);
    if (!process.env.RESEND_API_KEY) {
        console.error("CRITICAL: RESEND_API_KEY is not set!");
        return NextResponse.json({ error: "Server configuration error: Email service not configured." }, { status: 500 });
    }
    const body = await request.json();
    
    // safeParse returns a result object with .success and .data/.error
    const result = ContactSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation Failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { firstName, lastName, email, contactNumber, subject, message } = result.data;
    const fullName = `${firstName} ${lastName || ''}`.trim();
    const finalSubject = subject || "New Contact Form Submission";
    const senderEmail = "no-reply@doloreshotels.com"; 

    // Brand Colors
    const primaryColor = "#f97316"; // Orange-500
    const backgroundColor = "#0a0a0a"; // Neutral-950
    const textColor = "#ffffff";
    const mutedColor = "#a3a3a3"; // Neutral-400
    const cardBg = "#171717"; // Neutral-900

    // Send Admin Notification
    const adminEmail = await resend.emails.send({
      from: `Tropicana <${senderEmail}>`,
      to: ['plmiranda@rdrealty.com.ph'],
      replyTo: email,
      subject: `[New Inquiry] ${finalSubject} - ${fullName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Times New Roman', serif;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border: 1px solid #e5e5e5;">
              <div style="border-bottom: 2px solid ${primaryColor}; padding-bottom: 20px; margin-bottom: 30px;">
                <h1 style="margin: 0; color: #171717; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">New Inquiry</h1>
                <p style="margin: 10px 0 0; color: #737373; font-family: sans-serif; font-size: 14px;">Received from Tropicana Website</p>
              </div>
              
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f4f4f5; color: #737373; width: 100px; font-family: sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Name</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f4f4f5; color: #171717; font-family: sans-serif; font-weight: 500;">${fullName}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f4f4f5; color: #737373; width: 100px; font-family: sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Email</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f4f4f5; color: #171717; font-family: sans-serif; font-weight: 500;">${email}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f4f4f5; color: #737373; width: 100px; font-family: sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Contact No.</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f4f4f5; color: #171717; font-family: sans-serif; font-weight: 500;">${contactNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f4f4f5; color: #737373; width: 100px; font-family: sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Subject</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f4f4f5; color: #171717; font-family: sans-serif; font-weight: 500;">${finalSubject}</td>
                </tr>
              </table>

              <div style="background-color: #f9f9f9; padding: 25px; border-left: 4px solid ${primaryColor}; margin-bottom: 30px;">
                <h3 style="margin-top: 0; color: #171717; font-family: sans-serif; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Message Content</h3>
                <p style="margin-bottom: 0; color: #404040; line-height: 1.6; font-family: sans-serif;">${message.replace(/\n/g, '<br>')}</p>
              </div>
              
              <div style="text-align: center; color: #a3a3a3; font-size: 12px; font-family: sans-serif; margin-top: 40px;">
                <p>© ${new Date().getFullYear()} Tropicana Worldwide Corp. Internal Notification.</p>
              </div>
            </div>
          </body>
        </html>
      `
    });

    if (adminEmail.error) {
      console.error("FAILED to send Admin Notification:", adminEmail.error);
      return NextResponse.json({ error: "Failed to send admin notification: " + adminEmail.error.message }, { status: 500 });
    } else {
        console.log("Admin Notification Sent Successfully:", adminEmail.data);
    }

    // Send Guest Auto-Reply
    const guestEmail = await resend.emails.send({
      from: `Tropicana Worldwide Corp. <${senderEmail}>`,
      to: [email],
      subject: "We received your message - Tropicana Worldwide Corp.",
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
                <p style="color: ${mutedColor}; font-family: sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px;">Dear ${firstName},</p>
                
                <h2 style="color: #ffffff; font-size: 24px; font-weight: 300; margin-bottom: 20px; line-height: 1.4;">Thank you for getting in touch.</h2>
                
                <p style="color: #d4d4d4; font-family: sans-serif; font-size: 16px; line-height: 1.8; margin-bottom: 30px;">
                  We have successfully received your inquiry regarding "<strong>${finalSubject}</strong>".
                  Our team is currently reviewing your message and will respond to you personally within 24 hours.
                </p>

                <div style="border-top: 1px solid #333; margin: 30px 0;"></div>

                <p style="color: ${mutedColor}; font-family: sans-serif; font-size: 14px; line-height: 1.6;">
                  In the meantime, we invite you to explore our collection of hotels and resorts.
                </p>
                
                <div style="margin-top: 30px;">
                  <a href="https://doloreshotels.com" style="display: inline-block; padding: 15px 30px; background-color: #ffffff; color: #000000; text-decoration: none; font-family: sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Visit Our Website</a>
                </div>
              </div>

              <!-- Footer -->
              <div style="background-color: #0a0a0a; padding: 30px 40px; text-align: center; border-top: 1px solid #333;">
                <p style="margin: 0; color: #525252; font-family: sans-serif; font-size: 12px;">
                  &copy; ${new Date().getFullYear()} Tropicana Worldwide Corp.<br>
                  General Santos City, Philippines
                </p>
              </div>
            </div>
          </body>
        </html>
      `
    });

    if (guestEmail.error) {
        console.error("Guest Auto-Reply Error:", guestEmail.error);
    }

    return NextResponse.json({ success: true, data: { admin: adminEmail.data, guest: guestEmail.data } });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
