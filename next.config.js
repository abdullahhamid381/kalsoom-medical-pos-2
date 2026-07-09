/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  optimizeFonts: false,
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'whatsapp-web.js', 'puppeteer', 'pdfkit', 'bwip-js']
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), 'better-sqlite3'];
    return config;
  }
};

module.exports = nextConfig;
