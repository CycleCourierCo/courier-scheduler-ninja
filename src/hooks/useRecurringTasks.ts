import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listRecurrences,
  createRecurrence,
  updateRecurrence,
  deleteRecurrence,
  generateRecurringNow,
  type RecurrenceInput,
} from "@/services/recurringTasksService";
import type { TaskRecurrence } from "@/types/task";

export function useRecurrences() {
  return useQuery({ queryKey: ['task-recurrences'], queryFn: listRecurrences });
}

export function useRecurrenceMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['task-recurrences'] });
    qc.invalidateQueries({ queryKey: ['tasks'] });
  };

  const create = useMutation({
    mutationFn: ({ input, userId }: { input: RecurrenceInput; userId: string }) =>
      createRecurrence(input, userId),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<TaskRecurrence> }) =>
      updateRecurrence(id, patch),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteRecurrence(id),
    onSuccess: invalidate,
  });
  const generate = useMutation({
    mutationFn: () => generateRecurringNow(),
    onSuccess: invalidate,
  });

  return { create, update, remove, generate };
}
