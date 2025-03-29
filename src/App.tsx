
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";

import "./App.css";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import CreateOrder from "./pages/CreateOrder";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import SenderAvailability from "./pages/SenderAvailability";
import ReceiverAvailability from "./pages/ReceiverAvailability";
import OrderDetail from "./pages/OrderDetail";
import CustomerOrderDetail from "./pages/CustomerOrderDetail";
import JobScheduling from "./pages/JobScheduling";
import TrackingPage from "./pages/TrackingPage";
import UserProfile from "./pages/UserProfile";
import AwaitingApproval from "./pages/AwaitingApproval";
import AccountApprovals from "./pages/AccountApprovals";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              
              {/* B2C users are explicitly blocked from this page - this is a B2B-only page */}
              <Route 
                path="/awaiting-approval" 
                element={
                  <ProtectedRoute 
                    requiresApproval={false} 
                    noB2CAccess={true} // Explicitly block B2C users
                  >
                    <AwaitingApproval />
                  </ProtectedRoute>
                } 
              />
              
              {/* All remaining routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/create-order"
                element={
                  <ProtectedRoute>
                    <CreateOrder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders/:id"
                element={
                  <ProtectedRoute>
                    <OrderDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customer-orders/:id"
                element={
                  <ProtectedRoute>
                    <CustomerOrderDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/job-scheduling"
                element={
                  <ProtectedRoute adminOnly={true}>
                    <JobScheduling />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <UserProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/account-approvals"
                element={
                  <ProtectedRoute adminOnly={true}>
                    <AccountApprovals />
                  </ProtectedRoute>
                }
              />
              
              {/* Public routes that skip authentication */}
              <Route path="/sender-availability/:id" element={<SenderAvailability />} />
              <Route path="/receiver-availability/:id" element={<ReceiverAvailability />} />
              <Route path="/tracking" element={<TrackingPage />} />
              <Route path="/tracking/:id" element={<TrackingPage />} />
              
              {/* Catch-all for 404 errors */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Toaster position="top-right" />
            <Analytics />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
