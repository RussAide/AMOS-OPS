import { createContext, createElement, useContext, useState, useCallback, type ReactNode } from "react";

interface Facility {
  id: string;
  name: string;
  code: string;
  licensedCapacity: number;
  operationalCapacity: number;
  currentOccupancy: number;
  status: string;
}

interface FacilityContextValue {
  activeFacilityId: string | null;
  activeFacility: Facility | null;
  setActiveFacility: (facility: Facility | null) => void;
  clearFacility: () => void;
}

const FacilityContext = createContext<FacilityContextValue | null>(null);

export function FacilityProvider({ children }: { children: ReactNode }) {
  const [activeFacility, setActiveFacilityState] = useState<Facility | null>(null);

  const setActiveFacility = useCallback((facility: Facility | null) => {
    setActiveFacilityState(facility);
  }, []);

  const clearFacility = useCallback(() => {
    setActiveFacilityState(null);
  }, []);

  return createElement(
    FacilityContext.Provider,
    {
      value: {
        activeFacilityId: activeFacility?.id ?? null,
        activeFacility,
        setActiveFacility,
        clearFacility,
      },
    },
    children,
  );
}

export function useFacility() {
  const context = useContext(FacilityContext);
  if (!context) throw new Error("useFacility must be used within FacilityProvider");
  return context;
}
