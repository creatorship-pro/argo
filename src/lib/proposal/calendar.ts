/**
 * Turns a systemd OnCalendar expression into plain words for the owner.
 * It understands the common shapes; anything else falls back to a neutral
 * phrase, never a wrong guess.
 */
const DAYS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

function time12(h: number, m: number): string {
  const ap = h >= 12 ? "pm" : "am";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
}

export function describeCalendar(expr: string): string {
  const e = expr.trim();
  const every =
    e.match(/^(?:(\S+)\s+)?\*-\*-\*\s+\*:(\d+)\/(\d+)(?::00)?$/) ??
    e.match(/^(?:(\S+)\s+)?\*:(\d+)\/(\d+)(?::00)?$/);
  let days = "";
  const dayPart = e.match(/^([A-Za-z.,]+)\s/)?.[1];
  if (dayPart) {
    const lower = dayPart.toLowerCase();
    if (lower === "mon..fri") days = "on weekdays";
    else if (lower === "sat,sun" || lower === "sat..sun") days = "on weekends";
    else {
      const names = lower
        .split(",")
        .map((d) => DAYS[d.slice(0, 3)])
        .filter(Boolean);
      if (names.length) days = `on ${names.join(", ")}`;
    }
  }
  const ranged = e.match(/(\d{1,2})\.\.(\d{1,2}):(\d+)\/(\d+)(?::\d+)?$/);
  if (ranged) {
    const from = time12(Number(ranged[1]), Number(ranged[3]));
    const to = time12(Number(ranged[2]), 0);
    return `every ${ranged[4]} minutes between ${from} and ${to}${days ? ` ${days}` : ""}`;
  }
  if (every)
    return `every ${every[3]} minutes${days ? ` ${days}` : ""}`.replace(
      "  ",
      " ",
    );
  const at = e.match(/(?:\*-\*-\*\s+)?(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (at && !e.includes("/") && !e.includes("*:")) {
    const when = time12(Number(at[1]), Number(at[2]));
    return `${days ? days.replace(/^on /, "") + " at" : "every day at"} ${when}`.replace(
      "weekdays at",
      "weekdays at",
    );
  }
  return "on a schedule";
}
