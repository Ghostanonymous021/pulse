import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run auth session on app routes.
     * Skip static assets, SW, icons — required for PWA install/offline.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest|ico)$).*)",
  ],
};
