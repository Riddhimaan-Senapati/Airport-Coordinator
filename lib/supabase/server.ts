import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "../database.types";
import { getPublicConfig } from "./public-config";

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type Identity = { email: string | undefined; id: string };

export async function createClient() {
  const cookieStore = await cookies();
  const { publishableKey, url } = getPublicConfig();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, options, value } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. The proxy refreshes them instead.
        }
      },
    },
  });
}

export async function getIdentity(supabase: SupabaseServerClient): Promise<Identity | null> {
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;

  const id = data.claims.sub;
  if (!id) return null;

  return { email: data.claims.email, id };
}

export async function getCurrentUser() {
  return getIdentity(await createClient());
}
