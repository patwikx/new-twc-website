import * as z from "zod";
import { PasswordSchema, PASSWORD_ERRORS } from "./password";

export const LoginSchema = z.object({
  email: z.string().email({
    message: "Email is required",
  }),
  password: z.string().min(1, {
    message: "Password is required",
  }),
});

export const RegisterSchema = z.object({
  email: z.string().email({
    message: "Email is required",
  }),
  password: PasswordSchema,
  name: z.string().min(1, {
    message: "Name is required",
  }),
});

export const ResetSchema = z.object({
  email: z.string().email({
    message: "Email is required",
  }),
});

export const NewPasswordSchema = z.object({
  password: PasswordSchema,
  confirmPassword: z.string().min(1, {
    message: "Confirm password is required",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const SettingsSchema = z.object({
  name: z.optional(z.string()),
  phone: z.optional(z.string()),
  dateOfBirth: z.optional(z.string()), // Will be parsed to Date on server
  nationality: z.optional(z.string()),
  address: z.optional(z.string()),
  isTwoFactorEnabled: z.optional(z.boolean()),
  email: z.optional(z.string().email()),
  password: z.optional(z.string().min(6)),
  newPassword: z.optional(PasswordSchema),
})
.refine((data) => {
  if (data.password && !data.newPassword) {
    return false;
  }
  return true;
}, {
  message: "New password is required!",
  path: ["newPassword"]
})
.refine((data) => {
  if (data.newPassword && !data.password) {
    return false;
  }
  return true;
}, {
  message: "Password is required!",
  path: ["password"]
});

// Re-export password utilities for convenience
export { PasswordSchema, PASSWORD_ERRORS } from "./password";

// Re-export phone validation utilities
export { 
  PhoneSchema, 
  OptionalPhoneSchema,
  PHONE_ERRORS, 
  validatePhoneNumber, 
  normalizePhoneNumber,
  isValidMobile,
  isValidLandline,
} from "./phone";
