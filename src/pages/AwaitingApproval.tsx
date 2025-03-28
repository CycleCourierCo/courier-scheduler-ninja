
import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

const AwaitingApproval = () => {
  const { userProfile, signOut } = useAuth();

  return (
    <Layout>
      <div className="container max-w-3xl mx-auto mt-10 px-4">
        <Card>
          <CardHeader>
            <div className="flex flex-col items-center space-y-2">
              <Clock size={48} className="text-amber-500" />
              <CardTitle className="text-2xl">Account Pending Approval</CardTitle>
              <CardDescription className="text-center">
                Your business account is currently awaiting approval from our team.
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
                <p><span className="font-medium">Status:</span> <span className="text-amber-500 font-medium">Pending</span></p>
              </div>
            </div>

            <div className="space-y-4">
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
