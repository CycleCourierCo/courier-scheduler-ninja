import { useQuery } from "@tanstack/react-query";
import {
  fetchQueues,
  fetchQueueMembers,
  fetchQueueSlas,
  fetchStaffOptions,
} from "@/services/customerServiceQueueService";

export const useCsQueues = () =>
  useQuery({ queryKey: ['cs-queues'], queryFn: fetchQueues, staleTime: 60_000 });

export const useCsQueueMembers = () =>
  useQuery({ queryKey: ['cs-queue-members'], queryFn: fetchQueueMembers, staleTime: 60_000 });

export const useCsQueueSlas = () =>
  useQuery({ queryKey: ['cs-queue-slas'], queryFn: fetchQueueSlas, staleTime: 60_000 });

export const useCsStaff = () =>
  useQuery({ queryKey: ['cs-staff'], queryFn: fetchStaffOptions, staleTime: 300_000 });
