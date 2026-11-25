import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

// Always run: a cached "ok" would hide a dead database.
export const dynamic = "force-dynamic";

/** For Docker/TrueNAS health checks: is the app up and can it reach the
 * database? Deliberately says nothing else. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
