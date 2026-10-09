// Обов’язкові сповіщення о 8, 11, 14, 17, 20, 23. Запускається кожні 15 хвилин планувальником (див. supabase-push.sql).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT")!,
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const SLOTS = [8, 11, 14, 17, 20, 23];
const MSGS = [
  "Ранкова кава ☕ і один урок Java: гарний початок дня.",
  "Факт: Java створили в 1995 році, а назву взяли від кави з острова Ява.",
  "String у Java незмінний. Кожна «зміна» створює новий об’єкт.",
  "Жарт: чому Java-розробники носять окуляри? Бо вони не C#.",
  "Мініурок: == порівнює посилання, equals() порівнює вміст. Не плутай!",
  "Факт: талісман Java звуть Дюк, і він досі махає рукою на конференціях.",
  "Порада: давай змінним зрозумілі імена. Через місяць ти скажеш собі дякую.",
  "Спробуй згадати: чим ArrayList відрізняється від LinkedList?",
  "Лисичка нагадує: 5 хвилин практики краще, ніж година завтра.",
  "Факт: JVM дозволяє одному й тому ж коду працювати на будь-якій системі.",
  "Жарт: у програміста 2 проблеми. Одна з них — NullPointerException.",
  "Optional допомагає не боятися null. Хочеш подивитись, як він працює?",
  "Час для короткого повторення: слабкі теми чекають у вкладці «Курс».",
  "Порада: читай повідомлення про помилку з першого рядка, там майже завжди підказка.",
  "Факт: у Java немає вказівників, зате є збирач сміття.",
  "Ти вже далеко пройшла. Ще один маленький крок?",
  "Мініквіз: який тип у Java зберігає true або false? (boolean)",
  "Вечірній урок закріплює вивчене краще, ніж здається. Заходь!",
  "Факт: switch у сучасній Java вміє повертати значення.",
  "Лисичка вже налила тобі кави. Повертайся до Java ☕",
  "Порада: пиши код руками, а не лише читай. Так він запам’ятовується.",
  "Жарт: рекурсія — дивись «рекурсія».",
  "Факт: слово final робить змінну, метод або клас незмінними.",
  "Перед сном повтори одну тему. Мозок закріпить її за ніч.",
];

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
  const test = new URL(req.url).searchParams.get("test") === "1";
  const { data: subs, error } = await sb.from("push_subs").select("*");
  if (error) return new Response(error.message, { status: 500 });
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      const tz = s.tz || "UTC";
      const now = localNow(tz);
      if (test) {
        await webpush.sendNotification(s.sub, JSON.stringify({ title: "Java Бариста", body: "Тест: сповіщення працюють! ☕🦊", url: "./" }));
        sent++;
        continue;
      }
      const slot = SLOTS.find((h) => now.min >= h * 60 && now.min < h * 60 + 15);
      if (slot === undefined) continue;
      const key = `${now.date}#${slot}`;
      if (s.last_sent === key) continue;
      const { data: pr } = await sb.from("progress").select("data").eq("user_id", s.user_id).maybeSingle();
      const d = pr?.data ?? {};
      const streak = Number(d.streak) || 0;
      const doneToday = d.last === now.date;
      const day = Math.floor(Date.parse(now.date) / 86400000);
      const idx = SLOTS.indexOf(slot);
      const dow = new Date(now.date + "T12:00:00Z").getUTCDay();
      const q = d.quiet && d.quiet.on ? d.quiet : null;
      if (q && (q.from < q.to ? slot >= q.from && slot < q.to : slot >= q.from || slot < q.to)) continue;
      if (d.wkdLate && (dow === 0 || dow === 6) && slot === 8) continue;
      const paused = typeof d.pause === "string" && d.pause !== "" && now.date <= d.pause;

      const nv = typeof d.nv === "string" ? d.nv : "";
      const male = d.sex === "m";
      const pick = MSGS[(day * 6 + idx) % MSGS.length];
      let body: string;
      if (dow === 0 && slot === 20) {
        let xp = 0, days = 0;
        for (let i = 0; i < 7; i++) {
          const k = new Date(Date.parse(now.date + "T12:00:00Z") - i * 86400000).toISOString().slice(0, 10);
          const h = d.hist && d.hist[k];
          if (h && h.xp) { xp += h.xp; days++; }
        }
        body = `Підсумок тижня${nv ? ", " + nv : ""}: ${xp} XP, ${days} дн. занять. ${days >= 5 ? "Чудовий тиждень!" : "Новий тиждень, нові перемоги."}`;
      } else if (idx % 3 === 2 && streak > 0 && !doneToday && !paused) body = `${nv ? nv + ", с" : "С"}ерія ${streak} дн. під загрозою. Один урок, і лисичка спокійна.`;
      else if (idx % 3 === 2 && doneToday) body = `${nv ? nv + ", т" : "Т"}и вже ${male ? "займався" : "займалась"} сьогодні, молодець! Ще один урок для закріплення?`;
      else if (idx === 0 && nv) body = `Доброго ранку, ${nv}! ` + pick;
      else if (idx === 5 && nv) body = `На добраніч, ${nv}! ` + pick;
      else body = pick;
      await webpush.sendNotification(s.sub, JSON.stringify({ title: "Java Бариста", body, url: "./" }));
      await sb.from("push_subs").update({ last_sent: key }).eq("user_id", s.user_id);
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sb.from("push_subs").delete().eq("user_id", s.user_id);
    }
  }
  return new Response(JSON.stringify({ sent }), { headers: { "Content-Type": "application/json" } });
});
