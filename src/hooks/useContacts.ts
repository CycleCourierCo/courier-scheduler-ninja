import { useQuery } from "@tanstack/react-query";
import { fetchUserContacts, fetchAllContacts, Contact } from "@/services/contactService";

export const useContacts = (userId?: string, isAdmin = false) => {
  return useQuery<Contact[]>({
    queryKey: isAdmin ? ['contacts', 'all'] : ['contacts', userId],
    queryFn: () => isAdmin ? fetchAllContacts() : fetchUserContacts(userId!),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: isAdmin || !!userId,
  });
};
