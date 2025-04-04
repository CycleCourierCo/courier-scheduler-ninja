
import React from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TermsPage: React.FC = () => {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">Terms and Conditions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">Last updated: April 4, 2025</p>
            
            <div className="space-y-6">
              <p className="text-center">Content coming soon.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default TermsPage;
