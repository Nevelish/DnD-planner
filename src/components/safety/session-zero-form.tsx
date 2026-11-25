"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { saveSessionZero } from "@/lib/actions/safety";
import { SESSION_ZERO_QUESTIONS, type SessionZeroAnswers } from "@/lib/sessionZero";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/userError";

export function SessionZeroForm({
  campaignId,
  answers,
}: {
  campaignId: string;
  answers: SessionZeroAnswers;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await saveSessionZero(campaignId, formData);
        toast.success("Session Zero saved.");
      } catch (e) {
        toast.error(errorMessage(e));
      }
    });
  }

  return (
    // onSubmit rather than action: a form action resets the textareas to
    // their old defaultValues while the save is still in flight.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(new FormData(e.currentTarget));
      }}
      className="flex flex-col gap-4"
    >
      {SESSION_ZERO_QUESTIONS.map(({ key, label, hint }) => (
        <div key={key} className="flex flex-col gap-1.5">
          <Label htmlFor={`sz-${key}`}>{label}</Label>
          <Textarea
            id={`sz-${key}`}
            name={key}
            rows={2}
            maxLength={1000}
            defaultValue={answers[key] ?? ""}
            placeholder={hint}
          />
        </div>
      ))}
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
