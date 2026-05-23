import * as Sentry from "@sentry/react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ErrorFallback from "./components/ErrorFallback";

import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import OrderDetail from "./pages/OrderDetail";
import Auth from "./pages/Auth";
import CreateOrder from "./pages/CreateOrder";
import CustomerOrderDetail from "./pages/CustomerOrderDetail";
import SenderAvailability from "./pages/SenderAvailability";
import ReceiverAvailability from "./pages/ReceiverAvailability";

import TrackingPage from "./pages/TrackingPage";
import UserProfile from "./pages/UserProfile";
import AnalyticsPage from "./pages/AnalyticsPage";
import JobScheduling from "./pages/JobScheduling";
import AccountApprovals from "./pages/AccountApprovals";
import ApiKeysPage from "./pages/ApiKeysPage";
import WebhookConfigPage from "./pages/WebhookConfigPage";
import InvoicesPage from "./pages/InvoicesPage";
import NotFound from "./pages/NotFound";
import AboutPage from "./pages/AboutPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsPage from "./pages/TermsPage";
import ApiDocumentationPage from "./pages/ApiDocumentationPage";
import LoadingUnloadingPage from "./pages/LoadingUnloadingPage";
import UserManagement from "./pages/UserManagement";
import BulkAvailabilityPage from "./pages/BulkAvailabilityPage";
import DriverTimeslips from "./pages/DriverTimeslips";
import RouteProfitabilityPage from "./pages/RouteProfitabilityPage";
import BicycleInspections from "./pages/BicycleInspections";
import HolidaysPage from "./pages/HolidaysPage";
import PricingPage from "./pages/PricingPage";
import NoticeBarManagement from "./pages/NoticeBarManagement";
import AnnouncementEmailsPage from "./pages/AnnouncementEmailsPage";
import AIRouting from "./pages/AIRouting";
import BulkOrderUpload from "./pages/BulkOrderUpload";
import WarehouseStockPage from "./pages/WarehouseStockPage";
import MyStockPage from "./pages/MyStockPage";
import FuelFinderPage from "./pages/FuelFinderPage";
import VehicleManagement from "./pages/VehicleManagement";
import ClaimsList from "./pages/ClaimsList";
import NewClaim from "./pages/NewClaim";
import ClaimDetail from "./pages/ClaimDetail";
import DispatchOrdersPage from "./pages/DispatchOrdersPage";
import DispatchRoutesPage from "./pages/DispatchRoutesPage";

const queryClient = new QueryClient();

function App() {
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
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/:mode" element={<Auth />} />
              <Route path="/reset-password" element={<Auth />} />
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
              <Route path="/route-profitability" element={
                <ProtectedRoute adminOnly={true}>
                  <RouteProfitabilityPage />
                </ProtectedRoute>
              } />
              <Route path="/bicycle-inspections" element={
                <ProtectedRoute>
                  <BicycleInspections />
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
              <Route path="/ai-routing" element={
                <ProtectedRoute>
                  <AIRouting />
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
              <Route path="/my-stock" element={
                <ProtectedRoute>
                  <MyStockPage />
                </ProtectedRoute>
              } />
              <Route path="/fuel-finder" element={
                <ProtectedRoute>
                  <FuelFinderPage />
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
              <Route path="/dispatch/orders" element={
                <ProtectedRoute>
                  <DispatchOrdersPage />
                </ProtectedRoute>
              } />
              <Route path="/dispatch/routes" element={
                <ProtectedRoute>
                  <DispatchRoutesPage />
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
            <Toaster position="top-right" closeButton richColors />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  );
}

export default App;
