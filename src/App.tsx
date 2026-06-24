import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Player from "./pages/Player";
import Payment from "./pages/Payment";
import Profile from "./pages/Profile";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminChannels from "./pages/admin/Channels";
import AdminSlider from "./pages/admin/Slider";
import AdminToken from "./pages/admin/Token";
import AdminUsers from "./pages/admin/Users";
import AdminNotifications from "./pages/admin/Notifications";
import AdminAds from "./pages/admin/Ads";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/player/:id" element={<Player />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/channels" element={<AdminChannels />} />
            <Route path="/admin/slider" element={<AdminSlider />} />
            <Route path="/admin/token" element={<AdminToken />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/notifications" element={<AdminNotifications />} />
            <Route path="/admin/ads" element={<AdminAds />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
