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
    metadataBase: new URL('https://www.krishnafluteacademy.com'),
    title: "Krishna Flute Academy",
    description: "Learn the divine art of flute playing with Guru Krishna Flute Academy. Professional courses, handcrafted flutes, and musical wisdom.",
    openGraph: {
        title: "Krishna Flute Academy",
        description: "Learn the divine art of flute playing. Professional courses, handcrafted flutes, and more.",
        url: "https://krishnafluteacademy.com",
        siteName: "Krishna Flute Academy",
        images: [
            {
                url: "/Toppic.jpg",
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
        description: "Learn the divine art of flute playing",
        images: ["/Toppic.jpg"],
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${playfair.variable}`}>
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
            </head>
            <body className={`${inter.className} antialiased font-sans`}>
                <ToastProvider>
                    {children}
                </ToastProvider>
            </body>
        </html>
    );
}
