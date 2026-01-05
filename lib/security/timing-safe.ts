import { timingSafeEqual as cryptoTimingSafeEqual, createHmac } from 'crypto';

/**
 * HMAC key for timing-safe comparison.
 * Uses environment variable if available, otherwise falls back to a static key.
 * The key doesn't need to be secret for correctness - it just ensures
 * we always produce fixed-length digests for comparison.
 */
const HMAC_KEY = process.env.TIMING_SAFE_HMAC_KEY || 'timing-safe-comparison-key';

/**
 * Computes HMAC-SHA256 digest of a string, producing a fixed 32-byte buffer.
 */
function computeDigest(value: string): Buffer {
  return createHmac('sha256', HMAC_KEY).update(value, 'utf8').digest();
}

/**
 * Performs a timing-safe comparison of two strings.
 * This prevents timing attacks where an attacker could determine
 * how many characters match by measuring response time.
 *
 * Uses HMAC-SHA256 to hash both inputs into fixed-length (32-byte) digests
 * before comparison. This ensures constant-time execution regardless of
 * input lengths, preventing length-based timing leaks.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 */
export function timingSafeEqual(a: string, b: string): boolean {
  // Handle edge cases where either string is null/undefined
  if (a === null || a === undefined || b === null || b === undefined) {
    return false;
  }

  // Hash both strings to fixed-length digests (32 bytes each)
  // This prevents length information leakage since both digests
  // are always the same size regardless of input length
  const digestA = computeDigest(a);
  const digestB = computeDigest(b);

  // Perform timing-safe comparison of the fixed-length digests
  return cryptoTimingSafeEqual(digestA, digestB);
}
