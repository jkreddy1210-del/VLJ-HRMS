/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },

  // Next.js 14 requires outputFileTracingIncludes under experimental.
  // Prisma's client engine loads these assets at runtime from the generated client directory.
  experimental: {
    outputFileTracingIncludes: {
      "/api/auth/login": [
        "./src/generated/prisma/**/*",
      ],
      "/api/**/*": [
        "./src/generated/prisma/**/*",
      ],
      "/*": [
        "./src/generated/prisma/**/*",
      ],
    },
  },
};

module.exports = nextConfig;
