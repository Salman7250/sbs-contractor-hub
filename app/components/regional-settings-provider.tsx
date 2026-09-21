"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  DEFAULT_REGIONAL_SETTINGS,
  getRegionalSettings,
  type RegionalSettings,
} from "@/lib/regional-settings";

type RegionalSettingsContextValue = {
  settings: RegionalSettings;
  loading: boolean;
  refresh: () => Promise<void>;
};

const RegionalSettingsContext =
  createContext<RegionalSettingsContextValue | null>(
    null
  );

export function RegionalSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, setSettings] =
    useState<RegionalSettings>(
      DEFAULT_REGIONAL_SETTINGS
    );

  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const nextSettings =
        await getRegionalSettings();

      setSettings(nextSettings);
    } catch (error) {
      console.error(
        "Regional settings load error:",
        error
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const handleRegionalSettingsUpdated = () => {
      void refresh();
    };

    window.addEventListener(
      "sbs-regional-settings-updated",
      handleRegionalSettingsUpdated
    );

    return () => {
      window.removeEventListener(
        "sbs-regional-settings-updated",
        handleRegionalSettingsUpdated
      );
    };
  }, [refresh]);

  return (
    <RegionalSettingsContext.Provider
      value={{
        settings,
        loading,
        refresh,
      }}
    >
      {children}
    </RegionalSettingsContext.Provider>
  );
}

export function useRegionalSettings() {
  const context = useContext(
    RegionalSettingsContext
  );

  if (!context) {
    throw new Error(
      "useRegionalSettings must be used inside RegionalSettingsProvider."
    );
  }

  return context;
}