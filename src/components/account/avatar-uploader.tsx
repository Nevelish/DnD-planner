"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImageUpIcon, Trash2Icon } from "lucide-react";

import { removeAvatar, uploadAvatar } from "@/lib/actions/avatar";
import type { AvatarUser } from "@/lib/avatar";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { errorMessage } from "@/lib/userError";

const UPLOAD_SIZE = 512;

/** Crops the middle square out of the picked photo and shrinks it, so a
 * 6 MB phone photo uploads as ~60 KB. The server re-encodes it again. */
async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file); // honours EXIF rotation
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(UPLOAD_SIZE, side);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.9),
  );
}

export function AvatarUploader({ user }: { user: AvatarUser }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarUpdatedAt, setAvatarUpdatedAt] = useState(user.avatarUpdatedAt ?? null);
  const [isPending, startTransition] = useTransition();

  function handleFile(file: File | undefined) {
    if (!file) return;
    startTransition(async () => {
      let blob: Blob;
      try {
        blob = await toSquareJpeg(file);
      } catch {
        toast.error("Your browser couldn't open that picture. Try a JPEG or PNG.");
        return;
      }
      try {
        const formData = new FormData();
        formData.set("avatar", blob, "avatar.jpg");
        const result = await uploadAvatar(formData);
        setAvatarUpdatedAt(result.avatarUpdatedAt);
        toast.success("Profile picture updated.");
        router.refresh();
      } catch (e) {
        toast.error(errorMessage(e));
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function handleRemove() {
    startTransition(async () => {
      try {
        await removeAvatar();
        setAvatarUpdatedAt(null);
        toast.success("Profile picture removed.");
        router.refresh();
      } catch (e) {
        toast.error(errorMessage(e));
      }
    });
  }

  return (
    <div className="flex items-center gap-4">
      <UserAvatar user={{ ...user, avatarUpdatedAt }} className="size-16 text-lg" />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => inputRef.current?.click()}
          >
            <ImageUpIcon /> {avatarUpdatedAt ? "Change picture" : "Upload picture"}
          </Button>
          {avatarUpdatedAt && (
            <Button size="sm" variant="ghost" disabled={isPending} onClick={handleRemove}>
              <Trash2Icon /> Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {isPending
            ? "Saving…"
            : avatarUpdatedAt
              ? "Shown next to your name in your campaigns."
              : user.image
                ? "Using your Discord picture. Upload one to use a different picture here."
                : "Optional. Shown next to your name in your campaigns."}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          aria-label="Profile picture file"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
