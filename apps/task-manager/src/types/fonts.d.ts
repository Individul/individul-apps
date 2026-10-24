// Un `.ttf` importat devine `data:` URL în base64 — vezi regula din next.config.mjs.
declare module "*.ttf" {
  const dataUrl: string;
  export default dataUrl;
}
