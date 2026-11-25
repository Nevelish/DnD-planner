"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Calendar, dateFnsLocalizer, type Event } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "@/components/calendar/campaign-calendar.css";

export type CalendarSession = {
  id: string;
  campaignId: string;
  campaignName: string;
  title: string | null;
  startsAt: string;
  durationMinutes: number | null;
  status: "PROPOSED" | "CONFIRMED" | "COMPLETED";
};

/** Someone's away dates, shown as an all-day bar. */
export type CalendarAway = {
  key: string;
  title: string;
  startsOn: string; // YYYY-MM-DD
  endsOn: string; // YYYY-MM-DD, inclusive
  mine: boolean;
};

/** Midnight at the start of a "YYYY-MM-DD" day, in the browser's timezone. */
function startOfDay(day: string, addDays = 0) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date + addDays);
}

type CalendarEvent = Event & { session?: CalendarSession; away?: CalendarAway };

const EVENT_CLASS: Record<CalendarSession["status"], string> = {
  PROPOSED: "rbc-event-proposed",
  CONFIRMED: "rbc-event-confirmed",
  COMPLETED: "rbc-event-completed",
};

export function CampaignCalendar({
  sessions,
  away = [],
  weekStartsOn,
}: {
  sessions: CalendarSession[];
  away?: CalendarAway[];
  weekStartsOn: 0 | 1;
}) {
  const router = useRouter();

  const localizer = useMemo(
    () =>
      dateFnsLocalizer({
        format,
        parse,
        startOfWeek: () => startOfWeek(new Date(), { locale: enUS, weekStartsOn }),
        getDay,
        locales: { "en-US": enUS },
      }),
    [weekStartsOn],
  );

  const awayEvents: CalendarEvent[] = away.map((a) => ({
    title: a.title,
    start: startOfDay(a.startsOn),
    end: startOfDay(a.endsOn, 1),
    allDay: true,
    away: a,
  }));

  const sessionEvents: CalendarEvent[] = sessions.map((s) => {
    const start = new Date(s.startsAt);
    const end = new Date(start.getTime() + (s.durationMinutes ?? 180) * 60_000);
    return {
      title: `${s.title || "Session"} — ${s.campaignName}`,
      start,
      end,
      session: s,
    };
  });

  return (
    <div className="h-[70vh] rounded-lg border bg-card p-2">
      <Calendar<CalendarEvent>
        localizer={localizer}
        events={[...awayEvents, ...sessionEvents]}
        startAccessor="start"
        endAccessor="end"
        views={["month"]}
        defaultView="month"
        onSelectEvent={(event: CalendarEvent) => {
          if (event.session) {
            router.push(`/campaigns/${event.session.campaignId}/sessions/${event.session.id}`);
          }
        }}
        eventPropGetter={(event: CalendarEvent) => ({
          className: event.away
            ? event.away.mine
              ? "rbc-event-away rbc-event-away-mine"
              : "rbc-event-away"
            : event.session
              ? EVENT_CLASS[event.session.status]
              : undefined,
        })}
      />
    </div>
  );
}
