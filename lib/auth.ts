import "server-only";

import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";

import { database, mongoClient } from "./db";
import { sendVerificationEmail } from "./email";
import { emailSchema } from "./validation";

export const auth = betterAuth({
  database: mongodbAdapter(database, { client: mongoClient }),
  user: {
    validateUserInfo({ user }) {
      if (!emailSchema.safeParse(user.email).success) {
        return { error: "Use a valid @umass.edu email address." };
      }
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      await sendVerificationEmail({ to: user.email, url });
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/send-verification-email": { window: 300, max: 3 },
    },
  },
});
