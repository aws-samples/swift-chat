import React, { createContext, ReactNode, useContext, useState } from 'react';
import { EventData } from '../types/Chat.ts';

export type DrawerState = 'open' | 'closed';

interface AppContextType {
  sendEvent: (event: string, params?: EventData) => void;
  event: { event: string; params?: EventData } | null;
  drawerState: DrawerState;
  setDrawerState: (type: DrawerState) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [event, setEvent] = useState<{
    event: string;
    params?: EventData;
  } | null>(null);

  const sendEvent = (eventName: string, params?: EventData) => {
    setEvent({ event: eventName, params: params });
  };
  const [drawerState, setDrawerState] = useState<DrawerState>('open');

  return (
    <AppContext.Provider
      value={{
        sendEvent,
        event,
        drawerState,
        setDrawerState,
      }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
