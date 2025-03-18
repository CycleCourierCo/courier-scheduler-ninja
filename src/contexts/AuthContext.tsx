
import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type UserRole = 'admin' | 'b2b_customer' | 'b2c_customer';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  userRole: UserRole | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const navigate = useNavigate();

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching user role:", error);
        return null;
      }
      
      return data?.role as UserRole;
    } catch (error) {
      console.error("Error in fetchUserRole:", error);
      return null;
    }
  };

  // Initialize auth
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        
        // Check if there's an existing session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Error getting session:", error);
          setIsLoading(false); // Important: set loading to false even on error
          return;
        }
        
        setSession(session);
        
        if (session?.user) {
          setUser(session.user);
          const role = await fetchUserRole(session.user.id);
          setUserRole(role);
        } else {
          setUser(null);
          setUserRole(null);
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        toast.error("Error loading user session");
      } finally {
        // Important: always set loading to false when done
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event);
      
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setSession(null);
        setUserRole(null);
      } else if (session?.user) {
        setUser(session.user);
        setSession(session);
        
        // Only fetch the role if we don't already have it or if the user changed
        if (!userRole || session.user.id !== user?.id) {
          const role = await fetchUserRole(session.user.id);
          setUserRole(role);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) throw error;
      
      toast.success("Signed in successfully");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Error signing in:", error);
      toast.error(error.message || "Error signing in");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name }
        }
      });
      
      if (error) throw error;
      
      toast.success("Signed up successfully! Please check your email for verification.");
    } catch (error: any) {
      console.error("Error signing up:", error);
      toast.error(error.message || "Error signing up");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) throw error;
      
      // Manually clear the state
      setUser(null);
      setSession(null);
      setUserRole(null);
      
      navigate("/auth");
      toast.success("Signed out successfully");
    } catch (error: any) {
      console.error("Error signing out:", error);
      toast.error(error.message || "Error signing out");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, userRole, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
