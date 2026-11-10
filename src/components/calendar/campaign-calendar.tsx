"use client";

import { useRouter } from "next/navigation";
import { Calendar, dateFnsLocalizer, type Event } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "@/components/calendar/campaign-calendar.css";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: enUS }),
  getDay,
  locales: { "en-US": enUS },
});

export type CalendarSession = {
  id: string;
  campaignId: string;
  campaignName: string;
  title: string | null;
  startsAt: string;
  durationMinutes: number | null;
  status: "PROPOSED" | "CONFIRMED";
};

export function CampaignCalendar({ sessions }: { sessions: CalendarSession[] }) {
  const router = useRouter();

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
          className:
            event.resource.status === "CONFIRMED"
              ? "rbc-event-confirmed"
              : "rbc-event-proposed",
        })}
      />
    </div>
  );
}
