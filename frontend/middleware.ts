import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl.pathname;
  if (url.startsWith("/api/indexer/admin/")) {
    const got = req.headers.get("x-indexer-token");
    const need = process.env.INDEXER_ADMIN_TOKEN;
    if (!need || got !== need) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/indexer/admin/:path*"],
};
