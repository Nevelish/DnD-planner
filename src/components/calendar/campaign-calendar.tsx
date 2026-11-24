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

const EVENT_CLASS: Record<CalendarSession["status"], string> = {
  PROPOSED: "rbc-event-proposed",
  CONFIRMED: "rbc-event-confirmed",
  COMPLETED: "rbc-event-completed",
};

export function CampaignCalendar({
  sessions,
  weekStartsOn,
}: {
  sessions: CalendarSession[];
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

  const events: (Event & { resource: CalendarSession })[] = sessions.map((s) => {
    const start = new Date(s.startsAt);
    const end = new Date(start.getTime() + (s.durationMinutes ?? 180) * 60_000);
    return {
      title: `${s.title || "Session"} — ${s.campaignName}`,
      start,
      end,
      resource: s,
    };
  });

  return (
    <div className="h-[70vh] rounded-lg border bg-card p-2">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        views={["month"]}
        defaultView="month"
        onSelectEvent={(event) =>
          router.push(
            `/campaigns/${event.resource.campaignId}/sessions/${event.resource.id}`,
          )
        }
        eventPropGetter={(event) => ({
          className: EVENT_CLASS[(event.resource as CalendarSession).status],
        })}
      />
    </div>
  );
}
