'use client';

import { useState, useEffect, useCallback, type MouseEvent } from 'react';
import Link from 'next/link';
import {
  Heart,
  MessageCircle,
  ArrowRight,
  Share2,
  Loader2,
} from 'lucide-react';
import NewsCommentModal, {
  type NewsPostPatch,
} from '@/components/NewsCommentModal/NewsCommentModal';
import AuthPromptModal from '@/components/AuthPromptModal/AuthPromptModal';
import type { NewsComment } from '@/types/news';
import ShareModal from '../ShareModal/ShareModal';
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
  comments_count?: number;
  is_liked: boolean;
  comments: NewsComment[];
}

function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/api/') || url.startsWith('/static/')) return url;
  if (url.startsWith('/')) return url;
  return `/api/${url.replace(/^\/+/, '')}`;
}

export default function NewsSection() {
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharingPost, setSharingPost] = useState<NewsPost | null>(null);
  const [commentModalPostId, setCommentModalPostId] = useState<number | null>(
    null
  );
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState<'like' | 'comment'>(
    'like'
  );
  const [likeBusy, setLikeBusy] = useState<Set<number>>(new Set());

  const authHeaders = useCallback((): HeadersInit => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const token = raw?.trim();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, []);

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch('/api/news/', {
        cache: 'no-store',
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const normalized = (data as NewsPost[]).map((p) => ({
          ...p,
          comments_count: p.comments_count ?? p.comments?.length ?? 0,
          comments: p.comments ?? [],
        }));
        setPosts(normalized.slice(0, 3));
      }
    } catch (err) {
      console.error('Error fetching news:', err);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

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

  const openAuth = (reason: 'like' | 'comment') => {
    setAuthModalReason(reason);
    setAuthModalOpen(true);
  };

  const handleLike = async (e: MouseEvent<HTMLButtonElement>, postId: number) => {
    e.preventDefault();
    e.stopPropagation();
    const raw = localStorage.getItem('token')?.trim();
    if (!raw) {
      openAuth('like');
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
        await fetchNews();
        openAuth('like');
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
        await fetchNews();
      }
    } catch {
      await fetchNews();
    } finally {
      setLikeBusy((s) => {
        const n = new Set(s);
        n.delete(postId);
        return n;
      });
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  if (loading) return null;
  if (posts.length === 0) return null;

  const commentModalPost = commentModalPostId
    ? posts.find((p) => p.id === commentModalPostId) ?? null
    : null;

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
                  <img
                    src={resolveMediaUrl(post.media_url)}
                    alt={post.title}
                  />
                ) : (
                  <div className={styles.placeholder}>🌿</div>
                )}
                <div className={styles.dateBadge}>{getTimeAgo(post.created_at)}</div>
              </div>
              <div className={styles.body}>
                <h3 className={styles.postTitle}>{post.title}</h3>
                <p className={styles.excerpt}>{post.content}</p>
                <div className={styles.footer}>
                  <div className={styles.stats}>
                    <button
                      type="button"
                      className={styles.statBtn}
                      onClick={(e) => handleLike(e, post.id)}
                      disabled={likeBusy.has(post.id)}
                      title={post.is_liked ? 'Remover curtida' : 'Curtir'}
                    >
                      {likeBusy.has(post.id) ? (
                        <Loader2 size={16} className={styles.spin} />
                      ) : (
                        <Heart
                          size={16}
                          className={post.is_liked ? styles.liked : ''}
                          fill={post.is_liked ? 'currentColor' : 'none'}
                        />
                      )}{' '}
                      {post.likes_count}
                    </button>
                    <button
                      type="button"
                      className={styles.statBtn}
                      onClick={() => setCommentModalPostId(post.id)}
                      title="Comentários"
                    >
                      <MessageCircle size={16} />{' '}
                      {post.comments_count ?? post.comments.length}{' '}
                      {(post.comments_count ?? post.comments.length) === 1
                        ? 'comentário'
                        : 'comentários'}
                    </button>
                  </div>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.shareBtn}
                      onClick={() => {
                        setSharingPost(post);
                        setIsShareModalOpen(true);
                      }}
                      title="Compartilhar"
                    >
                      <Share2 size={16} />
                    </button>
                    <Link href="/novidades" className={styles.readMore}>
                      Ler mais
                    </Link>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.commentCta}
                  onClick={() => setCommentModalPostId(post.id)}
                >
                  Comentar nesta publicação
                </button>
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
    </section>
  );
}
