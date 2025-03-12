
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import CreateOrder from "./pages/CreateOrder";
import Dashboard from "./pages/Dashboard";
import SenderAvailability from "./pages/SenderAvailability";
import ReceiverAvailability from "./pages/ReceiverAvailability";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/create-order" element={
              <ProtectedRoute>
                <CreateOrder />
              </ProtectedRoute>
            } />
            <Route path="/sender-availability/:orderId" element={
              <ProtectedRoute>
                <SenderAvailability />
              </ProtectedRoute>
            } />
            <Route path="/receiver-availability/:orderId" element={
              <ProtectedRoute>
                <ReceiverAvailability />
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
