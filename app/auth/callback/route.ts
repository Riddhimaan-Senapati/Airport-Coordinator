import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "../../../lib/supabase/server";

const emailOtpTypes: ReadonlySet<string> = new Set<EmailOtpType>([
  "email",
  "email_change",
  "invite",
  "magiclink",
  "recovery",
  "signup",
]);

function isEmailOtpType(value: string): value is EmailOtpType {
  return emailOtpTypes.has(value);
}

function getSafeRedirect(request: NextRequest, fallback: string) {
  const next = request.nextUrl.searchParams.get("next");
  if (!next?.startsWith("/") || next.startsWith("//")) {
    return new URL(fallback, request.url);
  }

  const redirect = new URL(next, request.url);
  return redirect.origin === request.nextUrl.origin ? redirect : new URL(fallback, request.url);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const fallback = type === "recovery" ? "/auth/reset-password" : "/trips";
  const redirect = getSafeRedirect(request, fallback);
  const supabase = await createClient();

  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type && isEmailOtpType(type)
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("Missing authentication callback parameters.") };

  if (result.error) {
    return NextResponse.redirect(new URL("/auth/signin?error=callback", request.url));
  }

  return NextResponse.redirect(redirect);
}
