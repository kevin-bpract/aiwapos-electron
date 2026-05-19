import { createContext, useContext, type ReactNode } from 'react';

/**
 * When true, Sales/Supermarket customer dropdown must stay closed and must not auto-open
 * (shift check in progress or Session / Shift Opening modal is visible).
 */
export interface ShiftSessionGateContextValue {
  blockCustomerSelection: boolean;
}

const ShiftSessionGateContext = createContext<ShiftSessionGateContextValue>({
  blockCustomerSelection: false,
});

export function ShiftSessionGateProvider({
  value,
  children,
}: {
  value: ShiftSessionGateContextValue;
  children: ReactNode;
}) {
  return (
    <ShiftSessionGateContext.Provider value={value}>
      {children}
    </ShiftSessionGateContext.Provider>
  );
}

export function useShiftSessionGate(): ShiftSessionGateContextValue {
  return useContext(ShiftSessionGateContext);
}
