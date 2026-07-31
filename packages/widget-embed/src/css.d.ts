// esbuild's `text` loader turns a CSS import into a plain string at bundle
// time (build.mjs) — this just tells TS what shape to expect.
declare module "*.css" {
  const content: string;
  export default content;
}
