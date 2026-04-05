import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type ConfigMap = Record<string, string>;

const ConfigContext = createContext<ConfigMap>({});

export const useConfig = () => useContext(ConfigContext);

export const ConfigProvider = ({ children }: { children: React.ReactNode }) => {
  const [config, setConfig] = useState<ConfigMap>({});

  const fetchConfig = useCallback(() => {
    supabase
      .from("admin_config")
      .select("key, value")
      .then(({ data }) => {
        if (data) {
          const map: ConfigMap = {};
          for (const row of data) map[row.key] = row.value;
          setConfig(map);
        }
      });
  }, []);

  useEffect(() => {
    fetchConfig();
    const handler = () => fetchConfig();
    window.addEventListener("config-updated", handler);
    return () => window.removeEventListener("config-updated", handler);
  }, [fetchConfig]);

  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
};
