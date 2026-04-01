'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import styles from './AuthPromptModal.module.css';

type Reason = 'like' | 'comment';

interface AuthPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: Reason;
}

export default function AuthPromptModal({
  isOpen,
  onClose,
  reason,
}: AuthPromptModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-prompt-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.card}>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Fechar"
        >
          <X size={22} />
        </button>
        <div className={styles.badge}>ECOSOPIS</div>
        <h2 id="auth-prompt-title" className={styles.title}>
          {reason === 'like' ? 'Entre para curtir' : 'Entre para comentar'}
        </h2>
        <p className={styles.text}>
          {reason === 'like'
            ? 'Inicie sessão para apoiar as publicações do Diário ECOSOPIS com uma curtida.'
            : 'Inicie sessão para publicar comentários e participar na conversa com a comunidade.'}
        </p>
        <div className={styles.actions}>
          <Link
            href="/conta"
            className={styles.primary}
            onClick={onClose}
          >
            Entrar ou criar conta
          </Link>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
