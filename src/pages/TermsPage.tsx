
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
              <section>
                <h2 className="text-2xl font-semibold">Introduction</h2>
                <p>These terms and conditions ("Terms") govern your use of The Cycle Courier Co. website and services. By using our website and services, you accept these Terms in full. If you disagree with these Terms or any part of them, you must not use our website or services.</p>
              </section>
              
              <section>
                <h2 className="text-2xl font-semibold">Service Description</h2>
                <p>The Cycle Courier Co. provides bicycle courier services for the delivery of packages, documents, and goods within our service area. Our services are subject to availability and may be restricted by factors including but not limited to weather conditions, package size, weight, and content.</p>
              </section>
              
              <section>
                <h2 className="text-2xl font-semibold">Ordering and Payment</h2>
                <p>Orders can be placed through our website, mobile app, or by contacting our customer service. Payment must be made in advance unless credit terms have been agreed upon. We accept major credit cards, electronic bank transfers, and other payment methods as specified on our website.</p>
              </section>
              
              <section>
                <h2 className="text-2xl font-semibold">Delivery and Collection</h2>
                <p>Delivery times are estimates and are not guaranteed unless explicitly stated. We will make reasonable efforts to collect and deliver items within the specified timeframes. The customer is responsible for ensuring that someone is available to hand over and receive the items at the specified addresses during the agreed time windows.</p>
              </section>
              
              <section>
                <h2 className="text-2xl font-semibold">Prohibited Items</h2>
                <p>The following items are prohibited from being transported by our service:</p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li>Illegal substances and items</li>
                  <li>Dangerous goods and hazardous materials</li>
                  <li>Firearms, explosives, and weapons</li>
                  <li>Perishable goods that may spoil during transport</li>
                  <li>Live animals</li>
                  <li>Items exceeding our weight and size limitations</li>
                </ul>
              </section>
              
              <section>
                <h2 className="text-2xl font-semibold">Liability</h2>
                <p>Our liability for loss or damage to items is limited to the declared value of the item, up to a maximum as specified in our current insurance policy. We are not liable for indirect or consequential losses arising from late delivery or non-delivery of items.</p>
              </section>
              
              <section>
                <h2 className="text-2xl font-semibold">Cancellation and Refunds</h2>
                <p>Cancellations made before a courier has been dispatched may be eligible for a full refund. Cancellations made after a courier has been dispatched may be subject to a cancellation fee. No refund will be provided once the delivery has been completed.</p>
              </section>
              
              <section>
                <h2 className="text-2xl font-semibold">Modifications to Terms</h2>
                <p>We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting on our website. Your continued use of our services after any changes indicates your acceptance of the modified Terms.</p>
              </section>
              
              <section>
                <h2 className="text-2xl font-semibold">Contact Us</h2>
                <p>If you have any questions about these Terms, please contact us at terms@cyclecourierco.com.</p>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default TermsPage;
