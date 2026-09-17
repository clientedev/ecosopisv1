"use client";
import React, { useState, useRef, useEffect } from "react";
import styles from "./ProductStory.module.css";
import { X, Volume2, VolumeX, ChevronLeft, ChevronRight, ShoppingBag, Pause, Play } from "lucide-react";
import { StoryVideo } from "./ProductStoryCircles";

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

    const videoRef = useRef<HTMLVideoElement | null>(null);

    const currentStory = storyVideos[currentIndex];

    // Format URLs
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
        if (currentIndex < storyVideos.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setProgress(0);
        } else {
            onClose();
        }
    };

    const togglePlay = () => {
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
        setIsMuted(prev => !prev);
    };

    useEffect(() => {
        // Reset and play video when currentIndex changes
        if (videoRef.current) {
            videoRef.current.currentTime = 0;
            setProgress(0);
            setIsPlaying(true);
            videoRef.current.play().catch(err => console.error("Autoplay error:", err));
        }
    }, [currentIndex]);

    if (!currentStory) return null;

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
                            <div>
                                <h4 className={styles.storyTitleText}>{currentStory.title || productName}</h4>
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

                {/* Vídeo do Story */}
                <div className={styles.storyVideoWrapper}>
                    <video
                        ref={videoRef}
                        src={getMediaUrl(currentStory.video_url)}
                        className={styles.storyVideo}
                        autoPlay
                        playsInline
                        muted={isMuted}
                        onTimeUpdate={handleTimeUpdate}
                        onEnded={handleVideoEnd}
                    />

                    {/* Zonas de Toque/Clique para Navegação */}
                    <div className={styles.storyTouchZoneLeft} onClick={handlePrev} />
                    <div className={styles.storyTouchZoneCenter} onClick={togglePlay} />
                    <div className={styles.storyTouchZoneRight} onClick={handleNext} />
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
