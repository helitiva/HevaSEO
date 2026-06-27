/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',   // self-host friendly: node server bundle for Docker
  transpilePackages: ['@heva/catalog'],   // shared TS source consumed directly
  experimental: {
    // Tree-shake barrel imports so only the used members ship to the client bundle.
    optimizePackageImports: ['react-simple-maps'],
  },
};

export default nextConfig;
