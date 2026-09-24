import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pins the workspace root explicitly. Without this, Next.js's own
  // "inferred workspace root" heuristic gets confused whenever a sibling
  // package-lock.json exists above this directory (e.g. a git worktree
  // nested under the main checkout, which has its own lockfile after `npm
  // install`) — discovered because it silently corrupted the absolute path
  // Turbopack used to resolve satori's harfbuzzjs WASM asset (rewritten to
  // a nonsensical "C:\ROOT\..." path, ENOENT at runtime) even though the
  // build's own exit code stayed 0. Same fix Next.js's own warning names.
  turbopack: {
    root: path.join(__dirname),
  },
  // @resvg/resvg-js ships a native N-API binary (js-binding.js), the same
  // category of package as `sharp` — but unlike sharp, it isn't in Next.js's
  // built-in default serverExternalPackages list, so Turbopack tries to
  // bundle the native binding into the server chunk graph and fails ("asset
  // is not placeable in ESM chunks"). satori/harfbuzzjs has a related but
  // distinct problem: harfbuzzjs (satori's text-shaping WASM dependency)
  // locates its own hb.wasm at runtime via Node's real `__dirname`, which
  // Turbopack's bundling corrupts into a bogus "C:\ROOT\..." path when it's
  // bundled into the server chunk (confirmed via a local build: the file
  // exists on disk at the correct path, only the bundled reference is
  // wrong). Marking both external tells Next.js to `require()` them from
  // node_modules at runtime instead, same as sharp already works without
  // needing to be listed here.
  serverExternalPackages: ["@resvg/resvg-js", "satori", "harfbuzzjs"],
  // Allow the dev server to serve /_next/* assets (HMR, on-demand chunks) to
  // requests originating from other hosts — LAN devices for real-device
  // testing, or a cloudflared quick tunnel for HTTPS-only features like the
  // camera. Only affects `next dev`; production builds ignore this field.
  allowedDevOrigins: [
    // this dev machine's current LAN IP
    "192.168.1.43", 
    // future-proof against DHCP re-lease
    "192.168.1.*", 
    // cloudflared quick tunnels (fresh URL each run)
    "*.trycloudflare.com",],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
