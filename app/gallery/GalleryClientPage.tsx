'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { GalleryFull } from '../../src/components/GalleryFull';

export default function GalleryClientPage() {
    const router = useRouter();
    return <GalleryFull onBack={() => router.push('/')} />;
}
