"use client";

import { QueryClient, QueryClientProvider, isServer } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "next-themes";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // SSR + RSC hydration: don't refetch on mount if data came from server prefetch.
        staleTime: 60_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserClient: QueryClient | undefined;

function getQueryClient() {
  // On the server, always make a fresh client per request. In the browser,
  // reuse one singleton so the cache survives client-side navigation.
  if (isServer) return makeQueryClient();
  if (!browserClient) browserClient = makeQueryClient();
  return browserClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    // attribute="class" because globals.css declares
    // `@custom-variant dark (&:is(.dark *))` — the variant keys off a class on
    // <html>, not a data attribute. defaultTheme="system" so the app follows the
    // OS until the lawyer picks a side; disableTransitionOnChange stops every
    // border and surface from animating at once when they do.
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
