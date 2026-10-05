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

  // Prisma Client uses the query compiler WASM files from the custom
  // src/generated/prisma output directory. Next.js/Vercel's file tracing
  // does not reliably include these non-JS assets automatically.
  outputFileTracingIncludes: {
    "/*": [
      "./src/generated/prisma/query_compiler_bg.wasm",
      "./src/generated/prisma/query_compiler_bg.js",
    ],
  },
};

module.exports = nextConfig;
