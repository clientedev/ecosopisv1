'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { Heart, MessageCircle, Send, Share2, User } from 'lucide-react';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import ShareModal from '@/components/ShareModal/ShareModal';
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
  likes_count: number;
  is_liked: boolean;
  comments: any[];
}

export default function NewsPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharingPost, setSharingPost] = useState<NewsPost | null>(null);

  const fetchPosts = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: any = {};
      if (token) headers['Authorization'] = `Bearer ${token} `;

      const response = await fetch('/api/news/', {
        headers,
        cache: 'no-store'
      });
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

  const handleLike = async (postId: number) => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Você precisa estar logado para curtir!');
      return;
    }

    try {
      const res = await fetch(`/ api / news / ${postId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchPosts();
    } catch (err) {
      console.error('Error liking post:', err);
    }
  };

  const handleComment = async (postId: number) => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Você precisa estar logado para comentar!');
      return;
    }

    const content = prompt('Digite seu comentário:');
    if (!content) return;

    try {
      const res = await fetch(`/api/news/${postId}/comment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });
      if (res.ok) fetchPosts();
    } catch (err) {
      console.error('Error commenting:', err);
    }
  };

  const handleShare = (post: NewsPost) => {
    setSharingPost(post);
    setIsShareModalOpen(true);
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
              Sua dose diária de autocuidado e beleza natural.
            </p>
          </div>
        </div>

        <div className={styles.contentContainer}>
          {loading ? (
            <div className={styles.postsGrid}>
              {[1, 2].map((i) => (
                <div key={i} className={styles.skeletonCard}>
                  <div className={styles.skeletonHeader}>
                    <div className={styles.skeletonAvatar}></div>
                    <div className={styles.skeletonText}></div>
                  </div>
                  <div className={styles.skeletonMedia}></div>
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <MessageCircle size={48} />
              </div>
              <h3>Nada por aqui ainda</h3>
              <p>Estamos preparando conteúdos incríveis para você.</p>
            </div>
          ) : (
            <div className={styles.postsGrid}>
              {posts.map((post, index) => (
                <article key={post.id} className={styles.postCard} style={{ animationDelay: `${index * 0.1}s` }}>
                  <div className={styles.postHeader}>
                    <div className={styles.avatar}>
                      <User size={20} />
                    </div>
                    <div className={styles.headerInfo}>
                      <span className={styles.authorName}>{post.user?.full_name || 'Equipe ECOSOPIS'}</span>
                      <span className={styles.postDate}>{getTimeAgo(post.created_at)}</span>
                    </div>
                  </div>

                  {post.media_url && (
                    <div className={styles.mediaWrapper}>
                      {post.media_type === 'video' ? (
                        <video
                          src={post.media_url}
                          controls
                          playsInline
                          className={styles.postMedia}
                        />
                      ) : (
                        <img
                          src={post.media_url}
                          alt={post.title}
                          className={styles.postMedia}
                        />
                      )}
                    </div>
                  )}

                  <div className={styles.interactionBar}>
                    <button
                      onClick={() => handleLike(post.id)}
                      className={`${styles.interactionBtn} ${post.is_liked ? styles.liked : ''}`}
                    >
                      <Heart size={24} fill={post.is_liked ? "currentColor" : "none"} />
                    </button>
                    <button
                      onClick={() => handleComment(post.id)}
                      className={styles.interactionBtn}
                    >
                      <MessageCircle size={24} />
                    </button>
                    <button
                      className={styles.interactionBtn}
                      style={{ marginLeft: 'auto' }}
                      onClick={() => handleShare(post)}
                    >
                      <Share2 size={24} />
                    </button>
                  </div>

                  <div className={styles.likesCount}>
                    {post.likes_count || 0} curtidas
                  </div>

                  <div className={styles.postContent}>
                    <h2 className={styles.postTitle}>{post.title}</h2>
                    <p className={styles.postExcerpt}>{post.content}</p>
                  </div>

                  {post.comments && post.comments.length > 0 && (
                    <div className={styles.commentsSection}>
                      {post.comments.slice(0, 3).map((comment: any) => (
                        <div key={comment.id} className={styles.commentItem}>
                          <span className={styles.commentAuthor}>{comment.user?.full_name || 'Usuário'}:</span>
                          {comment.content}
                        </div>
                      ))}
                      {post.comments.length > 3 && (
                        <button className={styles.interactionBtn} style={{ fontSize: '0.8rem', padding: '4px 0', color: '#8e8e8e' }}>
                          Ver todos os {post.comments.length} comentários
                        </button>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />

      {sharingPost && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          url={`${typeof window !== 'undefined' ? window.location.origin : ''}/novidades?id=${sharingPost.id}`}
          title={`Confira essa novidade na ECOSOPIS: ${sharingPost.title}`}
        />
      )}
    </div>
  );
}
