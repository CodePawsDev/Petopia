'use client';

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';

type BookingPhase = 'idle' | 'busy' | 'uncertain' | 'success';

type BookingFlow = {
  phase: BookingPhase;
  setPhase: (phase: BookingPhase) => void;
};

const BookingFlowContext = createContext<BookingFlow | null>(null);

export function BookingFlowProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [phase, setPhase] = useState<BookingPhase>('idle');

  return (
    <BookingFlowContext.Provider value={{ phase, setPhase }}>
      {children}
    </BookingFlowContext.Provider>
  );
}

export function useBookingFlow(): BookingFlow {
  const context = useContext(BookingFlowContext);

  if (!context) {
    throw new Error('BookingFlowProvider is required');
  }

  return context;
}