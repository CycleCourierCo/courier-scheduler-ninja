
import { RouterProvider, createBrowserRouter, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  {
    path: "/",
    element: <Index />,
  },
  {
    path: "/auth/:mode",
    element: <Auth />,
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/orders/:id",
    element: (
      <ProtectedRoute>
        <OrderDetail />
      </ProtectedRoute>
    ),
  },
  {
    path: "/jobs",
    element: (
      <ProtectedRoute>
        <JobsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/customer-orders/:id",
    element: (
      <ProtectedRoute>
        <CustomerOrderDetail />
      </ProtectedRoute>
    ),
  },
  {
    path: "/create-order",
    element: (
      <ProtectedRoute>
        <CreateOrder />
      </ProtectedRoute>
    ),
  },
  {
    path: "/profile",
    element: (
      <ProtectedRoute>
        <UserProfile />
      </ProtectedRoute>
    ),
  },
  {
    path: "/analytics",
    element: (
      <ProtectedRoute>
        <AnalyticsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/scheduling",
    element: (
      <ProtectedRoute>
        <JobScheduling />
      </ProtectedRoute>
    ),
  },
  {
    path: "/approvals",
    element: (
      <ProtectedRoute>
        <AccountApprovals />
      </ProtectedRoute>
    ),
  },
  {
    path: "/sender-availability/:id",
    element: <SenderAvailability />,
  },
  {
    path: "/receiver-availability/:id",
    element: <ReceiverAvailability />,
  },
  {
    path: "/tracking/:id",
    element: <TrackingPage />,
  },
  {
    path: "/auth",
    element: <Navigate to="/auth/login" />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster position="top-right" closeButton richColors />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
