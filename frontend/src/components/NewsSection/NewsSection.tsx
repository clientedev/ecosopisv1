import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, ArrowRight, Calendar, User } from 'lucide-react';
import styles from './NewsSection.module.css';

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
  const [news, setNews] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch('/api/news');
        if (res.ok) {
          const data = await res.json();
          setNews(data.slice(0, 3));
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
  if (news.length === 0) return null;

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
          {news.map((post) => (
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
                  <Link href="/novidades" className={styles.readMore}>Ler mais</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
