import React from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
const AboutPage: React.FC = () => {
  return <Layout>
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">About The Cycle Courier Co.</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center mb-8">
              <img src="https://cyclecourierco.com/cdn/shop/files/ERY.png?v=1740100482&width=240" alt="The Cycle Courier Co." className="h-32 object-contain" />
            </div>
            
            <p className="text-xl font-semibold text-courier-500 text-center">
              Streamlining Bike Transport - Bikes Delivered Safely, Inspected Thoroughly, Hassle Free and Backed by Warranty!
            </p>
            
            <p className="text-lg">
              At The Cycle Courier Co. we're not just another courier service - we're redefining how bikes are transported across the country. Built by cyclists, for cyclists, we understand that every bike represents more than just a frame and wheels; it's a passion, an investment and a lifestyle. That's why we've combined our love for cycling with cutting-edge technology and industry expertise to create a game-changing solution for bike transportation.
            </p>
            
            <p className="text-lg">
              Whether you're a trade client shipping multiple bikes or a private buyer purchasing your dream ride, we've designed a service that delivers speed, security and peace of mind.
            </p>
            
            <p className="text-lg">With our specialist inspection service, we go the extra mile to ensure that bikes arrive in perfect condition. Every bike we transport is fully insured to its value, so you can rest assured that your pride and joy is in safe hands.</p>
            
            <p className="text-lg">
              Our high-tech platform brings a new level of transparency and convenience to bike delivery. From seamless job bookings to real-time tracking, our customers have complete visibility every step of the way. For trade clients, we've automated the delivery process to minimize effort and maximize efficiency, making us the ideal logistics partner for bike retailers and businesses.
            </p>
            
            <p className="text-lg">
              With Cytech-certified drivers, next-day and same-day delivery options and a relentless commitment to excellence, The Cycle Courier Co. is setting a new standard in bike transportation. By combining innovation, expertise, and a passion for cycling, we're revolutionizing the way bikes are delivered - safely, securely and with unparalleled customer care.
            </p>
            
            <h2 className="text-2xl font-semibold mt-6">Contact Us</h2>
            <p>
              Have questions or want to learn more about our services? Please visit our <a href="/" className="text-courier-500 hover:underline">home page</a> to get in touch or call us at +44 121 798 0767.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>;
};
export default AboutPage;