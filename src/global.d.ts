// Ambient module declaration for side-effect CSS imports (e.g. `import "./globals.css"`).
// Needed because TypeScript 6.x doesn't reliably pick up Next.js's own bundled
// CSS module declarations the way TypeScript 5.x did.
declare module "*.css";
