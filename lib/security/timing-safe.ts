import { timingSafeEqual as cryptoTimingSafeEqual } from 'crypto';

/**
 * Performs a timing-safe comparison of two strings.
 * This prevents timing attacks where an attacker could determine
 * how many characters match by measuring response time.
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

  // Convert strings to buffers
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');

  // If lengths differ, we still need to do a constant-time comparison
  // to avoid leaking length information through timing
  if (bufferA.length !== bufferB.length) {
    // Compare against itself to maintain constant time
    // but return false since lengths differ
    cryptoTimingSafeEqual(bufferA, bufferA);
    return false;
  }

  // Perform the actual timing-safe comparison
  return cryptoTimingSafeEqual(bufferA, bufferB);
}
