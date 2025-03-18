
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type UserRole = 'admin' | 'regular' | null;

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  userRole: UserRole;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const navigate = useNavigate();
  const isMounted = useRef(true);
  const authCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch user role
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
      
      console.log("User role data:", data);
      // Check if the role is 'admin' and set accordingly
      if (data?.role === 'admin') {
        return 'admin';
      }
      return 'regular';
    } catch (error) {
      console.error("Error in fetchUserRole:", error);
      return null;
    }
  };

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (authCheckTimeoutRef.current) {
        clearTimeout(authCheckTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    console.log("AuthContext initializing");
    
    // Set a timeout to prevent infinite loading
    authCheckTimeoutRef.current = setTimeout(() => {
      if (isLoading && isMounted.current) {
        console.log("Auth check timeout reached, forcing loading to false");
        setIsLoading(false);
      }
    }, 5000); // 5 second timeout
    
    const setData = async () => {
      try {
        setIsLoading(true);
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Error getting session:", error);
          throw error;
        }
        
        if (isMounted.current) {
          console.log("Initial session:", session ? "exists" : "null");
          setSession(session);
          setUser(session?.user || null);
          
          // Get user role if user exists
          if (session?.user) {
            console.log("Fetching role for user:", session.user.id);
            const role = await fetchUserRole(session.user.id);
            if (isMounted.current) {
              setUserRole(role);
            }
          }
        }
      } catch (error) {
        console.error("Error loading user:", error);
        toast.error("Error loading user session");
      } finally {
        if (isMounted.current) {
          console.log("Initial auth loading complete");
          setIsLoading(false);
          
          // Clear the timeout since we've finished loading
          if (authCheckTimeoutRef.current) {
            clearTimeout(authCheckTimeoutRef.current);
          }
        }
      }
    };

    setData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log("Auth state changed:", _event, session ? "session exists" : "no session");
      if (isMounted.current) {
        setIsLoading(true); // Set loading to true when auth state changes
        setSession(session);
        setUser(session?.user || null);
        
        // Get user role if user exists
        if (session?.user) {
          console.log("Auth state change: fetching role for", session.user.id);
          const role = await fetchUserRole(session.user.id);
          if (isMounted.current) {
            setUserRole(role);
          }
        } else {
          setUserRole(null);
        }
        
        console.log("Auth state change: loading complete");
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      console.log("Signing in with email:", email);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      toast.success("Signed in successfully");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Error signing in:", error);
      toast.error(error.message || "Error signing in");
      throw error;
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      setIsLoading(true);
      console.log("Signing up with email:", email);
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
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      console.log("Signing out");
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      navigate("/auth");
      toast.success("Signed out successfully");
    } catch (error: any) {
      console.error("Error signing out:", error);
      toast.error(error.message || "Error signing out");
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        setUserRole(null);
      }
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
