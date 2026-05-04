import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { COLLECTION_FEATURE_ENABLED } from "@/lib/feature-flags";
import { ThemeProvider } from "@/hooks/use-theme";
import { ConfigProvider } from "@/hooks/use-config";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity-log";
import { ChatProvider } from "@/components/chat/ChatProvider";
import ChatWidget from "@/components/chat/ChatWidget";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import SignOn from "./pages/SignOn";
import PendingApproval from "./pages/PendingApproval";
import Index from "./pages/Index";
import Collection from "./pages/Collection";
import KnowledgeHub from "./pages/KnowledgeHub";
import Admin from "./pages/Admin";
import Stats from "./pages/Stats";
import Notepad from "./pages/Notepad";
import Changelog from "./pages/Changelog";
import DevKennyAvatar from "./pages/DevKennyAvatar";
import AdminKhImages from "./pages/AdminKhImages";
import NotFound from "./pages/NotFound";
import KeyboardShortcutsModal from "@/components/KeyboardShortcutsModal";

const queryClient = new QueryClient();

const LoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center" style={{ background: "#080806" }}>
    <span className="text-sm tracking-wider animate-pulse" style={{ color: "#C9A84C" }}>
      Loading Imperial Database...
    </span>
  </div>
);

const PageViewLogger = () => {
  const location = useLocation();
  useEffect(() => {
    logActivity("page.view", null, {
      path: location.pathname,
      referrer: document.referrer || null,
    });
  }, [location.pathname]);
  return null;
};

const AppRoutes = () => {
  const { isLoading, isAuthenticated, isApproved } = useAuth();

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
      <PageViewLogger />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/knowledge" element={<KnowledgeHub />} />
        <Route path="/collection" element={COLLECTION_FEATURE_ENABLED ? <Collection /> : <Navigate to="/" replace />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/notepad" element={<Notepad />} />
        <Route path="/changelog" element={<Changelog />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/kh-images" element={<AdminKhImages />} />
        <Route path="/dev/kenny-avatar" element={<DevKennyAvatar />} />
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
            <KeyboardShortcutsModal />
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
