/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure external image domains
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
        port: '',
        pathname: '/maps/api/place/photo**',
      },
      {
        protocol: 'https',
        hostname: 'places.googleapis.com',
        port: '',
        pathname: '/v1/places/**/photos/**/media**',
      },
    ],
  },
  
  // External packages for server components
  serverExternalPackages: ['@googlemaps/google-maps-services-js'],
  
  // Allow access from local network devices during development
  // Note: allowedDevOrigins is not available in current Next.js version
  // Using headers instead for CORS support
  
  // Optional: Add CORS headers for development
  async headers() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'Access-Control-Allow-Origin',
              value: '*'
            },
            {
              key: 'Access-Control-Allow-Methods',
              value: 'GET, POST, PUT, DELETE, OPTIONS'
            },
            {
              key: 'Access-Control-Allow-Headers',
              value: 'Content-Type, Authorization'
            }
          ]
        }
      ]
    }
    return []
  }
}

module.exports = nextConfig
