'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  X,
  Heart,
  Loader2,
  SendHorizontal,
  MessageCircle,
  LogIn,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { NewsComment, NewsPostEngagement } from '@/types/news';
import AuthPromptModal from '@/components/AuthPromptModal/AuthPromptModal';
import {
  resolveMediaUrl,
  resolveAvatarUrl,
  formatCommentTime,
  getInitials,
} from './newsModalUtils';
import styles from './NewsCommentModal.module.css';

export interface NewsPostPatch {
  comments: NewsComment[];
  comments_count: number;
  likes_count: number;
  is_liked: boolean;
}

interface NewsCommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: NewsPostEngagement | null;
  onEngagementUpdate: (postId: number, patch: Partial<NewsPostPatch>) => void;
}

export default function NewsCommentModal({
  isOpen,
  onClose,
  post,
  onEngagementUpdate,
}: NewsCommentModalProps) {
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [posting, setPosting] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<'like' | 'comment'>('comment');
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraft('');
      setError('');
    }
  }, [isOpen, post?.id]);

  const token = useCallback(() => localStorage.getItem('token')?.trim() ?? '', []);

  const handleLike = async () => {
    if (!post) return;
    const raw = token();
    if (!raw) {
      setAuthReason('like');
      setAuthOpen(true);
      return;
    }
    if (likeBusy) return;
    setLikeBusy(true);

    const optimisticLiked = !post.is_liked;
    const optimisticCount = Math.max(
      0,
      post.likes_count + (optimisticLiked ? 1 : -1)
    );
    onEngagementUpdate(post.id, {
      is_liked: optimisticLiked,
      likes_count: optimisticCount,
    });

    try {
      const res = await fetch(`/api/news/${post.id}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${raw}` },
      });
      if (res.status === 401) {
        setAuthReason('like');
        setAuthOpen(true);
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as { liked: boolean; likes_count: number };
        onEngagementUpdate(post.id, {
          is_liked: data.liked,
          likes_count: data.likes_count,
        });
      }
    } catch {
      onEngagementUpdate(post.id, {
        is_liked: post.is_liked,
        likes_count: post.likes_count,
      });
    } finally {
      setLikeBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!post) return;
    const raw = token();
    if (!raw) {
      setAuthReason('comment');
      setAuthOpen(true);
      return;
    }
    const text = draft.trim();
    if (!text) {
      setError('Escreva uma mensagem antes de publicar.');
      return;
    }
    if (posting) return;
    setPosting(true);
    setError('');

    try {
      const res = await fetch(`/api/news/${post.id}/comment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${raw}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: text }),
      });
      if (res.status === 401) {
        setAuthReason('comment');
        setAuthOpen(true);
        return;
      }
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          detail?: string | { msg?: string }[];
        };
        let msg = 'Não foi possível publicar.';
        const d = errBody.detail;
        if (typeof d === 'string') msg = d;
        else if (Array.isArray(d) && d[0] && typeof d[0] === 'object' && 'msg' in d[0]) {
          msg = d.map((x) => (x as { msg: string }).msg).join(' ');
        }
        setError(msg);
        return;
      }
      const newComment = (await res.json()) as NewsComment;
      setDraft('');
      onEngagementUpdate(post.id, {
        comments: [...post.comments, newComment],
        comments_count: (post.comments_count ?? post.comments.length) + 1,
      });
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setPosting(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!post) return;
    const raw = token();
    if (!raw) {
      setAuthReason('comment');
      setAuthOpen(true);
      return;
    }
    if (deletingCommentId) return;
    setDeletingCommentId(commentId);
    setError('');
    try {
      const res = await fetch(`/api/news/${post.id}/comment/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${raw}` },
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { detail?: string };
        setError(errBody.detail || 'Não foi possível excluir o comentário.');
        return;
      }
      const nextComments = post.comments.filter((c) => c.id !== commentId);
      onEngagementUpdate(post.id, {
        comments: nextComments,
        comments_count: Math.max(0, (post.comments_count ?? post.comments.length) - 1),
      });
    } catch {
      setError('Erro de conexão ao excluir comentário.');
    } finally {
      setDeletingCommentId(null);
    }
  };

  if (!isOpen || !post) return null;

  const mediaSrc = resolveMediaUrl(post.media_url);
  const title = post.title || 'Publicação';

  return (
    <>
      <div
        className={styles.overlay}
        role="dialog"
        aria-modal="true"
        aria-labelledby="news-modal-title"
        onClick={handleOverlayClick}
      >
        <div className={styles.panel}>
          <header className={styles.header}>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Fechar"
            >
              <X size={22} />
            </button>
            <div className={styles.headerMain}>
              {mediaSrc && post.media_type !== 'video' && (
                <div className={styles.thumb}>
                  <img src={mediaSrc} alt="" />
                </div>
              )}
              <div className={styles.postAuthorThumb}>
                {post.user?.profile_picture ? (
                  <img 
                    src={resolveAvatarUrl(post.user.profile_picture) ?? ''} 
                    alt={post.user?.full_name || ''} 
                    className={styles.authorAvatar} 
                  />
                ) : (
                  <div className={styles.avatarPlaceholder}>{getInitials(post.user?.full_name)}</div>
                )}
              </div>
              <div className={styles.headerText}>
                <h2 id="news-modal-title" className={styles.modalTitle}>
                  {title}
                </h2>
                <div className={styles.headerActions}>
                  <button
                    type="button"
                    className={`${styles.likeBtn} ${post.is_liked ? styles.likeBtnActive : ''}`}
                    onClick={handleLike}
                    disabled={likeBusy}
                    aria-label={post.is_liked ? 'Remover curtida' : 'Curtir'}
                  >
                    {likeBusy ? (
                      <Loader2 size={20} className={styles.spin} />
                    ) : (
                      <Heart
                        size={20}
                        strokeWidth={2}
                        fill={post.is_liked ? 'currentColor' : 'none'}
                      />
                    )}
                    <span>{post.likes_count}</span>
                  </button>
                  <span className={styles.metaPill}>
                    <MessageCircle size={16} strokeWidth={2} />
                    {post.comments_count ?? post.comments.length}{' '}
                    {(post.comments_count ?? post.comments.length) === 1
                      ? 'comentário'
                      : 'comentários'}
                  </span>
                </div>
              </div>
            </div>
          </header>

          <div className={styles.body}>
            <div className={styles.commentsScroll}>
              {post.comments.length === 0 ? (
                <p className={styles.empty}>
                  Ainda não há comentários. Seja a primeira pessoa a responder.
                </p>
              ) : (
                post.comments.map((c) => {
                  const av = resolveAvatarUrl(c.user.profile_picture);
                  const name = c.user.full_name?.trim() || 'Utilizador';
                  return (
                    <div key={c.id} className={styles.commentRow}>
                      <div className={styles.commentAvatar}>
                        {av ? (
                          <img src={av} alt="" />
                        ) : (
                          <span>{getInitials(name)}</span>
                        )}
                      </div>
                      <div className={styles.commentMain}>
                        <div className={styles.commentTop}>
                          <span className={styles.commentName}>{name}</span>
                          <span className={styles.commentWhen}>
                            {formatCommentTime(c.created_at)}
                          </span>
                        </div>
                        <p className={styles.commentBody}>{c.content}</p>
                        {user?.role === 'admin' && (
                          <button
                            type="button"
                            className={styles.deleteCommentBtn}
                            onClick={() => handleDeleteComment(c.id)}
                            disabled={deletingCommentId === c.id}
                          >
                            {deletingCommentId === c.id ? (
                              <Loader2 size={14} className={styles.spin} />
                            ) : (
                              <Trash2 size={14} />
                            )}
                            Excluir
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className={styles.footer}>
              {user ? (
                <>
                  <label className={styles.label} htmlFor="news-modal-comment">
                    O seu comentário
                  </label>
                  <textarea
                    id="news-modal-comment"
                    className={styles.textarea}
                    rows={3}
                    placeholder="Partilhe a sua opinião…"
                    value={draft}
                    maxLength={2000}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  {error && <p className={styles.error}>{error}</p>}
                  <div className={styles.footerRow}>
                    <span className={styles.counter}>{draft.length}/2000</span>
                    <button
                      type="button"
                      className={styles.publish}
                      onClick={handleSubmit}
                      disabled={posting}
                    >
                      {posting ? (
                        <>
                          <Loader2 size={18} className={styles.spin} />
                          A publicar…
                        </>
                      ) : (
                        <>
                          <SendHorizontal size={18} />
                          Publicar comentário
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className={styles.guest}>
                  <LogIn size={22} className={styles.guestIcon} />
                  <div>
                    <p className={styles.guestTitle}>Participe na conversa</p>
                    <p className={styles.guestText}>
                      <button
                        type="button"
                        className={styles.link}
                        onClick={() => {
                          setAuthReason('comment');
                          setAuthOpen(true);
                        }}
                      >
                        Inicie sessão
                      </button>{' '}
                      ou{' '}
                      <Link href="/conta" className={styles.linkInline}>
                        crie uma conta
                      </Link>{' '}
                      para comentar.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AuthPromptModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        reason={authReason}
      />
    </>
  );
}
