'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Smartphone, Check, X, Loader2 } from 'lucide-react';
import styles from './WhatsAppPromptModal.module.css';

interface WhatsAppPromptModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function WhatsAppPromptModal({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
}: WhatsAppPromptModalProps = {}) {
  const { user, token, refreshProfile } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Se já foi passado como prop controlada
    if (controlledIsOpen !== undefined) {
      setInternalOpen(controlledIsOpen);
      return;
    }

    // Auto-detecção: Usuário logado mas sem telefone
    if (user && token && (!user.phone || user.phone.trim() === '')) {
      const urlParams = new URLSearchParams(window.location.search);
      const urlPrompt = urlParams.get('prompt_whatsapp') === '1';
      const storedPrompt = localStorage.getItem('prompt_whatsapp') === 'true' || sessionStorage.getItem('prompt_whatsapp') === 'true';
      const isGoogleUser = user.auth_provider === 'google' || Boolean(user.google_id);

      if (urlPrompt || storedPrompt || isGoogleUser) {
        setInternalOpen(true);
      }
    } else {
      setInternalOpen(false);
    }
  }, [user, token, controlledIsOpen]);

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;

  if (!isOpen) return null;

  const handleClose = () => {
    if (controlledOnClose) {
      controlledOnClose();
    } else {
      setInternalOpen(false);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('prompt_whatsapp');
        sessionStorage.removeItem('prompt_whatsapp');
      }
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);

    if (v.length > 6) {
      v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
    } else if (v.length > 2) {
      v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    } else if (v.length > 0) {
      v = `(${v}`;
    }

    setPhone(v);
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDigits = phone.replace(/\D/g, '');

    if (cleanDigits.length < 10) {
      setError('Por favor, informe o DDD e o número completo (mínimo 10 dígitos).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const authToken = token || localStorage.getItem('token');
      const res = await fetch('/api/auth/me/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          phone: phone.trim(),
        }),
      });

      if (res.ok) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('prompt_whatsapp');
          sessionStorage.removeItem('prompt_whatsapp');
        }
        await refreshProfile();
        handleClose();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || 'Não foi possível salvar o telefone. Tente novamente.');
      }
    } catch (err: any) {
      setError('Erro de conexão com o servidor. Verifique sua internet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsapp-prompt-title"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className={styles.card}>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={handleClose}
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        <div className={styles.iconWrapper}>
          <Smartphone size={32} />
        </div>

        <div className={styles.badge}>CADASTRO GOOGLE</div>
        <h2 id="whatsapp-prompt-title" className={styles.title}>
          Cadastre seu WhatsApp
        </h2>
        <p className={styles.text}>
          Para receber o rastreamento das suas encomendas e o status dos pedidos em tempo real, informe seu número de WhatsApp:
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div>
            <label className={styles.label}>Número de Celular / WhatsApp:</label>
            <div className={styles.inputGroup}>
              <div className={styles.countryPrefix}>
                <span>🇧🇷</span> +55
              </div>
              <input
                type="tel"
                className={styles.inputField}
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={handlePhoneChange}
                autoFocus
                required
              />
            </div>
            <span className={styles.hint}>
              Exemplo com DDD: (11) 98765-4321
            </span>
            {error && <div className={styles.errorText}>{error}</div>}
          </div>

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading || phone.replace(/\D/g, '').length < 10}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spin" />
                  Salvando WhatsApp...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Salvar WhatsApp e Continuar
                </>
              )}
            </button>
            <button
              type="button"
              className={styles.skipBtn}
              onClick={handleClose}
            >
              Lembrar mais tarde
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
