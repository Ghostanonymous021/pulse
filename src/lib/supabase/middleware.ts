import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { hasSupabaseEnv } from "@/lib/env";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!hasSupabaseEnv()) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/recuperar");
  const isApiRoute = path.startsWith("/api/");
  // PWA + static shell must never require a session (install / offline / SW)
  const isPwaShell =
    path === "/sw.js" ||
    path === "/offline" ||
    path.startsWith("/offline/") ||
    path.startsWith("/manifest") ||
    path.startsWith("/icons/") ||
    path === "/favicon.ico" ||
    path.endsWith(".webmanifest");
  const isPublic =
    path === "/" ||
    isApiRoute ||
    isPwaShell ||
    path.startsWith("/_next") ||
    path.startsWith("/favicon");

  // API routes handle their own auth; never redirect them to HTML login.
  if (isApiRoute || isPwaShell) {
    return supabaseResponse;
  }

  if (!user && !isAuthRoute && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Logged-in users leave auth screens (except during explicit flows)
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
