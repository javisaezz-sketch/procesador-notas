require('dotenv').config({ path: '.env' });

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/articulos/[id]/publicar': ['./lib/logos-aviso/**/*'],
  },
};

module.exports = nextConfig;
