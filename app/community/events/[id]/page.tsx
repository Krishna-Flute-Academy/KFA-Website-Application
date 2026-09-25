import CommunityEventDetailView from '../../../../src/components/community/CommunityEventDetailView';
export default async function CommunityEventPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <CommunityEventDetailView id={id} />; }
