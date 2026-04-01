'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Heart,
  MessageCircle,
  Share2,
  User,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import ShareModal from '@/components/ShareModal/ShareModal';
import NewsCommentModal, {
  type NewsPostPatch,
} from '@/components/NewsCommentModal/NewsCommentModal';
import AuthPromptModal from '@/components/AuthPromptModal/AuthPromptModal';
import type { NewsComment } from '@/types/news';
import styles from './page.module.css';

interface NewsPost {
  id: number;
  title: string;
  content: string;
  media_url?: string;
  media_type?: string;
  created_at: string;
  user_id: number;
  user?: {
    full_name?: string | null;
    email?: string;
  };
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  comments: NewsComment[];
}

const EXCERPT_MAX = 200;

function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/api/') || url.startsWith('/static/')) return url;
  if (url.startsWith('/')) return url;
  return `/api/${url.replace(/^\/+/, '')}`;
}

function formatPostDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

export default function NewsPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharingPost, setSharingPost] = useState<NewsPost | null>(null);
  const [expandedContent, setExpandedContent] = useState<Record<number, boolean>>(
    {}
  );
  const [likeBusy, setLikeBusy] = useState<Set<number>>(new Set());
  const [commentModalPostId, setCommentModalPostId] = useState<number | null>(
    null
  );
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState<'like' | 'comment'>(
    'like'
  );

  const authHeaders = useCallback((): HeadersInit => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const token = raw?.trim();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, []);

  const fetchPosts = useCallback(async () => {
    try {
      const headers: HeadersInit = { ...authHeaders() };
      const response = await fetch('/api/news/', {
        headers,
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        setPosts(
          (data as NewsPost[]).map((p) => ({
            ...p,
            comments_count: p.comments_count ?? p.comments?.length ?? 0,
            comments: p.comments ?? [],
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const openAuthModal = (reason: 'like' | 'comment') => {
    setAuthModalReason(reason);
    setAuthModalOpen(true);
  };

  const handleEngagementUpdate = (postId: number, patch: Partial<NewsPostPatch>) => {
    setPosts((list) =>
      list.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          comments: patch.comments ?? p.comments,
          comments_count:
            patch.comments_count ?? p.comments_count ?? p.comments.length,
          likes_count: patch.likes_count ?? p.likes_count,
          is_liked: patch.is_liked ?? p.is_liked,
        };
      })
    );
  };

  const handleLike = async (postId: number) => {
    const raw = localStorage.getItem('token')?.trim();
    if (!raw) {
      openAuthModal('like');
      return;
    }
    if (likeBusy.has(postId)) return;
    setLikeBusy((s) => new Set(s).add(postId));

    const prev = posts.find((p) => p.id === postId);
    const optimisticLiked = !prev?.is_liked;
    const optimisticCount = Math.max(
      0,
      (prev?.likes_count ?? 0) + (optimisticLiked ? 1 : -1)
    );
    setPosts((list) =>
      list.map((p) =>
        p.id === postId
          ? { ...p, is_liked: optimisticLiked, likes_count: optimisticCount }
          : p
      )
    );

    try {
      const res = await fetch(`/api/news/${postId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${raw}` },
      });
      if (res.status === 401) {
        await fetchPosts();
        openAuthModal('like');
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as { liked: boolean; likes_count: number };
        setPosts((list) =>
          list.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  is_liked: data.liked,
                  likes_count: data.likes_count ?? p.likes_count,
                }
              : p
          )
        );
      } else {
        await fetchPosts();
      }
    } catch (err) {
      console.error('Error liking post:', err);
      await fetchPosts();
    } finally {
      setLikeBusy((s) => {
        const n = new Set(s);
        n.delete(postId);
        return n;
      });
    }
  };

  const handleShare = (post: NewsPost) => {
    setSharingPost(post);
    setIsShareModalOpen(true);
  };

  const toggleContent = (id: number) => {
    setExpandedContent((e) => ({ ...e, [id]: !e[id] }));
  };

  const needsTruncate = (text: string) => text.length > EXCERPT_MAX;

  const commentModalPost = commentModalPostId
    ? posts.find((p) => p.id === commentModalPostId) ?? null
    : null;

  return (
    <div className={styles.pageWrapper}>
      <Header />

      <main className={styles.main}>
        <div className={styles.heroSection}>
          <div className={styles.container}>
            <span className={styles.badge}>Dicas & atualizações</span>
            <h1 className={styles.pageTitle}>Diário ECOSOPIS</h1>
            <p className={styles.pageSubtitle}>
              Histórias, bastidores e novidades da nossa jornada com você.
            </p>
          </div>
        </div>

        <div className={styles.contentContainer}>
          {loading ? (
            <div className={styles.postsGrid}>
              {[1, 2].map((i) => (
                <div key={i} className={styles.skeletonCard}>
                  <div className={styles.skeletonHeader}>
                    <div className={styles.skeletonAvatar} />
                    <div className={styles.skeletonText} />
                  </div>
                  <div className={styles.skeletonMedia} />
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
              {posts.map((post, index) => {
                const mediaSrc = resolveMediaUrl(post.media_url);
                const expanded = expandedContent[post.id];
                const longText = needsTruncate(post.content);
                const bodyText =
                  longText && !expanded
                    ? `${post.content.slice(0, EXCERPT_MAX).trim()}…`
                    : post.content;

                return (
                  <article
                    key={post.id}
                    className={styles.postCard}
                    style={{ animationDelay: `${index * 0.08}s` }}
                  >
                    <div className={styles.postTopBar}>
                      <div className={styles.avatar}>
                        <User size={18} strokeWidth={2} />
                      </div>
                      <div className={styles.headerInfo}>
                        <span className={styles.authorName}>
                          {post.user?.full_name?.trim() || 'Equipe ECOSOPIS'}
                        </span>
                        <time
                          className={styles.postDate}
                          dateTime={post.created_at}
                        >
                          {formatPostDate(post.created_at)}
                        </time>
                      </div>
                    </div>

                    {mediaSrc && (
                      <div className={styles.mediaWrapper}>
                        {post.media_type === 'video' ? (
                          <video
                            src={mediaSrc}
                            controls
                            playsInline
                            className={styles.postMedia}
                            preload="metadata"
                          />
                        ) : (
                          <img
                            src={mediaSrc}
                            alt={post.title}
                            className={styles.postMedia}
                          />
                        )}
                        <span className={styles.mediaDateBadge}>
                          {formatPostDate(post.created_at)}
                        </span>
                      </div>
                    )}

                    <div className={styles.engagementRow}>
                      <button
                        type="button"
                        className={`${styles.engageBtn} ${post.is_liked ? styles.engageBtnLiked : ''}`}
                        onClick={() => handleLike(post.id)}
                        disabled={likeBusy.has(post.id)}
                        aria-label={post.is_liked ? 'Remover curtida' : 'Curtir'}
                      >
                        {likeBusy.has(post.id) ? (
                          <Loader2 size={22} className={styles.spin} />
                        ) : (
                          <Heart
                            size={22}
                            strokeWidth={2}
                            fill={post.is_liked ? 'currentColor' : 'none'}
                          />
                        )}
                        <span className={styles.engageCount}>{post.likes_count}</span>
                      </button>

                      <button
                        type="button"
                        className={styles.engageBtn}
                        onClick={() => setCommentModalPostId(post.id)}
                        aria-label="Abrir comentários"
                      >
                        <MessageCircle size={22} strokeWidth={2} />
                        <span className={styles.engageCount}>
                          {post.comments_count ?? post.comments.length}
                        </span>
                      </button>

                      <div className={styles.engageSpacer} />

                      <button
                        type="button"
                        className={styles.engageBtn}
                        onClick={() => handleShare(post)}
                        aria-label="Compartilhar"
                      >
                        <Share2 size={20} strokeWidth={2} />
                      </button>
                    </div>

                    {post.likes_count > 0 && (
                      <p className={styles.likesSummary}>
                        <strong>{post.likes_count}</strong>
                        {post.likes_count === 1 ? ' curtida' : ' curtidas'}
                        {post.is_liked && user && (
                          <span className={styles.youLiked}> · Você curtiu</span>
                        )}
                      </p>
                    )}

                    <div className={styles.postContent}>
                      <h2 className={styles.postTitle}>{post.title}</h2>
                      <p className={styles.postExcerpt}>{bodyText}</p>
                      {longText && (
                        <button
                          type="button"
                          className={styles.readMoreBtn}
                          onClick={() => toggleContent(post.id)}
                        >
                          {expanded ? (
                            <>
                              Ver menos <ChevronUp size={16} />
                            </>
                          ) : (
                            <>
                              Ler mais <ChevronDown size={16} />
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <div className={styles.commentCtaRow}>
                      <button
                        type="button"
                        className={styles.openCommentsBtn}
                        onClick={() => setCommentModalPostId(post.id)}
                      >
                        <MessageCircle size={18} strokeWidth={2} />
                        Ver e publicar comentários
                        <span className={styles.commentCtaBadge}>
                          {post.comments_count ?? post.comments.length}
                        </span>
                      </button>
                    </div>
                  </article>
                );
              })}
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

      <NewsCommentModal
        isOpen={commentModalPostId !== null}
        onClose={() => setCommentModalPostId(null)}
        post={commentModalPost}
        onEngagementUpdate={handleEngagementUpdate}
      />

      <AuthPromptModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        reason={authModalReason}
      />
    </div>
  );
}
