import Layout from "@/components/Layout";
import MechanicProfitabilityPanel from "@/components/analytics/MechanicProfitabilityPanel";
import MechanicComparisonChart from "@/components/analytics/MechanicComparisonChart";
import MechanicHoursSection from "@/components/analytics/MechanicHoursSection";

const MechanicProfitabilityPage = () => {
  return (
    <Layout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Mechanic Profitability</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Workshop revenue, profit and productivity per mechanic.
          </p>
        </div>

        <MechanicProfitabilityPanel />

        <MechanicComparisonChart />

        <div>
          <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4">Mechanic Hours</h2>
          <MechanicHoursSection />
        </div>
      </div>
    </Layout>
  );
};

export default MechanicProfitabilityPage;
