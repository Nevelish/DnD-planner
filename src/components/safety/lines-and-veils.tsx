"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { BanIcon, EyeOffIcon, XIcon } from "lucide-react";
import type { SafetyKind } from "@prisma/client";

import { addSafetyEntry, removeSafetyEntry } from "@/lib/actions/safety";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Entry = { id: string; kind: SafetyKind; text: string; mine: boolean };

const KINDS = {
  LINE: {
    title: "Lines",
    blurb: "Never in the game, not even off-screen.",
    icon: BanIcon,
    empty: "No lines yet.",
    placeholder: "e.g. harm to children",
  },
  VEIL: {
    title: "Veils",
    blurb: "Can happen in the story, but off-screen. Fade to black.",
    icon: EyeOffIcon,
    empty: "No veils yet.",
    placeholder: "e.g. torture, described in detail",
  },
} as const;

export function LinesAndVeils({
  campaignId,
  entries,
  isDM,
}: {
  campaignId: string;
  entries: Entry[];
  isDM: boolean;
}) {
  const [kind, setKind] = useState<SafetyKind>("LINE");
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleAdd(formData: FormData) {
    formData.set("kind", kind);
    startTransition(async () => {
      try {
        await addSafetyEntry(campaignId, formData);
        formRef.current?.reset();
        toast.success(kind === "LINE" ? "Line added." : "Veil added.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleRemove(entry: Entry) {
    if (!entry.mine && !window.confirm(`Remove "${entry.text}" for everyone?`)) return;
    startTransition(async () => {
      try {
        await removeSafetyEntry(campaignId, entry.id);
        toast.success("Removed.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {(["LINE", "VEIL"] as const).map((k) => {
          const { title, blurb, icon: Icon, empty } = KINDS[k];
          const list = entries.filter((e) => e.kind === k);
          return (
            <section key={k} aria-labelledby={`safety-${k}`} className="flex flex-col gap-2">
              <h3 id={`safety-${k}`} className="flex items-center gap-2 font-medium">
                <Icon className="size-4 text-muted-foreground" aria-hidden /> {title}
              </h3>
              <p className="text-xs text-muted-foreground">{blurb}</p>
              {list.length === 0 ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">{empty}</p>
              ) : (
                <ul className="flex flex-col divide-y rounded-md border">
                  {list.map((entry) => (
                    <li key={entry.id} className="flex items-start justify-between gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0 break-words">
                        {entry.text}
                        {entry.mine && (
                          <span className="ml-1.5 text-xs text-muted-foreground">(added by you)</span>
                        )}
                      </span>
                      {(entry.mine || isDM) && (
                        <button
                          type="button"
                          onClick={() => handleRemove(entry)}
                          disabled={isPending}
                          aria-label={`Remove "${entry.text}"`}
                          className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
                        >
                          <XIcon className="size-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <form
        ref={formRef}
        // onSubmit rather than action: a form action auto-resets the form
        // straight away, which would lose the text if adding fails.
        onSubmit={(e) => {
          e.preventDefault();
          handleAdd(new FormData(e.currentTarget));
        }}
        className="flex flex-col gap-3 rounded-md bg-muted/50 p-4">
        <p className="text-sm font-medium">Add something</p>
        <div role="group" aria-label="Line or veil" className="grid grid-cols-2 gap-2 sm:w-72">
          {(["LINE", "VEIL"] as const).map((k) => (
            <Button
              key={k}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={cn(kind === k && "border-primary bg-primary/10 text-foreground hover:bg-primary/15")}
            >
              {k === "LINE" ? "Line" : "Veil"}
            </Button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            name="text"
            required
            maxLength={200}
            aria-label={kind === "LINE" ? "New line" : "New veil"}
            placeholder={KINDS[kind].placeholder}
          />
          <Button type="submit" disabled={isPending} className="shrink-0">
            Add {kind === "LINE" ? "line" : "veil"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Added anonymously: nobody, not even the DM, can see who added what.
          No need to explain why.
        </p>
      </form>
    </div>
  );
}
