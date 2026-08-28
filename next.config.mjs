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

    // Image Configuration: restrict to known trusted hosts only
    images: {
        remotePatterns: [
            // Supabase Storage (both projects)
            { protocol: 'https', hostname: 'cmjyqvyzxthnjnuxbufz.supabase.co' },
            { protocol: 'https', hostname: 'sevtycwrmhzyfxvxkkgc.supabase.co' },
            // Google profile pictures (OAuth sign-in)
            { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
            // Google user content (additional OAuth avatar domains)
            { protocol: 'https', hostname: '*.googleusercontent.com' },
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