"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import {
  Share2,
  QrCode as QrIcon,
  ChevronRight,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import styles from "./page.module.css";

interface LinkItem {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  icon: React.ReactNode;
}

export default function LinksPage() {
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [currentUrl, setCurrentUrl] = useState("https://ecosopis.com.br/link");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = window.location.href;
      setCurrentUrl(url);
      QRCode.toDataURL(url, {
        width: 260,
        margin: 2,
        color: {
          dark: "#141f17",
          light: "#ffffff",
        },
      })
        .then((res) => setQrDataUrl(res))
        .catch((err) => console.error("QR Code Error:", err));
    }
  }, []);

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "ECOSOPIS Naturais | Links Oficiais",
          text: "Acesse todos os links oficiais da Ecosopis Naturais: Loja, Instagram, WhatsApp, Shopee e muito mais!",
          url: currentUrl,
        });
        return;
      } catch (err) {
        // User cancelled or share failed, fallback to copy
      }
    }

    // Fallback: Copy link
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(currentUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      });
    }
  };

  const links: LinkItem[] = [
    {
      id: "instagram",
      title: "Instagram",
      subtitle: "@ecosopis • Dicas, bastidores e novidades",
      url: "https://www.instagram.com/ecosopis/",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.iconSvg}>
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
      ),
    },
    {
      id: "site",
      title: "Site",
      subtitle: "ecosopis.com.br • Loja Oficial Completa",
      url: "https://ecosopis.com.br",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.iconSvg}>
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
    },
    {
      id: "whatsapp",
      title: "Whatsapp",
      subtitle: "(11) 95155-9212 • Fale com nossa equipe",
      url: "https://wa.me/5511951559212?text=Ol%C3%A1!%20Vim%20pelo%20link%20da%20bio%20e%20gostaria%20de%20mais%20informa%C3%A7%C3%B5es.",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={styles.iconSvg}>
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.78 14.15c-.24.68-1.39 1.3-1.92 1.38-.49.08-1.12.11-3.23-.76-2.7-1.12-4.44-3.87-4.57-4.05-.14-.18-1.09-1.45-1.09-2.76 0-1.31.69-1.96.93-2.22.25-.26.54-.33.72-.33.18 0 .36.002.52.01.17.008.39-.06.61.47.23.55.78 1.9.85 2.04.07.14.11.31.02.5-.09.18-.14.3-.28.46-.14.17-.29.38-.42.51-.14.14-.29.3-.13.58.17.28.74 1.22 1.58 1.97 1.09.97 2 1.27 2.29 1.41.28.14.45.12.62-.07.17-.2.72-.84.91-1.13.19-.29.38-.24.64-.15.26.09 1.66.78 1.94.92.29.14.48.21.55.33.07.12.07.69-.17 1.37z" />
        </svg>
      ),
    },
    {
      id: "shopee",
      title: "Loja shopee",
      subtitle: "ecosopisnaturais • Cupons e frete grátis",
      url: "https://shopee.com.br/ecosopisnaturais",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={styles.iconSvg}>
          <path d="M19.349 7.153H17.43A5.433 5.433 0 0012 2.15a5.433 5.433 0 00-5.43 5.003h-1.92a2.153 2.153 0 00-2.15 2.155L2.5 19.308a2.153 2.153 0 002.15 2.155h14.7a2.153 2.153 0 002.15-2.155l-0.001-10a2.153 2.153 0 00-2.15-2.155zM12 4.15a3.433 3.433 0 013.43 3.003H8.57A3.433 3.433 0 0112 4.15zM15.42 15.655c-0.21 0.49-0.56 0.885-1.07 1.18s-1.13 0.44-1.87 0.44c-0.65 0-1.21-0.105-1.68-0.315s-0.845-0.515-1.135-0.915l1.01-0.9c0.2 0.28 0.44 0.49 0.72 0.63s0.59 0.21 0.93 0.21c0.39 0 0.69-0.085 0.89-0.255s0.3-0.38 0.3-0.63c0-0.23-0.08-0.415-0.24-0.55s-0.455-0.27-0.88-0.4c-0.67-0.205-1.165-0.435-1.485-0.69s-0.48-0.635-0.48-1.14c0-0.53 0.21-0.965 0.63-1.3s0.975-0.5 1.665-0.5c0.59 0 1.095 0.125 1.515 0.375s0.725 0.585 0.915 1.005l-0.94 0.8c-0.165-0.33-0.4-0.57-0.705-0.72s-0.65-0.225-1.035-0.225c-0.32 0-0.57 0.075-0.75 0.225s-0.27 0.355-0.27 0.615c0 0.2 0.075 0.365 0.225 0.5s0.41 0.245 0.78 0.335c0.665 0.19 1.155 0.4 1.47 0.63s0.56 0.54 0.735 0.935 0.265 0.84 0.265 1.335z" />
        </svg>
      ),
    },
    {
      id: "shein",
      title: "Loja shein",
      subtitle: "Vitrine exclusiva na Shein",
      url: "https://api-shein.shein.com/h5/sharejump/appjump?link=lqYK71Q1hpt&localcountry=BR",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={styles.iconSvg}>
          {/* Elegant Shein 'S' Badge */}
          <rect x="2" y="2" width="20" height="20" rx="6" fill="#16241a" />
          <path d="M15.5 8.2c-.4-.7-1.1-1.2-2.1-1.2-1.4 0-2.3.9-2.3 2.1 0 2.5 4.3 1.8 4.3 4.8 0 1.6-1.3 2.8-3.3 2.8-1.5 0-2.6-.7-3.1-1.8l1.4-.9c.3.7.9 1.1 1.7 1.1 1.1 0 1.7-.6 1.7-1.3 0-2.4-4.3-1.8-4.3-4.8 0-1.7 1.4-2.8 3.5-2.8 1.4 0 2.4.6 2.9 1.5l-1.7.5z" fill="#ffffff" />
        </svg>
      ),
    },
    {
      id: "mercadolivre",
      title: "Loja mercado livre",
      subtitle: "Compra garantida & Entrega rápida",
      url: "https://produto.mercadolivre.com.br/MLB-2651562604-sabonete-de-acafro-com-dolomita-kit-c-3-unidades-artesanal-_JM",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={styles.iconSvg}>
          {/* Handshake official ML icon representation */}
          <path d="m11 17 2 2a1 1 0 0 0 1.4 0l4.3-4.3a1 1 0 0 0 0-1.4L16 11" />
          <path d="m18 13 2.5-2.5a2.12 2.12 0 0 0 0-3l-2.1-2.1a2.12 2.12 0 0 0-3 0L12.5 8" />
          <path d="m14 6-1.5-1.5a2.12 2.12 0 0 0-3 0l-5 5a2.12 2.12 0 0 0 0 3L6 14" />
          <path d="m7 15 1.5 1.5a2.12 2.12 0 0 0 3 0L13 15" />
        </svg>
      ),
    },
    {
      id: "tiktok",
      title: "Tiktok",
      subtitle: "@ecosopis • Vídeos e transformações",
      url: "https://www.tiktok.com/@ecosopis?ug_source=op.auth&ug_term=Linktr.ee&utm_source=awyc6vc625ejxp86&utm_campaign=tt4d_profile_link&_r=1",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={styles.iconSvg}>
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-.88-.06A6.34 6.34 0 0 0 3.14 15.7a6.34 6.34 0 0 0 10.86 4.43c.12-.12.22-.25.32-.38V12a8.16 8.16 0 0 0 5.27 1.95v-3.49a4.84 4.84 0 0 1-2-.77z" />
        </svg>
      ),
    },
  ];

  return (
    <main className={styles.pageContainer}>
      {/* Background ambient lighting */}
      <div className={styles.ambientGlow} />
      <div className={styles.botanicalPattern} />

      {/* Decorative Botanical Foliage in bottom corners matching the PDF */}
      <svg className={styles.foliageCornerLeft} viewBox="0 0 100 100" fill="#d4a373">
        <path d="M10 90 C30 80 50 60 70 30 C50 45 35 60 10 90 Z M40 65 C55 55 65 40 75 20 C60 35 50 50 40 65 Z M20 85 C35 70 50 55 60 40 C45 55 35 70 20 85 Z" opacity="0.8" />
        <path d="M5 95 C25 75 45 45 70 15 C52 35 32 60 5 95 Z" opacity="0.6" />
      </svg>
      <svg className={styles.foliageCornerRight} viewBox="0 0 100 100" fill="#d4a373">
        <path d="M10 90 C30 80 50 60 70 30 C50 45 35 60 10 90 Z M40 65 C55 55 65 40 75 20 C60 35 50 50 40 65 Z M20 85 C35 70 50 55 60 40 C45 55 35 70 20 85 Z" opacity="0.8" />
        <path d="M5 95 C25 75 45 45 70 15 C52 35 32 60 5 95 Z" opacity="0.6" />
      </svg>

      <div className={styles.contentCard}>
        {/* Top utility actions: QR Code & Share */}
        <div className={styles.topActions}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => setShowQrModal(true)}
            aria-label="Ver QR Code"
            title="Ver QR Code da página"
          >
            <QrIcon size={14} />
            <span>QR Code</span>
          </button>

          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleShare}
            aria-label="Compartilhar página"
            title="Compartilhar ou copiar link"
          >
            <Share2 size={14} />
            <span>Compartilhar</span>
          </button>
        </div>

        {/* Brand Header */}
        <header className={styles.brandHeader}>
          <div className={styles.treeLogoWrap}>
            <div className={styles.treeGlow} />
            <Image
              src="/tree_gold.png"
              alt="Árvore da Vida Ecosopis"
              width={140}
              height={118}
              priority
              className={styles.treeLogo}
            />
          </div>

          <h1 className={styles.brandTitle}>ECOSOPIS</h1>
          <span className={styles.brandSubtitle}>Naturais</span>

          <div className={styles.brandTagline}>
            <Sparkles size={12} className={styles.verifiedBadge} />
            <span>Cosméticos Veganos & Conscientes</span>
          </div>
        </header>

        {/* Links List (The 7 Buttons from the PDF) */}
        <section className={styles.linksList} aria-label="Links oficiais da Ecosopis">
          {links.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkCard}
              id={`link-${item.id}`}
            >
              <div className={styles.iconWrap}>{item.icon}</div>
              <div className={styles.textWrap}>
                <span className={styles.linkTitle}>{item.title}</span>
                <span className={styles.linkSubtitle}>{item.subtitle}</span>
              </div>
              <div className={styles.arrowWrap}>
                <ChevronRight size={18} />
              </div>
            </a>
          ))}
        </section>

        {/* Visual instruction from PDF ("CLIQUE NOS ÍCONES") */}
        <div className={styles.clickHint}>
          <div className={styles.hintIconWrap}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
          </div>
          <span>Clique nos ícones</span>
        </div>

        {/* Bottom credits */}
        <footer className={styles.pageFooter}>
          <span className={styles.footerBrandNote}>
            Ciência Natural & Cosmética Consciente
          </span>
          <p className={styles.footerCopyright}>
            © {new Date().getFullYear()} Ecosopis Naturais. Todos os direitos reservados.
          </p>
        </footer>
      </div>

      {/* Toast Notification when link is copied */}
      {copied && (
        <div className={styles.toastNotification} role="status">
          <Check size={16} color="#dfb17b" />
          <span>Link copiado para a área de transferência!</span>
        </div>
      )}

      {/* QR Code Modal for In-Person Events & Sharing */}
      {showQrModal && (
        <div
          className={styles.modalBackdrop}
          onClick={() => setShowQrModal(false)}
        >
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={() => setShowQrModal(false)}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>

            <h3 style={{ margin: "0 0 4px", color: "#faebd7", fontFamily: "var(--font-logo, serif)" }}>
              QR CODE OFICIAL
            </h3>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "rgba(255,255,255,0.7)" }}>
              Aponte a câmera do celular para abrir esta página de links
            </p>

            <div className={styles.qrWrap}>
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="QR Code dos links da Ecosopis"
                  style={{ width: 220, height: 220, display: "block" }}
                />
              )}
            </div>

            <button
              type="button"
              className={styles.actionBtn}
              style={{ width: "100%", justifyContent: "center", padding: "10px" }}
              onClick={handleShare}
            >
              <Share2 size={16} />
              <span>Copiar / Compartilhar URL</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
