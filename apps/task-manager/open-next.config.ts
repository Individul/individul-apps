import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Implicitul, fără cache incremental: paginile sunt toate dinamice.
export default defineCloudflareConfig();
