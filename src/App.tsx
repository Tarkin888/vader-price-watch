import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/hooks/use-theme";
import { ConfigProvider } from "@/hooks/use-config";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChatProvider } from "@/components/chat/ChatProvider";
import ChatWidget from "@/components/chat/ChatWidget";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import SignOn from "./pages/SignOn";
import PendingApproval from "./pages/PendingApproval";
import Index from "./pages/Index";
import Collection from "./pages/Collection";
import KnowledgeHub from "./pages/KnowledgeHub";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const LoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center" style={{ background: "#080806" }}>
    <span className="text-sm tracking-wider animate-pulse" style={{ color: "#C9A84C" }}>
      Loading Imperial Database...
    </span>
  </div>
);

const AppRoutes = () => {
  const { isLoading, isAuthenticated, isApproved, profile } = useAuth();

  useEffect(() => {
    supabase.from("page_views").insert({
      page: window.location.pathname,
      user_agent: navigator.userAgent,
    });
  }, []);

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <SignOn />;
  if (!isApproved) return <PendingApproval />;

  return (
    <>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/knowledge" element={<KnowledgeHub />} />
        <Route path="/collection" element={<Collection />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <ConditionalChatWidget />
    </>
  );
};

const ConditionalChatWidget = () => {
  const { pathname } = useLocation();
  if (pathname.startsWith("/admin")) return null;
  return <ChatWidget />;
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ConfigProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AuthProvider>
              <ChatProvider>
                <BrowserRouter>
                  <AppRoutes />
                </BrowserRouter>
              </ChatProvider>
            </AuthProvider>
          </TooltipProvider>
        </ConfigProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
