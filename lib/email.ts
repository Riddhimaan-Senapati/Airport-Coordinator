import "server-only";

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { z } from "zod";

const smtpSchema = z
  .object({
    host: z.string().min(1),
    port: z.coerce.number().int().min(1).max(65_535),
    user: z.string().min(1).optional(),
    password: z.string().min(1).optional(),
    from: z.email(),
  })
  .refine(({ user, password }) => Boolean(user) === Boolean(password), {
    message: "SMTP_USER and SMTP_PASSWORD must be set together",
  });

let transporter: Transporter | undefined;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const smtp = smtpSchema.parse({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.EMAIL_FROM,
  });

  transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: smtp.user && smtp.password ? { user: smtp.user, pass: smtp.password } : undefined,
  });
  return transporter;
}

type VerificationEmail = {
  to: string;
  url: string;
};

export async function sendVerificationEmail({ to, url }: VerificationEmail) {
  const from = smtpSchema.shape.from.parse(process.env.EMAIL_FROM);
  await getTransporter().sendMail({
    from,
    to,
    subject: "Verify your Airport Buddy account",
    text: `Verify your email address: ${url}`,
  });
}
