"use server";

import { db } from "@/lib/db";

/**
 * Validate and get coupon by code
 */
export async function getCouponByCode(code: string) {
  const coupon = await db.coupon.findFirst({
    where: {
      code: code.toUpperCase(),
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: new Date() } },
      ],
    },
  });
  
  if (!coupon) return null;
  
  // Convert Decimal to number
  return {
    code: coupon.code,
    type: coupon.type.toLowerCase() as "percent" | "fixed",
    value: Number(coupon.value),
    description: coupon.description,
  };
}
