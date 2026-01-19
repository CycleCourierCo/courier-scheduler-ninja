import { useQuery } from "@tanstack/react-query";
import { fetchUserContacts, Contact } from "@/services/contactService";

export const useContacts = () => {
  return useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: fetchUserContacts,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
