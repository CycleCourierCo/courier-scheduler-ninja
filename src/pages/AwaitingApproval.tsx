
import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Clock, XCircle, ShieldAlert } from "lucide-react";

const AwaitingApproval = () => {
  const { userProfile, signOut } = useAuth();

  const getStatusDetails = () => {
    const status = userProfile?.account_status || 'pending';
    
    switch (status) {
      case 'approved':
        return {
          icon: <CheckCircle2 size={48} className="text-green-500" />,
          title: "Account Approved",
          description: "Your business account has been approved. You can now access all features.",
          statusText: "Approved",
          statusColor: "text-green-500"
        };
      case 'rejected':
        return {
          icon: <XCircle size={48} className="text-red-500" />,
          title: "Account Application Rejected",
          description: "Your business account application has been rejected. Please contact support for more information.",
          statusText: "Rejected",
          statusColor: "text-red-500"
        };
      case 'suspended':
        return {
          icon: <ShieldAlert size={48} className="text-red-500" />,
          title: "Account Suspended",
          description: "Your business account has been suspended. Please contact support for more information.",
          statusText: "Suspended",
          statusColor: "text-red-500"
        };
      default:
        return {
          icon: <Clock size={48} className="text-amber-500" />,
          title: "Account Pending Approval",
          description: "Your business account is currently awaiting approval from our team.",
          statusText: "Pending",
          statusColor: "text-amber-500"
        };
    }
  };

  const statusDetails = getStatusDetails();

  return (
    <Layout>
      <div className="container max-w-3xl mx-auto mt-10 px-4">
        <Card>
          <CardHeader>
            <div className="flex flex-col items-center space-y-2">
              {statusDetails.icon}
              <CardTitle className="text-2xl">{statusDetails.title}</CardTitle>
              <CardDescription className="text-center">
                {statusDetails.description}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border rounded-md p-4 bg-accent/20">
              <h3 className="font-medium mb-2">Account Information</h3>
              <div className="space-y-1 text-sm">
                <p><span className="font-medium">Name:</span> {userProfile?.name}</p>
                <p><span className="font-medium">Email:</span> {userProfile?.email}</p>
                <p><span className="font-medium">Business:</span> {userProfile?.company_name}</p>
                <p><span className="font-medium">Status:</span> <span className={`${statusDetails.statusColor} font-medium`}>{statusDetails.statusText}</span></p>
              </div>
            </div>

            <div className="space-y-4">
              {userProfile?.account_status === 'rejected' ? (
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm">Please contact our support team for more information about your application status.</p>
                </div>
              ) : userProfile?.account_status === 'suspended' ? (
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm">Your account has been suspended. Please contact our support team.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-start space-x-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <p className="text-sm">Your account has been successfully created.</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm">Our team is reviewing your business account application.</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="h-5 w-5 text-courier-600 shrink-0 mt-0.5" />
                    <p className="text-sm">You'll be notified by email once your account has been approved.</p>
                  </div>
                </>
              )}
            </div>

            <div className="border-t pt-4 flex justify-center">
              <Button variant="outline" onClick={signOut}>
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AwaitingApproval;
