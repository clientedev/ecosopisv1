"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import styles from "./RouletteModal.module.css";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";

interface Prize {
    id: number;
    nome: string;
    descricao: string;
    discount_type?: string;
    discount_value?: number;
}

export default function RouletteModal() {
    const { token, user } = useAuth();
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [isSpinning, setIsSpinning] = useState(false);
    const [result, setResult] = useState<Prize | null>(null);
    const [prizes, setPrizes] = useState<Prize[]>([]);
    const [config, setConfig] = useState<any>(null);
    const [redeemMsg, setRedeemMsg] = useState("");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const rotationRef = useRef(0);
    const canvasSizeRef = useRef(400);
    // Prevent the effect from closing the modal once it's been opened
    const hasOpenedRef = useRef(false);

    // ─── Draw ──────────────────────────────────────────────────────────────
    const drawRoulette = useCallback((rotation: number) => {
        const canvas = canvasRef.current;
        if (!canvas || prizes.length === 0) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const size = canvasSizeRef.current;
        const centerX = size / 2;
        const centerY = size / 2;
        const outerRadius = centerX - 4;
        const wheelRadius = outerRadius - 16;

        ctx.clearRect(0, 0, size, size);

        // ── Rim ──
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
        const rimGrad = ctx.createLinearGradient(0, 0, size, size);
        rimGrad.addColorStop(0, "#b8860b");
        rimGrad.addColorStop(0.5, "#ffd700");
        rimGrad.addColorStop(1, "#b8860b");
        ctx.fillStyle = rimGrad;
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 18;
        ctx.fill();
        ctx.shadowBlur = 0;

        // ── Inner rim shadow ──
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius - 4, 0, 2 * Math.PI);
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // ── Animated lights ──
        const numLights = Math.max(16, Math.floor(outerRadius * 0.28));
        const lightRadius = Math.max(3, outerRadius * 0.035);
        for (let i = 0; i < numLights; i++) {
            const angle = (i * (2 * Math.PI)) / numLights + rotation * 0.1;
            const x = centerX + (outerRadius - 9) * Math.cos(angle);
            const y = centerY + (outerRadius - 9) * Math.sin(angle);
            ctx.beginPath();
            ctx.arc(x, y, lightRadius, 0, 2 * Math.PI);
            const isGlow = Math.floor(i + rotation * 8) % 4 === 0;
            ctx.fillStyle = isGlow ? "#fff" : "#ffd700";
            ctx.shadowColor = isGlow ? "#fff" : "#ffd700";
            ctx.shadowBlur = isGlow ? 12 : 4;
            ctx.fill();
        }
        ctx.shadowBlur = 0;

        // ── Slices ──
        const prizePool =
            prizes.length < 6
                ? [...prizes, ...prizes, ...prizes, ...prizes, ...prizes, ...prizes].slice(
                      0,
                      Math.max(prizes.length * 2, 6)
                  )
                : prizes;

        const sliceAngle = (2 * Math.PI) / prizePool.length;
        const colorSchemes = [
            { main: "#1b4332", dark: "#0f281e", text: "#ffffff" }, // Emerald deep
            { main: "#2d6a4f", dark: "#1b4332", text: "#ffffff" }, // Emerald medium
            { main: "#d4af37", dark: "#aa882c", text: "#0f281e" }, // Premium gold - dark emerald text!
            { main: "#40916c", dark: "#2d6a4f", text: "#ffffff" }, // Soft sage
        ];

        prizePool.forEach((prize, i) => {
            const angle = rotation + i * sliceAngle;
            const scheme = colorSchemes[i % colorSchemes.length];

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, wheelRadius, angle, angle + sliceAngle);

            const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, wheelRadius);
            grad.addColorStop(0, scheme.main);
            grad.addColorStop(1, scheme.dark);
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.18)";
            ctx.lineWidth = 1;
            ctx.stroke();

            // Text
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(angle + sliceAngle / 2);
            ctx.textAlign = "right";

            // Set responsive text font and style
            // Reduce base font size slightly to fit text better
            const fontSize = Math.max(9, Math.floor(size * 0.032));
            ctx.font = `800 ${fontSize}px "Karla", "Raleway", system-ui, sans-serif`;

            const textOffset = Math.floor(size * 0.06); // Push a bit closer to edge

            // Split text to avoid "..."
            const words = prize.nome.split(" ");
            let line1 = "";
            let line2 = "";
            
            if (prize.nome.length > 14) {
                if (words.length > 1) {
                    const mid = Math.ceil(words.length / 2);
                    line1 = words.slice(0, mid).join(" ");
                    line2 = words.slice(mid).join(" ");
                } else {
                    line1 = prize.nome.substring(0, 12) + "-";
                    line2 = prize.nome.substring(12);
                }
            } else {
                line1 = prize.nome;
            }

            // Setup styles for extreme readability and high contrast
            ctx.strokeStyle = scheme.text === "#ffffff" ? "rgba(0, 0, 0, 0.7)" : "rgba(255, 255, 255, 0.8)";
            ctx.lineWidth = 3;
            ctx.lineJoin = "round";
            ctx.fillStyle = scheme.text;

            const renderLine = (str: string, yOffset: number) => {
                ctx.strokeText(str, wheelRadius - textOffset, yOffset);
                ctx.fillText(str, wheelRadius - textOffset, yOffset);
            };

            if (line2) {
                renderLine(line1, -fontSize * 0.2);
                renderLine(line2, fontSize * 0.9);
            } else {
                renderLine(line1, fontSize * 0.35);
            }
            ctx.restore();
        });

        // ── Hub ──
        const hubRadius = Math.max(18, Math.floor(size * 0.065));
        ctx.beginPath();
        ctx.arc(centerX, centerY, hubRadius, 0, 2 * Math.PI);
        const hubGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, hubRadius);
        hubGrad.addColorStop(0, "#ffd700");
        hubGrad.addColorStop(0.7, "#b8860b");
        hubGrad.addColorStop(1, "#8b6508");
        ctx.fillStyle = hubGrad;
        ctx.shadowColor = "rgba(0,0,0,0.4)";
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 3;
        ctx.stroke();

        // Inner hub detail
        const innerHubR = Math.max(6, Math.floor(size * 0.024));
        ctx.beginPath();
        ctx.arc(centerX, centerY, innerHubR, 0, 2 * Math.PI);
        ctx.fillStyle = "#1a3a16";
        ctx.fill();
    }, [prizes]);

    // ─── Responsiveness: ResizeObserver ───────────────────────────────────
    const updateCanvasSize = useCallback(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const rect = container.getBoundingClientRect();
        const size = Math.round(rect.width);
        if (size < 10) return;

        canvasSizeRef.current = size;

        // Use devicePixelRatio for crisp rendering
        const dpr = window.devicePixelRatio || 1;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;

        const ctx = canvas.getContext("2d");
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        drawRoulette(rotationRef.current);
    }, [drawRoulette]);

    useEffect(() => {
        if (!isOpen || prizes.length === 0) return;

        const ro = new ResizeObserver(() => {
            updateCanvasSize();
        });

        if (containerRef.current) {
            ro.observe(containerRef.current);
        }

        // Initial sizing (needs a short delay to let CSS layout settle)
        const t = setTimeout(updateCanvasSize, 50);

        return () => {
            ro.disconnect();
            clearTimeout(t);
        };
    }, [isOpen, prizes, updateCanvasSize]);

    // ─── Manual open listener (separate, stable) ─────────────────────────
    useEffect(() => {
        const handleManualOpen = () => {
            hasOpenedRef.current = true;
            setIsOpen(true);
            sessionStorage.setItem("roulette_manual_trigger", "true");
            sessionStorage.setItem("roulette_modal_open", "true");
        };
        window.addEventListener("open-roulette", handleManualOpen);
        return () => window.removeEventListener("open-roulette", handleManualOpen);
    }, []);

    // ─── Eligibility check ────────────────────────────────────────────────
    useEffect(() => {
        // Once opened, never re-evaluate (user will close explicitly)
        if (hasOpenedRef.current) return;

        let cancelled = false;

        const checkEligibility = async () => {
            const isManual = sessionStorage.getItem("roulette_manual_trigger") === "true";

            // Only auto-open on home page
            if (pathname !== "/" && !isManual) return;

            // Restore if this session already had it open
            if (sessionStorage.getItem("roulette_modal_open") === "true") {
                if (!cancelled) {
                    hasOpenedRef.current = true;
                    setIsOpen(true);
                }
                return;
            }

            try {
                const configRes = await fetch("/api/roleta/config");
                const configData = await configRes.json();
                if (cancelled) return;
                setConfig(configData);
                if (!configData.ativa) return;

                const prizeRes = await fetch("/api/roleta/prizes");
                const prizeData = await prizeRes.json();
                if (cancelled) return;
                setPrizes(prizeData);

                const canSpin = !!(token && user && user.pode_girar_roleta);
                const spinShown = sessionStorage.getItem("roulette_spin_shown");
                const teaserShown = sessionStorage.getItem("roulette_teaser_shown");

                if (canSpin && !spinShown) {
                    hasOpenedRef.current = true;
                    setIsOpen(true);
                    sessionStorage.setItem("roulette_spin_shown", "true");
                    sessionStorage.setItem("roulette_modal_open", "true");
                } else if (configData.popup_ativo && !teaserShown && !spinShown) {
                    hasOpenedRef.current = true;
                    setIsOpen(true);
                    sessionStorage.setItem("roulette_teaser_shown", "true");
                    sessionStorage.setItem("roulette_modal_open", "true");
                }
            } catch (error) {
                console.error("Error checking roulette eligibility:", error);
            }
        };

        checkEligibility();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, user, pathname]);



    // ─── Spin ──────────────────────────────────────────────────────────────
    const handleSpin = async () => {
        if (isSpinning) return;
        const t = localStorage.getItem("token");
        if (!t) return;

        try {
            setIsSpinning(true);
            const res = await fetch("/api/roleta/girar", {
                method: "POST",
                headers: { Authorization: `Bearer ${t}` },
            });

            if (!res.ok) {
                const err = await res.json();
                alert(err.detail || "Erro ao girar a roleta");
                setIsSpinning(false);
                return;
            }

            const data = await res.json();
            const chosenPrize = data.prize;

            const prizePool =
                prizes.length < 6
                    ? [...prizes, ...prizes, ...prizes, ...prizes, ...prizes, ...prizes].slice(
                          0,
                          Math.max(prizes.length * 2, 6)
                      )
                    : prizes;
            const prizeIndex = prizePool.findIndex((p) => p.id === chosenPrize.id);
            const sliceAngle = (2 * Math.PI) / prizePool.length;
            const extraRotations = 10 * 2 * Math.PI;
            const prizePosition = -(prizeIndex * sliceAngle + sliceAngle / 2) - Math.PI / 2;
            const finalRotationValue = extraRotations + prizePosition;

            const startTime = performance.now();
            const duration = 6000;

            const animate = (time: number) => {
                const elapsed = time - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
                const currentRotation = easeOut * finalRotationValue;
                rotationRef.current = currentRotation;
                drawRoulette(currentRotation);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    setIsSpinning(false);
                    setResult(chosenPrize);
                }
            };

            requestAnimationFrame(animate);
        } catch (error) {
            console.error("Error spinning:", error);
            setIsSpinning(false);
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        sessionStorage.removeItem("roulette_modal_open");
        sessionStorage.removeItem("roulette_manual_trigger");
    };

    const handleRedeem = () => {
        if (result && result.discount_type && result.discount_value) {
            const discountData = {
                type: result.discount_type,
                value: result.discount_value,
                name: result.nome,
            };
            localStorage.setItem("active_roulette_discount", JSON.stringify(discountData));
            window.dispatchEvent(new Event("roulette_discount_applied"));
            setRedeemMsg("success"); // We'll just use a flag and render the HTML in the JSX
        } else {
            setIsOpen(false);
            sessionStorage.removeItem("roulette_modal_open");
            sessionStorage.removeItem("roulette_manual_trigger");
        }
    };

    if (!mounted || !isOpen) return null;

    const showTeaser = !user || !user.pode_girar_roleta;

    return createPortal(
        <div className={styles.overlay}>
            <div className={styles.modal}>
                {!result && (
                    <button className={styles.closeBtn} onClick={handleClose} aria-label="Fechar">
                        ×
                    </button>
                )}

                {/* ── Teaser (not logged in / no spin) ── */}
                {showTeaser && !result ? (
                    <div className={styles.teaserContent}>
                        <div className={styles.teaserIcon}>🎡</div>
                        <h2 className={styles.title}>Giro da Sorte</h2>
                        <p className={styles.subtitle}>
                            Prepare-se para transformar seu autocuidado! Ganhe prêmios exclusivos agora mesmo.
                        </p>
                        <p className={styles.teaserCall}>
                            <span className={styles.highlight}>Crie sua conta</span> hoje mesmo e libere seu
                            giro gratuito para ganhar prêmios exclusivos de autocuidado!
                        </p>
                        {!user ? (
                            <Link href="/conta" className={styles.spinBtn} onClick={handleClose}>
                                CADASTRAR E GANHAR AGORA
                            </Link>
                        ) : (
                            <Link href="/produtos" className={styles.spinBtn} onClick={handleClose}>
                                VER PRODUTOS E GANHAR
                            </Link>
                        )}
                    </div>
                ) : !result ? (
                    /* ── Spin screen ── */
                    <>
                        <h2 className={styles.title}>🍀 Giro da Sorte!</h2>
                        <p className={styles.subtitle}>
                            Você ganhou um giro gratuito na nossa roleta e pode ganhar prêmios incríveis de
                            autocuidado.
                        </p>

                        <div className={styles.rouletteWrapper}>
                            <div className={styles.rouletteContainer} ref={containerRef}>
                                {/* Pointer */}
                                <div className={styles.pointer}>
                                    <svg viewBox="0 0 24 24" fill="#ffd700" stroke="#1b4332" strokeWidth="1.5">
                                        <path d="M12 21l-8-16h16l-8 16z" />
                                    </svg>
                                </div>

                                <canvas ref={canvasRef} className={styles.canvas} />
                            </div>
                        </div>

                        <button
                            className={`${styles.spinBtn} ${isSpinning ? styles.spinning : ""}`}
                            onClick={handleSpin}
                            disabled={isSpinning}
                        >
                            {isSpinning ? (
                                <>
                                    <span className={styles.spinnerDot} />
                                    Girando…
                                </>
                            ) : (
                                "GIRAR AGORA"
                            )}
                        </button>
                    </>
                ) : (
                    /* ── Result screen ── */
                    <div className={styles.resultContainer}>
                        {[...Array(20)].map((_, i) => (
                            <div
                                key={i}
                                className={styles.confetti}
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    animationDelay: `${Math.random() * 3}s`,
                                    backgroundColor: ["#ffd700", "#2d5a27", "#ffffff", "#b8860b"][
                                        Math.floor(Math.random() * 4)
                                    ],
                                }}
                            />
                        ))}

                        <span className={styles.resultIcon}>🎁</span>
                        <h2 className={styles.title}>Parabéns!</h2>
                        <p className={styles.subtitle}>Sorte grande! Você acaba de ganhar:</p>
                        <h3 className={styles.resultTitle}>{result.nome}</h3>
                        <p className={styles.resultDesc}>{result.descricao}</p>

                        {redeemMsg ? (
                            <div className={styles.redeemSuccess}>
                                <div style={{ background: '#f0fdf4', border: '1px dashed #22c55e', padding: '16px', borderRadius: '12px', textAlign: 'left', marginBottom: '16px' }}>
                                    <h4 style={{ color: '#166534', marginTop: 0, marginBottom: '10px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        ✅ Cupom salvo com sucesso!
                                    </h4>
                                    <p style={{ color: '#166534', fontSize: '0.9rem', marginBottom: '8px', fontWeight: 600 }}>Como utilizar seu desconto:</p>
                                    <ol style={{ color: '#15803d', fontSize: '0.85rem', margin: 0, paddingLeft: '20px', lineHeight: '1.5' }}>
                                        <li>Adicione seus produtos desejados ao carrinho.</li>
                                        <li>Acesse a página do Carrinho.</li>
                                        <li>Logo abaixo do campo de cupom, procure pela caixa verde informando seu prêmio.</li>
                                        <li>Clique no botão <strong>&quot;USAR ESTE CUPOM&quot;</strong> para aplicar o desconto no valor final!</li>
                                    </ol>
                                </div>
                                <div className={styles.redeemActions}>
                                    <Link href="/carrinho" className={styles.spinBtn} onClick={handleClose} style={{ marginBottom: '10px' }}>
                                        IR PARA O CARRINHO
                                    </Link>
                                    <button className={styles.closeLinkBtn} onClick={handleClose}>
                                        Continuar navegando
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button className={styles.spinBtn} onClick={handleRedeem}>
                                RESGATAR MEU PRÊMIO
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
