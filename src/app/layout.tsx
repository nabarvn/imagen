import "./globals.css";
import type { Metadata } from "next";
import { constructMetadata } from "@/lib/utils";
import { Providers, Header, Generator } from "@/components";

export const metadata: Metadata = constructMetadata();

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Header />
          <Generator />

          {children}
        </Providers>
      </body>
    </html>
  );
};

export default RootLayout;
