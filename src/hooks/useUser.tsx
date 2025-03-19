
import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';

export const useUser = () => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error("useUser must be used within an AuthProvider");
  }
  
  // Extract user role from the user object (assumes role is stored in user metadata)
  const userRole = context.user?.app_metadata?.role || 'b2c_customer';
  
  return { user: context.user, userRole };
};
