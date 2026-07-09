import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

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

const FacilityContext = createContext<FacilityContextValue>({
  activeFacilityId: null,
  activeFacility: null,
  setActiveFacility: () => {},
  clearFacility: () => {},
});

export function FacilityProvider({ children }: { children: ReactNode }) {
  const [activeFacility, setActiveFacilityState] = useState<Facility | null>(null);

  const setActiveFacility = useCallback((facility: Facility | null) => {
    setActiveFacilityState(facility);
  }, []);

  const clearFacility = useCallback(() => {
    setActiveFacilityState(null);
  }, []);

  return (
    <FacilityContext.Provider
      value={{
        activeFacilityId: activeFacility?.id ?? null,
        activeFacility,
        setActiveFacility,
        clearFacility,
      }}
    >
      {children}
    </FacilityContext.Provider>
  );
}

export function useFacility() {
  return useContext(FacilityContext);
}
