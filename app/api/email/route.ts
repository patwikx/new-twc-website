import { NextResponse } from 'next/server';
import axios from 'axios';
import https from 'https';
import { timingSafeEqual } from '@/lib/security';

const processEmailRequest = async (body: any, apiKey: string) => {
  const { type, email, token, name } = body;
  const senderEmail = "no-reply@doloreshotels.com";
  const primaryColor = "#f97316";
  const mutedColor = "#a3a3a3";
  
  let subject = "";
  let html = "";

  if (type === "password-reset") {
    subject = "Reset your password - Tropicana";
    html = `
      <!DOCTYPE html>
      <html>
        <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'Times New Roman', serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #171717; color: #ffffff;">
            <div style="padding: 40px 40px; text-align: center; border-bottom: 1px solid #333;">
               <h1 style="margin: 0; color: #ffffff; font-size: 28px; text-transform: uppercase; letter-spacing: 3px; font-weight: 400;">Tropicana</h1>
               <p style="margin: 5px 0 0; color: ${primaryColor}; font-size: 10px; letter-spacing: 4px; text-transform: uppercase;">Worldwide Corp.</p>
            </div>
            <div style="padding: 40px;">
              <p style="color: ${mutedColor}; font-family: sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px;">Password Reset Request</p>
              <h2 style="color: #ffffff; font-size: 24px; font-weight: 300; margin-bottom: 20px; line-height: 1.4;">Reset your password</h2>
              <p style="color: #d4d4d4; font-family: sans-serif; font-size: 16px; line-height: 1.8; margin-bottom: 30px;">
                We received a request to reset your password. Use the code below to verify your identity. This code will expire in 1 hour.
              </p>
              <div style="text-align: center; margin: 40px 0;">
                <div style="display: inline-block; padding: 20px 40px; background-color: #0a0a0a; border: 2px solid ${primaryColor};">
                  <span style="font-family: monospace; font-size: 36px; letter-spacing: 8px; color: #ffffff; font-weight: bold;">${token}</span>
                </div>
              </div>
              <div style="border-top: 1px solid #333; margin: 30px 0;"></div>
              <p style="color: ${mutedColor}; font-family: sans-serif; font-size: 14px; line-height: 1.6;">
                If you didn't request a password reset, you can safely ignore this email.
              </p>
            </div>
            <div style="background-color: #0a0a0a; padding: 30px 40px; text-align: center; border-top: 1px solid #333;">
              <p style="margin: 0; color: #525252; font-family: sans-serif; font-size: 12px;">
                &copy; ${new Date().getFullYear()} Tropicana Worldwide Corp.<br>
                General Santos City, Philippines
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  } else if (type === "verification") {
    subject = "Confirm your email - Tropicana";
    html = `
      <!DOCTYPE html>
      <html>
        <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'Times New Roman', serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #171717; color: #ffffff;">
            <div style="padding: 40px 40px; text-align: center; border-bottom: 1px solid #333;">
               <h1 style="margin: 0; color: #ffffff; font-size: 28px; text-transform: uppercase; letter-spacing: 3px; font-weight: 400;">Tropicana</h1>
               <p style="margin: 5px 0 0; color: ${primaryColor}; font-size: 10px; letter-spacing: 4px; text-transform: uppercase;">Worldwide Corp.</p>
            </div>
            <div style="padding: 40px;">
              <p style="color: ${mutedColor}; font-family: sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px;">Email Confirmation</p>
              <h2 style="color: #ffffff; font-size: 24px; font-weight: 300; margin-bottom: 20px; line-height: 1.4;">Verify your email address</h2>
              <p style="color: #d4d4d4; font-family: sans-serif; font-size: 16px; line-height: 1.8; margin-bottom: 30px;">
                Thank you for signing up! Use the code below to verify your email address and activate your account.
              </p>
              <div style="text-align: center; margin: 40px 0;">
                <div style="display: inline-block; padding: 20px 40px; background-color: #0a0a0a; border: 2px solid ${primaryColor};">
                  <span style="font-family: monospace; font-size: 36px; letter-spacing: 8px; color: #ffffff; font-weight: bold;">${token}</span>
                </div>
              </div>
              <div style="border-top: 1px solid #333; margin: 30px 0;"></div>
              <p style="color: ${mutedColor}; font-family: sans-serif; font-size: 14px; line-height: 1.6;">
                If you didn't create an account, you can safely ignore this email.
              </p>
            </div>
            <div style="background-color: #0a0a0a; padding: 30px 40px; text-align: center; border-top: 1px solid #333;">
              <p style="margin: 0; color: #525252; font-family: sans-serif; font-size: 12px;">
                &copy; ${new Date().getFullYear()} Tropicana Worldwide Corp.<br>
                General Santos City, Philippines
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  } else if (type === "welcome") {
    const domain = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    subject = "Welcome to Tropicana - Your account is ready!";
    html = `
      <!DOCTYPE html>
      <html>
        <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'Times New Roman', serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #171717; color: #ffffff;">
            <div style="padding: 40px 40px; text-align: center; border-bottom: 1px solid #333;">
               <h1 style="margin: 0; color: #ffffff; font-size: 28px; text-transform: uppercase; letter-spacing: 3px; font-weight: 400;">Tropicana</h1>
               <p style="margin: 5px 0 0; color: ${primaryColor}; font-size: 10px; letter-spacing: 4px; text-transform: uppercase;">Worldwide Corp.</p>
            </div>
            <div style="padding: 40px;">
              <p style="color: ${mutedColor}; font-family: sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px;">Welcome</p>
              <h2 style="color: #ffffff; font-size: 24px; font-weight: 300; margin-bottom: 20px; line-height: 1.4;">Hello, ${name || "Guest"}!</h2>
              <p style="color: #d4d4d4; font-family: sans-serif; font-size: 16px; line-height: 1.8; margin-bottom: 30px;">
                Welcome to Tropicana! Your account has been successfully created. You can now explore our collection of luxury hotels and resorts, make reservations, and enjoy exclusive member benefits.
              </p>
              <div style="margin-top: 30px;">
                <a href="${domain}" style="display: inline-block; padding: 15px 30px; background-color: #ffffff; color: #000000; text-decoration: none; font-family: sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Start Exploring</a>
              </div>
            </div>
            <div style="background-color: #0a0a0a; padding: 30px 40px; text-align: center; border-top: 1px solid #333;">
              <p style="margin: 0; color: #525252; font-family: sans-serif; font-size: 12px;">
                &copy; ${new Date().getFullYear()} Tropicana Worldwide Corp.<br>
                General Santos City, Philippines
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  } else if (type === "booking-confirmation") {
    const { ref, propertyName, checkIn, checkOut, amount, guestName, lookupToken } = body;
    const domain = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const confirmationLink = `${domain}/book/confirmation?ref=${ref}`;
    // Use token link for direct access if available, otherwise fall back to manual lookup
    const viewBookingLink = lookupToken 
      ? `${domain}/bookings/lookup/${lookupToken}`
      : `${domain}/bookings/lookup`;
    
    subject = `Booking Confirmed: ${ref} - Tropicana`;
    html = `
      <!DOCTYPE html>
      <html>
        <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'Times New Roman', serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #171717; color: #ffffff;">
            <div style="padding: 40px 40px; text-align: center; border-bottom: 1px solid #333;">
               <h1 style="margin: 0; color: #ffffff; font-size: 28px; text-transform: uppercase; letter-spacing: 3px; font-weight: 400;">Tropicana</h1>
               <p style="margin: 5px 0 0; color: ${primaryColor}; font-size: 10px; letter-spacing: 4px; text-transform: uppercase;">Worldwide Corp.</p>
            </div>
            <div style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <p style="color: ${primaryColor}; font-family: sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">Payment Successful</p>
                <h2 style="color: #ffffff; font-size: 32px; font-weight: 300; margin: 0; line-height: 1.2;">You're Booked!</h2>
              </div>
              
              <p style="color: #d4d4d4; font-family: sans-serif; font-size: 16px; line-height: 1.8; margin-bottom: 30px; text-align: center;">
                Dear ${guestName || "Guest"},<br>
                Your reservation at <strong>${propertyName}</strong> is confirmed. We are honored to host you.
              </p>

              <div style="background-color: #222; padding: 30px; margin-bottom: 30px; border-left: 2px solid ${primaryColor};">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding-bottom: 15px; color: ${mutedColor}; font-family: sans-serif; font-size: 12px; text-transform: uppercase;">Reference</td>
                    <td style="padding-bottom: 15px; color: #ffffff; font-family: monospace; font-size: 16px; text-align: right;">${ref}</td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 15px; color: ${mutedColor}; font-family: sans-serif; font-size: 12px; text-transform: uppercase;">Check In</td>
                    <td style="padding-bottom: 15px; color: #ffffff; font-family: sans-serif; font-size: 14px; text-align: right;">${checkIn}</td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 15px; color: ${mutedColor}; font-family: sans-serif; font-size: 12px; text-transform: uppercase;">Check Out</td>
                    <td style="padding-bottom: 15px; color: #ffffff; font-family: sans-serif; font-size: 14px; text-align: right;">${checkOut}</td>
                  </tr>
                  <tr>
                    <td style="border-top: 1px solid #333; padding-top: 15px; color: ${mutedColor}; font-family: sans-serif; font-size: 12px; text-transform: uppercase;">Total Paid</td>
                    <td style="border-top: 1px solid #333; padding-top: 15px; color: ${primaryColor}; font-family: sans-serif; font-size: 18px; text-align: right;">${amount}</td>
                  </tr>
                </table>
              </div>

              <div style="text-align: center; margin-top: 30px; margin-bottom: 20px;">
                <a href="${viewBookingLink}" style="display: inline-block; padding: 15px 30px; background-color: ${primaryColor}; color: #000000; text-decoration: none; font-family: sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">View Your Booking</a>
              </div>
              
              <div style="text-align: center; margin-top: 15px;">
                <a href="${confirmationLink}" style="display: inline-block; padding: 12px 25px; background-color: transparent; color: #ffffff; text-decoration: none; font-family: sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; border: 1px solid #444;">Download Receipt</a>
              </div>
              
              <div style="border-top: 1px solid #333; margin: 30px 0; padding-top: 20px;">
                <p style="color: ${mutedColor}; font-family: sans-serif; font-size: 12px; text-align: center; margin: 0;">
                  Can't click the button? Look up your booking at<br>
                  <a href="${domain}/bookings/lookup" style="color: ${primaryColor}; text-decoration: none;">${domain}/bookings/lookup</a><br>
                  using reference <strong style="color: #ffffff;">${ref}</strong> and your email address.
                </p>
              </div>
            </div>
            <div style="background-color: #0a0a0a; padding: 30px 40px; text-align: center; border-top: 1px solid #333;">
               <p style="margin: 0 0 10px; color: ${mutedColor}; font-family: sans-serif; font-size: 14px;">
                 Present this email or your booking reference upon arrival.
               </p>
               <p style="margin: 0; color: #525252; font-family: sans-serif; font-size: 12px;">
                &copy; ${new Date().getFullYear()} Tropicana Worldwide Corp.<br>
                General Santos City, Philippines
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  } else if (type === "booking-cancellation") {
    const { ref, propertyName, checkIn, checkOut, refundAmount, cancellationFee, guestName, isFreeCancellation } = body;
    const domain = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    
    subject = `Booking Cancelled: ${ref} - Tropicana`;
    html = `
      <!DOCTYPE html>
      <html>
        <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'Times New Roman', serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #171717; color: #ffffff;">
            <div style="padding: 40px 40px; text-align: center; border-bottom: 1px solid #333;">
               <h1 style="margin: 0; color: #ffffff; font-size: 28px; text-transform: uppercase; letter-spacing: 3px; font-weight: 400;">Tropicana</h1>
               <p style="margin: 5px 0 0; color: ${primaryColor}; font-size: 10px; letter-spacing: 4px; text-transform: uppercase;">Worldwide Corp.</p>
            </div>
            <div style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <p style="color: ${mutedColor}; font-family: sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">Cancellation Confirmed</p>
                <h2 style="color: #ffffff; font-size: 32px; font-weight: 300; margin: 0; line-height: 1.2;">Booking Cancelled</h2>
              </div>
              
              <p style="color: #d4d4d4; font-family: sans-serif; font-size: 16px; line-height: 1.8; margin-bottom: 30px; text-align: center;">
                Dear ${guestName || "Guest"},<br>
                Your reservation at <strong>${propertyName}</strong> has been cancelled.
                ${isFreeCancellation 
                  ? "A full refund will be processed to your original payment method." 
                  : "A partial refund will be processed after deducting the cancellation fee."}
              </p>

              <div style="background-color: #222; padding: 30px; margin-bottom: 30px; border-left: 2px solid ${mutedColor};">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding-bottom: 15px; color: ${mutedColor}; font-family: sans-serif; font-size: 12px; text-transform: uppercase;">Reference</td>
                    <td style="padding-bottom: 15px; color: #ffffff; font-family: monospace; font-size: 16px; text-align: right;">${ref}</td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 15px; color: ${mutedColor}; font-family: sans-serif; font-size: 12px; text-transform: uppercase;">Original Check In</td>
                    <td style="padding-bottom: 15px; color: #ffffff; font-family: sans-serif; font-size: 14px; text-align: right;">${checkIn}</td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 15px; color: ${mutedColor}; font-family: sans-serif; font-size: 12px; text-transform: uppercase;">Original Check Out</td>
                    <td style="padding-bottom: 15px; color: #ffffff; font-family: sans-serif; font-size: 14px; text-align: right;">${checkOut}</td>
                  </tr>
                  ${!isFreeCancellation ? `
                  <tr>
                    <td style="padding-bottom: 15px; color: ${mutedColor}; font-family: sans-serif; font-size: 12px; text-transform: uppercase;">Cancellation Fee</td>
                    <td style="padding-bottom: 15px; color: #ef4444; font-family: sans-serif; font-size: 14px; text-align: right;">${cancellationFee}</td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="border-top: 1px solid #333; padding-top: 15px; color: ${mutedColor}; font-family: sans-serif; font-size: 12px; text-transform: uppercase;">Refund Amount</td>
                    <td style="border-top: 1px solid #333; padding-top: 15px; color: #22c55e; font-family: sans-serif; font-size: 18px; text-align: right;">${refundAmount}</td>
                  </tr>
                </table>
              </div>

              <div style="border-top: 1px solid #333; margin: 30px 0; padding-top: 20px;">
                <p style="color: ${mutedColor}; font-family: sans-serif; font-size: 12px; text-align: center; margin: 0;">
                  Refunds typically take 5-10 business days to appear on your statement.<br>
                  If you have any questions, please contact us at<br>
                  <a href="mailto:support@doloreshotels.com" style="color: ${primaryColor}; text-decoration: none;">support@doloreshotels.com</a>
                </p>
              </div>
              
              <div style="text-align: center; margin-top: 30px;">
                <a href="${domain}" style="display: inline-block; padding: 15px 30px; background-color: #ffffff; color: #000000; text-decoration: none; font-family: sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Book Again</a>
              </div>
            </div>
            <div style="background-color: #0a0a0a; padding: 30px 40px; text-align: center; border-top: 1px solid #333;">
               <p style="margin: 0 0 10px; color: ${mutedColor}; font-family: sans-serif; font-size: 14px;">
                 We hope to welcome you in the future.
               </p>
               <p style="margin: 0; color: #525252; font-family: sans-serif; font-size: 12px;">
                &copy; ${new Date().getFullYear()} Tropicana Worldwide Corp.<br>
                General Santos City, Philippines
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  } else {
    throw new Error("Invalid email type");
  }



  // Use Axios for Resend API with IPv4 forced to avoid ECONNRESET
  try {
    const httpsAgent = new https.Agent({ family: 4 });
    
    const response = await axios.post("https://api.resend.com/emails", {
      from: `Tropicana <${senderEmail}>`,
      to: [email],
      subject: subject,
      html: html,
    }, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      httpsAgent: httpsAgent
    });
    return response.data;
  } catch (axiosError: any) {
    console.error("Axios Error Details:", axiosError.response?.data || axiosError.message);
    throw new Error(`Resend API Error: ${axiosError.response?.statusText || axiosError.message}`);
  }
};

export async function POST(request: Request) {
  console.log("Email API route hit (Axios)");
  
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Security Check - Use timing-safe comparison to prevent timing attacks
    const internalSecret = request.headers.get("x-internal-secret");
    const expectedSecret = process.env.RESEND_API_KEY;
    
    // Check if secret is missing or invalid using timing-safe comparison
    if (!internalSecret || !expectedSecret || !timingSafeEqual(internalSecret, expectedSecret)) {
      // Log failed authentication attempt with details for monitoring
      console.error("Failed email API authentication attempt", {
        timestamp: new Date().toISOString(),
        hasSecret: !!internalSecret,
        ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not set!");
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
    }

    console.log("Sending email via Axios...");
    const result = await processEmailRequest(body, process.env.RESEND_API_KEY);

    console.log("Email sent successfully:", result);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Email API catch error:", error);
    return NextResponse.json({ error: error.message || "Failed to send email" }, { status: 500 });
  }
}
