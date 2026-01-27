'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Heart, MessageCircle, Share2, Calendar, User, ArrowRight, Bookmark } from 'lucide-react';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import styles from './page.module.css';

interface NewsPost {
  id: number;
  title: string;
  content: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  created_at: string;
  user_id: number;
  user?: {
    full_name: string;
    email: string;
  };
}

export default function NewsPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    try {
      const response = await fetch('/api/news');
      if (response.ok) {
        const data = await response.json();
        setPosts(data);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Agora mesmo';
    if (diffInHours < 24) return `${diffInHours}h atrás`;
    if (diffInHours < 48) return 'Ontem';
    return formatDate(dateString);
  };

  return (
    <div className={styles.pageWrapper}>
      <Header />
      
      <main className={styles.main}>
        <div className={styles.heroSection}>
          <div className={styles.container}>
            <span className={styles.badge}>Dicas & Atualizações</span>
            <h1 className={styles.pageTitle}>Diário ECOSOPIS</h1>
            <p className={styles.pageSubtitle}>
              Sua dose diária de autocuidado, sustentabilidade e o universo da beleza natural.
            </p>
          </div>
        </div>

        <div className={styles.contentContainer}>
          {loading ? (
            <div className={styles.skeletonGrid}>
              {[1, 2, 3].map((i) => (
                <div key={i} className={styles.skeletonCard}>
                  <div className={styles.skeletonMedia}></div>
                  <div className={styles.skeletonContent}>
                    <div className={styles.skeletonLine}></div>
                    <div className={styles.skeletonLineShort}></div>
                  </div>
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <MessageCircle size={40} />
              </div>
              <h3>Nada por aqui ainda</h3>
              <p>Estamos preparando conteúdos incríveis sobre cosmética natural para você.</p>
            </div>
          ) : (
            <div className={styles.postsGrid}>
              {posts.map((post, index) => (
                <article key={post.id} className={styles.postCard} style={{ animationDelay: `${index * 0.1}s` }}>
                  {post.media_url && (
                    <div className={styles.mediaWrapper}>
                      {post.media_type === 'video' ? (
                        <video src={post.media_url} controls className={styles.postMedia} />
                      ) : (
                        <img src={post.media_url} alt={post.title} className={styles.postMedia} />
                      )}
                      <div className={styles.categoryBadge}>Novidade</div>
                    </div>
                  )}
                  
                  <div className={styles.postBody}>
                    <div className={styles.postMeta}>
                      <span className={styles.author}>
                        <User size={14} /> {post.user?.full_name || 'Equipe ECOSOPIS'}
                      </span>
                      <span className={styles.date}>
                        <Calendar size={14} /> {getTimeAgo(post.created_at)}
                      </span>
                    </div>
                    
                    <h2 className={styles.postTitle}>{post.title}</h2>
                    <p className={styles.postExcerpt}>{post.content}</p>
                    
                    <div className={styles.postFooter}>
                      <div className={styles.interactions}>
                        <button className={styles.interactionBtn} title="Curtir">
                          <Heart size={20} />
                        </button>
                        <button className={styles.interactionBtn} title="Comentar">
                          <MessageCircle size={20} />
                        </button>
                        <button className={styles.interactionBtn} title="Salvar">
                          <Bookmark size={20} />
                        </button>
                      </div>
                      <button className={styles.shareBtn}>
                        <Share2 size={18} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
