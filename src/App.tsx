import * as Sentry from "@sentry/react";
import { Suspense, lazy, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ErrorFallback from "./components/ErrorFallback";

import ProtectedRoute from "./components/ProtectedRoute";

// Eager: everything a customer or a public link can reach. Keeps the first
// download small so slow connections and older Safari don't stall on it.
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import SenderAvailability from "./pages/SenderAvailability";
import ReceiverAvailability from "./pages/ReceiverAvailability";
import RepairOffer from "./pages/RepairOffer";
import NiPartnerUpload from "./pages/NiPartnerUpload";
import TrackingPage from "./pages/TrackingPage";
import NotFound from "./pages/NotFound";

// Lazy: staff/admin pages, loaded only when someone opens them.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const CreateOrder = lazy(() => import("./pages/CreateOrder"));
const CustomerOrderDetail = lazy(() => import("./pages/CustomerOrderDetail"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const JobScheduling = lazy(() => import("./pages/JobScheduling"));
const AccountApprovals = lazy(() => import("./pages/AccountApprovals"));
const ApiKeysPage = lazy(() => import("./pages/ApiKeysPage"));
const WebhookConfigPage = lazy(() => import("./pages/WebhookConfigPage"));
const InvoicesPage = lazy(() => import("./pages/InvoicesPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const ApiDocumentationPage = lazy(() => import("./pages/ApiDocumentationPage"));
const LoadingUnloadingPage = lazy(() => import("./pages/LoadingUnloadingPage"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const BulkAvailabilityPage = lazy(() => import("./pages/BulkAvailabilityPage"));
const DriverTimeslips = lazy(() => import("./pages/DriverTimeslips"));
const MechanicClock = lazy(() => import("./pages/MechanicClock"));
const RouteProfitabilityPage = lazy(() => import("./pages/RouteProfitabilityPage"));
const MechanicProfitabilityPage = lazy(() => import("./pages/MechanicProfitabilityPage"));
const BicycleInspections = lazy(() => import("./pages/BicycleInspections"));
const HolidaysPage = lazy(() => import("./pages/HolidaysPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const NoticeBarManagement = lazy(() => import("./pages/NoticeBarManagement"));
const AnnouncementEmailsPage = lazy(() => import("./pages/AnnouncementEmailsPage"));
const BulkOrderUpload = lazy(() => import("./pages/BulkOrderUpload"));
const WarehouseStockPage = lazy(() => import("./pages/WarehouseStockPage"));
const StorageBaysPage = lazy(() => import("./pages/StorageBaysPage"));
const TrunkRunsPage = lazy(() => import("./pages/TrunkRunsPage"));
const MyStockPage = lazy(() => import("./pages/MyStockPage"));
const ShopifyIntegrationPage = lazy(() => import("./pages/ShopifyIntegrationPage"));
const FuelFinderPage = lazy(() => import("./pages/FuelFinderPage"));
const VehicleManagement = lazy(() => import("./pages/VehicleManagement"));
const EquipmentPage = lazy(() => import("./pages/EquipmentPage"));
const ClaimsList = lazy(() => import("./pages/ClaimsList"));
const NewClaim = lazy(() => import("./pages/NewClaim"));
const ClaimDetail = lazy(() => import("./pages/ClaimDetail"));
const BoxMyBikePage = lazy(() => import("./pages/BoxMyBikePage"));
const BuildMyBikePage = lazy(() => import("./pages/BuildMyBikePage"));
const CustomerServiceInbox = lazy(() => import("./pages/CustomerServiceInbox"));
const Tasks = lazy(() => import("./pages/Tasks"));
const ProjectManagement = lazy(() => import("./pages/ProjectManagement"));
const RoutePermissionsPage = lazy(() => import("./pages/RoutePermissionsPage"));
const LabourTimesAdmin = lazy(() => import("./pages/LabourTimesAdmin"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const ReviewsPage = lazy(() => import("./pages/ReviewsPage"));
const ReviewDetailPage = lazy(() => import("./pages/ReviewDetailPage"));
const MyReviewsPage = lazy(() => import("./pages/MyReviewsPage"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
    <span className="sr-only">Loading</span>
  </div>
);

function App() {
  useEffect(() => {
    // The app mounted, so the shell fallback did its job — allow future
    // stale-release retries again.
    (window as unknown as { __cccClearChunkRetry?: () => void }).__cccClearChunkRetry?.();
  }, []);

  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <ErrorFallback error={error as Error} resetError={resetError} />
      )}
      showDialog={false}
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/:mode" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/orders/:id" element={
                <ProtectedRoute>
                  <OrderDetail />
                </ProtectedRoute>
              } />
              <Route path="/customer-orders/:id" element={
                <ProtectedRoute>
                  <CustomerOrderDetail />
                </ProtectedRoute>
              } />
              <Route path="/create-order" element={
                <ProtectedRoute>
                  <CreateOrder />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <UserProfile />
                </ProtectedRoute>
              } />
              <Route path="/analytics" element={
                <ProtectedRoute adminOnly={true}>
                  <AnalyticsPage />
                </ProtectedRoute>
              } />
              <Route path="/scheduling" element={
                <ProtectedRoute>
                  <JobScheduling />
                </ProtectedRoute>
              } />
              <Route path="/account-approvals" element={
                <ProtectedRoute>
                  <AccountApprovals />
                </ProtectedRoute>
              } />
              <Route path="/api-keys" element={
                <ProtectedRoute adminOnly={true}>
                  <ApiKeysPage />
                </ProtectedRoute>
              } />
              <Route path="/webhooks" element={
                <ProtectedRoute adminOnly={true}>
                  <WebhookConfigPage />
                </ProtectedRoute>
              } />
              <Route path="/users" element={
                <ProtectedRoute>
                  <UserManagement />
                </ProtectedRoute>
              } />
              <Route path="/invoices" element={
                <ProtectedRoute>
                  <InvoicesPage />
                </ProtectedRoute>
              } />
              <Route path="/loading" element={
                <ProtectedRoute>
                  <LoadingUnloadingPage />
                </ProtectedRoute>
              } />
              <Route path="/sender-availability/:id" element={<SenderAvailability />} />
              <Route path="/receiver-availability/:id" element={<ReceiverAvailability />} />
              <Route path="/repair-offer/:id" element={<RepairOffer />} />
              <Route path="/ni-partner/:orderId" element={<NiPartnerUpload />} />

              <Route path="/bulk-availability" element={
                <ProtectedRoute>
                  <BulkAvailabilityPage />
                </ProtectedRoute>
              } />
              <Route path="/driver-timeslips" element={
                <ProtectedRoute>
                  <DriverTimeslips />
                </ProtectedRoute>
              } />
              <Route path="/mechanic-clock" element={
                <ProtectedRoute>
                  <MechanicClock />
                </ProtectedRoute>
              } />
              <Route path="/route-profitability" element={
                <ProtectedRoute adminOnly={true}>
                  <RouteProfitabilityPage />
                </ProtectedRoute>
              } />
              <Route path="/mechanic-profitability" element={
                <ProtectedRoute adminOnly={true}>
                  <MechanicProfitabilityPage />
                </ProtectedRoute>
              } />

              <Route path="/bicycle-inspections" element={
                <ProtectedRoute>
                  <BicycleInspections />
                </ProtectedRoute>
              } />
              <Route path="/box-my-bike" element={
                <ProtectedRoute>
                  <BoxMyBikePage />
                </ProtectedRoute>
              } />
              <Route path="/build-my-bike" element={
                <ProtectedRoute>
                  <BuildMyBikePage />
                </ProtectedRoute>
              } />
              <Route path="/inbox" element={
                <ProtectedRoute>
                  <CustomerServiceInbox />
                </ProtectedRoute>
              } />
              <Route path="/inbox/:conversationId" element={
                <ProtectedRoute>
                  <CustomerServiceInbox />
                </ProtectedRoute>
              } />
              <Route path="/project-management" element={
                <ProtectedRoute>
                  <ProjectManagement />
                </ProtectedRoute>
              } />
              <Route path="/tasks" element={
                <ProtectedRoute>
                  <Tasks />
                </ProtectedRoute>
              } />
              <Route path="/knowledge" element={
                <ProtectedRoute noB2CAccess={true}>
                  <KnowledgeBase />
                </ProtectedRoute>
              } />
              <Route path="/reviews" element={
                <ProtectedRoute noB2CAccess={true}>
                  <ReviewsPage />
                </ProtectedRoute>
              } />
              <Route path="/reviews/:id" element={
                <ProtectedRoute noB2CAccess={true}>
                  <ReviewDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/my-reviews" element={
                <ProtectedRoute noB2CAccess={true}>
                  <MyReviewsPage />
                </ProtectedRoute>
              } />
              <Route path="/knowledge/:slug" element={
                <ProtectedRoute noB2CAccess={true}>
                  <KnowledgeBase />
                </ProtectedRoute>
              } />

              <Route path="/holidays" element={
                <ProtectedRoute adminOnly={true}>
                  <HolidaysPage />
                </ProtectedRoute>
              } />
              <Route path="/pricing" element={
                <ProtectedRoute>
                  <PricingPage />
                </ProtectedRoute>
              } />
              <Route path="/notices" element={
                <ProtectedRoute adminOnly={true}>
                  <NoticeBarManagement />
                </ProtectedRoute>
              } />
              <Route path="/emails" element={
                <ProtectedRoute noB2CAccess={true}>
                  <AnnouncementEmailsPage />
                </ProtectedRoute>
              } />
              <Route path="/bulk-upload" element={
                <ProtectedRoute>
                  <BulkOrderUpload />
                </ProtectedRoute>
              } />
              <Route path="/warehouse-stock" element={
                <ProtectedRoute adminOnly={true}>
                  <WarehouseStockPage />
                </ProtectedRoute>
              } />
              <Route path="/storage-bays" element={
                <ProtectedRoute adminOnly={true}>
                  <StorageBaysPage />
                </ProtectedRoute>
              } />
              <Route path="/trunk-runs" element={
                <ProtectedRoute adminOnly={true}>
                  <TrunkRunsPage />
                </ProtectedRoute>
              } />
              <Route path="/my-stock" element={
                <ProtectedRoute>
                  <MyStockPage />
                </ProtectedRoute>
              } />
              <Route path="/shopify-integration" element={
                <ProtectedRoute>
                  <ShopifyIntegrationPage />
                </ProtectedRoute>
              } />
              <Route path="/fuel-finder" element={
                <ProtectedRoute>
                  <FuelFinderPage />
                </ProtectedRoute>
              } />
              <Route path="/equipment" element={
                <ProtectedRoute>
                  <EquipmentPage />
                </ProtectedRoute>
              } />
              <Route path="/vehicles" element={
                <ProtectedRoute adminOnly={true}>
                  <VehicleManagement />
                </ProtectedRoute>
              } />
              <Route path="/claims" element={
                <ProtectedRoute adminOnly={true}>
                  <ClaimsList />
                </ProtectedRoute>
              } />
              <Route path="/claims/new" element={
                <ProtectedRoute adminOnly={true}>
                  <NewClaim />
                </ProtectedRoute>
              } />
              <Route path="/claims/:id" element={
                <ProtectedRoute adminOnly={true}>
                  <ClaimDetail />
                </ProtectedRoute>
              } />
              <Route path="/admin/labour-times" element={
                <ProtectedRoute>
                  <LabourTimesAdmin />
                </ProtectedRoute>
              } />
              <Route path="/admin/route-permissions" element={
                <ProtectedRoute adminOnly>
                  <RoutePermissionsPage />
                </ProtectedRoute>
              } />
              <Route path="/tracking" element={<TrackingPage />} />
              <Route path="/tracking/:id" element={<TrackingPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/api-docs" element={<ApiDocumentationPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            <Toaster
              position="top-right"
              closeButton
              richColors
              expand={false}
              visibleToasts={5}
              pauseWhenPageIsHidden
              toastOptions={{ duration: 4000 }}
            />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  );
}

export default App;
