
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
      
      return data?.role as UserRole || 'b2c_customer';
    } catch (error) {
      console.error("Error in fetchUserRole:", error);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;
    console.log("Auth context initializing");
    
    const initAuth = async () => {
      try {
        if (!mounted) return;
        
        console.log("Getting initial session");
        setIsLoading(true);
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Error getting session:", error);
          if (mounted) {
            setIsLoading(false);
          }
          return;
        }
        
        if (mounted) {
          console.log("Setting initial session:", !!session);
          setSession(session);
          setUser(session?.user || null);
          
          if (session?.user) {
            console.log("Fetching user role for:", session.user.id);
            const role = await fetchUserRole(session.user.id);
            if (mounted) {
              setUserRole(role);
              console.log("User role set to:", role);
            }
          } else {
            if (mounted) {
              setUserRole(null);
              console.log("No user, setting role to null");
            }
          }
          
          setIsLoading(false);
          console.log("Initial auth loading complete");
        }
      } catch (error) {
        console.error("Error loading user:", error);
        if (mounted) {
          setIsLoading(false);
          console.log("Auth loading failed, setting isLoading to false");
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, session?.user?.id);
      
      if (!mounted) return;
      
      console.log("Setting session from auth change event");
      setSession(session);
      setUser(session?.user || null);
      
      if (session?.user) {
        console.log("Fetching user role after auth change for:", session.user.id);
        const role = await fetchUserRole(session.user.id);
        if (mounted) {
          setUserRole(role);
          console.log("Updated user role to:", role);
        }
      } else {
        if (mounted) {
          setUserRole(null);
          console.log("No user after auth change, setting role to null");
        }
      }
      
      setIsLoading(false);
      console.log("Auth state change handling complete");
    });

    return () => {
      console.log("Auth context cleanup");
      mounted = false;
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
      setIsLoading(false);
      throw error;
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
