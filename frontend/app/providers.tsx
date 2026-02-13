"use client";

import { SWRConfig } from "swr";
import { apiRequest } from "@/lib/api";

const swrFetcher = <T,>(endpoint: string): Promise<T> =>
  apiRequest<T>(endpoint);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: swrFetcher,
        revalidateOnFocus: true,
        dedupingInterval: 5000,
        errorRetryCount: 2,
        onError: (error, key) => {
          if (process.env.NODE_ENV === "development") {
            console.error(`[SWR] ${key}:`, error);
          }
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
