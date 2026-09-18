"use client";
import React, { useState, useRef, useEffect } from "react";
import styles from "./ProductStory.module.css";
import { X, Volume2, VolumeX, ChevronLeft, ChevronRight, ShoppingBag, Pause, Play } from "lucide-react";
import { StoryVideo } from "./ProductStoryCircles";
import { isGoogleDriveUrl, getGoogleDriveEmbedUrl, getGoogleDriveDirectStreamUrl } from "@/utils/driveUtils";
import { isInstagramContent, getInstagramEmbedUrl, extractInstagramPermalink } from "@/utils/instagramUtils";

interface ProductStoryModalProps {
    storyVideos: StoryVideo[];
    initialIndex: number;
    productName: string;
    productImage?: string;
    productPrice?: number;
    onClose: () => void;
    onBuyNow: () => void;
}

export default function ProductStoryModal({
    storyVideos,
    initialIndex,
    productName,
    productImage,
    productPrice,
    onClose,
    onBuyNow
}: ProductStoryModalProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [isMuted, setIsMuted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);
    const [progress, setProgress] = useState(0);
    // For Drive iframes, we simulate progress with a timer
    const driveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const driveProgressRef = useRef<number>(0);

    const videoRef = useRef<HTMLVideoElement | null>(null);

    const currentStory = storyVideos[currentIndex];

    // Detecta se o vídeo atual é do Google Drive
    const isDriveVideo = currentStory && isGoogleDriveUrl(currentStory.video_url);
    // Detecta se é Instagram
    const isInstagramVideo = currentStory && isInstagramContent(currentStory.video_url);
    const instagramEmbedUrl = isInstagramVideo ? getInstagramEmbedUrl(currentStory.video_url) : null;
    const instagramPermalink = isInstagramVideo ? (extractInstagramPermalink(currentStory.video_url) || "https://www.instagram.com") : null;
    // Para iframes sem controle de tempo (Drive, Instagram)
    const usesIframeProgress = isDriveVideo || isInstagramVideo;

    // Format URLs & handle Google Drive direct video stream
    const getVideoSrc = (url?: string) => {
        if (!url) return "";
        if (isGoogleDriveUrl(url)) {
            return getGoogleDriveDirectStreamUrl(url) || "";
        }
        if (url.startsWith("http")) return url;
        if (url.startsWith("/api/")) return url;
        if (url.startsWith("/static/")) return url;
        if (url.startsWith("/images/")) return `/api${url}`;
        if (url.startsWith("images/")) return `/api/${url}`;
        if (url.startsWith("/uploads/")) return `/static${url}`;
        if (url.startsWith("uploads/")) return `/static/${url}`;
        return url;
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

    // Close modal on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    // Simulated progress for Drive/Instagram iframes
    const startDriveProgress = () => {
        if (driveTimerRef.current) clearInterval(driveTimerRef.current);
        driveProgressRef.current = 0;
        setProgress(0);
        const TOTAL_SECONDS = isInstagramVideo ? 30 : 60;
        driveTimerRef.current = setInterval(() => {
            driveProgressRef.current += 100 / (TOTAL_SECONDS * 10);
            const capped = Math.min(driveProgressRef.current, 100);
            setProgress(capped);
            if (capped >= 100) {
                clearInterval(driveTimerRef.current!);
                handleVideoEnd();
            }
        }, 100);
    };

    const stopDriveProgress = () => {
        if (driveTimerRef.current) clearInterval(driveTimerRef.current);
    };

    // Handle video end -> advance to next or close
    const handleVideoEnd = () => {
        if (currentIndex < storyVideos.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setProgress(0);
        } else {
            onClose();
        }
    };

    // Video time update for progress bar
    const handleTimeUpdate = () => {
        if (videoRef.current && videoRef.current.duration > 0) {
            const currentProgress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
            setProgress(currentProgress);
        }
    };

    const handlePrev = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        stopDriveProgress();
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setProgress(0);
        } else {
            setProgress(0);
            if (videoRef.current) videoRef.current.currentTime = 0;
        }
    };

    const handleNext = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        stopDriveProgress();
        if (currentIndex < storyVideos.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setProgress(0);
        } else {
            onClose();
        }
    };

    const togglePlay = () => {
        if (isDriveVideo) return; // Não conseguimos controlar iframe cross-origin
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
            setIsPlaying(false);
        } else {
            videoRef.current.play().catch(err => console.error("Play error:", err));
            setIsPlaying(true);
        }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isDriveVideo) return; // Não conseguimos controlar iframe cross-origin
        setIsMuted(prev => !prev);
    };

    // Ao mudar de story, reset e play
    useEffect(() => {
        stopDriveProgress();
        setProgress(0);
        setIsPlaying(true);

        if (usesIframeProgress) {
            startDriveProgress();
        } else if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(err => console.error("Autoplay error:", err));
        }

        return () => stopDriveProgress();
    }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!currentStory) return null;

    const driveEmbedUrl = isDriveVideo ? getGoogleDriveEmbedUrl(currentStory.video_url) : null;

    return (
        <div className={styles.storyModalOverlay} onClick={onClose}>
            <div className={styles.storyModalContainer} onClick={e => e.stopPropagation()}>
                {/* Header com barras de progresso superiores */}
                <div className={styles.storyProgressHeader}>
                    <div className={styles.progressBarsRow}>
                        {storyVideos.map((_, idx) => {
                            let widthFill = "0%";
                            if (idx < currentIndex) widthFill = "100%";
                            else if (idx === currentIndex) widthFill = `${progress}%`;
                            return (
                                <div key={idx} className={styles.progressBarTrack}>
                                    <div
                                        className={styles.progressBarFill}
                                        style={{ width: widthFill }}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    <div className={styles.storyModalHeaderInfo}>
                        <div className={styles.storyProductInfo}>
                            <img
                                src={getMediaUrl(productImage) || "/logo_final.png"}
                                alt={productName}
                                className={styles.storyProductThumb}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h4 className={styles.storyTitleText}>{currentStory.title || productName}</h4>
                                {isInstagramVideo && instagramPermalink && (
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
                        </div>
                        <button
                            className={styles.storyCloseBtn}
                            onClick={onClose}
                            title="Fechar"
                            type="button"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Vídeo do Story com Autoplay Nativo */}
                <div className={styles.storyVideoWrapper}>
                    {isInstagramVideo && instagramEmbedUrl ? (
                        <div className={styles.instagramEmbedBox}>
                            <iframe
                                key={`ig-${currentIndex}`}
                                src={instagramEmbedUrl}
                                className={styles.instagramIframe}
                                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share; fullscreen"
                                title={currentStory.title}
                                scrolling="yes"
                            />
                        </div>
                    ) : isDriveVideo ? (
                        <iframe
                            key={`drive-${currentIndex}`}
                            src={getGoogleDriveEmbedUrl(currentStory.video_url) || ""}
                            className={styles.storyVideo}
                            allow="autoplay; encrypted-media; fullscreen"
                            title={currentStory.title}
                            style={{ border: "none" }}
                        />
                    ) : (
                        <video
                            ref={videoRef}
                            src={getVideoSrc(currentStory.video_url)}
                            className={styles.storyVideo}
                            autoPlay
                            playsInline
                            muted={isMuted}
                            onTimeUpdate={handleTimeUpdate}
                            onEnded={handleVideoEnd}
                        />
                    )}

                    {/* Zonas de Toque/Clique para Navegação (apenas vídeos diretos, sem cobrir iframes) */}
                    {!isInstagramVideo && !isDriveVideo && (
                        <>
                            <div className={styles.storyTouchZoneLeft} onClick={handlePrev} />
                            <div className={styles.storyTouchZoneCenter} onClick={togglePlay} />
                            <div className={styles.storyTouchZoneRight} onClick={handleNext} />
                        </>
                    )}

                    {/* Botões de navegação lateral para Instagram no celular */}
                    {isInstagramVideo && (
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
                            {currentIndex < storyVideos.length - 1 && (
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
                </div>

                {/* Botões Chevron de navegação lateral no Desktop */}
                {currentIndex > 0 && (
                    <button
                        className={styles.navChevronLeft}
                        onClick={handlePrev}
                        title="Anterior"
                        type="button"
                    >
                        <ChevronLeft size={28} />
                    </button>
                )}

                {currentIndex < storyVideos.length - 1 && (
                    <button
                        className={styles.navChevronRight}
                        onClick={handleNext}
                        title="Próximo"
                        type="button"
                    >
                        <ChevronRight size={28} />
                    </button>
                )}

                {/* Botão de Áudio */}
                <button
                    className={styles.storyAudioBtn}
                    onClick={toggleMute}
                    title={isMuted ? "Ativar som" : "Desativar som"}
                    type="button"
                >
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>

                {/* Rodapé com CTA de Compra Direta */}
                <div className={styles.storyFooterCTA}>
                    <button
                        className={styles.buyStoryBtn}
                        onClick={() => {
                            onBuyNow();
                            onClose();
                        }}
                        type="button"
                    >
                        <ShoppingBag size={20} />
                        COMPRAR AGORA {productPrice ? `• R$ ${productPrice.toFixed(2).replace('.', ',')}` : ''}
                    </button>
                </div>
            </div>
        </div>
    );
}
