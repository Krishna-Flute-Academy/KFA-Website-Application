import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
    dest: "public",
    cacheOnFrontEndNav: true,
    aggressiveFrontEndNavCaching: true,
    reloadOnOnline: true,
    swcMinify: true,
    disable: process.env.NODE_ENV === "development",
    workboxOptions: {
        disableDevLogs: true,
    },
});

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

export default withPWA(nextConfig);