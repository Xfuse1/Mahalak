// ESLint flat config (متوافق مع Next.js 16 / ESLint 9)
// يستبدل .eslintrc.json القديم الذي لم يعد يعمل مع eslint-config-next@16
import nextCoreWebVitals from "eslint-config-next/core-web-vitals"

const config = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "crmAndCacher1/**",
      "inspection/**",
      "scripts/**",
      "testsprite_tests/**",
    ],
  },
  ...nextCoreWebVitals,
]

export default config
