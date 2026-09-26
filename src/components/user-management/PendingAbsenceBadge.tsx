import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Count of absence requests awaiting an admin (pending, or approved with a cancel request). */
export const usePendingAbsenceCount = (enabled = true) =>
  useQuery({
    queryKey: ["absence-pending-count"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("driver_absence_requests")
        .select("id", { count: "exact", head: true })
        .or("status.eq.pending,and(status.eq.approved,cancel_requested.eq.true)");
      return count ?? 0;
    },
  });

export const PendingAbsenceBadge = () => {
  const { data = 0 } = usePendingAbsenceCount();
  if (!data) return null;
  return (
    <span className="ml-auto rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground" aria-label={`${data} absence requests waiting`}>
      {data}
    </span>
  );
};
