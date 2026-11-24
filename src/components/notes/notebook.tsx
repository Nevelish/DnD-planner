"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FilePlusIcon,
  LinkIcon,
  PinIcon,
  PinOffIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import {
  createNotebookPage,
  deleteNotebookPage,
  renameNotebookPage,
  saveNotebookPage,
  setNotebookPagePinned,
  linkMentionInPage,
} from "@/lib/actions/notebook";
import { NOTE_TEMPLATES, templatesFor, type NoteTemplateKey } from "@/lib/noteTemplates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NotesEditor } from "@/components/notes/notes-editor";
import { NotebookMarkdown, type LinkablePage } from "@/components/notes/notebook-markdown";

export type NotebookPage = {
  id: string;
  label: string;
  pinned: boolean;
  /** Set for a session's prep page: where that session lives. */
  sessionHref: string | null;
  /** e.g. the session date for prep pages. */
  meta?: string;
};

export type NotebookSelected = NotebookPage & {
  title: string;
  content: string;
  updatedAt: string;
  /** Pages with a [[link]] to this one. */
  backlinks: { id: string; label: string }[];
  /** Pages that name this one in plain text, without linking it. */
  mentions: { id: string; label: string }[];
  /** Just created: open on the editor rather than the preview. */
  startInEdit: boolean;
};

export type NotebookSearch = {
  q: string;
  results: { id: string; label: string; snippet: string }[];
};

const DISCARD = "You have unsaved changes on this page. Leave without saving?";

function NewPageDialog({
  campaignId,
  kind,
  onCreated,
}: {
  campaignId: string;
  kind: "dm" | "player";
  onCreated: (pageId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState<NoteTemplateKey>("blank");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("template", template);
    startTransition(async () => {
      try {
        const { pageId } = await createNotebookPage(campaignId, formData);
        setOpen(false);
        onCreated(pageId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full">
          <FilePlusIcon /> New page
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New page</DialogTitle>
          <DialogDescription>
            {kind === "dm" ? "Only you can see your notebook." : "Only you can see your notebook, not even the DM."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="page-title">Title</Label>
            <Input id="page-title" name="title" required maxLength={120} placeholder="Baron Vex" autoFocus />
          </div>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">Start from</legend>
            <div className="grid grid-cols-2 gap-2">
              {templatesFor(kind).map((key) => (
                <Button
                  key={key}
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-pressed={template === key}
                  onClick={() => setTemplate(key)}
                  className={cn(template === key && "border-primary bg-primary/10 text-foreground hover:bg-primary/15")}
                >
                  {NOTE_TEMPLATES[key].label}
                </Button>
              ))}
            </div>
          </fieldset>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create page"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PageList({
  heading,
  pages,
  selectedId,
  hrefFor,
  onNavigate,
}: {
  heading: string;
  pages: NotebookPage[];
  selectedId: string | null;
  hrefFor: (id: string) => string;
  onNavigate: (e: React.MouseEvent) => void;
}) {
  if (pages.length === 0) return null;
  return (
    <nav aria-label={heading} className="flex flex-col gap-1">
      <h3 className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{heading}</h3>
      <ul className="flex flex-col">
        {pages.map((p) => (
          <li key={p.id}>
            <Link
              href={hrefFor(p.id)}
              onClick={onNavigate}
              aria-current={p.id === selectedId ? "page" : undefined}
              className={cn(
                "flex flex-col rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                p.id === selectedId && "bg-muted font-medium",
              )}
            >
              <span className="truncate">{p.label}</span>
              {p.meta && <span className="truncate text-xs font-normal text-muted-foreground">{p.meta}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** A notebook: the DM's (kind "dm", with session prep) or a player's own
 * private one (kind "player"). Which pages it holds is decided on the
 * server; this only changes templates and wording. */
export function Notebook({
  campaignId,
  kind,
  pages,
  selected,
  search,
  linkablePages,
}: {
  campaignId: string;
  kind: "dm" | "player";
  pages: NotebookPage[];
  selected: NotebookSelected | null;
  search: NotebookSearch | null;
  /** Pages a [[link]] can point at (not session prep). */
  linkablePages: LinkablePage[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [dirty, setDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const onDirtyChange = useCallback((d: boolean) => setDirty(d), []);

  const hrefFor = (id: string) => `${pathname}?page=${id}`;
  const confirmLeave = () => !dirty || window.confirm(DISCARD);
  const onNavigate = (e: React.MouseEvent) => {
    if (!confirmLeave()) e.preventDefault();
  };
  const go = (href: string) => {
    if (confirmLeave()) {
      setDirty(false);
      router.push(href);
    }
  };

  const pinned = pages.filter((p) => p.pinned && !p.sessionHref);
  const plain = pages.filter((p) => !p.pinned && !p.sessionHref);
  const prep = pages.filter((p) => p.sessionHref);
  const selectedId = search ? null : (selected?.id ?? null);

  function run(action: () => Promise<unknown>, done?: () => void) {
    startTransition(async () => {
      try {
        await action();
        done?.();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    go(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname);
  }

  return (
    <div className="grid gap-6 md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="flex flex-col gap-4">
        <NewPageDialog campaignId={campaignId} kind={kind} onCreated={(id) => go(`${hrefFor(id)}&edit=1`)} />
        <form onSubmit={handleSearch} role="search" className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            type="search"
            aria-label="Search your notebook"
            placeholder="Search pages"
            defaultValue={search?.q ?? ""}
            key={search?.q ?? ""}
            className="pl-8"
          />
        </form>

        {/* Phones: one dropdown instead of a long list above the page. */}
        <div className="md:hidden">
          <Label htmlFor="page-picker" className="sr-only">
            Open a page
          </Label>
          <select
            id="page-picker"
            value={selectedId ?? ""}
            onChange={(e) => e.target.value && go(hrefFor(e.target.value))}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            {!selectedId && <option value="">Open a page…</option>}
            {[
              ["Pinned", pinned],
              ["Pages", plain],
              ["Session prep", prep],
            ].map(([heading, list]) =>
              (list as NotebookPage[]).length ? (
                <optgroup key={heading as string} label={heading as string}>
                  {(list as NotebookPage[]).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                      {p.meta ? ` (${p.meta})` : ""}
                    </option>
                  ))}
                </optgroup>
              ) : null,
            )}
          </select>
        </div>

        <div className="hidden flex-col gap-4 md:flex">
          <PageList heading="Pinned" pages={pinned} selectedId={selectedId} hrefFor={hrefFor} onNavigate={onNavigate} />
          <PageList heading="Pages" pages={plain} selectedId={selectedId} hrefFor={hrefFor} onNavigate={onNavigate} />
          <PageList heading="Session prep" pages={prep} selectedId={selectedId} hrefFor={hrefFor} onNavigate={onNavigate} />
        </div>
      </aside>

      <section className="min-w-0">
        {search ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">
                {search.results.length} {search.results.length === 1 ? "page matches" : "pages match"} “{search.q}”
              </h3>
              <Button size="sm" variant="ghost" onClick={() => go(pathname)}>
                <XIcon /> Clear search
              </Button>
            </div>
            <ul className="flex flex-col divide-y rounded-md border">
              {search.results.map((r) => (
                <li key={r.id}>
                  <Link href={hrefFor(r.id)} className="flex flex-col gap-0.5 px-3 py-2 hover:bg-muted">
                    <span className="text-sm font-medium">{r.label}</span>
                    {r.snippet && <span className="text-xs text-muted-foreground">{r.snippet}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : selected ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {selected.sessionHref ? (
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-semibold">Prep: {selected.label}</h3>
                  <Link href={selected.sessionHref} className="text-xs text-muted-foreground underline underline-offset-2">
                    Go to the session{selected.meta ? ` (${selected.meta})` : ""}
                  </Link>
                </div>
              ) : (
                <Input
                  key={selected.id + selected.title}
                  aria-label="Page title"
                  defaultValue={selected.title}
                  maxLength={120}
                  className="h-9 min-w-0 flex-1 border-transparent px-1 text-lg font-semibold shadow-none hover:border-input focus-visible:border-input"
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  onBlur={(e) => {
                    const title = e.currentTarget.value.trim();
                    if (title && title !== selected.title) {
                      startTransition(async () => {
                        try {
                          const { updatedLinks } = await renameNotebookPage(campaignId, selected.id, title);
                          toast.success(
                            updatedLinks
                              ? `Renamed, and updated links in ${updatedLinks} ${updatedLinks === 1 ? "page" : "pages"}.`
                              : "Renamed.",
                          );
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Something went wrong.");
                        }
                      });
                    } else {
                      e.currentTarget.value = selected.title;
                    }
                  }}
                />
              )}
              {!selected.sessionHref && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => run(() => setNotebookPagePinned(campaignId, selected.id, !selected.pinned))}
                >
                  {selected.pinned ? <PinOffIcon /> : <PinIcon />} {selected.pinned ? "Unpin" : "Pin"}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => {
                  if (!window.confirm(`Delete "${selected.label}"? This can't be undone.`)) return;
                  run(
                    () => deleteNotebookPage(campaignId, selected.id),
                    () => {
                      setDirty(false);
                      toast.success("Page deleted.");
                      router.push(pathname);
                    },
                  );
                }}
              >
                <Trash2Icon /> Delete
              </Button>
            </div>
            <NotesEditor
              key={selected.id}
              campaignId={campaignId}
              initialContent={selected.content}
              initialUpdatedAt={selected.updatedAt}
              save={(formData) => saveNotebookPage(campaignId, selected.id, formData)}
              onDirtyChange={onDirtyChange}
              // Open on the readable view (where [[links]] work), unless the
              // page is empty or was just created.
              defaultTab={selected.startInEdit || !selected.content.trim() ? "edit" : "preview"}
              linkTargets={linkablePages.filter((p) => p.id !== selected.id).map((p) => p.title)}
              renderPreview={(content) => (
                <NotebookMarkdown
                  campaignId={campaignId}
                  content={content}
                  pages={linkablePages}
                  confirmLeave={confirmLeave}
                />
              )}
              placeholder={"Markdown works. Link other pages with [[Page title]]."}
              linkHelp={kind}
            />
            {selected.backlinks.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Linked from:</span>
                {selected.backlinks.map((b) => (
                  <Link
                    key={b.id}
                    href={hrefFor(b.id)}
                    onClick={onNavigate}
                    className="rounded-md border px-2 py-0.5 hover:bg-muted"
                  >
                    {b.label}
                  </Link>
                ))}
              </div>
            )}
            {selected.mentions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Mentioned in, not linked:</span>
                {selected.mentions.map((m) => (
                  <span key={m.id} className="inline-flex items-center rounded-md border">
                    <Link
                      href={hrefFor(m.id)}
                      onClick={onNavigate}
                      className="rounded-l-md px-2 py-0.5 hover:bg-muted"
                    >
                      {m.label}
                    </Link>
                    <button
                      type="button"
                      disabled={isPending}
                      aria-label={`Link ${selected.title} in ${m.label}`}
                      title={`Turn the mention in ${m.label} into a link`}
                      onClick={() =>
                        run(
                          () => linkMentionInPage(campaignId, m.id, selected.title),
                          () => toast.success(`Linked in ${m.label}.`),
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-r-md border-l px-2 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                    >
                      <LinkIcon className="size-3.5" /> Link
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            <p>Your notebook is empty.</p>
            <p>Make a page for an NPC, a place, a plot thread: anything you want to keep track of.</p>
          </div>
        )}
      </section>
    </div>
  );
}
