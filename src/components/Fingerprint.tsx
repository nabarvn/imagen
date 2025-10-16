"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  PropsWithChildren,
} from "react";

import FingerprintJS from "@fingerprintjs/fingerprintjs";

interface FingerprintContextType {
  fingerprint: string | null;
}

const FingerprintContext = createContext<FingerprintContextType | undefined>(
  undefined,
);

export const FingerprintProvider = ({ children }: PropsWithChildren) => {
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  useEffect(() => {
    const getFingerprint = async () => {
      const fp = await FingerprintJS.load();
      const { visitorId } = await fp.get();
      setFingerprint(visitorId);
    };

    getFingerprint();
  }, []);

  return (
    <FingerprintContext.Provider value={{ fingerprint }}>
      {children}
    </FingerprintContext.Provider>
  );
};

export const useFingerprint = () => {
  const context = useContext(FingerprintContext);

  if (context === undefined) {
    throw new Error(
      "`useFingerprint` must be used within a `FingerprintProvider`",
    );
  }

  return context;
};
