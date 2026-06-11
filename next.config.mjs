/** @type {import('next').NextConfig} */
const nextConfig = {

    // Trailing Slash: Required for correct routing on static hosts (GitHub Pages)
    trailingSlash: true,

    // Image Configuration: unoptimized required for static export
    images: {
        unoptimized: true,
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },

    // Optimization for Supabase Client
    serverExternalPackages: ['@supabase/supabase-js'],

    async rewrites() {
        return [
            {
                source: '/admin-dashboard/:path*',
                destination: '/teacher-dashboard/:path*',
            },
        ];
    },
};

export default nextConfig;