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
  const [progress, setProgress] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const hasTriggeredPlay = useRef(false);
  const revealedRef = useRef(false);

  useEffect(() => { revealedRef.current = revealed; }, [revealed]);

  // Só abre o modal se elegível — e NUNCA fecha se já revelou
  useEffect(() => {
    if (revealedRef.current) return;
    if (!user || !token) { setIsOpen(false); return; }
    if (user.scratch_used) { setIsOpen(false); return; }

    fetch('/api/raspadinha/config')
      .then(r => r.ok ? r.json() : null)
      .then(cfg => { if (cfg?.enabled) setIsOpen(true); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.scratch_used, token]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;

    // Silver gradient foil
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0,    '#c8c8c8');
    g.addColorStop(0.3,  '#e4e4e4');
    g.addColorStop(0.5,  '#b0b0b0');
    g.addColorStop(0.75, '#d8d8d8');
    g.addColorStop(1,    '#bdbdbd');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Diagonal lines texture
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    for (let i = -h; i < w + h; i += 8) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.stroke();
    }

    // Text
    ctx.fillStyle = '#606060';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RASPE AQUI PARA REVELAR', w / 2, h / 2);
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        revealedRef.current = true;
        setRevealed(true);
        if (updateUser) updateUser({ scratch_used: true });
      } else {
        alert(data.detail || 'Erro ao resgatar.');
        hasTriggeredPlay.current = false;
      }
    } catch {
      alert('Erro de conexão. Tente novamente.');
      hasTriggeredPlay.current = false;
    } finally {
      setLoading(false);
    }
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
    ctx.arc(x, y, 26, 0, Math.PI * 2, false);
    ctx.fill();

    // Progress
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let t = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] === 0) t++;
    const pct = Math.round((t / (pixels.length / 4)) * 100);
    setProgress(pct);
    if (pct > 42) claimReward();
  };

  const onDown  = (e: React.MouseEvent<HTMLCanvasElement>) => { isDrawing.current = true; scratch(e.clientX, e.clientY); };
  const onMove  = (e: React.MouseEvent<HTMLCanvasElement>) => { if (isDrawing.current) scratch(e.clientX, e.clientY); };
  const onUp    = () => { isDrawing.current = false; };
  const onTDown = (e: React.TouchEvent<HTMLCanvasElement>) => { if (e.touches.length) { isDrawing.current = true; scratch(e.touches[0].clientX, e.touches[0].clientY); } };
  const onTMove = (e: React.TouchEvent<HTMLCanvasElement>) => { if (isDrawing.current && e.touches.length) scratch(e.touches[0].clientX, e.touches[0].clientY); };
  const onTUp   = () => { isDrawing.current = false; };

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
    return 'FRETE GRÁTIS';
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
    <div className={styles.overlay}>
      <div className={styles.modal}>

        {/* Green header bar */}
        <div className={styles.topBar}>
          <span className={styles.topBarLabel}>🌿 Presente de Boas-Vindas</span>
        </div>

        <div className={styles.body}>
          {!revealed ? (
            <>
              <h2 className={styles.title}>Raspe e descubra<br />seu desconto!</h2>
              <p className={styles.subtitle}>Você ganhou uma raspadinha exclusiva. Arraste o dedo ou mouse para revelar.</p>

              <div className={styles.scratchWrapper}>
                {/* Prize behind the foil */}
                <div className={styles.prizeBack}>
                  <span className={styles.leafIcon}>🌱</span>
                  <span className={styles.prizeBackHint}>SEU DESCONTO</span>
                </div>

                <canvas
                  ref={canvasRef}
                  width={300}
                  height={140}
                  className={styles.canvas}
                  onMouseDown={onDown}
                  onMouseMove={onMove}
                  onMouseUp={onUp}
                  onMouseLeave={onUp}
                  onTouchStart={onTDown}
                  onTouchMove={onTMove}
                  onTouchEnd={onTUp}
                />

                {loading && (
                  <div className={styles.loadingCover}>
                    <div className={styles.spinner} />
                  </div>
                )}
              </div>

              {/* Progress bar */}
              <div className={styles.progressTrack}>
                <div className={styles.progressBar} style={{ width: `${progress}%` }} />
              </div>
              <p className={styles.progressLabel}>{progress < 20 ? 'Comece a raspar…' : progress < 42 ? 'Continue…' : 'Revelando…'}</p>
            </>
          ) : (
            <div className={styles.resultArea}>
              <div className={styles.resultTop}>
                <span className={styles.winIcon}>🎉</span>
                <h2 className={styles.winTitle}>Você ganhou!</h2>
                <p className={styles.winDesc}>{result?.message || 'Aproveite seu desconto especial de boas-vindas.'}</p>
              </div>

              <div className={styles.discountBadge}>{formatReward()}</div>

              {/* Coupon */}
              <div className={styles.couponArea}>
                <span className={styles.couponHint}>Use o código abaixo no carrinho</span>
                <div className={styles.couponRow}>
                  <span className={styles.couponCode}>{result?.coupon_code}</span>
                  <button
                    className={`${styles.copyBtn} ${copied ? styles.copyOk : ''}`}
                    onClick={handleCopy}
                  >
                    {copied ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
                <span className={styles.couponExpiry}>Válido até {formatExpiry()}</span>
              </div>

              <p className={styles.emailInfo}>
                📧 Enviamos também para <strong>{maskEmail(result?.user_email || user?.email)}</strong>
              </p>

              <button className={styles.shopBtn} onClick={() => setIsOpen(false)}>
                Ir às compras →
              </button>
            </div>
          )}
        </div>

        <button className={styles.closeBtn} onClick={() => setIsOpen(false)} aria-label="Fechar">✕</button>
      </div>
    </div>
  );
}
