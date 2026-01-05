/**
 * Client IP Extraction Utility
 * 
 * Centralized utility for extracting client IP addresses from HTTP request headers.
 * Used by rate limiting and logging across API routes.
 * 
 * ## Security Considerations
 * 
 * The `x-forwarded-for` header is client-spoofable and should only be trusted when:
 * 1. Your application is behind a trusted reverse proxy (e.g., Cloudflare, AWS ALB, nginx)
 * 2. The proxy is configured to overwrite/sanitize the header
 * 3. You've set TRUST_PROXY=true in your environment
 * 
 * ## Configuration
 * 
 * Set the following environment variable to enable proxy trust:
 * - `TRUST_PROXY=true` - Enable parsing of x-forwarded-for header
 * 
 * ## Platform-Specific Headers
 * 
 * This utility checks the following headers in order of priority:
 * 1. `cf-connecting-ip` - Cloudflare (infrastructure-set, cannot be spoofed)
 * 2. `x-real-ip` - nginx/common proxies (infrastructure-set when properly configured)
 * 3. `x-vercel-forwarded-for` - Vercel platform (infrastructure-set)
 * 4. `x-forwarded-for` - Standard proxy header (ONLY when TRUST_PROXY=true)
 * 5. Falls back to 'unknown' if no IP can be determined
 * 
 * ## Deployment Notes
 * 
 * - **Cloudflare**: No configuration needed, cf-connecting-ip is always set
 * - **Vercel**: No configuration needed, x-vercel-forwarded-for is always set
 * - **AWS ALB/ELB**: Set TRUST_PROXY=true, ALB sets x-forwarded-for
 * - **nginx**: Configure `proxy_set_header X-Real-IP $remote_addr;` and use x-real-ip
 * - **Direct (no proxy)**: Leave TRUST_PROXY unset, will return 'unknown'
 */

/**
 * Whether to trust the x-forwarded-for header.
 * Only enable this when running behind a trusted reverse proxy.
 */
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';

/**
 * Extract client IP from request headers.
 * 
 * Prioritizes infrastructure-set headers that cannot be spoofed by clients,
 * and only falls back to x-forwarded-for when explicitly configured to trust proxies.
 * 
 * @param request - The incoming HTTP request
 * @returns The client IP address, or 'unknown' if not determinable
 * 
 * @example
 * ```typescript
 * // In an API route handler
 * import { getClientIP } from '@/lib/client-ip';
 * 
 * export async function POST(request: Request) {
 *   const clientIP = getClientIP(request);
 *   // Use for rate limiting, logging, etc.
 * }
 * ```
 */
export function getClientIP(request: Request): string {
  // 1. Cloudflare - infrastructure-set, highest priority
  // This header is set by Cloudflare's edge and cannot be spoofed by clients
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }

  // 2. x-real-ip - commonly set by nginx and other reverse proxies
  // When properly configured, this is set by the proxy and overwrites any client value
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }

  // 3. Vercel platform header - infrastructure-set
  const vercelForwardedFor = request.headers.get('x-vercel-forwarded-for');
  if (vercelForwardedFor) {
    // Vercel sets this to the actual client IP
    return vercelForwardedFor.split(',')[0].trim();
  }

  // 4. x-forwarded-for - ONLY trust when TRUST_PROXY is enabled
  // This header is easily spoofable by clients, so we only use it when
  // we know we're behind a trusted proxy that sanitizes it
  if (TRUST_PROXY) {
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
      // x-forwarded-for can contain multiple IPs: "client, proxy1, proxy2"
      // The first IP is the original client (when proxy is trusted)
      return forwardedFor.split(',')[0].trim();
    }
  }

  // 5. No reliable IP source available
  // In serverless environments without proper proxy configuration,
  // we may not have access to the actual client IP
  return 'unknown';
}
