import { useQuery } from "@tanstack/react-query";
import { fetchUserContacts, Contact } from "@/services/contactService";

export const useContacts = (userId?: string) => {
  return useQuery<Contact[]>({
    queryKey: ['contacts', userId],
    queryFn: () => fetchUserContacts(userId!),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!userId,
  });
};
