'use client';

import { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import {
    Music, Download, Users, Award, Phone, Mail, MapPin, Star,
    SignalLow, SignalMedium, SignalHigh, BookOpen, Heart, Sparkles,
    Facebook, Instagram, Youtube, MessageSquare, ChevronRight, Menu, X,
    Lock, ExternalLink, Share2, User, Play
} from 'lucide-react';

// Use dynamic imports for client components to ensure they only load on the client
const Blog = dynamic(() => import('../src/components/Blog').then(module => module.Blog), { ssr: false });
const BlogAdmin = dynamic(() => import('../src/components/BlogAdmin').then(module => module.BlogAdmin), { ssr: false });
const GalleryFull = dynamic(() => import('../src/components/GalleryFull').then(module => module.GalleryFull), { ssr: false });

import { supabase, BlogPost, GalleryItem } from '../src/lib/supabase';
import { supabaseAuth } from '../src/lib/supabase-auth';
import { Carousel } from 'react-responsive-carousel';
import "react-responsive-carousel/lib/styles/carousel.min.css";
import { useSearchParams } from 'next/navigation';

const heroImages = [
    `/Toppic.jpg`,
    `/hero-image-1.jpg`,
    `/hero-image-2.jpg`,
];

const formatDateString = (dateString: string) => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Recent';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

// Blog Section Component
const BlogSection = ({
    visible,
    posts,
    onViewAll,
    onReadPost
}: {
    visible: boolean;
    posts: BlogPost[];
    onViewAll: () => void;
    onReadPost: (id: string) => void;
}) => {

    // 👇 Helper to copy link without opening the post
    const handleCopyLink = (e: React.MouseEvent, slug: string) => {
        e.stopPropagation();
        const url = `${window.location.origin}/blog/${slug}`;
        navigator.clipboard.writeText(url).then(() => alert("Link copied to clipboard!"));
    };

    if (!posts || posts.length === 0) {
        return (
            <section id="blog" className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 bg-blue-50/50">
                <div className="max-w-7xl mx-auto">
                    <div className={`text-center mb-16 transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-blue-900 mb-4">Our Latest Insights</h2>
                        <div className="w-20 h-1 bg-gradient-to-r from-yellow-500 to-blue-500 mx-auto mb-6"></div>
                        <p className="text-lg md:text-xl text-blue-700 max-w-3xl mx-auto">Check back soon for articles.</p>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section id="blog" className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 bg-blue-50/50">
            <div className="max-w-7xl mx-auto">
                <div className={`text-center mb-16 transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}>
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-blue-900 mb-4">Our Latest Insights</h2>
                    <div className="w-20 h-1 bg-gradient-to-r from-yellow-500 to-blue-500 mx-auto mb-6"></div>
                    <p className="text-lg md:text-xl text-blue-700 max-w-3xl mx-auto">In-depth articles and guides from our master musicians.</p>
                </div>

                {/* Horizontal Scroll Container */}
                <div className="flex overflow-x-auto pb-8 gap-6 snap-x snap-mandatory scroll-smooth no-scrollbar">
                    {posts.map((post, index) => (
                        <div
                            key={post.id}
                            onClick={() => onReadPost(post.slug || post.id)}
                            className={`relative block bg-white rounded-2xl shadow-xl overflow-hidden transform hover:scale-[1.02] transition-all duration-500 hover:shadow-2xl group cursor-pointer 
                                flex-shrink-0 w-[85vw] sm:w-[350px] md:w-[400px] snap-center
                                ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                            style={{ transitionDelay: `${index * 150}ms` }}
                        >
                            {post.featured_image && (
                                <div className="relative h-48 overflow-hidden">
                                    <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-blue-900/10 group-hover:bg-blue-900/20 transition-all"></div>
                                    <button onClick={(e) => handleCopyLink(e, post.slug || post.id)} className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white text-blue-600 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10" title="Copy Link">
                                        <Share2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                            <div className="p-6 space-y-3">
                                <h3 className="text-xl lg:text-2xl font-bold text-blue-900 group-hover:text-blue-700 transition-colors line-clamp-2 whitespace-normal">{post?.title || 'Untitled Post'}</h3>
                                <p className="text-sm md:text-base text-blue-800 leading-relaxed line-clamp-3 whitespace-normal">{post?.excerpt || ''}</p>
                                <div className="flex items-center justify-between text-xs text-blue-600 pt-2">
                                    <span>{post?.created_at ? formatDateString(post.created_at) : 'Recent'}</span>
                                    <span className="flex items-center space-x-1"><span>{post?.view_count || 0} views</span></span>
                                </div>
                                <span className="flex items-center space-x-2 text-sm font-semibold text-yellow-600 group-hover:text-yellow-700 transition-colors pt-2">
                                    <span>Read Article</span><ChevronRight className="w-4 h-4" />
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="text-center mt-12">
                    <button onClick={onViewAll} className="bg-blue-700 text-white px-8 py-3 rounded-full text-lg font-semibold hover:bg-blue-800 transition-all shadow-xl">
                        Explore All Articles <BookOpen className="inline-block w-5 h-5 ml-2" />
                    </button>
                </div>
            </div>
        </section>
    );
};

export function PageClient({ 
    initialPosts = [], 
    initialEvent = null, 
    initialTestimonials = [], 
    initialGallery = [] 
}: { 
    initialPosts?: BlogPost[], 
    initialEvent?: any, 
    initialTestimonials?: any[], 
    initialGallery?: GalleryItem[] 
}) {
    const searchParams = useSearchParams();
    const postFromUrl = searchParams.get('post');

    // Redirect legacy /?post=slug URLs to /blog/slug/ so WhatsApp previews
    // use the correct OG metadata (featured image + excerpt) from the blog page.
    useEffect(() => {
        if (postFromUrl) {
            window.location.replace(`/blog/${postFromUrl}/`);
        }
    }, [postFromUrl]);

    const [scrolled, setScrolled] = useState(false);
    const [userSession, setUserSession] = useState<any>(null);
    const [userRole, setUserRole] = useState<string | null>(null);

    // Track auth session
    useEffect(() => {
        const checkSession = async () => {
            try {
                const { data: { session } } = await supabaseAuth.auth.getSession();
                setUserSession(session);
                if (session?.user) {
                    const { data: userData } = await supabaseAuth
                        .from('users')
                        .select('role')
                        .eq('id', session.user.id)
                        .maybeSingle();
                    if (userData?.role) {
                        setUserRole(userData.role);
                    } else {
                        setUserRole(session.user.user_metadata?.role || 'student');
                    }
                }
            } catch (err) {
                console.error('Error fetching session:', err);
            }
        };

        checkSession();

        const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange(async (_event, session) => {
            setUserSession(session);
            if (session?.user) {
                try {
                    const { data } = await supabaseAuth
                        .from('users')
                        .select('role')
                        .eq('id', session.user.id)
                        .maybeSingle();
                    if (data?.role) {
                        setUserRole(data.role);
                    } else {
                        setUserRole(session.user.user_metadata?.role || 'student');
                    }
                } catch (err) {
                    console.error('Error getting role on auth change:', err);
                    setUserRole(session.user.user_metadata?.role || 'student');
                }
            } else {
                setUserRole(null);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const getDashboardLink = () => {
        if (!userSession) return '/login';
        const role = userRole?.toLowerCase();
        if (role === 'admin') return '/teacher-dashboard';
        if (role === 'teacher') return '/teacher-dashboard';
        return '/student-dashboard';
    };

    const getAuthButtonLabel = () => {
        return 'Login';
    };

    const [visibleSections, setVisibleSections] = useState<Record<string, boolean>>({});
    const [currentView, setCurrentView] = useState<'home' | 'blog' | 'admin' | 'gallery'>('home');
    const [recentBlogPosts, setRecentBlogPosts] = useState<BlogPost[]>(initialPosts);
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminPassword, setAdminPassword] = useState('');
    const [showAdminLogin, setShowAdminLogin] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
    const [formName, setFormName] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [formCourse, setFormCourse] = useState('Select a course');
    const [formMessage, setFormMessage] = useState('');
    const [activeEvent, setActiveEvent] = useState<{ title: string, registration_link: string, image_url?: string, button_text?: string, description?: string } | null>(initialEvent);
    const [showEventPopup, setShowEventPopup] = useState(false);
    const [bannerClosed, setBannerClosed] = useState(false);
    const [testimonials, setTestimonials] = useState<any[]>(initialTestimonials);
    const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(initialGallery);
    const [selectedGalleryItem, setSelectedGalleryItem] = useState<GalleryItem | null>(null);

    // Show event popup if there is an active event
    useEffect(() => {
        if (initialEvent) {
            const timer = setTimeout(() => setShowEventPopup(true), 5000);
            return () => clearTimeout(timer);
        }
    }, [initialEvent]);

    // While redirecting, show a spinner so nothing flashes
    if (postFromUrl) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

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

    // 1. Unified Scroll & Visibility Listener
    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
            const sections = ['about', 'founder', 'courses', 'contact', 'flutes', 'gallery', 'blog'];
            const newVisibleSections: Record<string, boolean> = {};
            sections.forEach(sectionId => {
                const element = document.getElementById(sectionId);
                if (element) {
                    const rect = element.getBoundingClientRect();
                    const isInViewport = rect.top < window.innerHeight * 0.75 && rect.bottom > 0;
                    newVisibleSections[sectionId] = isInViewport;
                }
            });
            setVisibleSections(newVisibleSections);
        };
        window.addEventListener('scroll', handleScroll);
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Removed Client-side Data Fetching block. Data is now fetched server-side in page.tsx!

    // 3. Admin Shortcut
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey && event.shiftKey && event.key === 'A') {
                event.preventDefault();
                setShowAdminLogin(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const scrollToSection = (sectionId: string) => {
        const element = document.getElementById(sectionId);
        element?.scrollIntoView({ behavior: 'smooth' });
        setMobileMenuOpen(false);
    };

    const socialLinks = {
        facebook: 'https://www.facebook.com/krishnafluteacademy/',
        instagram: 'https://www.instagram.com/krishnafluteacademy?igsh=MWw0NjZsNms2czN1aw==',
        youtube: 'https://www.youtube.com/@krishnafluteacademy'
    };

    const mapEmbedUrl = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3889.3510000000003!2d77.656832!3d12.885108!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bae6ca3e5e5e5e5%3A0x8e5e5e5e5e5e5e5e!2sElectronic%20City%20Phase%201%2C%20Bengaluru%2C%20Karnataka!5e0!3m2!1sen!2sin!4v1620000000000!5m2!1sen!2sin";
    const mapLinkUrl = `https://maps.app.goo.gl/Xumte2BGx8FwLijg8`;
    const whatsappNumber = '919836952545';
    const baseWhatsappUrl = `https://wa.me/${whatsappNumber}?text=`;

    const handleWhatsAppSubmit = async () => {
        if (!formName || !formPhone) {
            alert("Please enter your Name and Phone number.");
            return;
        }

        supabase
            .from('inquiries')
            .insert([{
                name: formName,
                email: formEmail,
                phone: formPhone,
                course: formCourse,
                message: formMessage
            }])
            .then(({ error }) => {
                if (error) console.error('Error saving inquiry:', error);
            });

        const messageDetails = `
Hello Krishna Flute Academy, I have an inquiry!

*Name:* ${formName}
*Email:* ${formEmail}
*Phone:* ${formPhone}
*Course Interest:* ${formCourse}
*Message:* ${formMessage}
        `.trim();

        const finalWhatsappUrl = `${baseWhatsappUrl}${encodeURIComponent(messageDetails)}`;
        window.location.href = finalWhatsappUrl;
    };

    const handleAdminLogin = () => {
        if (adminPassword === 'kfa-admin-2025') {
            setIsAdmin(true);
            setShowAdminLogin(false);
            setAdminPassword('');
            setCurrentView('admin');
        } else {
            alert('Invalid admin password');
        }
    };

    const handleAdminLogout = () => {
        setIsAdmin(false);
        setCurrentView('home');
    };

    const renderHomeView = () => {
        const isBannerVisible = activeEvent && !bannerClosed;

        return (
            <div className="overflow-x-hidden">
                {isBannerVisible && (
                    <div className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white px-4 py-2 md:py-3 shadow-lg flex justify-between items-center h-12 md:h-14 animate-slideDown">
                        <div className="flex-1 flex items-center justify-center gap-2 md:gap-4">
                            {activeEvent?.image_url ? (
                                <img
                                    src={activeEvent.image_url}
                                    alt="Event"
                                    className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover border-2 border-white/50"
                                />
                            ) : (
                                <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-yellow-200 animate-pulse" />
                            )}

                            <span className="text-xs md:text-sm font-bold uppercase tracking-wide truncate max-w-[200px] md:max-w-none">
                                {activeEvent?.title}
                            </span>

                            <a
                                href={activeEvent?.registration_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-white text-red-600 text-xs md:text-sm font-extrabold px-3 py-1 md:px-4 md:py-1.5 rounded-full shadow-sm hover:bg-gray-100 transition-transform transform hover:scale-105 flex items-center gap-1"
                            >
                                {activeEvent.button_text || 'Register Now'}
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                        <button
                            onClick={() => setBannerClosed(true)}
                            className="ml-2 bg-black/20 p-1 rounded-full hover:bg-black/30 transition-colors"
                            aria-label="Close Banner"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}
                <nav
                    className={`fixed w-full z-50 transition-all duration-300 
                    ${isBannerVisible ? 'top-12 md:top-14' : 'top-0'} 
                    ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-lg py-2' : 'bg-white/90 backdrop-blur-md shadow-lg py-3'}
                `}
                >
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center h-16">
                            <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
                                <img
                                    src={'/image.png'}
                                    alt="Krishna Flute Academy Logo"
                                    className="h-8 w-8 min-[400px]:h-9 min-[400px]:w-9 sm:h-10 sm:w-10 md:h-12 md:w-12 object-contain shrink-0"
                                />
                                <span className="text-xs min-[360px]:text-sm sm:text-base md:text-lg font-black text-blue-900 tracking-tight whitespace-nowrap">Krishna Flute Academy</span>
                            </div>

                            <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
                                <button onClick={() => scrollToSection('about')} className="text-blue-700 hover:text-blue-900 transition-colors text-sm lg:text-base font-medium">About</button>
                                <button onClick={() => scrollToSection('founder')} className="text-blue-700 hover:text-blue-900 transition-colors text-sm lg:text-base font-medium">Founder</button>
                                <button onClick={() => scrollToSection('courses')} className="text-blue-700 hover:text-blue-900 transition-colors text-sm lg:text-base font-medium">Courses</button>
                                <button onClick={() => { setCurrentView('gallery'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-blue-700 hover:text-blue-900 transition-colors text-sm lg:text-base font-medium">Gallery</button>
                                <a href="/blog/" className="text-blue-700 hover:text-blue-900 transition-colors text-sm lg:text-base font-medium">Blog</a>
                                <button onClick={() => scrollToSection('contact')} className="text-blue-700 hover:text-blue-900 transition-colors text-sm lg:text-base font-medium">Contact</button>
                            </div>

                            <div className="flex items-center justify-end shrink-0">
                                <div className="hidden sm:flex items-center space-x-3 mr-5">
                                    <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="w-8 h-8 md:w-9 md:h-9 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 transition-all duration-300 transform hover:scale-110">
                                        <Facebook className="w-4 h-4 md:w-5 md:h-5 text-white" />
                                    </a>
                                    <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="w-8 h-8 md:w-9 md:h-9 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 rounded-full flex items-center justify-center hover:shadow-lg transition-all duration-300 transform hover:scale-110">
                                        <Instagram className="w-4 h-4 md:w-5 md:h-5 text-white" />
                                    </a>
                                    <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="w-8 h-8 md:w-9 md:h-9 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition-all duration-300 transform hover:scale-110">
                                        <Youtube className="w-4 h-4 md:w-5 md:h-5 text-white" />
                                    </a>
                                </div>

                                <div className="flex items-center">
                                    <a href={getDashboardLink()} className="flex items-center justify-center space-x-1 px-2.5 py-1.5 min-[400px]:space-x-1.5 min-[400px]:px-3.5 min-[400px]:py-2 sm:px-5 sm:py-2 bg-[#a15912] text-white rounded-full font-bold text-[10px] min-[400px]:text-xs md:text-sm transition-all duration-300 shadow-md hover:bg-[#8a4b0f] hover:scale-105 whitespace-nowrap">
                                        <User className="w-3 h-3 min-[400px]:w-3.5 min-[400px]:h-3.5 sm:w-4 sm:h-4" />
                                        <span>{getAuthButtonLabel()}</span>
                                    </a>
                                </div>

                                <button
                                    className="md:hidden p-1.5 ml-2 min-[400px]:p-2 min-[400px]:ml-3 rounded-lg hover:bg-gray-100 transition-colors text-blue-900"
                                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                    aria-label="Toggle Menu"
                                >
                                    {mobileMenuOpen ? <X className="w-5 h-5 min-[400px]:w-6 min-[400px]:h-6" /> : <Menu className="w-5 h-5 min-[400px]:w-6 min-[400px]:h-6" />}
                                </button>

                                {isAdmin && (
                                    <div className="hidden md:flex items-center space-x-2 ml-4">
                                        <span className="text-xs text-green-600 font-semibold bg-green-50 px-2 py-1 rounded">Admin</span>
                                        <button
                                            onClick={handleAdminLogout}
                                            className="text-xs text-red-600 hover:text-red-800 transition-colors px-2 py-1 rounded hover:bg-red-50"
                                            title="Logout from admin"
                                        >
                                            Logout
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </nav>
                {mobileMenuOpen && (
                    <div className={`fixed inset-0 z-[55] md:hidden ${isBannerVisible ? 'top-12 md:top-14' : 'top-0'}`}>
                        <div
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                            onClick={() => setMobileMenuOpen(false)}
                        />
                        <div className="absolute top-0 right-0 w-3/4 max-w-sm h-full bg-white shadow-2xl transform transition-transform duration-300">
                            <div className="p-6">
                                <div className="flex justify-end mb-8">
                                    <button
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    <button onClick={() => { scrollToSection('about'); setMobileMenuOpen(false); }} className="block w-full text-left text-lg font-semibold text-blue-900 transition-colors py-2">About</button>
                                    <button onClick={() => { scrollToSection('founder'); setMobileMenuOpen(false); }} className="block w-full text-left text-lg font-semibold text-blue-900 transition-colors py-2">Founder</button>
                                    <button onClick={() => { scrollToSection('courses'); setMobileMenuOpen(false); }} className="block w-full text-left text-lg font-semibold text-blue-900 transition-colors py-2">Courses</button>
                                    <button onClick={() => { setCurrentView('gallery'); setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="block w-full text-left text-lg font-semibold text-blue-900 transition-colors py-2">Gallery</button>
                                    <a href="/blog/" className="block w-full text-left text-lg font-semibold text-blue-900 transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>Blog</a>
                                    <button onClick={() => { scrollToSection('contact'); setMobileMenuOpen(false); }} className="block w-full text-left text-lg font-semibold text-blue-900 transition-colors py-2">Contact</button>
                                    <a href={getDashboardLink()} className="block w-full text-left text-lg font-semibold text-blue-900 transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>{getAuthButtonLabel()}</a>
                                    {userSession && (
                                        <button
                                            onClick={async () => {
                                                await supabaseAuth.auth.signOut();
                                                setMobileMenuOpen(false);
                                                window.location.reload();
                                            }}
                                            className="block w-full text-left text-lg font-semibold text-red-600 transition-colors py-2"
                                        >
                                            Logout
                                        </button>
                                    )}

                                    <div className="pt-6 border-t border-gray-200">
                                        <div className="flex space-x-4">
                                            <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center transition-all duration-300"><Facebook className="w-5 h-5 text-white" /></a>
                                            <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 rounded-full flex items-center justify-center transition-all duration-300"><Instagram className="w-5 h-5 text-white" /></a>
                                            <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center transition-all duration-300"><Youtube className="w-5 h-5 text-white" /></a>
                                        </div>
                                    </div>

                                    {isAdmin && (
                                        <div className="pt-6 border-t border-gray-200">
                                            <div className="space-y-3">
                                                <span className="text-sm text-green-600 font-semibold bg-green-50 px-3 py-1 rounded">Admin</span>
                                                <button onClick={handleAdminLogout} className="block w-full text-left text-sm text-red-600 transition-colors px-3 py-2 rounded hover:bg-red-50">Logout from Admin</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {showEventPopup && activeEvent && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowEventPopup(false)}></div>
                        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scaleIn">
                            <button onClick={() => setShowEventPopup(false)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70 z-10"><X className="w-5 h-5" /></button>
                            {activeEvent.image_url && <img src={activeEvent.image_url} alt={activeEvent.title} className="w-full h-auto object-cover" />}
                            <div className="p-6 text-center">
                                <h3 className="text-2xl font-bold text-blue-900 mb-2">{activeEvent.title}</h3>
                                <p className="text-gray-600 mb-6 text-sm">{activeEvent.description || "Join us for this special event!"}</p>
                                <a href={activeEvent.registration_link} target="_blank" rel="noopener noreferrer" className="block w-full bg-yellow-500 text-blue-900 font-extrabold py-3 rounded-full shadow-lg hover:bg-yellow-400 transition-transform transform hover:scale-105">
                                    {activeEvent.button_text || 'Register Now'}
                                </a>
                            </div>
                        </div>
                    </div>
                )}
                <section className={`relative overflow-hidden transition-all duration-300
                ${isBannerVisible ? 'pt-28 md:pt-34' : 'pt-16 md:pt-20'} 
                pb-0 px-0 sm:px-0`}
                >
                    <Carousel autoPlay={true} infiniteLoop={true} showThumbs={false} showStatus={false} interval={5000} className="w-full">
                        {heroImages.map((imageUrl, index) => (
                            <div key={index} className="relative w-full h-[350px] sm:h-[450px] md:h-[550px]">
                                <img src={imageUrl} alt={`Hero Slide ${index + 1}`} className="w-full h-full object-cover" loading={index === 0 ? "eager" : "lazy"} />
                                <div className="absolute inset-0 bg-black/40"></div>
                                <div className="absolute inset-0 flex flex-col justify-center items-start text-left text-white p-6 sm:p-12 md:pl-24 font-montserrat z-10">
                                    <div className="space-y-2 md:space-y-4">
                                        {index === 0 && (
                                            <>
                                                <p className="text-xs md:text-2xl font-light tracking-[0.35em] uppercase text-gray-300">LEARN FLUTE</p>
                                                <h1 className="text-3xl sm:text-5xl md:text-7xl leading-tight">
                                                    <span className="font-bold" style={{ fontWeight: 600, letterSpacing: '-0.01em' }}>Krishna</span><br />
                                                    <span className="font-bold" style={{ fontWeight: 600, letterSpacing: '-0.01em' }}>Flute Academy</span>
                                                </h1>
                                                <p className="text-sm md:text-xl font-medium text-yellow-400 tracking-wide">With Krishna Gopal Bhaumik</p>
                                            </>
                                        )}
                                        {index === 1 && (
                                            <>
                                                <p className="text-xs md:text-2xl font-light tracking-[0.35em] uppercase text-gray-300">LEARN FLUTE</p>
                                                <h1 className="text-xl sm:text-5xl md:text-7xl leading-tight">
                                                    <span className="font-serif italic font-light">Turn Your Breath</span><br />
                                                    <span className="font-bold" style={{ fontWeight: 600, letterSpacing: '-0.01em' }}>Into Tune</span>
                                                </h1>
                                                <p className="text-xs md:text-xl font-medium text-yellow-400 tracking-wide">With Krishna Gopal Bhaumik</p>
                                            </>
                                        )}
                                        {index === 2 && (
                                            <>
                                                <p className="text-xs md:text-2xl font-light tracking-[0.35em] uppercase text-gray-300">LEARN FLUTE</p>
                                                <h1 className="text-2xl sm:text-5xl md:text-7xl leading-tight">
                                                    <span className="font-serif italic font-light">From Basics</span><br />
                                                    <span className="font-bold" style={{ fontWeight: 600, letterSpacing: '-0.01em' }}>To Advanced</span>
                                                </h1>
                                                <p className="text-sm md:text-xl font-medium text-yellow-400 tracking-wide">With Krishna Gopal Bhaumik</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </Carousel>
                </section>

                <div className="w-full h-px bg-gradient-to-r from-transparent via-blue-300 to-transparent"></div>

                <section id="about" className="py-20 px-4 sm:px-6 lg:px-8 bg-white/50">
                    <div className="max-w-6xl mx-auto">
                        <div className={`text-center mb-16 transform transition-all duration-1000 ${visibleSections['about'] ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
                            <h2 className="text-4xl md:text-5xl font-bold text-blue-900 mb-6">Why Choose Us</h2>
                            <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-yellow-500 mx-auto mb-8"></div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                            <div className={`space-y-4 md:space-y-6 transform transition-all duration-1000 delay-200 ${visibleSections['about'] ? 'translate-x-0 opacity-100' : '-translate-x-20 opacity-0'}`}>
                                <p className="text-base md:text-lg text-blue-800 leading-loose max-w-prose">
                                    Our commitment goes beyond weekly lessons. We host immersive <strong>Workshops and Weekly Challenges</strong> designed specifically to keep students motivated and focused on rapid improvement.
                                </p>
                                <p className="text-base md:text-lg text-blue-800 leading-loose max-w-prose">
                                    More importantly, we provide consistent opportunities for <strong>stage performance</strong>, including participation in events like the Flute and Fest. This real-world experience is fundamental to enhancing skills, building confidence, and ensuring sustained engagement in the student's musical development.
                                </p>
                            </div>

                            <div className={`relative transform transition-all duration-1000 delay-400 ${visibleSections['about'] ? 'translate-y-0 opacity-100' : 'translate-x-20 opacity-0'}`}>
                                <div className="bg-gradient-to-br from-blue-200 to-yellow-200 rounded-2xl p-6 md:p-8 shadow-xl transition-all duration-500">
                                    <Music className="w-12 h-12 md:w-16 md:h-16 text-blue-600 mx-auto mb-4" />
                                    <h3 className="text-xl md:text-2xl font-bold text-blue-900 text-center mb-4">Our Mission</h3>
                                    <p className="text-sm md:text-base text-blue-800 text-center leading-relaxed">
                                        To spread the divine beauty of Krishna's flute music, touching hearts and souls through the power of melody, rhythm, and spiritual connection.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mt-12 md:mt-16">
                            <div className="text-center p-4 md:p-6 bg-gradient-to-br from-blue-100 to-yellow-100 rounded-lg transform hover:scale-105 transition-all duration-300">
                                <Users className="w-6 h-6 md:w-8 md:h-8 text-blue-600 mx-auto mb-2" />
                                <div className="text-xl md:text-2xl font-bold text-blue-900">500+</div>
                                <div className="text-sm md:text-base text-blue-700">Students Taught</div>
                            </div>
                            <div className="text-center p-4 md:p-6 bg-gradient-to-br from-blue-100 to-yellow-100 rounded-lg transform hover:scale-105 transition-all duration-300">
                                <Award className="w-6 h-6 md:w-8 md:h-8 text-blue-600 mx-auto mb-2" />
                                <div className="text-xl md:text-2xl font-bold text-blue-900">50+</div>
                                <div className="text-sm md:text-base text-blue-700">Workshops and events Hosted</div>
                            </div>
                            <div className="text-center p-4 md:p-6 bg-gradient-to-br from-blue-100 to-yellow-100 rounded-lg transform hover:scale-105 transition-all duration-300">
                                <Music className="w-6 h-6 md:w-8 md:h-8 text-blue-600 mx-auto mb-2" />
                                <div className="text-xl md:text-2xl font-bold text-blue-900">100+</div>
                                <div className="text-sm md:text-base text-blue-700">Performances and Collaborations</div>
                            </div>
                            <div className="text-center p-4 md:p-6 bg-gradient-to-br from-blue-100 to-yellow-100 rounded-lg transform hover:scale-105 transition-all duration-300">
                                <Star className="w-6 h-6 md:w-8 md:h-8 text-yellow-500 mx-auto mb-2" />
                                <div className="text-xl md:text-2xl font-bold text-blue-900">4.8 ★</div>
                                <div className="text-sm md:text-base text-blue-700">Google Student Rating</div>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="founder" className="py-16 md:py-20 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-6xl mx-auto">
                        <div className={`text-center mb-12 md:mb-16 transform transition-all duration-1000 ${visibleSections['founder'] ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-blue-900 mb-4 md:mb-6">Our Guru</h2>
                            <div className="w-20 h-1 bg-gradient-to-r from-blue-500 to-yellow-500 mx-auto mb-6 md:mb-8"></div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                            <div className={`relative transform transition-all duration-1000 delay-200 ${visibleSections['founder'] ? 'translate-x-0 opacity-100' : '-translate-x-20 opacity-0'}`}>
                                <div className="relative overflow-hidden rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-500 transform hover:scale-105">
                                    <img src={'/guru.jpg'} alt="Founder" className="w-full h-auto object-center block" loading="lazy" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-blue-900/40 to-transparent rounded-2xl"></div>
                                </div>
                                <div className="absolute -bottom-4 -right-4 bg-gradient-to-r from-blue-500 to-yellow-500 rounded-full p-3 md:p-4 shadow-xl animate-pulse">
                                    <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-white" />
                                </div>
                            </div>

                            <div className={`space-y-4 md:space-y-6 transform transition-all duration-1000 delay-400 ${visibleSections['founder'] ? 'translate-x-0 opacity-100' : 'translate-x-20 opacity-0'}`}>
                                <h3 className="text-2xl md:text-3xl font-bold text-blue-900">Master Musician & Educator</h3>
                                <p className="text-base md:text-lg text-blue-800 leading-loose max-w-prose">
                                    A <strong>dedicated and passionate Indian classical flutist</strong>, <strong>Sri Krishna Gopal Bhaumik</strong> brings over <strong>20 years of teaching and performance experience</strong> to his students. Trained under the guidance of <strong>renowned gurus Sri Bishwajit Sarkar and Sri Ashok Kumar Karmakar</strong>, he has mastered multiple musical styles — from <strong>Indian classical and folk</strong> to <strong>Rabindrasangeet, contemporary, and Bollywood music</strong>. His mission is to <strong>inspire and nurture students</strong> through structured learning that balances <strong>traditional depth with modern creativity</strong>, while fostering a <strong>lifelong appreciation for India's rich musical heritage</strong>.
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mt-6 md:mt-8">
                                    <div className="space-y-2 md:space-y-3 bg-gradient-to-br from-blue-100 to-yellow-100 p-4 rounded-lg shadow-md">
                                        <h4 className="text-lg md:text-xl font-semibold text-blue-900 mb-2 flex items-center space-x-2">
                                            <Award className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" />
                                            <span>Key Achievements</span>
                                        </h4>
                                        <div className="flex items-start space-x-2 md:space-x-3 text-blue-700">
                                            <Music className="w-4 h-4 md:w-5 md:h-5 text-blue-500 mt-1 flex-shrink-0" />
                                            <span className="text-sm md:text-base">Featured artist on TV channels like Kannada Doordarshan and Tara Bangla</span>
                                        </div>
                                        <div className="flex items-start space-x-2 md:space-x-3 text-blue-700">
                                            <Music className="w-4 h-4 md:w-5 md:h-5 text-blue-500 mt-1 flex-shrink-0" />
                                            <span className="text-sm md:text-base">Performed in prestigious music events across India</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2 md:space-y-3 bg-gradient-to-br from-blue-100 to-yellow-100 p-4 rounded-lg shadow-md">
                                        <h4 className="text-lg md:text-xl font-semibold text-blue-900 mb-2 flex items-center space-x-2">
                                            <Star className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                            <span>Core Expertise</span>
                                        </h4>
                                        <div className="flex items-center space-x-2 md:space-x-3 text-blue-700">
                                            <Star className="w-3 h-3 md:w-4 md:h-4 text-yellow-500 flex-shrink-0" />
                                            <span className="text-sm md:text-base">Classical & Contemporary Flute Performance</span>
                                        </div>
                                        <div className="flex items-center space-x-2 md:space-x-3 text-blue-700">
                                            <Star className="w-3 h-3 md:w-4 md:h-4 text-yellow-500 flex-shrink-0" />
                                            <span className="text-sm md:text-base">Music Theory & Instrumental Training</span>
                                        </div>
                                        <div className="flex items-center space-x-2 md:space-x-3 text-blue-700">
                                            <Star className="w-3 h-3 md:w-4 md:h-4 text-yellow-500 flex-shrink-0" />
                                            <span className="text-sm md:text-base">Rabindrasangeet & Bollywood Music</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="flutes" className="py-16 md:py-20 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-7xl mx-auto text-center mb-12">
                        <h2 className="text-5xl font-bold text-blue-900 mb-4 md:mb-6">Handcrafted Flutes</h2>
                        <div className="w-20 h-1 bg-gradient-to-r from-blue-500 to-yellow-500 mx-auto"></div>
                    </div>
                    <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-center gap-8 md:gap-10">
                        <div className={`md:w-1/2 transform transition-all duration-1000 delay-200 ${visibleSections['flutes'] ? 'translate-x-0 opacity-100' : '-translate-x-20 opacity-0'}`}>
                            <img src={'/flutes_custom.jpg'} alt="Handcrafted Flutes" className="w-full rounded-xl shadow-2xl" loading="lazy" />
                        </div>
                        <div className={`md:w-1/2 space-y-4 md:space-y-6 transform transition-all duration-1000 delay-400 ${visibleSections['flutes'] ? 'translate-x-0 opacity-100' : 'translate-x-20 opacity-0'}`}>
                            <p className="text-2xl md:text-3xl font-semibold text-blue-900">
                                🎵 Handcrafted Flutes Tailored to Perfection
                            </p>
                            <p className="text-base md:text-lg text-blue-800 leading-loose max-w-prose">
                                At Krishna Flute Academy, we believe the flute is not just an instrument — it's an extension of the artist's soul. Each bansuri is handcrafted from premium Assam bamboo, carefully selected for its tonal richness and durability. Every flute is precision-tuned to match the student's playing style and comfort, ensuring perfect pitch, smooth airflow, and superior sound quality. This personalized approach allows learners to experience music with clarity, ease, and a deeper emotional connection to their instrument.
                            </p>
                        </div>
                    </div>
                </section>

                <BlogSection
                    visible={visibleSections['blog']}
                    posts={recentBlogPosts}
                    onViewAll={() => {
                        window.location.href = '/blog/';
                    }}
                    onReadPost={(id) => {
                        window.location.href = `/blog/${id}`;
                    }}
                />

                <section id="gallery" className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 bg-white/50 overflow-hidden">
                    <div className="max-w-7xl mx-auto text-center mb-12">
                        <h2 className="text-5xl font-bold text-blue-900 mb-4 md:mb-6">Gallery</h2>
                        <div className="w-20 h-1 bg-gradient-to-r from-blue-500 to-yellow-500 mx-auto"></div>
                    </div>
                    <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 px-2 sm:px-4">
                        {galleryItems.slice(0, 8).map((gItem, index) => (
                            <div key={gItem.id} onClick={() => setSelectedGalleryItem(gItem)} className="relative h-32 sm:h-48 bg-white rounded-xl overflow-hidden shadow-lg cursor-pointer transform hover:scale-105 transition-all">
                                {gItem.media_type === 'image' ? (
                                    <img src={gItem.url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="relative w-full h-full bg-gray-100 flex items-center justify-center">
                                        <Play className="w-12 h-12 text-blue-600" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="text-center mt-12">
                        <button onClick={() => {
                            setCurrentView('gallery');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }} className="flex items-center justify-center space-x-2 mx-auto bg-blue-700 text-white px-8 py-3 rounded-full font-semibold hover:bg-blue-800 transition-all shadow-lg group">
                            <span>View More Performances</span>
                            <Sparkles className="w-5 h-5 text-yellow-300 group-hover:animate-pulse" />
                        </button>

                    </div>
                    <p className="text-center text-blue-700 mt-8 text-sm md:text-base">Find more performances on our official Facebook and Instagram channels.</p>
                </section>

                <section id="courses" className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 bg-white/50">
                    <div className="max-w-7xl mx-auto text-center mb-12">
                        <h2 className="text-4xl font-bold text-blue-900 mb-4">Learn With Us</h2>
                        <div className="w-20 h-1 bg-gradient-to-r from-blue-500 to-yellow-500 mx-auto"></div>
                    </div>
                    <div className="max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                        {[
                            {
                                title: "Beginner",
                                description: "Perfect for your first steps into flute music",
                                features: ["Introduction to the Flute", "Breath Control & Blowing Techniques", "Fundamentals of Swaras", "Taan Practice (Basic)"],
                                icon: <SignalLow className="w-8 h-8" />,
                                color: "from-blue-400 to-blue-600"
                            },
                            {
                                title: "Intermediate",
                                description: "Build your foundation with advanced techniques",
                                features: ["Advanced Taan Practice", "Introduction to Komal Swaras", "Introduction to Raagas", "Mastering Advanced Playing Techniques"],
                                icon: <SignalMedium className="w-8 h-8" />,
                                color: "from-yellow-400 to-yellow-600"
                            },
                            {
                                title: "Advanced",
                                description: "Master intricate compositions and professional techniques",
                                features: ["Complex ragas", "Taan & meend", "Concert preparation", "Teaching methodology"],
                                icon: <SignalHigh className="w-8 h-8" />,
                                color: "from-blue-500 to-yellow-500"
                            },
                            {
                                title: "Kids Program",
                                description: "Fun lessons designed for young learners",
                                features: ["Playful learning", "Simple songs", "Rhythm games", "Creative expression"],
                                icon: <Heart className="w-8 h-8" />,
                                color: "from-yellow-300 to-blue-500"
                            }
                        ].map((course, index) => (
                            <div
                                key={index}
                                className={`flex flex-col h-full bg-white rounded-2xl shadow-xl overflow-hidden transform hover:scale-105 transition-all duration-500 hover:shadow-2xl ${visibleSections['courses'] ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}
                                style={{ transitionDelay: `${index * 150}ms` }}
                            >
                                <div className={`bg-gradient-to-r ${course.color} p-6 text-white`}>
                                    <div className="flex items-center justify-center mb-4">
                                        {course.icon}
                                    </div>
                                    <h3 className="text-xl font-bold text-center">{course.title}</h3>
                                </div>
                                <div className="p-6 flex-grow">
                                    <p className="text-blue-800 mb-6 leading-relaxed text-sm md:text-base">{course.description}</p>
                                    <ul className="space-y-2 mb-6">
                                        {course.features.map((feature, idx) => (
                                            <li key={idx} className="flex items-center space-x-2 text-blue-700">
                                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                                <span className="text-xs md:text-sm">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>


                            </div>

                        ))}
                    </div>

                    <div className="max-w-7xl mx-auto flex justify-end mt-8 w-full">
                        <a
                            href={'/KFA-Brochure.pdf'}
                            download="Krishna-Flute-Academy-Brochure.pdf"
                            className="text-blue-700 hover:text-blue-900 font-semibold transition-colors group inline-flex items-center text-sm md:text-base cursor-pointer"
                            aria-label="Download our brochure to learn more"
                        >
                            Download Brochure
                            <Download className="w-4 h-4 ml-1.5 opacity-70 group-hover:opacity-100 transition-opacity" />
                        </a>
                    </div>
                </section>

                {/* Testimonials Section */}
                {testimonials.length > 0 && (
                    <section className="py-20 px-4 bg-yellow-50">
                        <div className="max-w-6xl mx-auto">
                            {/* Header with Flexbox Layout for Buttons */}
                            <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
                                <h2 className="text-4xl font-bold text-blue-900">
                                    Student's Love
                                </h2>

                                <div className="flex gap-3">
                                    {/* Button 1: Write a Review */}
                                    <a
                                        href="https://www.google.com/maps/place/Krishna+Flute+Academy/@12.8498601,77.6502361,17z/data=!4m8!3m7!1s0x3bae6d9c05a7322f:0x9f9d6655d2439467!8m2!3d12.8498601!4d77.652811!9m1!1b1!16s%2Fg%2F11m2x5sn66?entry=ttu&g_ep=EgoyMDI1MTExNy4wIKXMDSoASAFQAw%3D%3D"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 bg-blue-600 text-white border-2 border-blue-600 px-4 py-2 rounded-full font-bold hover:bg-blue-700 transition-all shadow-sm hover:shadow-md text-sm"
                                    >
                                        Write a Review <Star className="w-4 h-4 fill-current" />
                                    </a>

                                    {/* Button 2: See More */}
                                    <a
                                        href="https://www.google.com/maps/place/Krishna+Flute+Academy/@12.8498601,77.6502361,17z/data=!4m8!3m7!1s0x3bae6d9c05a7322f:0x9f9d6655d2439467!8m2!3d12.8498601!4d77.652811!9m1!1b1!16s%2Fg%2F11m2x5sn66?entry=ttu&g_ep=EgoyMDI1MTExNy4wIKXMDSoASAFQAw%3D%3D"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 bg-white border-2 border-blue-100 text-blue-700 px-4 py-2 rounded-full font-bold hover:bg-blue-50 hover:border-blue-200 transition-all shadow-sm hover:shadow-md text-sm"
                                    >
                                        See More <ExternalLink className="w-4 h-4" />
                                    </a>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-3 gap-6">
                                {testimonials.map((t: any) => (
                                    <div key={t.id} className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all">
                                        <div className="flex gap-1 text-yellow-400 mb-4">
                                            {[...Array(t.rating || 5)].map((_, i) => <Star key={i} className="fill-current w-5 h-5" />)}
                                        </div>
                                        <p className="text-gray-600 italic mb-6 leading-relaxed">"{t.message || t.content}"</p>
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-100 text-blue-600 rounded-full p-2">
                                                <User className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-blue-900">{t.name}</h4>
                                                <p className="text-xs text-gray-500">{t.location}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* Contact Section */}
                <section id="contact" className="py-16 md:py-20 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-6xl mx-auto">
                        <div className={`text-center mb-12 md:mb-16 transform transition-all duration-1000 ${visibleSections['contact'] ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-blue-900 mb-4 md:mb-6">Contact Us</h2>
                            <div className="w-20 h-1 bg-gradient-to-r from-blue-500 to-yellow-500 mx-auto mb-6 md:mb-8"></div>
                            <p className="text-lg md:text-xl text-blue-700">Ready to start your musical journey? Let's connect!</p>
                        </div>
                        <div className="grid md:grid-cols-2 gap-8 md:gap-12">
                            <div className={`space-y-6 md:space-y-8 transform transition-all duration-1000 delay-200 ${visibleSections['contact'] ? 'translate-x-0 opacity-100' : '-translate-x-20 opacity-0'}`}>
                                <div className="flex items-start space-x-4 transform transition-all duration-300 hover:translate-x-2">
                                    <div className="bg-gradient-to-r from-blue-500 to-yellow-500 p-3 rounded-full">
                                        <Phone className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold text-blue-900 mb-2">Phone</h3>
                                        <p className="text-blue-700">+91 98369 52545</p>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-4 transform transition-all duration-300 hover:translate-x-2">
                                    <div className="bg-gradient-to-r from-blue-500 to-yellow-500 p-3 rounded-full">
                                        <Mail className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold text-blue-900 mb-2">Email</h3>
                                        <p className="text-blue-700">kgbhaumik86@gmail.com</p>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-4 transform transition-all duration-300 hover:translate-x-2">
                                    <div className="bg-gradient-to-r from-blue-500 to-yellow-500 p-3 rounded-full">
                                        <MapPin className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold text-blue-900 mb-2">Address</h3>
                                        <p className="text-blue-700">Electronic City Phase 1</p>
                                        <p className="text-blue-700">Bengaluru, India</p>
                                    </div>
                                </div>
                                <div className="bg-gradient-to-br from-blue-100 to-yellow-100 p-6 rounded-2xl transform hover:scale-105 transition-all duration-300">
                                    <h3 className="text-xl font-semibold text-blue-900 mb-4">Location Map</h3>
                                    <a href={mapLinkUrl} target="_blank" rel="noopener noreferrer" className="block w-full rounded-xl overflow-hidden shadow-lg transition-shadow duration-300 hover:shadow-xl relative">
                                        <iframe
                                            title="Academy Location Map"
                                            src={mapEmbedUrl}
                                            className="w-full h-64 border-none"
                                            allowFullScreen
                                            loading="lazy"
                                            referrerPolicy="no-referrer-when-downgrade"
                                        />
                                        <div className="absolute inset-0 bg-transparent cursor-pointer opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg font-semibold">Open in Google Maps</span>
                                        </div>
                                    </a>
                                </div>
                            </div>
                            <div className={`bg-white rounded-2xl shadow-xl p-6 md:p-8 space-y-6 transform transition-all duration-1000 delay-400 ${visibleSections['contact'] ? 'translate-y-0 opacity-100' : 'translate-x-20 opacity-0'}`}>
                                <div>
                                    <label className="block text-blue-900 font-semibold mb-2" htmlFor="name">Full Name</label>
                                    <input
                                        id="name"
                                        type="text"
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        className="w-full px-4 py-3 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                                        placeholder="Enter your full name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-blue-900 font-semibold mb-2" htmlFor="email">Email Address</label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={formEmail}
                                        onChange={(e) => setFormEmail(e.target.value)}
                                        className="w-full px-4 py-3 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                                        placeholder="Enter your email"
                                    />
                                </div>
                                <div>
                                    <label className="block text-blue-900 font-semibold mb-2" htmlFor="phone">Phone Number</label>
                                    <input
                                        id="phone"
                                        type="tel"
                                        value={formPhone}
                                        onChange={(e) => setFormPhone(e.target.value)}
                                        className="w-full px-4 py-3 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                                        placeholder="Enter your phone number"
                                    />
                                </div>
                                <div>
                                    <label className="block text-blue-900 font-semibold mb-2" htmlFor="course">Course Interest</label>
                                    <select
                                        id="course"
                                        value={formCourse}
                                        onChange={(e) => setFormCourse(e.target.value)}
                                        className="w-full px-4 py-3 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                                    >
                                        <option>Select a course</option>
                                        <option>Beginner Course</option>
                                        <option>Intermediate Course</option>
                                        <option>Advanced Course</option>
                                        <option>Kids Special</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-blue-900 font-semibold mb-2" htmlFor="message">Message</label>
                                    <textarea
                                        id="message"
                                        rows={4}
                                        value={formMessage}
                                        onChange={(e) => setFormMessage(e.target.value)}
                                        className="w-full px-4 py-3 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                                        placeholder="Tell us about your musical background and goals..."
                                    ></textarea>
                                </div>
                                <button
                                    onClick={handleWhatsAppSubmit}
                                    className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-lg text-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center space-x-3"
                                >
                                    <MessageSquare className="w-6 h-6" />
                                    <span>Send Inquiry via WhatsApp</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <footer className="bg-gradient-to-r from-blue-900 to-yellow-900 text-white py-12 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid md:grid-cols-3 gap-8">
                            <div>
                                <div className="flex items-center space-x-3 mb-4">
                                    <img src="/image.png" alt="Krishna Flute Academy" className="h-10 w-10 object-contain" />
                                    <span className="text-xl font-bold">Krishna Flute Academy</span>
                                </div>
                                <p className="text-blue-100 leading-relaxed text-sm md:text-base">Spreading the divine melodies of Krishna's flute through traditional teaching and modern techniques.</p>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
                                <ul className="space-y-2 text-blue-100">
                                    <li><button onClick={() => scrollToSection('about')} className="hover:text-white transition-colors text-sm md:text-base">About Us</button></li>
                                    <li><button onClick={() => scrollToSection('courses')} className="hover:text-white transition-colors text-sm md:text-base">Courses</button></li>
                                    <li><button onClick={() => scrollToSection('founder')} className="hover:text-white transition-colors text-sm md:text-base">Our Founder</button></li>
                                    <li><button onClick={() => scrollToSection('contact')} className="hover:text-white transition-colors text-sm md:text-base">Contact</button></li>
                                    <li><button onClick={() => { setCurrentView('gallery'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:text-white transition-colors text-sm md:text-base">Gallery</button></li>
                                    <li><button onClick={() => { setCurrentView('blog'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:text-white transition-colors text-sm md:text-base">Blog</button></li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold mb-4">Follow Us</h3>
                                <div className="flex space-x-4">
                                    <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors cursor-pointer"><Facebook className="w-5 h-5" /></a>
                                    <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors cursor-pointer"><Instagram className="w-5 h-5" /></a>
                                    <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors cursor-pointer"><Youtube className="w-5 h-5" /></a>
                                </div>
                            </div>
                        </div>
                        <div className="border-t border-blue-700 mt-8 pt-8 text-center text-blue-200 text-sm md:text-base">
                            <p>© 2025 Krishna Flute Academy. All rights reserved. | Designed with love for music lovers</p>
                            <button onClick={() => setShowAdminLogin(true)} className="p-1 text-blue-800 hover:text-blue-400 transition-colors opacity-50 hover:opacity-100" aria-label="Admin Login"><Lock className="w-4 h-4" /></button>
                        </div>
                    </div>
                </footer>

                <a href="/KFA-Brochure.pdf" download className="fixed bottom-12 right-6 z-50 p-4 bg-blue-700 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 hover:bg-blue-800"><Download className="w-7 h-7 text-white" /></a>
            </div>
        );
    };

    const renderCurrentView = () => {
        switch (currentView) {
            case 'blog':
                return <Blog
                    initialPostId={selectedPostId}
                    onBack={() => {
                        setSelectedPostId(null);
                        setCurrentView('home');
                    }}
                />;
            case 'gallery':
                return <GalleryFull onBack={() => setCurrentView('home')} />;
            case 'admin':
                return <BlogAdmin onBackToHome={() => setCurrentView('home')} />;
            default:
                return renderHomeView();
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
            {renderCurrentView()}
            {showAdminLogin && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm mx-4">
                        <h3 className="text-xl font-bold mb-4">Admin Access</h3>
                        <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className="w-full p-2 border rounded mb-4" onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} />
                        <div className="flex gap-2">
                            <button onClick={handleAdminLogin} className="flex-1 bg-blue-600 text-white py-2 rounded">Login</button>
                            <button onClick={() => setShowAdminLogin(false)} className="flex-1 bg-gray-300 py-2 rounded">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
            {selectedGalleryItem && (
                <div className="fixed inset-0 z-[110] bg-black/90 flex items-center justify-center p-4">
                    <button onClick={() => setSelectedGalleryItem(null)} className="absolute top-6 right-6 text-white"><X className="w-8 h-8" /></button>
                    {selectedGalleryItem.media_type === 'image' ? (
                        <img src={selectedGalleryItem.url} className="max-w-full max-h-[80vh] rounded-lg" />
                    ) : (
                        <iframe src={selectedGalleryItem.url} className="w-full max-w-4xl aspect-video rounded-lg" />
                    )}
                </div>
            )}
        </div>
    );
}

export default function AcademyContent() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <PageClient />
        </Suspense>
    );
}
