
import React from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AboutPage: React.FC = () => {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">About The Cycle Courier Co.</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center mb-8">
              <img 
                src="https://cyclecourierco.com/cdn/shop/files/ERY.png?v=1740100482&width=240" 
                alt="The Cycle Courier Co." 
                className="h-32 object-contain"
              />
            </div>
            
            <p className="text-lg">
              The Cycle Courier Co. is a premium eco-friendly delivery service, providing fast, reliable and sustainable courier solutions for businesses and individuals across the city.
            </p>
            
            <h2 className="text-2xl font-semibold mt-6">Our Mission</h2>
            <p>
              We're on a mission to revolutionize urban delivery by providing zero-emission, efficient courier services while reducing traffic congestion and supporting local communities.
            </p>
            
            <h2 className="text-2xl font-semibold mt-6">Our Values</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><span className="font-medium">Sustainability</span> - We're committed to reducing carbon emissions through our bicycle-based delivery network.</li>
              <li><span className="font-medium">Reliability</span> - Our couriers are professionals who deliver on time, every time.</li>
              <li><span className="font-medium">Community</span> - We employ local riders and support local businesses.</li>
              <li><span className="font-medium">Innovation</span> - We continuously improve our technology to provide the best service possible.</li>
            </ul>
            
            <h2 className="text-2xl font-semibold mt-6">Our Team</h2>
            <p>
              Our team consists of passionate cyclists, logistics experts, and technology professionals all working together to provide exceptional delivery experiences.
            </p>
            
            <h2 className="text-2xl font-semibold mt-6">Contact Us</h2>
            <p>
              Have questions or want to learn more about our services? Please visit our <a href="/" className="text-courier-500 hover:underline">home page</a> to get in touch or call us at (555) 123-4567.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AboutPage;
