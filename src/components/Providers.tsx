"use client";

import { Toaster } from "react-hot-toast";
import { PropsWithChildren } from "react";
import { FingerprintProvider } from "@/components/Fingerprint";

const Providers = ({ children }: PropsWithChildren) => {
  return (
    <FingerprintProvider>
      {children}

      <Toaster
        position="bottom-center"
        toastOptions={{
          className: "[&>div:first-child]:mt-1",
          style: { alignItems: "flex-start" },
        }}
      />
    </FingerprintProvider>
  );
};

export default Providers;
