import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Warning: This allows production builds to successfully complete even if
    // your project has TypeScript errors.
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Fallback for node modules in browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        https: false,
        http: false,
        stream: false,
        crypto: false,
        os: false,
        path: false,
        zlib: false,
      };
    }
    
    // Exclude pptxgenjs from server-side bundling
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('pptxgenjs');
    }
    
    return config;
  },
};

export default nextConfig;
