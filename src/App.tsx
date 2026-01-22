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
import JobsPage from "./pages/JobsPage";
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
import DriverCheckin from "./pages/DriverCheckin";

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
              <Route path="/jobs" element={
                <ProtectedRoute>
                  <JobsPage />
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
                <ProtectedRoute adminOnly={true}>
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
              <Route path="/driver-checkin" element={
                <ProtectedRoute>
                  <DriverCheckin />
                </ProtectedRoute>
              } />
              <Route path="/route-profitability" element={
                <ProtectedRoute adminOnly={true}>
                  <RouteProfitabilityPage />
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
