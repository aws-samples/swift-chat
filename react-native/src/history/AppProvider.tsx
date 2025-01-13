import React, { createContext, ReactNode, useContext, useState } from 'react';
import { EventData } from '../types/Chat.ts';

export type DrawerType = 'permanent' | 'slide';

interface AppContextType {
  sendEvent: (event: string, params?: EventData) => void;
  event: { event: string; params?: EventData } | null;
  drawerType: DrawerType;
  setDrawerType: (type: DrawerType) => void;
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
  const [drawerType, setDrawerType] = useState<DrawerType>('permanent');

  return (
    <AppContext.Provider
      value={{
        sendEvent,
        event,
        drawerType,
        setDrawerType,
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
