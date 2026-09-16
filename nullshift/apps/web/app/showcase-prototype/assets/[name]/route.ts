import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  parseByteRange,
  SHOWCASE_ASSETS,
  showcaseEnabled,
} from "@/lib/showcasePrototype";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ name: string }> }
) {
  if (!showcaseEnabled(process.env.NODE_ENV, process.env.LOCAL_SHOWCASE))
    return new Response(null, { status: 404 });
  const { name } = await context.params;
  if (!Object.hasOwn(SHOWCASE_ASSETS, name)) return new Response(null, { status: 404 });
  let file: Buffer;
  try {
    file = await readFile(path.join(process.cwd(), ".local-showcase", name));
  } catch {
    return new Response(null, { status: 404 });
  }
  const headers: Record<string, string> = {
    "Content-Type": SHOWCASE_ASSETS[name as keyof typeof SHOWCASE_ASSETS],
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const range = parseByteRange(rangeHeader, file.length);
    if (!range)
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": `bytes */${file.length}` },
      });
    headers["Content-Range"] = `bytes ${range.start}-${range.end}/${file.length}`;
    headers["Content-Length"] = String(range.end - range.start + 1);
    return new Response(new Uint8Array(file.subarray(range.start, range.end + 1)), {
      status: 206,
      headers,
    });
  }
  headers["Content-Length"] = String(file.length);
  return new Response(new Uint8Array(file), { headers });
}
