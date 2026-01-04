// Get the base database URL for internal API calls
const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      // Client-side
      return '';
    }
    // Server-side - use environment variable or localhost
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  };
  
  export const sendPasswordResetEmail = async (
    email: string,
    token: string,
  ) => {
    const baseUrl = getBaseUrl();
    
    try {
      const response = await fetch(`${baseUrl}/api/email`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-internal-secret": process.env.RESEND_API_KEY || "" 
        },
        body: JSON.stringify({ type: "password-reset", email, token }),
        cache: "no-store",
      });
  
      // Check if response is HTML (error page)
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        console.error("Email API returned non-JSON response:", response.status);
        throw new Error("Email service unavailable");
      }
  
      const result = await response.json();
  
      if (!response.ok) {
        console.error("Password reset email error:", result.error);
        throw new Error(result.error || "Failed to send email");
      }
  
      console.log("Password reset email sent successfully:", result.data);
      return result;
    } catch (error) {
      console.error("Failed to send password reset email:", error);
      throw error;
    }
  };
  
  export const sendVerificationEmail = async (
    email: string,
    token: string,
  ) => {
    const baseUrl = getBaseUrl();
    
    try {
      const response = await fetch(`${baseUrl}/api/email`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-internal-secret": process.env.RESEND_API_KEY || "" 
        },
        body: JSON.stringify({ type: "verification", email, token }),
        cache: "no-store",
      });
  
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        console.error("Email API returned non-JSON response:", response.status);
        throw new Error("Email service unavailable");
      }
  
      const result = await response.json();
  
      if (!response.ok) {
        console.error("Verification email error:", result.error);
        throw new Error(result.error || "Failed to send email");
      }
  
      console.log("Verification email sent successfully:", result.data);
      return result;
    } catch (error) {
      console.error("Failed to send verification email:", error);
      throw error;
    }
  };
  
  export const sendWelcomeEmail = async (
    email: string,
    name: string,
  ) => {
    const baseUrl = getBaseUrl();
    
    try {
      const response = await fetch(`${baseUrl}/api/email`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-internal-secret": process.env.RESEND_API_KEY || "" 
        },
        body: JSON.stringify({ type: "welcome", email, name }),
        cache: "no-store",
      });
  
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        console.error("Email API returned non-JSON response");
        return;
      }
  
      const result = await response.json();
  
      if (!response.ok) {
        console.error("Welcome email error:", result.error);
      }
  
      console.log("Welcome email sent successfully:", result.data);
      return result;
    } catch (error) {
      console.error("Failed to send welcome email:", error);
      // Don't throw - welcome email is not critical
    }
  };

  interface BookingConfirmationParams {
    email: string;
    ref: string;
    propertyName: string;
    checkIn: string;
    checkOut: string;
    amount: string;
    guestName: string;
    lookupToken?: string; // Secure token for direct booking access
  }
  
  export const sendBookingConfirmationEmail = async (params: BookingConfirmationParams) => {
    const baseUrl = getBaseUrl();
    const { email, ...rest } = params;
  
    try {
      const response = await fetch(`${baseUrl}/api/email`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-internal-secret": process.env.RESEND_API_KEY || "" 
        },
        body: JSON.stringify({ 
          type: "booking-confirmation", 
          email, 
          ...rest 
        }),
        cache: "no-store",
      });
  
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        console.error("Email API returned non-JSON response");
        return;
      }
  
      const result = await response.json();
  
      if (!response.ok) {
        console.error("Booking confirmation email error:", result.error);
        throw new Error(result.error || "Failed to send booking email");
      }
  
      console.log("Booking confirmation email sent:", result.data);
      return result;
    } catch (error) {
      console.error("Failed to send booking confirmation email:", error);
      // Don't throw to avoid crashing webhook
    }
  };
