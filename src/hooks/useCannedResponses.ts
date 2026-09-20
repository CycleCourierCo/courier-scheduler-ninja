import { useQuery } from "@tanstack/react-query";
import { listCannedResponses } from "@/services/cannedResponseService";

export const useCannedResponses = (includeInactive = false) =>
  useQuery({
    queryKey: ["cs-canned-responses", includeInactive],
    queryFn: () => listCannedResponses(includeInactive),
    staleTime: 60_000,
  });
