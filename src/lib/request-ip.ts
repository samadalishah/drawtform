import type { NextRequest } from "next/server";

function firstHeaderValue(raw: string | null): string | null {
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim();
  return first || null;
}

export function getClientIp(request: NextRequest): string {
  const forwarded = firstHeaderValue(request.headers.get("x-forwarded-for"));
  if (forwarded) return forwarded;

  const realIp = firstHeaderValue(request.headers.get("x-real-ip"));
  if (realIp) return realIp;

  const cfIp = firstHeaderValue(request.headers.get("cf-connecting-ip"));
  if (cfIp) return cfIp;

  return "local";
}
