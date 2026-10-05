/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },

  // Keep Prisma's client-side query compiler assets inside Vercel's serverless bundle.
  outputFileTracingIncludes: {
    "/*": [
      "./src/generated/prisma/query_compiler_bg.wasm",
      "./src/generated/prisma/query_compiler_bg.js",
      "./src/generated/prisma/wasm.js",
      "./src/generated/prisma/wasm-edge-light-loader.mjs",
      "./src/generated/prisma/wasm-worker-loader.mjs",
    ],
  },
};

module.exports = nextConfig;
