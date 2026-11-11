import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // TripEase shows only real places from a live provider and answers only from
    // a real model. The stand-ins that tests use live in `src/test-support`, and
    // nothing the product runs may import them. This makes that a lint error, so
    // synthetic data cannot find its way back into the app by accident.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.{ts,tsx}", "src/test-support/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/test-support", "@/test-support/*", "**/test-support", "**/test-support/*"],
              message: "Test doubles are for tests only. TripEase must not run on demo or synthetic data.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
