/**
 * Client IP Extraction Utility
 * 
 * Centralized utility for extracting client IP addresses from HTTP request headers.
 * Used by rate limiting and logging across API routes.
 */

/**
 * Extract client IP from request headers.
 * Checks x-forwarded-for and x-real-ip headers commonly set by proxies/load balancers.
 * 
 * @param request - The incoming HTTP request
 * @returns The client IP address, or 'unknown' if not determinable
 */
export function getClientIP(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one (original client)
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }
  
  return 'unknown';
}
