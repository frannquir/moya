import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Mirror the tsconfig "@/*" path alias so domain modules that reach for
  // "@/lib/..." resolve under Vitest the same way they do under Next.
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    // The edge-function classifier is domain logic too — its rules must stay in
    // sync with lib/domain/escritos.ts, so it gets the same test coverage.
    include: ["lib/**/*.test.ts", "supabase/functions/**/*.test.ts"],
  },
});