"use client";

import { createContext, useContext, useEffect, useState } from "react";

const LS_KEY = "finance_visible";

interface FinanceVisibilityContextValue {
  visible: boolean;
  toggle: () => void;
}

const FinanceVisibilityContext = createContext<FinanceVisibilityContextValue>({
  visible: false,
  toggle: () => {},
});

export function FinanceVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored === "true") setVisible(true);
  }, []);

  function toggle() {
    setVisible(prev => {
      const next = !prev;
      localStorage.setItem(LS_KEY, String(next));
      return next;
    });
  }

  return (
    <FinanceVisibilityContext.Provider value={{ visible, toggle }}>
      {children}
    </FinanceVisibilityContext.Provider>
  );
}

export function useFinanceVisibility(): FinanceVisibilityContextValue {
  return useContext(FinanceVisibilityContext);
}
