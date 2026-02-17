import * as Sentry from "@sentry/react";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  userProfile: any | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, metadata?: Record<string, any>) => Promise<any>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isPasswordReset: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Check if URL has reset password token
  const checkForPasswordResetToken = () => {
    
    // Check all possible token locations
    const hasToken = 
      (window.location.hash && (
        window.location.hash.includes('access_token=') || 
        window.location.hash.includes('type=recovery')
      )) || 
      (window.location.search && window.location.search.includes('type=recovery')) ||
      (window.location.pathname.includes('/reset-password')) ||
      (window.location.pathname.includes('/reset'));
      
    if (hasToken) {
      setIsPasswordReset(true);
      return true;
    }
    
    return false;
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        throw error;
      }
      
      setUserProfile(data);
      return data;
    } catch (error) {
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchUserProfile(user.id);
    }
  };

  // Safety timeout to prevent infinite loading states
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      if (isLoading) {
        console.warn("Auth loading timeout - forcing reset");
        setIsLoading(false);
      }
    }, 10000);
    
    return () => clearTimeout(safetyTimeout);
  }, [isLoading]);

  useEffect(() => {
    let mounted = true;

    // Check for password reset token first
    const hasResetToken = checkForPasswordResetToken();
    const isOnResetPage = 
      window.location.pathname.includes('/reset-password') || 
      window.location.pathname.includes('/reset') ||
      (window.location.pathname.includes('/auth') && window.location.search.includes('action=resetPassword'));
      
    if (hasResetToken || isOnResetPage) {
      setIsPasswordReset(true);
      setIsLoading(false);
      return;
    }

    // Set up auth state listener FIRST (before getSession)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      
      // Synchronous state updates only - no stale closures
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Set Sentry user context
        Sentry.setUser({
          id: session.user.id,
          email: session.user.email,
        });
        
        // Use setTimeout to defer async operations (prevents auth deadlock)
        setTimeout(() => {
          if (mounted) {
            fetchUserProfile(session.user.id)
              .catch(() => {})
              .finally(() => {
                if (mounted) setIsLoading(false);
              });
          }
        }, 0);
      } else {
        // Clear Sentry user context when signed out
        Sentry.setUser(null);
        setUserProfile(null);
        setIsLoading(false);
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return;
      
      if (error) {
        console.error("Session error:", error);
        setIsLoading(false);
        return;
      }
      
      // If no session, ensure loading is false
      // (session presence will be handled by onAuthStateChange)
      if (!session) {
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const profile = await fetchUserProfile(user.id);
        
        if (profile && profile.is_business && profile.account_status !== 'approved' && profile.role !== 'admin') {
          await supabase.auth.signOut();
          
          if (profile.account_status === 'pending') {
            toast.info("Your business account is pending approval. We'll contact you soon.");
          } else if (profile.account_status === 'rejected') {
            toast.error("Your business account application has been rejected. Please contact support for more information.");
          } else if (profile.account_status === 'suspended') {
            toast.error("Your account has been suspended. Please contact support for assistance.");
          } else {
            toast.info("Your business account requires approval before you can sign in.");
          }
          return;
        }
        
        toast.success("Signed in successfully");
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "Error signing in");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string, metadata: Record<string, any> = {}) => {
    try {
      setIsLoading(true);
      const isBusinessAccount = metadata.is_business === 'true';
      
      if (isBusinessAccount) {
        
        // Use our Edge Function to create the business user
        try {
          const response = await supabase.functions.invoke("create-business-user", {
            body: {
              email,
              password,
              userData: {
                name,
                ...metadata
              }
            }
          });
          
          if (response.error) {
            throw new Error(response.error.message || "Failed to create business account");
          }
          
          if (!response.data) {
            throw new Error("Failed to create business account - no data returned");
          }
          
          return { data: response.data, isBusinessAccount: true };
        } catch (err: any) {
          toast.error(err.message || "Failed to create business account");
          throw err;
        }
      } else {
        // For regular accounts, use normal signup with auto-login
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              ...metadata
            }
          }
        });
        
        if (error) throw error;
        
        return data;
      }
    } catch (error: any) {
      toast.error(error.message || "Error signing up");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      
      // Clear Sentry user context
      Sentry.setUser(null);
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear React Query cache to prevent data leakage between users
      queryClient.clear();
      
      navigate("/auth");
      toast.success("Signed out successfully");
    } catch (error: any) {
      toast.error(error.message || "Error signing out");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      isLoading,
      userProfile,
      signIn, 
      signUp, 
      signOut,
      refreshProfile,
      isPasswordReset
    }}>
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
