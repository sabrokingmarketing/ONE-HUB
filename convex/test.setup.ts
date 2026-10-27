/// <reference types="vite/client" />
export const modules = import.meta.glob(["./**/*.*s", "!./**/*.test.ts", "!./test.setup.ts"]);
