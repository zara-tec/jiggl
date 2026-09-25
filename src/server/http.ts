import { NextResponse } from "next/server";
import { HttpError } from "./auth";

/** Wrap a route handler: JSON errors with proper status codes. */
export function handler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  };
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

/** Public origin of the app for links in emails, honouring a reverse proxy */
export function requestOrigin(req: Request): string {
  const url = new URL(req.url);
  const first = (h: string | null) => h?.split(",")[0].trim() || "";
  const proto = first(req.headers.get("x-forwarded-proto")) || url.protocol.replace(":", "");
  const host = first(req.headers.get("x-forwarded-host")) || req.headers.get("host") || url.host;
  return `${proto}://${host}`;
}
