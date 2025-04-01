
import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import DashboardHeader from "@/components/DashboardHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, CheckCircle, XCircle, ExternalLink, Building, Clock, Filter } from "lucide-react";
import { sendAccountApprovalEmail } from "@/services/emailService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Define the type for the business account data
interface BusinessAccount {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
  role: string;
  table_preferences: any | null;
  company_name: string | null;
  website: string | null;
  phone: string | null;
  is_business: boolean | null;
  account_status: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postal_code: string | null;
}

const AccountApprovals = () => {
  const [businessAccounts, setBusinessAccounts] = useState<BusinessAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingAccountIds, setProcessingAccountIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("all");
  const { userProfile } = useAuth();

  useEffect(() => {
    if (userProfile && userProfile.role !== 'admin') {
      window.location.href = '/dashboard';
    }
  }, [userProfile]);

  const fetchBusinessAccounts = async () => {
    try {
      setIsLoading(true);
      console.log("Fetching business accounts...");
      
      const { data, error } = await supabase.rpc('get_business_accounts_for_admin');
      
      if (error) {
        console.error("Error fetching business accounts:", error);
        throw error;
      }
      
      console.log("Raw business accounts data:", data);
      console.log("Retrieved business accounts count:", data?.length || 0);
      
      setBusinessAccounts(data || []);
    } catch (error) {
      console.error("Error fetching business accounts:", error);
      toast.error("Could not load business accounts");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchBusinessAccounts();
    }
  }, [userProfile]);

  const approveAccount = async (userId: string) => {
    try {
      setProcessingAccountIds(prev => [...prev, userId]);
      
      console.log(`Attempting to approve account ${userId}`);
      
      // Type assertion to make TypeScript happy
      const { data, error } = await supabase.rpc('admin_update_account_status' as any, {
        user_id: userId,
        status: 'approved'
      });

      if (error) {
        console.error("Error approving account:", error);
        throw error;
      }

      console.log(`Updated account ${userId} status to approved, result:`, data);

      const user = businessAccounts.find(account => account.id === userId);
      if (user?.email) {
        console.log(`Sending approval email to ${user.email}`);
        
        const emailSent = await sendAccountApprovalEmail(
          user.email, 
          user.name || "Customer",
          user.company_name
        );
        
        if (!emailSent) {
          toast.error("Account approved but failed to send notification email");
        } else {
          console.log("Approval email sent successfully");
        }
      }

      toast.success("Account approved successfully");
      
      await fetchBusinessAccounts();
      
    } catch (error) {
      console.error("Error approving account:", error);
      toast.error("Failed to approve account");
    } finally {
      setProcessingAccountIds(prev => prev.filter(id => id !== userId));
    }
  };

  const rejectAccount = async (userId: string) => {
    try {
      setProcessingAccountIds(prev => [...prev, userId]);
      
      console.log(`Attempting to reject account ${userId}`);
      
      // Type assertion to make TypeScript happy
      const { data, error } = await supabase.rpc('admin_update_account_status' as any, {
        user_id: userId,
        status: 'rejected'
      });

      if (error) {
        console.error("Error rejecting account:", error);
        throw error;
      }

      console.log(`Updated account ${userId} status to rejected, result:`, data);

      const user = businessAccounts.find(account => account.id === userId);
      if (user?.email) {
        console.log(`Sending rejection email to ${user.email}`);
        
        const emailResponse = await supabase.functions.invoke("send-email", {
          body: {
            to: user.email,
            subject: "Your business account application status",
            text: `Hello ${user.name},\n\nWe regret to inform you that your business account application for The Cycle Courier Co. has not been approved at this time. Please contact our customer service for more information.\n\nThe Cycle Courier Co. Team`,
            from: "Ccc@notification.cyclecourierco.com"
          }
        });
        
        if (emailResponse.error) {
          console.error("Error sending rejection email:", emailResponse.error);
          toast.error("Account rejected but failed to send notification email");
        } else {
          console.log("Rejection email sent successfully:", emailResponse.data);
        }
      }

      toast.success("Account rejected");
      
      await fetchBusinessAccounts();
      
    } catch (error) {
      console.error("Error rejecting account:", error);
      toast.error("Failed to reject account");
    } finally {
      setProcessingAccountIds(prev => prev.filter(id => id !== userId));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'suspended':
        return <Badge variant="outline" className="bg-red-100 text-red-800">Suspended</Badge>;
      default:
        return <Badge variant="outline" className="bg-amber-100 text-amber-800">Pending</Badge>;
    }
  };

  const isProcessing = (userId: string) => processingAccountIds.includes(userId);
  
  const filteredAccounts = businessAccounts.filter(account => {
    if (activeTab === "all") return true;
    if (activeTab === "pending") return account.account_status === "pending" || !account.account_status;
    if (activeTab === "approved") return account.account_status === "approved";
    if (activeTab === "rejected") return account.account_status === "rejected" || account.account_status === "suspended";
    return true;
  });

  return (
    <Layout>
      <DashboardHeader>
        <div className="flex items-center">
          <Shield size={28} className="mr-2" />
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Account Approvals</h2>
            <p className="text-muted-foreground">
              Manage business account applications
            </p>
          </div>
        </div>
      </DashboardHeader>
      
      <div className="container px-4 py-6 md:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building size={18} />
              Business Accounts
            </CardTitle>
            <CardDescription>
              Review and approve business account applications
            </CardDescription>
          </CardHeader>
          
          <div className="px-6">
            <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
                <TabsTrigger value="rejected">Rejected</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-6">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-courier-600"></div>
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="text-center p-6 text-muted-foreground">
                {activeTab === "all" 
                  ? "No business accounts found" 
                  : `No ${activeTab} business accounts found`}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell>
                          <div className="font-medium">{account.company_name || "N/A"}</div>
                          {account.website && (
                            <a 
                              href={account.website.startsWith('http') ? account.website : `https://${account.website}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground flex items-center hover:underline mt-1"
                            >
                              {account.website} <ExternalLink size={12} className="ml-1" />
                            </a>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            Created: {new Date(account.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>{account.name}</div>
                          <div className="text-xs text-muted-foreground">{account.email}</div>
                          {account.phone && (
                            <div className="text-xs text-muted-foreground">{account.phone}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {account.address_line_1 ? (
                            <div className="text-xs">
                              <div>{account.address_line_1}</div>
                              {account.address_line_2 && <div>{account.address_line_2}</div>}
                              <div>
                                {account.city}{account.postal_code ? `, ${account.postal_code}` : ''}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No address provided</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(account.account_status || '')}
                        </TableCell>
                        <TableCell className="text-right">
                          {account.account_status === 'pending' || !account.account_status ? (
                            <div className="space-x-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-green-600"
                                onClick={() => approveAccount(account.id)}
                                disabled={isProcessing(account.id)}
                              >
                                {isProcessing(account.id) ? (
                                  <><span className="animate-spin mr-1">◌</span> Processing</>
                                ) : (
                                  <><CheckCircle size={16} className="mr-1" /> Approve</>
                                )}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-red-600"
                                onClick={() => rejectAccount(account.id)}
                                disabled={isProcessing(account.id)}
                              >
                                {isProcessing(account.id) ? (
                                  <><span className="animate-spin mr-1">◌</span> Processing</>
                                ) : (
                                  <><XCircle size={16} className="mr-1" /> Reject</>
                                )}
                              </Button>
                            </div>
                          ) : account.account_status === 'approved' ? (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-600" 
                              onClick={() => rejectAccount(account.id)}
                              disabled={isProcessing(account.id)}
                            >
                              {isProcessing(account.id) ? (
                                <><span className="animate-spin mr-1">◌</span> Processing</>
                              ) : (
                                <><XCircle size={16} className="mr-1" /> Revoke</>
                              )}
                            </Button>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-green-600" 
                              onClick={() => approveAccount(account.id)}
                              disabled={isProcessing(account.id)}
                            >
                              {isProcessing(account.id) ? (
                                <><span className="animate-spin mr-1">◌</span> Processing</>
                              ) : (
                                <><CheckCircle size={16} className="mr-1" /> Approve</>
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AccountApprovals;
