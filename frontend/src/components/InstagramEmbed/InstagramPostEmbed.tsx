"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./InstagramPostEmbed.module.css";
import { Instagram, ExternalLink } from "lucide-react";
import { extractInstagramId, extractInstagramPermalink, getInstagramPostEmbedUrl } from "@/utils/instagramUtils";

interface InstagramPostEmbedProps {
    url: string;
    captioned?: boolean;
    maxWidth?: number | string;
    showTopBadge?: boolean;
    className?: string;
}

export default function InstagramPostEmbed({
    url,
    captioned = true,
    maxWidth = "540px",
    showTopBadge = true,
    className = ""
}: InstagramPostEmbedProps) {
    const [loading, setLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const postId = extractInstagramId(url);
    const permalink = postId ? extractInstagramPermalink(url) : (url.startsWith("http") ? url : `https://www.instagram.com/`);
    const embedUrl = postId ? getInstagramPostEmbedUrl(url, captioned) : null;

    // Tenta carregar o script oficial do Instagram caso disponível para auto-ajustar altura
    useEffect(() => {
        if (!postId) return;

        // Se o objeto instgrm já existir no window, processa o embed
        const win = window as any;
        if (win.instgrm?.Embeds?.process) {
            win.instgrm.Embeds.process();
        } else {
            const scriptId = "instagram-embed-script";
            if (!document.getElementById(scriptId)) {
                const script = document.createElement("script");
                script.id = scriptId;
                script.src = "https://www.instagram.com/embed.js";
                script.async = true;
                script.defer = true;
                script.onload = () => {
                    if (win.instgrm?.Embeds?.process) {
                        win.instgrm.Embeds.process();
                    }
                };
                document.body.appendChild(script);
            }
        }
    }, [postId]);

    if (!postId || !embedUrl) {
        return (
            <div className={`${styles.embedContainer} ${className}`} style={{ maxWidth }}>
                <div className={styles.fallbackCard}>
                    <div className={styles.fallbackIcon}>
                        <Instagram size={24} />
                    </div>
                    <p style={{ fontSize: "0.88rem", color: "#475569", margin: 0 }}>
                        Link da publicação do Instagram
                    </p>
                    {permalink && (
                        <a
                            href={permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.fallbackBtn}
                        >
                            Ver no Instagram <ExternalLink size={14} />
                        </a>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            className={`${styles.embedContainer} ${className}`}
            style={{ maxWidth }}
            data-instagram-post={postId}
        >
            {showTopBadge && (
                <div className={styles.embedHeader}>
                    <div className={styles.headerLeft}>
                        <div className={styles.instagramIconBadge}>
                            <Instagram size={16} />
                        </div>
                        <div>
                            <div className={styles.headerTitle}>Instagram</div>
                            <div className={styles.headerSubtitle}>Publicação Oficial</div>
                        </div>
                    </div>
                    <a
                        href={permalink || `https://www.instagram.com/p/${postId}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.externalLinkBtn}
                        title="Abrir no aplicativo ou site do Instagram"
                    >
                        Abrir <ExternalLink size={12} />
                    </a>
                </div>
            )}

            <div className={styles.iframeWrapper}>
                {loading && (
                    <div className={styles.skeletonBox}>
                        <div className={styles.spinner} />
                        <span className={styles.skeletonText}>Carregando publicação do Instagram...</span>
                    </div>
                )}

                <iframe
                    ref={iframeRef}
                    src={embedUrl}
                    className={`${styles.embedIframe} ${loading ? styles.embedIframeHidden : ""}`}
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                    allowFullScreen
                    scrolling="no"
                    title={`Instagram Post ${postId}`}
                    onLoad={() => setLoading(false)}
                    onError={() => {
                        setLoading(false);
                        setHasError(true);
                    }}
                />
            </div>
        </div>
    );
}
