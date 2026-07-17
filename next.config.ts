import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
