// Shared by the client component that writes it (TimeZoneSync) and the
// server helper that reads it (getRequestTimeZone), so it can't live in
// either "server-only" or "use client" code.
export const TIMEZONE_COOKIE = "tz";
