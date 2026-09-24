import { Metadata } from 'next';
import CommunityClientView from '../../../src/components/community/CommunityClientView';
import { getFallbackCategories } from '../../../src/lib/community';

interface CategoryPageProps {
    params: Promise<{ categorySlug: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
    const { categorySlug } = await params;
    const cat = getFallbackCategories().find(c => c.slug === categorySlug);
    const catName = cat ? cat.name : 'Discussions';

    return {
        title: `${catName} | KFA Community`,
        description: cat?.description || `Flute and Indian classical music discussions in ${catName} on KFA Community.`,
        openGraph: {
            title: `${catName} | KFA Community`,
            description: cat?.description || `Flute and Indian classical music discussions in ${catName}.`,
            url: `https://www.krishnafluteacademy.com/community/${categorySlug}`,
        },
        alternates: {
            canonical: `https://www.krishnafluteacademy.com/community/${categorySlug}`,
        },
    };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
    const { categorySlug } = await params;
    return <CommunityClientView initialCategorySlug={categorySlug} />;
}
