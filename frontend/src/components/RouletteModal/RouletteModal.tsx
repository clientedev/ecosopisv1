"use client";
import React, { useState, useEffect, useRef } from "react";
import styles from "./RouletteModal.module.css";
import Image from "next/image";
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
    // ... rest of state
    const [result, setResult] = useState<Prize | null>(null);
    const [prizes, setPrizes] = useState<Prize[]>([]);
    const [config, setConfig] = useState<any>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rotationRef = useRef(0);

    // Initial check for eligibility - runs on mount and path/auth changes
    useEffect(() => {
        const checkEligibility = async () => {
            // Restriction 1: ONLY on the root home page for AUTOMATIC showing
            // But we allow manual triggers via events anywhere
            if (pathname !== "/" && !sessionStorage.getItem("roulette_manual_trigger")) {
                setIsOpen(false);
                return;
            }

            try {
                const configRes = await fetch("/api/roleta/config");
                const configData = await configRes.json();
                setConfig(configData);

                if (!configData.ativa) {
                    setIsOpen(false);
                    return;
                }

                const prizeRes = await fetch("/api/roleta/prizes");
                const prizeData = await prizeRes.json();
                setPrizes(prizeData);

                const isLogged = !!(token && user);
                const canSpin = user?.pode_girar_roleta;

                // Flags to avoid annoying the user
                const teaserShown = sessionStorage.getItem("roulette_teaser_shown");
                const spinShown = sessionStorage.getItem("roulette_spin_shown");

                if (isLogged && canSpin) {
                    // USER CAN SPIN: Show if not shown this session
                    if (!spinShown) {
                        setIsOpen(true);
                        sessionStorage.setItem("roulette_spin_shown", "true");
                    }
                } else if (configData.popup_ativo) {
                    // TEASER MODE: Show if not shown this session AND user hasn't seen the spin modal yet
                    if (!teaserShown && !spinShown && pathname === "/") {
                        setIsOpen(true);
                        sessionStorage.setItem("roulette_teaser_shown", "true");
                    }
                }
            } catch (error) {
                console.error("Error checking roulette eligibility:", error);
            }
        };

        checkEligibility();

        // Listen for manual trigger
        const handleManualOpen = () => {
            setIsOpen(true);
            sessionStorage.setItem("roulette_manual_trigger", "true");
        };

        window.addEventListener("open-roulette", handleManualOpen);
        return () => window.removeEventListener("open-roulette", handleManualOpen);
    }, [token, user, pathname]);

    const drawRoulette = (rotation: number) => {
        const canvas = canvasRef.current;
        if (!canvas || prizes.length === 0) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const outerRadius = Math.min(centerX, centerY) - 20;
        const wheelRadius = outerRadius - 15;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // --- Draw Casino Rim ---
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
        const rimGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        rimGradient.addColorStop(0, "#b8860b"); // Dark Gold
        rimGradient.addColorStop(0.5, "#ffd700"); // bright Gold
        rimGradient.addColorStop(1, "#b8860b");
        ctx.fillStyle = rimGradient;
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Inner rim shadow for depth
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius - 5, 0, 2 * Math.PI);
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // --- Draw Animated Lights ---
        const numLights = 32;
        const lightRadius = 5;
        for (let i = 0; i < numLights; i++) {
            const angle = (i * (2 * Math.PI)) / numLights + (rotation * 0.1);
            const x = centerX + (outerRadius - 10) * Math.cos(angle);
            const y = centerY + (outerRadius - 10) * Math.sin(angle);

            ctx.beginPath();
            ctx.arc(x, y, lightRadius, 0, 2 * Math.PI);

            const isPoint = Math.floor(i + rotation * 8) % 4 === 0;
            ctx.fillStyle = isPoint ? "#fff" : "#ffd700";
            ctx.shadowColor = isPoint ? "#fff" : "#ffd700";
            ctx.shadowBlur = isPoint ? 15 : 5;
            ctx.fill();
        }
        ctx.shadowBlur = 0;

        const prizePool = prizes.length < 6
            ? [...prizes, ...prizes, ...prizes, ...prizes, ...prizes, ...prizes].slice(0, Math.max(prizes.length * 2, 6))
            : prizes;

        const sliceAngle = (2 * Math.PI) / prizePool.length;
        const colorSchemes = [
            { main: "#1a3a16", grad: "#0d1f0b" },
            { main: "#2d5a27", grad: "#1a3a16" },
            { main: "#b8860b", grad: "#8b6508" }, // Gold slice for contrast
            { main: "#3d7a35", grad: "#2d5a27" }
        ];

        prizePool.forEach((prize, i) => {
            const angle = rotation + i * sliceAngle;
            const scheme = colorSchemes[i % colorSchemes.length];

            // Draw slice with radial gradient
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, wheelRadius, angle, angle + sliceAngle);

            const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, wheelRadius);
            grad.addColorStop(0, scheme.main);
            grad.addColorStop(1, scheme.grad || scheme.main);

            ctx.fillStyle = grad;
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.2)";
            ctx.lineWidth = 1;
            ctx.stroke();

            // Draw text
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(angle + sliceAngle / 2);
            ctx.textAlign = "right";
            ctx.fillStyle = "white";
            ctx.font = "bold 32px Outfit";
            ctx.shadowColor = "rgba(0,0,0,0.5)";
            ctx.shadowBlur = 4;

            // Truncate and add ellipsis if needed
            const text = prize.nome.length > 20 ? prize.nome.substring(0, 17) + "..." : prize.nome;
            ctx.fillText(text, wheelRadius - 60, 10);
            ctx.restore();
        });

        // Center hub (The "Pin")
        ctx.beginPath();
        ctx.arc(centerX, centerY, 55, 0, 2 * Math.PI);
        const hubGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 55);
        hubGrad.addColorStop(0, "#ffd700");
        hubGrad.addColorStop(0.7, "#b8860b");
        hubGrad.addColorStop(1, "#8b6508");
        ctx.fillStyle = hubGrad;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 4;
        ctx.stroke();

        // Inner hub detail
        ctx.beginPath();
        ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI);
        ctx.fillStyle = "#1a3a16";
        ctx.fill();
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 5;
        ctx.stroke();
    };

    useEffect(() => {
        if (isOpen && prizes.length > 0) {
            drawRoulette(rotationRef.current);
        }
    }, [isOpen, prizes]);

    const handleSpin = async () => {
        if (isSpinning) return;

        const token = localStorage.getItem("token");
        if (!token) return;

        try {
            setIsSpinning(true);

            // 1. Get result from backend FIRST
            const res = await fetch("/api/roleta/girar", {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!res.ok) {
                const err = await res.json();
                alert(err.detail || "Erro ao girar a roleta");
                setIsSpinning(false);
                return;
            }

            const data = await res.json();
            const chosenPrize = data.prize;

            // 2. Animate to the prize
            const prizePool = prizes.length < 6
                ? [...prizes, ...prizes, ...prizes, ...prizes, ...prizes, ...prizes].slice(0, Math.max(prizes.length * 2, 6))
                : prizes;
            const prizeIndex = prizePool.findIndex(p => p.id === chosenPrize.id);
            const sliceAngle = (2 * Math.PI) / prizePool.length;

            // Calculate target rotation
            // The pointer is at the top (-PI/2)
            // We want the slice to land under the pointer
            const extraRotations = 10 * 2 * Math.PI; // Spin 10 times
            const prizePosition = - (prizeIndex * sliceAngle + sliceAngle / 2) - (Math.PI / 2);
            const finalRotationValue = extraRotations + prizePosition;

            const startTime = performance.now();
            const duration = 6000; // 6 seconds for a more dramatic effect

            const animate = (time: number) => {
                const elapsed = time - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Custom Ease Out: cubic-bezier(0.1, 0, 0.2, 1) approx
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
    };

    if (!isOpen) return null;

    const showTeaser = !user || !user.pode_girar_roleta;

    const handleRedeem = () => {
        if (result && result.discount_type && result.discount_value) {
            const discountData = {
                type: result.discount_type,
                value: result.discount_value,
                name: result.nome
            };
            localStorage.setItem("active_roulette_discount", JSON.stringify(discountData));
            alert("Desconto aplicado! Você verá a redução no seu carrinho.");
        }
        setIsOpen(false);
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                {!result && (
                    <button className={styles.closeBtn} onClick={handleClose}>×</button>
                )}

                {showTeaser && !result ? (
                    <div className={styles.teaserContent}>
                        <div className={styles.teaserIcon}>🎡</div>
                        <h2 className={styles.title}>Giro da Sorte</h2>
                        <p className={styles.subtitle}>
                            Prepare-se para transformar seu autocuidado! Ganhe prêmios exclusivos agora mesmo.
                        </p>

                        <p className={styles.teaserCall}>
                            <span className={styles.highlight}>Crie sua conta</span> hoje mesmo e libere seu giro gratuito para ganhar prêmios exclusivos de autocuidado!
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
                    <>
                        <h2 className={styles.title}>🍀 Giro da Sorte!</h2>
                        <p className={styles.subtitle}>
                            Você ganhou um giro gratuito na nossa roleta e pode ganhar prêmios incríveis de autocuidado.
                        </p>

                        <div className={styles.rouletteContainer}>
                            <div className={styles.pointer}>
                                <svg viewBox="0 0 24 24" fill="#2d5a27" stroke="white" strokeWidth="1">
                                    <path d="M12 21l-8-16h16l-8 16z" />
                                </svg>
                            </div>
                            <canvas
                                ref={canvasRef}
                                width={800}
                                height={800}
                                className={styles.canvas}
                            />
                        </div>

                        <button
                            className={styles.spinBtn}
                            onClick={handleSpin}
                            disabled={isSpinning}
                        >
                            {isSpinning ? "Girando..." : "GIRAR AGORA"}
                        </button>
                    </>
                ) : (
                    <div className={styles.resultContainer}>
                        {/* Confetti Elements */}
                        {[...Array(20)].map((_, i) => (
                            <div
                                key={i}
                                className={styles.confetti}
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    animationDelay: `${Math.random() * 3}s`,
                                    backgroundColor: ['#ffd700', '#2d5a27', '#ffffff', '#b8860b'][Math.floor(Math.random() * 4)]
                                }}
                            />
                        ))}
                        <span className={styles.resultIcon}>🎁</span>
                        <h2 className={styles.title}>Parabéns!</h2>
                        <p className={styles.subtitle}>Sorte grande! Você acaba de ganhar:</p>
                        <h3 className={styles.resultTitle}>{result.nome}</h3>
                        <p className={styles.resultDesc}>
                            {result.descricao}
                        </p>
                        <button className={styles.spinBtn} onClick={handleRedeem}>
                            RESGATAR MEU PRÊMIO
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
