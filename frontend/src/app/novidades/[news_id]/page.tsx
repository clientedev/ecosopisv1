import { Metadata } from 'next';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import NewsDetailClient from '@/app/novidades/[news_id]/NewsDetailClient';

interface Props {
  params: { news_id: string };
}

// We use the full internal URL for server-side fetch in Next.js App Router
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function getPost(id: string) {
  try {
    const res = await fetch(`${API_URL}/news/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Error fetching post on server:", error);
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.news_id);
  if (!post) return { title: 'Post não encontrado | ECOSOPIS' };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const mediaUrl = post.media_url 
    ? (post.media_url.startsWith('http') ? post.media_url : `${API_URL}${post.media_url}`)
    : `${baseUrl}/static/attached_assets/generated_images/natural_soap_bars_photography_lifestyle.png`;

  return {
    title: `${post.title} | Diário ECOSOPIS`,
    description: post.content.slice(0, 160) + '...',
    openGraph: {
      title: post.title,
      description: post.content.slice(0, 160) + '...',
      images: [mediaUrl],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.content.slice(0, 160) + '...',
      images: [mediaUrl],
    }
  };
}

export default async function NewsDetailPage({ params }: Props) {
  const post = await getPost(params.news_id);

  if (!post) {
    return (
      <>
        <Header />
        <main style={{ padding: '100px 20px', textAlign: 'center', minHeight: '60vh' }}>
          <h2>Postagem não encontrada</h2>
          <p>Parece que este conteúdo não está mais disponível.</p>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <NewsDetailClient initialPost={post} />
      <Footer />
    </>
  );
}
