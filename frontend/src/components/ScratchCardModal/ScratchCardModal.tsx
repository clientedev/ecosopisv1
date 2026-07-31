'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './ScratchCardModal.module.css';
import { X, Sparkles, Copy, Check, ShoppingBag, Mail, Gift } from 'lucide-react';

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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const hasTriggeredPlay = useRef(false);

  // Check eligibility on mount / auth change
  useEffect(() => {
    if (!user || !token) {
      setIsOpen(false);
      return;
    }

    // scratch_used now reflects "used this month" (computed server-side)
    if (user.scratch_used) {
      setIsOpen(false);
      return;
    }

    // Fetch config to check if scratchcard is enabled
    const checkEligibility = async () => {
      try {
        const res = await fetch('/api/raspadinha/config');
        if (res.ok) {
          const config = await res.json();
          if (config.enabled && !user.scratch_used) {
            setIsOpen(true);
          }
        }
      } catch (err) {
        console.error('Error checking scratchcard eligibility:', err);
      }
    };

    checkEligibility();
  }, [user, token]);

  // Initialize Canvas coat
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Draw metallic silver background
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#cbd5e1');
    grad.addColorStop(0.3, '#94a3b8');
    grad.addColorStop(0.5, '#e2e8f0');
    grad.addColorStop(0.7, '#64748b');
    grad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Draw subtle pattern dots/sparkles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const radius = Math.random() * 3 + 1;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw text overlay: "Raspe Aqui ✨"
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✨ RASPE AQUI ✨', width / 2, height / 2);
  }, []);

  useEffect(() => {
    if (isOpen && !revealed) {
      // Small timeout to allow canvas element to render in DOM
      const timer = setTimeout(() => {
        initCanvas();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, revealed, initCanvas]);

  // Claim reward API call
  const claimReward = async () => {
    if (hasTriggeredPlay.current) return;
    hasTriggeredPlay.current = true;
    setLoading(true);

    try {
      const res = await fetch('/api/raspadinha/play', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data: ScratchPlayResult = await res.json();
        setResult(data);
        setRevealed(true);
        // Update user state locally - scratch_used = true for this month
        if (updateUser) {
          updateUser({ scratch_used: true });
        }
      } else {
        const errorData = await res.json();
        alert(errorData.detail || 'Erro ao resgatar o prêmio da raspadinha.');
      }
    } catch (err) {
      console.error('Error claiming scratchcard prize:', err);
      alert('Erro de conexão ao processar a raspadinha.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate scratched area percentage
  const checkScratchPercentage = () => {
    if (hasTriggeredPlay.current || revealed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;
    let transparentCount = 0;

    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] === 0) {
        transparentCount++;
      }
    }

    const totalPixels = pixels.length / 4;
    const ratio = transparentCount / totalPixels;

    if (ratio > 0.45) {
      claimReward();
    }
  };

  // Scratch handler
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
    ctx.arc(x, y, 22, 0, Math.PI * 2, false);
    ctx.fill();

    checkScratchPercentage();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    scratch(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    scratch(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length > 0) {
      isDrawing.current = true;
      scratch(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || e.touches.length === 0) return;
    scratch(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    isDrawing.current = false;
  };

  const handleCopyCoupon = () => {
    if (!result?.coupon_code) return;
    navigator.clipboard.writeText(result.coupon_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const formatRewardLabel = () => {
    if (!result) return '';
    if (result.reward_type === 'percentage') {
      return `${result.reward_value}% DE DESCONTO`;
    } else if (result.reward_type === 'fixed') {
      return `R$ ${result.reward_value.toFixed(2)} DE DESCONTO`;
    } else if (result.reward_type === 'free_shipping') {
      return 'FRETE GRÁTIS';
    }
    return `${result.reward_value} DE DESCONTO`;
  };

  const formatExpiry = () => {
    if (!result?.expires_at) return '';
    const d = new Date(result.expires_at);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Mask email for display: ga****@gmail.com
  const maskEmail = (email?: string) => {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const visible = local.slice(0, 2);
    return `${visible}****@${domain}`;
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modalCard}>
        <button className={styles.closeBtn} onClick={handleClose} aria-label="Fechar">
          <X size={20} />
        </button>

        <span className={styles.badge}>
          <Sparkles size={14} style={{ display: 'inline', marginRight: 6 }} />
          PRESENTE DE BOAS-VINDAS
        </span>

        {!revealed ? (
          <>
            <h2 className={styles.title}>Raspe para descobrir seu presente!</h2>
            <p className={styles.subtitle}>Você ganhou uma raspadinha exclusiva de boas-vindas.</p>

            <div className={styles.canvasContainer}>
              <div className={styles.prizeUnderlay}>
                <span className={styles.prizeUnderlayTitle}>REVELANDO...</span>
                <span className={styles.prizeUnderlayValue}>🎁 ???</span>
              </div>

              <canvas
                ref={canvasRef}
                width={320}
                height={180}
                className={styles.scratchCanvas}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />

              {loading && (
                <div className={styles.loadingOverlay}>
                  <div className={styles.spinner} />
                </div>
              )}
            </div>

            <p className={styles.instructionHint}>
              <Sparkles size={16} /> Passe o dedo ou mouse por cima da área prateada para raspar
            </p>
          </>
        ) : (
          <div className={styles.resultContainer}>
            <div className={styles.confettiEmoji}>🎉</div>
            <h2 className={styles.congratsTitle}>Parabéns! Você ganhou!</h2>

            <div className={styles.rewardHighlight}>
              <Gift size={22} className={styles.rewardIcon} />
              {formatRewardLabel()}
            </div>

            {/* BIG COUPON BOX */}
            <div className={styles.couponBox}>
              <div className={styles.couponLabel}>Seu cupom exclusivo:</div>
              <div className={styles.couponCodeBig}>{result?.coupon_code}</div>
              <div className={styles.couponExpiry}>
                Válido até: <strong>{formatExpiry()}</strong>
              </div>
              <button
                className={`${styles.copyBtn} ${copied ? styles.copyBtnSuccess : ''}`}
                onClick={handleCopyCoupon}
              >
                {copied ? (
                  <><Check size={18} /> Cupom Copiado!</>
                ) : (
                  <><Copy size={18} /> Copiar Cupom</>
                )}
              </button>
            </div>

            {/* EMAIL NOTICE */}
            <div className={styles.emailNotice}>
              <Mail size={16} className={styles.emailIcon} />
              <span>
                Enviamos o cupom para{' '}
                <strong>{maskEmail(result?.user_email || user?.email)}</strong>
              </span>
            </div>

            <button className={styles.secondaryBtn} onClick={handleClose}>
              <ShoppingBag size={16} style={{ display: 'inline', marginRight: 6 }} />
              Usar agora nas compras
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
