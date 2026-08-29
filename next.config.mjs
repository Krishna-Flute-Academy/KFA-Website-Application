import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
    dest: "public",
    // Disabled aggressive caching to ensure real-time data and dashboard updates always show fresh content
    cacheOnFrontEndNav: false,
    aggressiveFrontEndNavCaching: false,
    reloadOnOnline: true,
    swcMinify: true,
    disable: process.env.NODE_ENV === "development",
    workboxOptions: {
        disableDevLogs: true,
    },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Vercel handles trailing slashes natively, enforcing it can cause redirect loops.

    // Image Configuration: allow images from any remote host
    images: {
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

    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Cross-Origin-Opener-Policy',
                        value: 'same-origin-allow-popups',
                    },
                ],
            },
        ];
    },
};

export default withPWA(nextConfig);