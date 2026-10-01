import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { ToastProvider } from "../src/lib/ToastContext";
import "./globals.css";

const inter = Inter({
    subsets: ["latin"],
    variable: '--font-inter',
    weight: ['300', '400', '500', '600']
});

const playfair = Playfair_Display({
    subsets: ["latin"],
    variable: '--font-playfair',
    weight: ['400', '600', '700']
});

export const metadata: Metadata = {
    metadataBase: new URL('https://krishnafluteacademy.com'),
    title: "Krishna Flute Academy",
    description: "Learn Indian classical bansuri with Krishna Gopal Bhaumik at Krishna Flute Academy. Professional courses, handcrafted flutes, practice tools, and a growing music community.",
    openGraph: {
        title: "Krishna Flute Academy",
        description: "Learn Indian classical bansuri with Krishna Gopal Bhaumik at Krishna Flute Academy. Professional courses, handcrafted flutes, and more.",
        url: "https://krishnafluteacademy.com",
        siteName: "Krishna Flute Academy",
        images: [
            {
                url: "/og-image.jpg",
                width: 1200,
                height: 630,
                alt: "Krishna Flute Academy",
            },
        ],
        locale: "en_US",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Krishna Flute Academy",
        description: "Learn Indian classical bansuri with Krishna Gopal Bhaumik at Krishna Flute Academy",
        images: ["/og-image.jpg"],
    },
};

import AutoLogoutProvider from "../src/components/AutoLogoutProvider";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${playfair.variable}`}>
            <head>
                <link rel="manifest" href="/manifest.json" />
                <meta name="theme-color" content="#FAF6F0" />
                <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
            </head>
            <body className={`${inter.className} antialiased font-sans`}>
                <ToastProvider>
                    <AutoLogoutProvider>
                        {children}
                    </AutoLogoutProvider>
                </ToastProvider>
            </body>
        </html>
    );
}
