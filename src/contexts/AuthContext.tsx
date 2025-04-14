
import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sendBusinessAccountCreationEmail } from "@/services/emailService";

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

  // Check if URL has reset password token
  const checkForPasswordResetToken = () => {
    console.log("Checking for password reset token...");
    console.log("Current URL hash:", window.location.hash);
    console.log("Current URL search:", window.location.search);
    
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
      console.log("Password reset token detected");
      setIsPasswordReset(true);
      return true;
    }
    
    return false;
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      console.log("Fetching user profile for ID:", userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error("Error fetching user profile:", error);
        throw error;
      }
      
      console.log("Fetched user profile:", data);
      setUserProfile(data);
      return data;
    } catch (error) {
      console.error("Error fetching user profile:", error);
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
          console.log("Password reset flow detected");
          setIsPasswordReset(true);
          setIsLoading(false);
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        console.log("Retrieved session:", session ? "exists" : "null");
        
        if (session?.user) {
          // Fetch user profile first to check approval status
          const profile = await fetchUserProfile(session.user.id);
          
          // If business user and not approved, don't set the session
          if (profile?.is_business && 
              profile?.account_status !== 'approved' && 
              profile?.role !== 'admin') {
            console.log("Business account not approved, not setting session");
            // Don't set session or user
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
          } else {
            // User is approved or not a business account, set session
            setSession(session);
            setUser(session.user);
          }
        } else {
          setSession(session);
          setUser(null);
        }
      } catch (error) {
        console.error("Error loading user:", error);
        toast.error("Error loading user session");
      } finally {
        setIsLoading(false);
      }
    };

    setData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log("Auth state changed, session:", session ? "exists" : "null");
      
      if (session?.user) {
        // Check user approval status before setting session
        const profile = await fetchUserProfile(session.user.id);
        
        if (profile?.is_business && 
            profile?.account_status !== 'approved' && 
            profile?.role !== 'admin') {
          console.log("Business account not approved, signing out");
          // Clear session and user
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setUserProfile(null);
          
          if (profile.account_status === 'pending') {
            toast.info("Your business account is pending approval. We'll contact you soon.");
          } else if (profile.account_status === 'rejected') {
            toast.error("Your business account application has been rejected. Please contact support for more information.");
          } else if (profile.account_status === 'suspended') {
            toast.error("Your account has been suspended. Please contact support for assistance.");
          } else {
            toast.info("Your business account requires approval before you can sign in.");
          }
          
          // Redirect to auth page
          navigate("/auth");
        } else {
          // Set session and fetch profile data
          setSession(session);
          setUser(session.user);
          setUserProfile(profile);
        }
      } else {
        setSession(null);
        setUser(null);
        setUserProfile(null);
      }
      
      setIsLoading(false);
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
          console.log("Business account not approved, signing out");
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
      console.error("Error signing in:", error);
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
        console.log("Creating business account via Edge Function");
        
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
          
          console.log("Edge function response:", response);
          
          if (response.error) {
            console.error("Edge function error:", response.error);
            throw new Error(response.error.message || "Failed to create business account");
          }
          
          if (!response.data) {
            console.error("No data returned from edge function");
            throw new Error("Failed to create business account - no data returned");
          }
          
          console.log("Business account created without automatic login");
          
          // Send confirmation email that account is pending approval
          await sendBusinessAccountCreationEmail(email, name);
          
          return { data: response.data, isBusinessAccount: true };
        } catch (err: any) {
          console.error("Failed to create business user:", err);
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
