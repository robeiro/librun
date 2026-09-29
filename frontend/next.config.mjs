/** @type {import('next').NextConfig} */
const rawBackend = process.env.BACKEND_URL || "http://127.0.0.1:8000";
// Clean any trailing slashes and trailing /api to ensure destination is always properly formatted
const backendUrl = rawBackend.trim().replace(/\/+$/, "").replace(/\/api$/, "");

const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
