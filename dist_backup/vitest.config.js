import { defineConfig } from "vitest/config";
import path from "path";
export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        setupFiles: ["./__tests__/setup-env.js"],
        include: ["./__tests__/**/*.test.ts"],
        exclude: ["**/node_modules/**", "**/dist/**"],
        clearMocks: true,
        mockReset: true,
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname),
        },
    },
});
