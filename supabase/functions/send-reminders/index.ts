// Щоденні нагадування. Запускається кожні 15 хвилин планувальником (див. supabase-push.sql).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT")!,
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

function localNow(tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  const hh = Number(g("hour")) % 24;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, min: hh * 60 + Number(g("minute")) };
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }
  const { data: subs, error } = await sb.from("push_subs").select("*");
  if (error) return new Response(error.message, { status: 500 });
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      const tz = s.tz || "UTC";
      const now = localNow(tz);
      const [h, m] = String(s.remind || "19:00").split(":").map(Number);
      const target = h * 60 + m;
      if (now.min < target || now.min >= target + 15) continue;
      if (s.last_sent === now.date) continue;
      const { data: pr } = await sb.from("progress").select("data").eq("user_id", s.user_id).maybeSingle();
      const d = pr?.data ?? {};
      if (d.last === now.date) continue; // вже займалась сьогодні
      const streak = Number(d.streak) || 0;
      const body = streak > 0
        ? `Серія ${streak} дн. під загрозою. Один урок, і лисичка спокійна.`
        : "Лисичка чекає на тебе. Пройди один короткий урок.";
      await webpush.sendNotification(s.sub, JSON.stringify({ title: "Java Бариста", body, url: "./" }));
      await sb.from("push_subs").update({ last_sent: now.date }).eq("user_id", s.user_id);
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sb.from("push_subs").delete().eq("user_id", s.user_id);
    }
  }
  return new Response(JSON.stringify({ sent }), { headers: { "Content-Type": "application/json" } });
});
