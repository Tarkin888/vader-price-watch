import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/use-theme";
import { ConfigProvider } from "@/hooks/use-config";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import Collection from "./pages/Collection";
import KnowledgeHub from "./pages/KnowledgeHub";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    supabase.from("page_views").insert({
      page: window.location.pathname,
      user_agent: navigator.userAgent,
    });
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <ConfigProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <ChatProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/knowledge" element={<KnowledgeHub />} />
                <Route path="/collection" element={<Collection />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
            <ChatWidget />
          </ChatProvider>
        </TooltipProvider>
      </ConfigProvider>
    </ThemeProvider>
  </QueryClientProvider>
  );
};

export default App;
