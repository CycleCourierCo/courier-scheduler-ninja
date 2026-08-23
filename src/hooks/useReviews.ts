import { useQuery } from "@tanstack/react-query";
import {
  getEmployeeHistory,
  getEmployeeRoles,
  getPreviousReview,
  getReviewBundle,
  listMyReviewCycles,
  listReviewCycles,
  listReviewableUsers,
} from "@/services/reviewService";
import type { ReviewFilters } from "@/types/review";

export const useReviewCycles = (filters: ReviewFilters) =>
  useQuery({ queryKey: ["review-cycles", filters], queryFn: () => listReviewCycles(filters) });

export const useMyReviews = (userId: string | undefined) =>
  useQuery({
    queryKey: ["my-reviews", userId],
    queryFn: () => listMyReviewCycles(userId as string),
    enabled: !!userId,
  });

export const useReviewBundle = (cycleId: string | undefined) =>
  useQuery({
    queryKey: ["review-bundle", cycleId],
    queryFn: () => getReviewBundle(cycleId as string),
    enabled: !!cycleId,
  });

export const useReviewableUsers = () =>
  useQuery({ queryKey: ["reviewable-users"], queryFn: listReviewableUsers, staleTime: 5 * 60 * 1000 });

export const useEmployeeRoles = (userId: string | undefined) =>
  useQuery({
    queryKey: ["employee-roles", userId],
    queryFn: () => getEmployeeRoles(userId as string),
    enabled: !!userId,
  });

export const useEmployeeReviewHistory = (employeeId: string | undefined) =>
  useQuery({
    queryKey: ["review-history", employeeId],
    queryFn: () => getEmployeeHistory(employeeId as string),
    enabled: !!employeeId,
  });

export const usePreviousReview = (employeeId: string | undefined, periodStart: string | undefined) =>
  useQuery({
    queryKey: ["review-previous", employeeId, periodStart],
    queryFn: () => getPreviousReview(employeeId as string, periodStart as string),
    enabled: !!employeeId && !!periodStart,
  });
