import { z } from "zod";

const VENUE_TYPES = ["BAR", "CLUB", "LOUNGE", "ROOFTOP", "RESTAURANT", "LIVE_MUSIC", "CAFE", "EVENT_SPACE", "OTHER"] as const;

const hoursSchema = z
  .array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      openTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm"),
      closeTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm"),
    })
  )
  .max(7 * 2); // at most two windows per day of week is plenty for hand-entered hours

export const venueAdminSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(60),
  subcategory: z.string().max(60).nullable().optional(),
  venueType: z.enum(VENUE_TYPES),
  neighborhood: z.string().min(1).max(60),
  streetAddress: z.string().min(1).max(160),
  city: z.string().min(1).max(60),
  state: z.string().min(1).max(20),
  postalCode: z.string().max(20),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().min(1),
  website: z.string().url().nullable().optional().or(z.literal("")),
  instagramHandle: z.string().max(60).nullable().optional(),
  capacityEstimate: z.number().int().positive().nullable().optional(),
  priceLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  musicType: z.string().max(60).nullable().optional(),
  isActive: z.boolean(),
  hours: hoursSchema,
});

export const venueAdminPatchSchema = venueAdminSchema.partial();
