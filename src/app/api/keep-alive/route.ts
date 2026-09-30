import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

/**
 * Supabaseの無料プランは約7日間APIアクセスが無いとプロジェクトを自動的に
 * 一時停止し、アプリ全体が「読み込み中」のまま固まって見える不具合になる
 * (2026-09-30に実際発生・手動復旧した)。Vercel Cron(vercel.json)から
 * このエンドポイントを毎日呼び、実際にテーブルへ軽い読み取りを行うことで
 * Supabase側の「使われている」判定をリセットし、自動停止を防ぐ。
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  if (!supabase) {
    return NextResponse.json(
      { ok: false, reason: "Supabase not configured" },
      { status: 200 },
    );
  }

  const { error } = await supabase.from("design_cases").select("id").limit(1);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, pingedAt: new Date().toISOString() });
}
