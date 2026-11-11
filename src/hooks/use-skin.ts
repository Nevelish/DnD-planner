"use client";

import { useSyncExternalStore } from "react";

import { getSkin, getClientSnapshot, subscribe, setSkin, type Skin } from "@/lib/skin";

export function useSkin(): [Skin, (skin: Skin) => void] {
  const skin = useSyncExternalStore(subscribe, getClientSnapshot, getSkin);
  return [skin, setSkin];
}
