import React, { createContext, useState, useContext, ReactNode } from 'react';
import { EventData } from '../types/Chat.ts';

interface AppContextType {
  sendEvent: (event: string, params?: EventData) => void;
  event: { event: string; params?: EventData } | null;
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

  return (
    <AppContext.Provider value={{ sendEvent, event }}>
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
