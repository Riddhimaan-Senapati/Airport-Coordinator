import { type NextRequest, NextResponse } from "next/server";

import { createClient, getIdentity } from "@/lib/supabase/server";

const MAX_QUERY_LENGTH = 100;
const MIN_QUERY_LENGTH = 2;
const RESULT_LIMIT = 10;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: `Search queries cannot exceed ${MAX_QUERY_LENGTH} characters.` },
      { status: 400 },
    );
  }
  const supabase = await createClient();
  const identity = await getIdentity(supabase);
  if (!identity) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json(
      { airports: [] },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const { data, error } = await supabase.rpc("search_airports", {
    query,
    result_limit: RESULT_LIMIT,
  });
  if (error) {
    return NextResponse.json(
      { error: "Airport search is unavailable." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  return NextResponse.json(
    {
      airports: data.map((airport) => ({
        id: Number(airport.id),
        code: airport.code,
        name: airport.name,
        municipality: airport.municipality,
        countryCode: airport.country_code,
      })),
    },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
