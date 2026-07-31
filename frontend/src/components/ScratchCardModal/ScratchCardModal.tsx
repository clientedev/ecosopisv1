'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './ScratchCardModal.module.css';

interface ScratchPlayResult {
  reward_type: string;
  reward_value: number;
  coupon_code: string;
  expires_at: string;
  message: string;
  user_email?: string;
}

export default function ScratchCardModal() {
  const { user, token, updateUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<ScratchPlayResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [scratchPercent, setScratchPercent] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const hasTriggeredPlay = useRef(false);
  // Keep track of revealed state in a ref to avoid stale closure in useEffect
  const revealedRef = useRef(false);

  useEffect(() => {
    revealedRef.current = revealed;
  }, [revealed]);

  // Check eligibility — never close if we already revealed the result
  useEffect(() => {
    if (revealedRef.current) return;

    if (!user || !token) {
      setIsOpen(false);
      return;
    }

    if (user.scratch_used) {
      setIsOpen(false);
      return;
    }

    const checkEligibility = async () => {
      try {
        const res = await fetch('/api/raspadinha/config');
        if (res.ok) {
          const config = await res.json();
          if (config.enabled) setIsOpen(true);
        }
      } catch (err) {
        console.error('Error checking scratchcard eligibility:', err);
      }
    };

    checkEligibility();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.scratch_used, token]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Silver foil gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0,   '#c0c0c0');
    grad.addColorStop(0.25,'#e8e8e8');
    grad.addColorStop(0.5, '#a8a8a8');
    grad.addColorStop(0.75,'#d4d4d4');
    grad.addColorStop(1,   '#b0b0b0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Fine hatching pattern for texture
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    for (let i = 0; i < w + h; i += 6) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(0, i);
      ctx.stroke();
    }

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.beginPath();
      ctx.arc(x, y, Math.random() * 2.5 + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Label
    ctx.fillStyle = '#555';
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RASPE AQUI', w / 2, h / 2 - 10);
    ctx.font = '13px Arial, sans-serif';
    ctx.fillStyle = '#777';
    ctx.fillText('↕  arraste o dedo  ↕', w / 2, h / 2 + 12);
  }, []);

  useEffect(() => {
    if (isOpen && !revealed) {
      const t = setTimeout(initCanvas, 60);
      return () => clearTimeout(t);
    }
  }, [isOpen, revealed, initCanvas]);

  const claimReward = async () => {
    if (hasTriggeredPlay.current) return;
    hasTriggeredPlay.current = true;
    setLoading(true);

    try {
      const res = await fetch('/api/raspadinha/play', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (res.ok) {
        setResult(data);
        revealedRef.current = true;
        setRevealed(true);
        // Update user AFTER setting revealed so the close-effect is skipped
        if (updateUser) updateUser({ scratch_used: true });
      } else {
        alert(data.detail || 'Erro ao resgatar o prêmio.');
        hasTriggeredPlay.current = false;
      }
    } catch {
      alert('Erro de conexão. Tente novamente.');
      hasTriggeredPlay.current = false;
    } finally {
      setLoading(false);
    }
  };

  const checkScratchPercentage = () => {
    if (hasTriggeredPlay.current || revealed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] === 0) transparent++;
    }
    const pct = Math.round((transparent / (pixels.length / 4)) * 100);
    setScratchPercent(pct);
    if (pct > 42) claimReward();
  };

  const scratch = (clientX: number, clientY: number) => {
    if (hasTriggeredPlay.current || revealed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, Math.PI * 2, false);
    ctx.fill();

    checkScratchPercentage();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => { isDrawing.current = true; scratch(e.clientX, e.clientY); };
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => { if (!isDrawing.current) return; scratch(e.clientX, e.clientY); };
  const handleMouseUp   = () => { isDrawing.current = false; };
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => { if (e.touches.length > 0) { isDrawing.current = true; scratch(e.touches[0].clientX, e.touches[0].clientY); } };
  const handleTouchMove  = (e: React.TouchEvent<HTMLCanvasElement>) => { if (!isDrawing.current || !e.touches.length) return; scratch(e.touches[0].clientX, e.touches[0].clientY); };
  const handleTouchEnd   = () => { isDrawing.current = false; };

  const handleCopy = () => {
    if (!result?.coupon_code) return;
    navigator.clipboard.writeText(result.coupon_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const formatReward = () => {
    if (!result) return '';
    if (result.reward_type === 'percentage') return `${result.reward_value}% OFF`;
    if (result.reward_type === 'fixed') return `R$ ${result.reward_value.toFixed(2)} OFF`;
    if (result.reward_type === 'free_shipping') return 'FRETE GRÁTIS';
    return `${result.reward_value} OFF`;
  };

  const formatExpiry = () => {
    if (!result?.expires_at) return '';
    return new Date(result.expires_at).toLocaleDateString('pt-BR');
  };

  const maskEmail = (email?: string) => {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (!domain) return email;
    return `${local.slice(0, 2)}****@${domain}`;
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget && revealed) setIsOpen(false); }}>
      <div className={styles.card}>

        {/* Header stripe */}
        <div className={styles.headerStripe}>
          <span className={styles.headerLeft}>🎁 RASPADINHA</span>
          <span className={styles.headerRight}>BOAS‑VINDAS</span>
        </div>

        {!revealed ? (
          /* ===== SCRATCH PHASE ===== */
          <div className={styles.scratchPhase}>
            <p className={styles.scratchHint}>Raspe a área abaixo para descobrir seu desconto!</p>

            <div className={styles.cardArea}>
              {/* Prize behind the foil */}
              <div className={styles.prizeBack}>
                <span className={styles.prizeBackIcon}>🏷️</span>
                <span className={styles.prizeBackText}>SEU DESCONTO</span>
              </div>

              {/* Progress bar */}
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${scratchPercent}%` }} />
              </div>

              <canvas
                ref={canvasRef}
                width={300}
                height={160}
                className={styles.canvas}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />

              {loading && <div className={styles.loadingLayer}><div className={styles.dots}><span /><span /><span /></div></div>}
            </div>
          </div>
        ) : (
          /* ===== RESULT PHASE ===== */
          <div className={styles.resultPhase}>
            <div className={styles.winBadge}>VOCÊ GANHOU!</div>

            <div className={styles.discountValue}>{formatReward()}</div>

            <p className={styles.resultMsg}>{result?.message}</p>

            {/* Coupon ticket */}
            <div className={styles.ticket}>
              <div className={styles.ticketNotchLeft} />
              <div className={styles.ticketNotchRight} />
              <div className={styles.ticketInner}>
                <span className={styles.ticketLabel}>USE O CÓDIGO</span>
                <span className={styles.ticketCode}>{result?.coupon_code}</span>
                <span className={styles.ticketExpiry}>válido até {formatExpiry()}</span>
              </div>
            </div>

            <button className={`${styles.copyBtn} ${copied ? styles.copied : ''}`} onClick={handleCopy}>
              {copied ? '✓ Copiado!' : '📋 Copiar código'}
            </button>

            <div className={styles.emailNote}>
              📧 Enviamos também para <strong>{maskEmail(result?.user_email || user?.email)}</strong>
            </div>

            <button className={styles.closeLink} onClick={() => setIsOpen(false)}>
              Fechar e ir às compras →
            </button>
          </div>
        )}

        {/* Bottom serial */}
        <div className={styles.serialBar}>
          <span>Nº 000-{user?.id?.toString().padStart(6, '0')}</span>
          <span>ecosopis.com.br</span>
        </div>
      </div>
    </div>
  );
}
