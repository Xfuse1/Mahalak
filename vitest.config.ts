import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

// يحلّ الاسم المستعار @ إلى جذر المشروع (نفس tsconfig) حتى تعمل استيرادات @/lib/... في الاختبارات.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
  },
})
