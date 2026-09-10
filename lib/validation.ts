import { z } from "zod";

export const airportIdSchema = z.coerce.number().int().positive();

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email())
  .refine((email) => email.endsWith("@umass.edu"), {
    message: "Use a valid @umass.edu email address.",
  });

export const tripInputSchema = z.object({
  airportId: airportIdSchema,
  arrivalAtUtc: z.iso
    .datetime({ offset: true })
    .transform((value) => new Date(value))
    .refine(
      (arrival) => {
        const now = Date.now();
        return arrival.getTime() >= now - 86_400_000 && arrival.getTime() <= now + 31_536_000_000;
      },
      { message: "Choose an arrival between yesterday and one year from now." },
    ),
  waitHours: z.coerce.number().int().min(1).max(24),
});

export const contactConsentSchema = z.object({
  matchId: z.uuid("Invalid match."),
  decision: z.enum(["accept", "revoke"]),
});

export type TripInput = z.infer<typeof tripInputSchema>;
