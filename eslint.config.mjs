import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // react-hooks/set-state-in-effect (React Compiler preset, added in
      // eslint-plugin-react-hooks v7 / eslint-config-next 16) flags every
      // "mounted" portal guard and every prop->state sync effect as an
      // error. Both patterns are deliberate here (SSR-safe portals in
      // avatars/lightbox/chat-bubble; syncing RSC-provided props into
      // local state in feed-list/chat-view/notification-bell/avatars).
      // Keep it visible as a warning instead of rewriting tested,
      // production components to satisfy a stylistic heuristic — see
      // ENGINEERING_CONSTITUTION.md (debate before rewriting working code).
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
