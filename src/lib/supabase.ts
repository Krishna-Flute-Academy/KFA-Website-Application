import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase: Missing environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  featured_image: string;
  author_name: string;
  author_email: string;
  published: boolean;
  published_at: string | null;
  view_count: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}
export interface GalleryItem {
  id: string;
  title: string | null;
  description: string | null;
  media_type: 'image' | 'video-url' | 'video-file';
  url: string;
  thumbnail_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Inquiry {
  id: string;
  created_at: string;
  name: string;
  email: string | null;
  phone: string;
  course: string;
  message: string;
}

export interface Event {
  id: string;
  created_at: string;
  title: string;
  registration_link: string;
  image_url: string | null;
  button_text: string | null;
  description: string | null;
  is_active: boolean;
}

export interface Testimonial {
  id: string;
  created_at: string;
  name: string;
  message: string;
  rating: number;
  location: string;
}
