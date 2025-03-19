
import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';

export const useUser = () => {
  const { user } = useContext(AuthContext);
  
  // Extract user role from the user object (assumes role is stored in user metadata)
  const userRole = user?.app_metadata?.role || 'b2c_customer';
  
  return { user, userRole };
};
