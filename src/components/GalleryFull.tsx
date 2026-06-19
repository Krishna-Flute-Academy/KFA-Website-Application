import React, { useState, useEffect } from 'react';
import { ChevronLeft, ImageIcon, Play, ExternalLink } from 'lucide-react';
import { supabase, GalleryItem } from '../lib/supabase';

interface GalleryFullProps {
    onBack: () => void;
}

export const GalleryFull: React.FC<GalleryFullProps> = ({ onBack }) => {
    const [items, setItems] = useState<GalleryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
    const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);

    const staticVideos: GalleryItem[] = [
        "https://www.youtube.com/embed/1SF2AYK_Y-U?si=9QssT5N4X6GrE8yp",
        "https://www.youtube.com/embed/jrz4YTyANsE",
        "https://www.youtube.com/embed/OlPvQ2ojRcU",
        "https://www.youtube.com/embed/XsvP3Ol72x0",
        "https://www.youtube.com/embed/UEaQLUkPA_I",
        "https://www.youtube.com/embed/-kk1RtiPcZ4",
        "https://www.youtube.com/embed/islvJvQOcN4",
        "https://www.youtube.com/embed/rRl_fMQ5KJU",
        "https://www.youtube.com/embed/it8A9OVHp7o",
        "https://www.youtube.com/embed/1lcKaTXy8Ko"
    ].map((url, index) => ({
        id: `static-full-${index}`,
        title: null,
        description: null,
        media_type: 'video-url',
        url: url,
        thumbnail_url: null,
        is_active: true,
        sort_order: 1000 + index,
        created_at: new Date(0).toISOString() // Oldest first for now, or use a specific date
    }));

    useEffect(() => {
        const fetchGallery = async () => {
            setLoading(true);
            const { data } = await supabase
                .from('gallery_items')
                .select('*')
                .eq('is_active', true)
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: false });

            // Merge dynamic items with static ones
            const dynamicItems = (data || []).filter(item => item && typeof item === 'object' && item.url);
            setItems([...dynamicItems, ...staticVideos]);
            setLoading(false);
        };

        fetchGallery();
        window.scrollTo(0, 0);
    }, []);

    const filteredItems = items.filter(item => {
        if (filter === 'all') return true;
        if (filter === 'image') return item.media_type === 'image';
        if (filter === 'video') return item.media_type === 'video-url' || item.media_type === 'video-file';
        return true;
    });

    const getYouTubeThumbnail = (url: string) => {
        let id = '';
        if (url.includes('youtube.com/embed/')) {
            id = url.split('embed/')[1].split('?')[0];
        } else if (url.includes('youtube.com/watch?v=')) {
            id = url.split('v=')[1].split('&')[0];
        } else if (url.includes('youtu.be/')) {
            id = url.split('/').pop()?.split('?')[0] || '';
        }
        return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
    };

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-blue-600 font-bold hover:text-blue-800 transition-colors self-start md:self-auto"
                    >
                        <ChevronLeft size={24} /> Back to Home
                    </button>

                    <div className="text-center">
                        <h1 className="text-4xl md:text-5xl font-bold text-blue-900 mb-2">Performance Gallery</h1>
                        <p className="text-blue-600">Explore our musical journey and student achievements</p>
                    </div>

                    <div className="flex bg-white p-1 rounded-xl shadow-md border border-gray-100">
                        {(['all', 'image', 'video'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${filter === f
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'text-gray-500 hover:text-blue-600 hover:bg-gray-50'
                                    }`}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)}s
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-blue-800 font-medium">Loading gallery...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                        {filteredItems.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => setSelectedItem(item)}
                                className="group relative bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500 transform hover:scale-[1.02] cursor-pointer"
                            >
                                <div className="aspect-[4/3] relative bg-gray-100">
                                    {item.media_type === 'image' ? (
                                        <img src={item.url} alt={item.title || ''} className="w-full h-full object-cover" loading="lazy" />
                                    ) : item.media_type === 'video-url' ? (
                                        <div className="w-full h-full">
                                            <img
                                                src={getYouTubeThumbnail(item.url) || ''}
                                                alt={item.title || ''}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                                onError={(e) => {
                                                    // Fallback if maxresdefault fails
                                                    const target = e.target as HTMLImageElement;
                                                    if (target.src.includes('mqdefault')) {
                                                        target.style.display = 'none';
                                                    } else {
                                                        target.src = target.src.replace('maxresdefault', 'mqdefault');
                                                    }
                                                }}
                                            />
                                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/40 transition-all">
                                                <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform">
                                                    <Play className="w-6 h-6 text-blue-600 ml-1 fill-current" />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative w-full h-full">
                                            {item.thumbnail_url ? (
                                                <img src={item.thumbnail_url} alt={item.title || ''} className="w-full h-full object-cover" />
                                            ) : (
                                                <video
                                                    src={`${item.url}#t=1`}
                                                    className="w-full h-full object-cover"
                                                    preload="metadata"
                                                />
                                            )}
                                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/40 transition-all">
                                                <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform">
                                                    <Play className="w-6 h-6 text-blue-600 ml-1 fill-current" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-2 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                        {item.media_type === 'image' ? <ImageIcon className="w-4 h-4 text-blue-600" /> : <Play className="w-4 h-4 text-blue-600" />}
                                    </div>
                                </div>

                                {(item.title || item.description) && (
                                    <div className="p-4">
                                        {item.title && <h3 className="font-bold text-blue-900 text-lg line-clamp-1">{item.title}</h3>}
                                        {item.description && <p className="text-gray-500 text-sm mt-1 line-clamp-2">{item.description}</p>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {!loading && filteredItems.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-dashed border-gray-200 mt-12">
                        <ImageIcon className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-500 text-xl font-medium">No items found for this filter.</p>
                    </div>
                )}
            </div>

            {/* Lightbox */}
            {selectedItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fadeIn">
                    <button
                        onClick={() => setSelectedItem(null)}
                        className="absolute top-6 right-6 text-white hover:text-gray-300 transition-colors z-[110]"
                    >
                        <ChevronLeft size={32} className="rotate-90 md:rotate-0" />
                    </button>

                    <div className="relative max-w-6xl w-full max-h-[90vh] flex flex-col items-center justify-center animate-scaleIn">
                        <div className="w-full relative rounded-2xl overflow-hidden shadow-2xl bg-black">
                            {selectedItem.media_type === 'image' ? (
                                <img src={selectedItem.url} alt={selectedItem.title || ''} className="max-w-full max-h-[80vh] mx-auto object-contain" />
                            ) : selectedItem.media_type === 'video-url' ? (
                                <div className="aspect-video w-full">
                                    <iframe
                                        className="w-full h-full"
                                        src={(() => {
                                            let url = selectedItem.url;
                                            if (url.includes('youtube.com/watch?v=')) {
                                                url = url.replace('watch?v=', 'embed/').split('&')[0];
                                            } else if (url.includes('youtu.be/')) {
                                                const id = url.split('/').pop()?.split('?')[0];
                                                url = `https://www.youtube.com/embed/${id}`;
                                            }
                                            return url;
                                        })()}
                                        title={selectedItem.title || "Video Player"}
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    ></iframe>
                                </div>
                            ) : (
                                <video
                                    src={selectedItem.url}
                                    controls
                                    autoPlay
                                    className="max-w-full max-h-[80vh] mx-auto"
                                />
                            )}
                        </div>

                        {(selectedItem.title || selectedItem.description) && (
                            <div className="mt-8 text-center text-white max-w-3xl">
                                {selectedItem.title && <h3 className="text-3xl font-bold mb-3 bg-gradient-to-r from-blue-400 to-yellow-400 bg-clip-text text-transparent">{selectedItem.title}</h3>}
                                {selectedItem.description && <p className="text-lg text-gray-300 leading-relaxed font-light">{selectedItem.description}</p>}

                                {selectedItem.media_type === 'video-url' && (
                                    <a
                                        href={selectedItem.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 mt-6 text-yellow-500 hover:text-yellow-400 font-bold transition-colors"
                                    >
                                        Watch on Source <ExternalLink size={18} />
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
