import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { COURSES_DATA } from '../../../src/data/courses-data';
import ClientCoursePage from './ClientCoursePage';

type Props = {
    params: Promise<{ slug: string }>;
};

// Return the 4 static course paths for build-time static generation & SEO indexing
export async function generateStaticParams() {
    return Object.keys(COURSES_DATA).map(slug => ({ slug }));
}

// Generate dynamic server-rendered SEO metadata
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const course = COURSES_DATA[slug];

    if (!course) {
        return {
            title: 'Course Not Found | Krishna Flute Academy',
            description: 'The requested Bansuri course could not be found.'
        };
    }

    const canonicalUrl = `https://www.krishnafluteacademy.com/courses/${course.slug}`;

    return {
        title: course.seoTitle,
        description: course.metaDescription,
        alternates: {
            canonical: canonicalUrl,
        },
        openGraph: {
            title: course.seoTitle,
            description: course.metaDescription,
            url: canonicalUrl,
            siteName: 'Krishna Flute Academy',
            locale: 'en_US',
            type: 'website',
            images: [
                {
                    url: course.heroImage,
                    width: 1200,
                    height: 630,
                    alt: `${course.title} at Krishna Flute Academy`,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: course.seoTitle,
            description: course.metaDescription,
            images: [course.heroImage],
        },
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
                'max-video-preview': -1,
                'max-image-preview': 'large',
                'max-snippet': -1,
            },
        },
    };
}

export default async function CourseDetailPage({ params }: Props) {
    const { slug } = await params;
    const course = COURSES_DATA[slug];

    if (!course) {
        notFound();
    }

    const canonicalUrl = `https://www.krishnafluteacademy.com/courses/${course.slug}`;

    // Schema.org Structured Data
    const courseJsonLd = {
        '@context': 'https://schema.org',
        '@graph': [
            // 1. MusicSchool / EducationalOrganization
            {
                '@type': 'MusicSchool',
                '@id': 'https://www.krishnafluteacademy.com/#organization',
                name: 'Krishna Flute Academy',
                url: 'https://www.krishnafluteacademy.com',
                logo: 'https://www.krishnafluteacademy.com/apple-touch-icon.png',
                description: 'Premier Indian Classical Bansuri academy offering structured offline classes in Bangalore (Bengaluru) and live interactive online lessons worldwide.',
                telephone: '+919836952545',
                email: 'kgbhaumik86@gmail.com',
                address: {
                    '@type': 'PostalAddress',
                    streetAddress: 'Electronic City Phase 1',
                    addressLocality: 'Bangalore',
                    addressRegion: 'Karnataka',
                    postalCode: '560100',
                    addressCountry: 'IN'
                }
            },
            // 2. Course Schema
            {
                '@type': 'Course',
                '@id': `${canonicalUrl}#course`,
                name: course.title,
                description: course.metaDescription,
                provider: {
                    '@id': 'https://www.krishnafluteacademy.com/#organization'
                },
                url: canonicalUrl,
                educationalCredentialAwarded: 'Level Certificate of Completion',
                coursePrerequisites: course.slug === 'beginner-bansuri' || course.slug === 'kids-bansuri' 
                    ? 'None. Suitable for complete beginners.' 
                    : 'Foundational Bansuri tone production and basic middle octave note command.',
                hasCourseInstance: [
                    {
                        '@type': 'CourseInstance',
                        courseMode: ['Onsite', 'Online'],
                        location: {
                            '@type': 'Place',
                            name: 'Krishna Flute Academy',
                            address: 'Electronic City Phase 1, Bangalore, Karnataka, India'
                        }
                    }
                ]
            },
            // 3. BreadcrumbList Schema
            {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    {
                        '@type': 'ListItem',
                        position: 1,
                        name: 'Home',
                        item: 'https://www.krishnafluteacademy.com'
                    },
                    {
                        '@type': 'ListItem',
                        position: 2,
                        name: 'Courses',
                        item: 'https://www.krishnafluteacademy.com/courses'
                    },
                    {
                        '@type': 'ListItem',
                        position: 3,
                        name: course.title,
                        item: canonicalUrl
                    }
                ]
            },
            // 4. FAQPage Schema (only with visible, factual page FAQs)
            {
                '@type': 'FAQPage',
                mainEntity: course.faqs.map(faq => ({
                    '@type': 'Question',
                    name: faq.question,
                    acceptedAnswer: {
                        '@type': 'Answer',
                        text: faq.answer
                    }
                }))
            }
        ]
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd) }}
            />
            <ClientCoursePage course={course} />
        </>
    );
}
