
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
import { Shield, CheckCircle, XCircle, ExternalLink, Building, Clock } from "lucide-react";

const AccountApprovals = () => {
  const [businessAccounts, setBusinessAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { userProfile } = useAuth();

  // Redirect if not admin
  useEffect(() => {
    if (userProfile && userProfile.role !== 'admin') {
      window.location.href = '/dashboard';
    }
  }, [userProfile]);

  // Fetch business accounts
  useEffect(() => {
    const fetchBusinessAccounts = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select(`
            id,
            name,
            email,
            company_name,
            website,
            phone,
            account_status,
            created_at,
            role
          `)
          .eq('is_business', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setBusinessAccounts(data || []);
      } catch (error) {
        console.error("Error fetching business accounts:", error);
        toast.error("Could not load business accounts");
      } finally {
        setIsLoading(false);
      }
    };

    if (userProfile?.role === 'admin') {
      fetchBusinessAccounts();
    }
  }, [userProfile]);

  const approveAccount = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ account_status: 'approved' })
        .eq('id', userId);

      if (error) throw error;

      // Send approval email
      const user = businessAccounts.find(account => account.id === userId);
      if (user?.email) {
        await supabase.functions.invoke("send-email", {
          body: {
            to: user.email,
            subject: "Your business account has been approved",
            text: `Hello ${user.name},\n\nYour business account for The Cycle Courier Co. has been approved. You can now log in and access all features.\n\nThank you for choosing us!\n\nThe Cycle Courier Co. Team`,
          }
        });
      }

      setBusinessAccounts(prevAccounts => 
        prevAccounts.map(account => 
          account.id === userId 
            ? { ...account, account_status: 'approved' } 
            : account
        )
      );
      toast.success("Account approved successfully");
    } catch (error) {
      console.error("Error approving account:", error);
      toast.error("Failed to approve account");
    }
  };

  const rejectAccount = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ account_status: 'rejected' })
        .eq('id', userId);

      if (error) throw error;

      // Send rejection email
      const user = businessAccounts.find(account => account.id === userId);
      if (user?.email) {
        await supabase.functions.invoke("send-email", {
          body: {
            to: user.email,
            subject: "Your business account application status",
            text: `Hello ${user.name},\n\nWe regret to inform you that your business account application for The Cycle Courier Co. has not been approved at this time. Please contact our customer service for more information.\n\nThe Cycle Courier Co. Team`,
          }
        });
      }

      setBusinessAccounts(prevAccounts => 
        prevAccounts.map(account => 
          account.id === userId 
            ? { ...account, account_status: 'rejected' } 
            : account
        )
      );
      toast.success("Account rejected");
    } catch (error) {
      console.error("Error rejecting account:", error);
      toast.error("Failed to reject account");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline" className="bg-amber-100 text-amber-800">Pending</Badge>;
    }
  };

  return (
    <Layout>
      <DashboardHeader 
        title="Account Approvals" 
        description="Manage business account applications" 
        icon={<Shield size={28} />}
      />
      
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
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-6">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-courier-600"></div>
              </div>
            ) : businessAccounts.length === 0 ? (
              <div className="text-center p-6 text-muted-foreground">
                No business accounts found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {businessAccounts.map((account) => (
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
                        </TableCell>
                        <TableCell>
                          <div>{account.name}</div>
                          <div className="text-xs text-muted-foreground">{account.email}</div>
                          {account.phone && (
                            <div className="text-xs text-muted-foreground">{account.phone}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(account.account_status)}
                        </TableCell>
                        <TableCell className="text-right">
                          {account.account_status === 'pending' ? (
                            <div className="space-x-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-green-600"
                                onClick={() => approveAccount(account.id)}
                              >
                                <CheckCircle size={16} className="mr-1" />
                                Approve
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-red-600"
                                onClick={() => rejectAccount(account.id)}
                              >
                                <XCircle size={16} className="mr-1" />
                                Reject
                              </Button>
                            </div>
                          ) : account.account_status === 'approved' ? (
                            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => rejectAccount(account.id)}>
                              <XCircle size={16} className="mr-1" />
                              Revoke
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" className="text-green-600" onClick={() => approveAccount(account.id)}>
                              <CheckCircle size={16} className="mr-1" />
                              Approve
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
