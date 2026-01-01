import { db } from "@/lib/db";
import { getPasswordResetTokenByEmail } from "@/data/password-reset-token";
import { getVerificationTokenByEmail } from "@/data/verification-token";

// Generate a 6-digit random code
const generateOTPCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const generatePasswordResetToken = async (email: string) => {
  const token = generateOTPCode();
  const expires = new Date(new Date().getTime() + 3600 * 1000); // 1 hour

  const existingToken = await getPasswordResetTokenByEmail(email);

  if (existingToken) {
    await db.passwordResetToken.delete({
      where: { id: existingToken.id }
    });
  }

  const passwordResetToken = await db.passwordResetToken.create({
    data: {
      email,
      token,
      expires,
    }
  });

  return passwordResetToken;
};

export const generateVerificationToken = async (email: string) => {
  const token = generateOTPCode();
  const expires = new Date(new Date().getTime() + 3600 * 1000); // 1 hour

  const existingToken = await getVerificationTokenByEmail(email);

  if (existingToken) {
    await db.verificationToken.delete({
      where: { 
        identifier_token: {
          identifier: existingToken.identifier,
          token: existingToken.token,
        }
      }
    });
  }

  const verificationToken = await db.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    }
  });

  return verificationToken;
};
