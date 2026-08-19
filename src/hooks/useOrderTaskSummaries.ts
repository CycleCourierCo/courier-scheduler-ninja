import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrderTaskSummary {
  id: string;
  title: string;
  status: string;
  assigneeName: string | null;
}

/**
 * Batched lookup of active (open / in progress / blocked) tasks for a set of orders.
 * Returns a map of order id -> tasks, used to badge job cards with their assignee.
 */
export function useOrderTaskSummaries(orderIds: string[], enabled = true) {
  const ids = Array.from(new Set(orderIds.filter(Boolean))).sort();

  return useQuery({
    queryKey: ["order-task-summaries", ids],
    enabled: enabled && ids.length > 0,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<Record<string, OrderTaskSummary[]>> => {
      const map: Record<string, OrderTaskSummary[]> = {};
      const CHUNK = 200;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from("tasks")
          .select("id, title, status, linked_order_id, assignee:profiles!tasks_assignee_id_fkey(id, name, email)")
          .in("linked_order_id", slice)
          .in("status", ["open", "in_progress", "blocked"]);
        if (error) throw error;
        for (const row of data || []) {
          const orderId = (row as any).linked_order_id as string | null;
          if (!orderId) continue;
          const assignee = (row as any).assignee as { name: string | null; email: string | null } | null;
          if (!map[orderId]) map[orderId] = [];
          map[orderId].push({
            id: (row as any).id,
            title: (row as any).title,
            status: (row as any).status,
            assigneeName: assignee?.name || assignee?.email || null,
          });
        }
      }
      return map;
    },
  });
}
