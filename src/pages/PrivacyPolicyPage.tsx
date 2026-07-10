
import React from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PrivacyPolicyPage: React.FC = () => {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">Last updated: April 4, 2025</p>
            
            <div className="space-y-6">
              <section>
                <h2 className="text-2xl font-semibold">Introduction</h2>
                <p>At The Cycle Courier Co., we respect your privacy and are committed to protecting your personal data. This privacy policy will inform you about how we look after your personal data when you visit our website and tell you about your privacy rights and how the law protects you.</p>
              </section>
              
              <section>
                <h2 className="text-2xl font-semibold">Information We Collect</h2>
                <p>We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:</p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li><span className="font-medium">Identity Data</span> - includes first name, last name, username or similar identifier.</li>
                  <li><span className="font-medium">Contact Data</span> - includes billing address, delivery address, email address and telephone numbers.</li>
                  <li><span className="font-medium">Transaction Data</span> - includes details about payments to and from you and other details of products and services you have purchased from us.</li>
                  <li><span className="font-medium">Technical Data</span> - includes internet protocol (IP) address, your login data, browser type and version, time zone setting and location, browser plug-in types and versions, operating system and platform, and other technology on the devices you use to access this website.</li>
                </ul>
              </section>
              
              <section>
                <h2 className="text-2xl font-semibold">How We Use Your Information</h2>
                <p>We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li>To register you as a new customer</li>
                  <li>To process and deliver your order</li>
                  <li>To manage our relationship with you</li>
                  <li>To improve our website, products/services, marketing or customer relationships</li>
                </ul>
              </section>
              
              <section>
                <h2 className="text-2xl font-semibold">Data Security</h2>
                <p>We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorized way, altered or disclosed. In addition, we limit access to your personal data to those employees, agents, contractors and other third parties who have a business need to know.</p>
              </section>
              
              <section>
                <h2 className="text-2xl font-semibold">Your Legal Rights</h2>
                <p>Under certain circumstances, you have rights under data protection laws in relation to your personal data, including the right to:</p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li>Request access to your personal data</li>
                  <li>Request correction of your personal data</li>
                  <li>Request erasure of your personal data</li>
                  <li>Object to processing of your personal data</li>
                  <li>Request restriction of processing your personal data</li>
                  <li>Request transfer of your personal data</li>
                  <li>Right to withdraw consent</li>
                </ul>
              </section>
              
              <section>
                <h2 className="text-2xl font-semibold">Contact Us</h2>
                <p>If you have any questions about this privacy policy or our privacy practices, please contact us at privacy@cyclecourierco.com.</p>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default PrivacyPolicyPage;
