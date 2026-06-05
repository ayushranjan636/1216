import { createContext, useContext } from 'react';
import { useCall } from '@/hooks/useCall';
import type { CallType } from '@/types';

type CallContextValue = ReturnType<typeof useCall>;

const CallContext = createContext<CallContextValue | null>(null);

export function CallContextProvider({ children }: { children: React.ReactNode }) {
  const value = useCall();
  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCallContext() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCallContext must be used within CallContextProvider');
  return ctx;
}

export type { CallType };
