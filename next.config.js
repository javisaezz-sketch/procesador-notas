require('dotenv').config({ path: '.env' });

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/articulos/[id]/publicar': ['./lib/logos-aviso/**/*'],
    '/api/pipeline/ejecutar': ['./lib/**/*'],
  },
};

module.exports = nextConfig;
