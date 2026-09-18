"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import styles from "./HomeStory.module.css";
import { X, Volume2, VolumeX, ChevronLeft, ChevronRight } from "lucide-react";
import { isGoogleDriveUrl, getGoogleDriveEmbedUrl, getGoogleDriveDirectStreamUrl } from "@/utils/driveUtils";
import { isInstagramContent, getInstagramEmbedUrl, extractInstagramPermalink, getInstagramDirectStreamUrl } from "@/utils/instagramUtils";
import { HomeStoryItem } from "./HomeStoryCircles";

interface HomeStoryModalProps {
    stories: HomeStoryItem[];
    initialIndex?: number;
    onClose: () => void;
}

export default function HomeStoryModal({
    stories,
    initialIndex = 0,
    onClose
}: HomeStoryModalProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [progress, setProgress] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [streamFailed, setStreamFailed] = useState(false);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const currentStory = stories[currentIndex];
    const isDrive = currentStory?.video_url ? isGoogleDriveUrl(currentStory.video_url) : false;
    const isInstagram = currentStory?.video_url ? isInstagramContent(currentStory.video_url) : false;
    const instagramEmbedUrl = isInstagram ? getInstagramEmbedUrl(currentStory.video_url) : null;
    const instagramPermalink = isInstagram ? (extractInstagramPermalink(currentStory.video_url) || "https://www.instagram.com") : null;
    const directInstagramStream = isInstagram ? getInstagramDirectStreamUrl(currentStory.video_url) : null;
    const directDriveStream = isDrive ? getGoogleDriveDirectStreamUrl(currentStory.video_url) : null;
    const driveEmbed = isDrive ? getGoogleDriveEmbedUrl(currentStory.video_url, true) : null;

    // Se tiver stream direto e não falhou, toca como vídeo HTML5 nativo em autoplay sem pedir play
    const isDirectPlayable = (!isInstagram && !isDrive) ||
                             (isDrive && !!directDriveStream) ||
                             (isInstagram && !streamFailed && !!directInstagramStream);

    // Para iframes sem controle de tempo (Drive sem stream direto, Instagram fallback)
    const usesTimerProgress = !isDirectPlayable;

    const handleNext = useCallback(() => {
        if (currentIndex < stories.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setProgress(0);
        } else {
            // Em loop: se terminar todos, volta para o primeiro ou repete o vídeo único
            if (stories.length > 1) {
                setCurrentIndex(0);
                setProgress(0);
            } else {
                setProgress(0);
                if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                    videoRef.current.play().catch(console.error);
                }
            }
        }
    }, [currentIndex, stories.length]);

    const handlePrev = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setProgress(0);
        }
    }, [currentIndex]);

    // Teclas de atalho (Escape fecha, Setas navegam)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowRight") handleNext();
            if (e.key === "ArrowLeft") handlePrev();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, handleNext, handlePrev]);

    const playVideo = useCallback(async () => {
        if (!videoRef.current) return;
        try {
            await videoRef.current.play();
            setIsPaused(false);
        } catch (err) {
            // Se o navegador barrar o autoplay com áudio, muta e inicia de imediato sem pedir play
            if (videoRef.current) {
                videoRef.current.muted = true;
                setIsMuted(true);
                await videoRef.current.play().catch(() => {});
                setIsPaused(false);
            }
        }
    }, []);

    // Reseta progresso ao trocar de story e inicia autoplay sem pedir play
    useEffect(() => {
        setStreamFailed(false);
        setProgress(0);
        if (isDirectPlayable && videoRef.current) {
            videoRef.current.currentTime = 0;
            playVideo();
        }
    }, [currentIndex, isDirectPlayable, playVideo]);

    // Timer de progresso para quando é iframe do Google Drive (sem eventos de video element)
    useEffect(() => {
        if (!usesTimerProgress) return;

        if (isPaused) {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            return;
        }

        const duration = isInstagram ? 60000 : 15000; // 60s para Instagram dar tempo de assistir, 15s para Drive
        const interval = 100;
        const step = (interval / duration) * 100;

        progressIntervalRef.current = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(progressIntervalRef.current as NodeJS.Timeout);
                    handleNext();
                    return 0;
                }
                return prev + step;
            });
        }, interval);

        return () => {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        };
    }, [currentIndex, usesTimerProgress, isInstagram, isPaused, handleNext]);

    // Sincroniza áudio do vídeo HTML5
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = isMuted;
        }
    }, [isMuted]);

    const handleTimeUpdate = () => {
        if (videoRef.current && videoRef.current.duration) {
            const pct = (videoRef.current.currentTime / videoRef.current.duration) * 100;
            setProgress(pct);
        }
    };

    const handleVideoEnded = () => {
        handleNext();
    };

    const getMediaUrl = (url?: string) => {
        if (!url) return "";
        if (url.startsWith("http")) return url;
        if (url.startsWith("/api/")) return url;
        if (url.startsWith("/static/")) return url;
        if (url.startsWith("/images/")) return `/api${url}`;
        if (url.startsWith("images/")) return `/api/${url}`;
        if (url.startsWith("/uploads/")) return `/static${url}`;
        if (url.startsWith("uploads/")) return `/static/${url}`;
        return url;
    };

    const videoSrc = (isInstagram ? directInstagramStream : null) || directDriveStream || getMediaUrl(currentStory?.video_url);

    return (
        <div className={styles.storyModalOverlay} onClick={onClose}>
            {/* Botão anterior para Desktop */}
            {currentIndex > 0 && (
                <button
                    className={styles.navChevronLeft}
                    onClick={(e) => {
                        e.stopPropagation();
                        handlePrev();
                    }}
                    title="Story anterior"
                    type="button"
                >
                    <ChevronLeft size={28} />
                </button>
            )}

            {/* Container do Story */}
            <div
                className={styles.storyModalContainer}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Cabeçalho com barras de progresso */}
                <div className={styles.storyProgressHeader}>
                    <div className={styles.progressBarsRow}>
                        {stories.map((s, idx) => (
                            <div key={s.id || idx} className={styles.progressBarTrack}>
                                <div
                                    className={styles.progressBarFill}
                                    style={{
                                        width:
                                            idx < currentIndex
                                                ? "100%"
                                                : idx === currentIndex
                                                ? `${progress}%`
                                                : "0%"
                                    }}
                                />
                            </div>
                        ))}
                    </div>

                    <div className={styles.storyModalHeaderInfo}>
                        <div className={styles.storyBrandInfo}>
                            <img
                                src="/logo_final.png"
                                alt="Ecosopis"
                                className={styles.storyBrandThumb}
                            />
                            <span className={styles.storyTitleText}>
                                {currentStory?.title || "Ecosopis"}
                            </span>
                            {isInstagram && instagramPermalink && (
                                <a
                                    href={instagramPermalink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.instagramBadgeBtn}
                                    onClick={(e) => e.stopPropagation()}
                                    title="Ver Reel original no Instagram"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                                    </svg>
                                    Ver no Insta ↗
                                </a>
                            )}
                        </div>

                        <button
                            className={styles.storyCloseBtn}
                            onClick={onClose}
                            title="Fechar story"
                            type="button"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Área do Vídeo */}
                <div className={styles.storyVideoWrapper}>
                    {!isDirectPlayable && isInstagram && instagramEmbedUrl ? (
                        <div className={styles.instagramEmbedBox}>
                            <iframe
                                key={`ig-${currentIndex}`}
                                src={instagramEmbedUrl}
                                className={styles.instagramIframe}
                                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share; fullscreen"
                                title={currentStory.title}
                                scrolling="no"
                            />
                        </div>
                    ) : !isDirectPlayable && isDrive && driveEmbed ? (
                        <iframe
                            src={driveEmbed}
                            className={styles.storyVideo}
                            allow="autoplay; encrypted-media; fullscreen"
                            title={currentStory.title}
                            style={{ border: "none" }}
                        />
                    ) : (
                        <video
                            ref={videoRef}
                            src={videoSrc}
                            className={styles.storyVideo}
                            autoPlay
                            playsInline
                            preload="auto"
                            muted={isMuted}
                            onCanPlay={() => playVideo()}
                            onLoadedData={() => playVideo()}
                            onTimeUpdate={handleTimeUpdate}
                            onEnded={handleVideoEnded}
                            onError={() => {
                                if (isInstagram) {
                                    setStreamFailed(true);
                                } else {
                                    setTimeout(handleNext, 3000);
                                }
                            }}
                        />
                    )}

                    {/* Zonas de toque para celular e clique rápido - apenas para vídeos diretos */}
                    {isDirectPlayable && (
                        <>
                            <div
                                className={styles.storyTouchZoneLeft}
                                onClick={handlePrev}
                                title="Voltar story"
                            />
                            <div
                                className={styles.storyTouchZoneCenter}
                                onClick={() => {
                                    if (videoRef.current) {
                                        if (videoRef.current.paused) {
                                            playVideo();
                                        } else {
                                            videoRef.current.pause();
                                            setIsPaused(true);
                                        }
                                    } else {
                                        setIsPaused(prev => !prev);
                                    }
                                }}
                                title="Pausar / Retomar"
                            />
                            <div
                                className={styles.storyTouchZoneRight}
                                onClick={handleNext}
                                title="Próximo story"
                            />
                        </>
                    )}

                    {/* Botões de navegação lateral para Instagram no celular (apenas em iframe fallback) */}
                    {!isDirectPlayable && isInstagram && (
                        <div className={styles.instagramNavControls}>
                            {currentIndex > 0 ? (
                                <button
                                    type="button"
                                    className={styles.instagramNavBtnLeft}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handlePrev();
                                    }}
                                    title="Story anterior"
                                    aria-label="Story anterior"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                            ) : <div />}
                            {currentIndex < stories.length - 1 && (
                                <button
                                    type="button"
                                    className={styles.instagramNavBtnRight}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleNext();
                                    }}
                                    title="Próximo story"
                                    aria-label="Próximo story"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Botão de Áudio (quando aplicável - para reprodução direta) */}
                    {isDirectPlayable && (
                        <button
                            className={styles.storyAudioBtn}
                            onClick={() => setIsMuted(prev => !prev)}
                            title={isMuted ? "Ativar som" : "Desativar som"}
                            type="button"
                        >
                            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                        </button>
                    )}
                </div>
            </div>

            {/* Botão próximo para Desktop */}
            {currentIndex < stories.length - 1 && (
                <button
                    className={styles.navChevronRight}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleNext();
                    }}
                    title="Próximo story"
                    type="button"
                >
                    <ChevronRight size={28} />
                </button>
            )}
        </div>
    );
}
