import { z } from "zod";
import { ClientError } from "../errors/client-error";
export const dateTime = z
    .string()
    .datetime({ offset: true })
    .transform((value) => new Date(value));
export const email = z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase());
export const tripBody = z.object({
    destination: z.string().trim().min(4).max(200),
    starts_at: dateTime,
    ends_at: dateTime
});
export function validateTripDates(startsAt: Date, endsAt: Date) {
    if (startsAt <= new Date()) throw new ClientError("Start date must be in the future");
    if (endsAt < startsAt) throw new ClientError("End date must be after start date");
    if (endsAt.getTime() - startsAt.getTime() > 366 * 86400000)
        throw new ClientError("Trip must be no longer than 366 days");
}

/** Refinements must not throw after another continuable schema check fails. */
export function isHttpUrl(value: string): boolean {
    try {
        return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
        return false;
    }
}
