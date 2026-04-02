'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Heart,
  MessageCircle,
  Share2,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import ShareModal from '@/components/ShareModal/ShareModal';
import NewsCommentModal, {
  type NewsPostPatch,
} from '@/components/NewsCommentModal/NewsCommentModal';
import AuthPromptModal from '@/components/AuthPromptModal/AuthPromptModal';
import { resolveMediaUrl, resolveAvatarUrl, getInitials } from '@/components/NewsCommentModal/newsModalUtils';
import styles from '../page.module.css';

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
    profile_picture?: string | null;
  };
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  comments: any[];
}

function formatPostDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export default function NewsDetailClient({ initialPost }: { initialPost: NewsPost }) {
  const { user } = useAuth();
  const [post, setPost] = useState<NewsPost>(initialPost);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState<'like' | 'comment'>('like');

  const handleEngagementUpdate = (postId: number, patch: Partial<NewsPostPatch>) => {
    setPost((p) => ({
      ...p,
      comments: patch.comments ?? p.comments,
      comments_count: patch.comments_count ?? p.comments_count ?? p.comments.length,
      likes_count: patch.likes_count ?? p.likes_count,
      is_liked: patch.is_liked ?? p.is_liked,
    }));
  };

  const handleLike = async () => {
    const raw = localStorage.getItem('token')?.trim();
    if (!raw) {
      setAuthModalReason('like');
      setAuthModalOpen(true);
      return;
    }
    if (likeBusy) return;
    setLikeBusy(true);

    const optimisticLiked = !post.is_liked;
    const optimisticCount = Math.max(0, post.likes_count + (optimisticLiked ? 1 : -1));
    
    setPost(p => ({ ...p, is_liked: optimisticLiked, likes_count: optimisticCount }));

    try {
      const res = await fetch(`/api/news/${post.id}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${raw}` },
      });
      if (res.ok) {
        const data = await res.json();
        handleEngagementUpdate(post.id, { is_liked: data.liked, likes_count: data.likes_count });
      }
    } catch (err) {
      console.error('Error liking post:', err);
    } finally {
      setLikeBusy(false);
    }
  };

  const mediaSrc = resolveMediaUrl(post.media_url);
  const avatarSrc = resolveAvatarUrl(post.user?.profile_picture);
  const authorName = post.user?.full_name?.trim() || 'Equipe ECOSOPIS';

  return (
    <div className={styles.pageWrapper}>
      <main className={styles.main}>
        <div className={styles.contentContainer} style={{ paddingTop: '100px' }}>
          <Link href="/novidades" className={styles.backButton} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', color: 'var(--primary-green)', fontWeight: 600, textDecoration: 'none' }}>
            <ArrowLeft size={20} /> Voltar para o Diário
          </Link>

          <article className={styles.postCard} style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className={styles.postTopBar}>
              <div className={styles.avatar}>
                {avatarSrc ? (
                  <img src={avatarSrc} alt={authorName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <span>{getInitials(authorName)}</span>
                )}
              </div>
              <div className={styles.headerInfo}>
                <span className={styles.authorName}>{authorName}</span>
                <time className={styles.postDate} dateTime={post.created_at}>
                  {formatPostDate(post.created_at)}
                </time>
              </div>
            </div>

            {mediaSrc && (
              <div className={styles.mediaWrapper}>
                {post.media_type === 'video' ? (
                  <video src={mediaSrc} controls playsInline className={styles.postMedia} />
                ) : (
                  <img src={mediaSrc} alt={post.title} className={styles.postMedia} />
                )}
              </div>
            )}

            <div className={styles.postContent} style={{ padding: '30px' }}>
              <h1 className={styles.postTitle} style={{ fontSize: '2.5rem', marginBottom: '20px' }}>{post.title}</h1>
              <div className={styles.postFullContent} style={{ whiteSpace: 'pre-line', lineHeight: '1.8', fontSize: '1.1rem', color: '#444' }}>
                {post.content}
              </div>
            </div>

            <div className={styles.engagementRow}>
              <button type="button" className={`${styles.engageBtn} ${post.is_liked ? styles.engageBtnLiked : ''}`} onClick={handleLike} disabled={likeBusy}>
                {likeBusy ? <Loader2 size={22} className={styles.spin} /> : <Heart size={22} fill={post.is_liked ? 'currentColor' : 'none'} />}
                <span className={styles.engageCount}>{post.likes_count}</span>
              </button>

              <button type="button" className={styles.engageBtn} onClick={() => setCommentModalOpen(true)}>
                <MessageCircle size={22} />
                <span className={styles.engageCount}>{post.comments_count}</span>
              </button>

              <div className={styles.engageSpacer} />

              <button type="button" className={styles.engageBtn} onClick={() => setIsShareModalOpen(true)}>
                <Share2 size={20} />
              </button>
            </div>
          </article>
        </div>
      </main>

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        url={typeof window !== 'undefined' ? window.location.href : ''}
        title={`Confira essa novidade na ECOSOPIS: ${post.title}`}
      />

      <NewsCommentModal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        post={post as any}
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
