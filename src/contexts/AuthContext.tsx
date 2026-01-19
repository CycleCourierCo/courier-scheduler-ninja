
import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sendBusinessAccountCreationEmail, sendBusinessRegistrationAdminNotification } from "@/services/emailService";

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

  useEffect(() => {
    const setData = async () => {
      try {
        // Check for password reset token first
        const hasResetToken = checkForPasswordResetToken();
        
        // Explicitly check URL path as well
        const isOnResetPage = 
          window.location.pathname.includes('/reset-password') || 
          window.location.pathname.includes('/reset') ||
          window.location.pathname.includes('/auth') && window.location.search.includes('action=resetPassword');
          
        if (hasResetToken || isOnResetPage) {
          setIsPasswordReset(true);
          setIsLoading(false);
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        
        setSession(session);
        setUser(session?.user || null);

        if (session?.user) {
          await fetchUserProfile(session.user.id);
        }
      } catch (error) {
        toast.error("Error loading user session");
      } finally {
        setIsLoading(false);
      }
    };

    setData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      
      // Only update state if session actually changed
      if (session?.user?.id !== user?.id) {
        setSession(session);
        setUser(session?.user || null);
        
        if (session?.user) {
          // Only fetch profile if we don't have one or user changed
          if (!userProfile || userProfile.id !== session.user.id) {
            fetchUserProfile(session.user.id)
              .catch(() => {})
              .finally(() => setIsLoading(false));
          } else {
            setIsLoading(false);
          }
        } else {
          setUserProfile(null);
          setIsLoading(false);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

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
          
          // Send confirmation email that account is pending approval
          try {
            await sendBusinessAccountCreationEmail(email, name);
            
            // Send notification to admin
            await sendBusinessRegistrationAdminNotification(
              name,
              email,
              metadata.company_name || '',
              metadata.phone || '',
              metadata.website || '',
              {
                addressLine1: metadata.address_line_1 || '',
                addressLine2: metadata.address_line_2,
                city: metadata.city || '',
                postalCode: metadata.postal_code || ''
              }
            );
          } catch (emailError) {
            // Don't throw here, as the account was created successfully
            console.error("Error sending notification emails:", emailError);
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
