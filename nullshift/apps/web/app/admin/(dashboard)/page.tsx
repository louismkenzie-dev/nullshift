import { loadToday } from "@/lib/ops/todayData";
import { TodayView } from "./TodayView";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const today = await loadToday();
  return <TodayView today={today} />;
}
