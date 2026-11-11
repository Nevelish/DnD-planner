"use client";

import { useSyncExternalStore } from "react";
import { PaletteIcon, CheckIcon } from "lucide-react";

import { useSkin } from "@/hooks/use-skin";
import { SKINS, type Skin } from "@/lib/skin";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SKIN_LABELS: Record<Skin, string> = {
  default: "Default",
  nier: "NieR",
};

const noopSubscribe = () => () => {};

/** True once hydrated on the client — avoids rendering the check-mark
 * (which depends on a client-only localStorage read) before hydration. */
function useMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function SkinToggle() {
  const [skin, setSkin] = useSkin();
  const mounted = useMounted();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <PaletteIcon />
          <span className="sr-only">Switch theme skin</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SKINS.map((id) => (
          <DropdownMenuItem key={id} onSelect={() => setSkin(id)}>
            {mounted && skin === id ? (
              <CheckIcon />
            ) : (
              <span className="size-4" aria-hidden="true" />
            )}
            {SKIN_LABELS[id]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
