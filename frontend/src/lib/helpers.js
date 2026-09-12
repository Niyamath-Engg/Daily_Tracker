export const CATEGORIES = [
  "Business", "Technology", "AI", "Robotics", "Electronics",
  "Finance", "Marketing", "Personal Development", "General", "Other",
];

export const WORKOUT_TYPES = ["Gym", "Walking", "Running", "Cycling", "Home Workout", "Sports", "Other"];

export const SUBSTACK_STATUSES = ["IDEA", "RESEARCH", "OUTLINE", "DRAFTING", "EDITING", "READY", "PUBLISHED"];

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatLong(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function formatShort(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
