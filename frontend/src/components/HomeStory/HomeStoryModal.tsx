"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import styles from "./HomeStory.module.css";
import { X, Volume2, VolumeX, ChevronLeft, ChevronRight } from "lucide-react";
import { isGoogleDriveUrl, getGoogleDriveEmbedUrl, getGoogleDriveDirectStreamUrl } from "@/utils/driveUtils";
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

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const currentStory = stories[currentIndex];
    const isDrive = currentStory?.video_url ? isGoogleDriveUrl(currentStory.video_url) : false;
    const directDriveStream = isDrive ? getGoogleDriveDirectStreamUrl(currentStory.video_url) : null;
    const driveEmbed = isDrive ? getGoogleDriveEmbedUrl(currentStory.video_url, true) : null;

    const handleNext = useCallback(() => {
        if (currentIndex < stories.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setProgress(0);
        } else {
            onClose();
        }
    }, [currentIndex, stories.length, onClose]);

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

    // Reseta progresso ao trocar de story
    useEffect(() => {
        setProgress(0);
    }, [currentIndex]);

    // Timer de progresso para quando é iframe do Google Drive (sem eventos de video element)
    useEffect(() => {
        if (!isDrive || directDriveStream) return;

        if (isPaused) {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            return;
        }

        const duration = 15000; // 15 segundos por story
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
    }, [currentIndex, isDrive, directDriveStream, isPaused, handleNext]);

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

    const videoSrc = directDriveStream || getMediaUrl(currentStory?.video_url);

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
                    {isDrive && !directDriveStream && driveEmbed ? (
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
                            muted={isMuted}
                            onTimeUpdate={handleTimeUpdate}
                            onEnded={handleVideoEnded}
                            onError={() => {
                                // Se falhar reprodução direta, avança suavemente
                                setTimeout(handleNext, 3000);
                            }}
                        />
                    )}

                    {/* Zonas de toque para celular e clique rápido */}
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
                                    videoRef.current.play();
                                    setIsPaused(false);
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

                    {/* Botão de Áudio (quando aplicável) */}
                    {(!isDrive || directDriveStream) && (
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
