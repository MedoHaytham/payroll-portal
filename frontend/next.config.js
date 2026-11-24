/** @type {import('next').NextConfig} */
module.exports = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${process.env.API_URL || 'http://localhost:5000'}/api/:path*` }];
  },
};
