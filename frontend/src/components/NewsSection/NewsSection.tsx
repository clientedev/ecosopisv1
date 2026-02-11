import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, ArrowRight, Calendar, User, Share2, Copy } from 'lucide-react';
import styles from './NewsSection.module.css';
import ShareModal from '../ShareModal/ShareModal';

interface NewsPost {
  id: number;
  title: string;
  content: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  created_at: string;
  user?: { full_name: string };
  likes_count: number;
  is_liked: boolean;
}

export default function NewsSection() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharingPost, setSharingPost] = useState<any>(null);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch('/api/news');
        if (res.ok) {
          const data = await res.json();
          setPosts(data.slice(0, 3));
        }
      } catch (err) {
        console.error('Error fetching news:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  if (loading) return null;
  if (posts.length === 0) return null;

  return (
    <section className={styles.section}>
      <div className="container">
        <div className={styles.header}>
          <h2 className={styles.title}>DIÁRIO ECOSOPIS</h2>
          <Link href="/novidades" className={styles.viewAll}>
            Ver todas as novidades <ArrowRight size={16} />
          </Link>
        </div>

        <div className={styles.grid}>
          {posts.map((post) => (
            <article key={post.id} className={styles.card}>
              <div className={styles.media}>
                {post.media_url ? (
                  <img src={post.media_url} alt={post.title} />
                ) : (
                  <div className={styles.placeholder}>🌿</div>
                )}
                <div className={styles.dateBadge}>
                  {getTimeAgo(post.created_at)}
                </div>
              </div>
              <div className={styles.body}>
                <h3 className={styles.postTitle}>{post.title}</h3>
                <p className={styles.excerpt}>{post.content}</p>
                <div className={styles.footer}>
                  <div className={styles.stats}>
                    <span className={styles.stat}>
                      <Heart size={16} className={post.is_liked ? styles.liked : ''} /> {post.likes_count}
                    </span>
                    <span className={styles.stat}>
                      <MessageCircle size={16} /> Comentar
                    </span>
                  </div>
                  <div className={styles.actions}>
                    <button
                      className={styles.shareBtn}
                      onClick={() => {
                        setSharingPost(post);
                        setIsShareModalOpen(true);
                      }}
                      title="Compartilhar"
                    >
                      <Share2 size={16} />
                    </button>
                    <Link href="/novidades" className={styles.readMore}>Ler mais</Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        {sharingPost && (
          <ShareModal
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
            url={`${typeof window !== 'undefined' ? window.location.origin : ''}/novidades?id=${sharingPost.id}`}
            title={`Confira essa novidade na ECOSOPIS: ${sharingPost.title}`}
          />
        )}
      </div >
    </section >
  );
}
