/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',   // self-host friendly: node server bundle for Docker
  transpilePackages: ['@heva/catalog'],   // shared TS source consumed directly
};

export default nextConfig;
