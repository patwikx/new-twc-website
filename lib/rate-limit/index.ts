/**
 * Rate Limiter with Sliding Window Algorithm
 * 
 * Implements IP-based rate limiting using an in-memory store.
 * Uses a sliding window algorithm to track request attempts.
 */

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number; // Seconds until the oldest request expires (when blocked)
}

interface RateLimitOptions {
  limit?: number;
  windowMs?: number;
  keyPrefix?: string; // Namespace for different endpoints (e.g., "checkout", "newsletter")
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Default configuration
const DEFAULT_LIMIT = 5;
const DEFAULT_WINDOW_MS = 60 * 1000; // 60 seconds

/**
 * Clean up expired entries from the store
 * Called periodically to prevent memory leaks
 */
function cleanupExpiredEntries(windowMs: number): void {
  const now = Date.now();
  const cutoff = now - windowMs;
  
  for (const [key, entry] of rateLimitStore.entries()) {
    // Filter out timestamps outside the window
    entry.timestamps = entry.timestamps.filter(ts => ts > cutoff);
    
    // Remove entry if no timestamps remain
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Check if a request should be rate limited using sliding window algorithm
 * 
 * @param identifier - Unique identifier for the client (typically IP address)
 * @param options - Rate limit configuration options
 * @returns Object with allowed status, remaining attempts, and retryAfter (when blocked)
 */
export async function checkLimit(
  identifier: string,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const { 
    limit = DEFAULT_LIMIT, 
    windowMs = DEFAULT_WINDOW_MS,
    keyPrefix 
  } = options;
  
  const now = Date.now();
  const cutoff = now - windowMs;
  
  // Build the key with optional prefix for endpoint namespacing
  const key = keyPrefix ? `${keyPrefix}:${identifier}` : identifier;
  
  // Get or create entry for this identifier
  let entry = rateLimitStore.get(key);
  
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(key, entry);
  }
  
  // Filter out timestamps outside the sliding window
  entry.timestamps = entry.timestamps.filter(ts => ts > cutoff);
  
  // Check if limit exceeded
  if (entry.timestamps.length >= limit) {
    // Calculate retryAfter: time until the oldest request expires
    const oldestTimestamp = Math.min(...entry.timestamps);
    const retryAfterMs = (oldestTimestamp + windowMs) - now;
    const retryAfter = Math.ceil(retryAfterMs / 1000);
    
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, retryAfter) // At least 1 second
    };
  }
  
  // Add current timestamp and allow request
  entry.timestamps.push(now);
  
  return {
    allowed: true,
    remaining: limit - entry.timestamps.length
  };
}

/**
 * Legacy function signature for backward compatibility
 * @deprecated Use checkLimit with options object instead
 */
export async function checkLimitLegacy(
  identifier: string,
  limit: number = DEFAULT_LIMIT,
  windowMs: number = DEFAULT_WINDOW_MS
): Promise<RateLimitResult> {
  return checkLimit(identifier, { limit, windowMs });
}

/**
 * Reset rate limit for a specific identifier
 * Useful for testing or administrative purposes
 * 
 * @param identifier - Unique identifier to reset
 */
export function resetLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

/**
 * Clear all rate limit entries
 * Useful for testing
 */
export function clearAllLimits(): void {
  rateLimitStore.clear();
}

/**
 * Get current count for an identifier within the window
 * Useful for testing and debugging
 * 
 * @param identifier - Unique identifier to check
 * @param windowMs - Time window in milliseconds
 * @returns Current count of requests in the window
 */
export function getCurrentCount(
  identifier: string,
  windowMs: number = DEFAULT_WINDOW_MS
): number {
  const entry = rateLimitStore.get(identifier);
  if (!entry) return 0;
  
  const cutoff = Date.now() - windowMs;
  return entry.timestamps.filter(ts => ts > cutoff).length;
}

// Periodic cleanup every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => cleanupExpiredEntries(DEFAULT_WINDOW_MS), 5 * 60 * 1000);
}
