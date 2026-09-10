import { createClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("airports").select("id").limit(1);
    if (error) throw error;
    return Response.json({ status: "ok" }, { headers });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers });
  }
}
