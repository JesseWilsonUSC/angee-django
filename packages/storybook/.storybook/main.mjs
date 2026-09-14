// @ts-check

import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const INIT_CWD = process.env.INIT_CWD ?? process.cwd();
const SOURCES = join(HERE, "../../../..");
const addonStories = readdirSync(SOURCES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(SOURCES, entry.name, "addons")))
  .map((entry) => ({
    directory: join(SOURCES, entry.name, "addons"),
    files: "*/*/web/src/**/*.stories.@(ts|tsx)",
  }));

/** @type {import("@storybook/react-vite").StorybookConfig} */
const config = {
  framework: "@storybook/react-vite",
  stories: [
    "../src/stories/**/*.stories.@(ts|tsx)",
    ...addonStories,
  ],
  addons: [],
  typescript: { reactDocgen: false },
  viteFinal: async (vite) => {
    const tailwind = (await import("@tailwindcss/vite")).default;
    vite.plugins = [...(vite.plugins ?? []), tailwind()];
    vite.resolve = {
      ...(vite.resolve ?? {}),
      preserveSymlinks: true,
      dedupe: ["react", "react-dom"],
      alias: {
        ...(vite.resolve?.alias ?? {}),
        "@angee/gql": join(INIT_CWD, "runtime/gql"),
        react: join(ROOT, "node_modules/react"),
        "react-dom": join(ROOT, "node_modules/react-dom"),
        "react-dom/client": join(ROOT, "node_modules/react-dom/client"),
        "react/jsx-runtime": join(ROOT, "node_modules/react/jsx-runtime"),
      },
    };
    return vite;
  },
};

export default config;
