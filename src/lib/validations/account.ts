import { z } from "zod";

export const dateTimeFormatSchema = z.object({
  timeFormat: z.enum(["HOUR_12", "HOUR_24"]),
  dateFormat: z.enum(["DMY", "MDY"]),
});
