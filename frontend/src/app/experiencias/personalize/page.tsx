"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import {
    Search, Upload, ImagePlus, Download, RotateCcw, MessageCircle, Maximize2, X, Check, Palette,
    Layers, Lock, Unlock, AlertCircle, ArrowLeft, ArrowRight, Sparkles, Eye,
} from "lucide-react";
import { loadArtFile, LoadedArt } from "@/lib/personalization/artLoader";
import {
    AreaCfg, ArtTransform, areaAspect, buildMapper, defaultTransform, imageToPlane, renderComposite,
} from "@/lib/personalization/renderer";
import styles from "./page.module.css";

const WHATSAPP_NUMBER = "5511951559212";

interface Area extends AreaCfg {
    id: number;
    product_id: number;
    image_url: string;
    name: string;
}
interface Product {
    id: number;
    name: string;
    slug: string;
    category: string | null;
    description: string | null;
    photos: string[];
    areas: Area[];
    customizable: boolean;
}
interface Placement {
    t: ArtTransform;
    enabled: boolean;
}

const STEPS = ["Produto", "Arte", "Personalizar", "Resultado"];
const photoCache = new Map<string, Promise<HTMLImageElement>>();

function loadPhoto(url: string): Promise<HTMLImageElement> {
    let p = photoCache.get(url);
    if (!p) {
        p = new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => {
                // alguns armazenamentos externos não enviam CORS: tenta sem (a exportação PNG pode falhar)
                const img2 = new Image();
                img2.onload = () => resolve(img2);
                img2.onerror = () => { photoCache.delete(url); reject(new Error("Foto indisponível")); };
                img2.src = url;
            };
            img.src = url;
        });
        photoCache.set(url, p);
    }
    return p;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export default function PersonalizePage() {
    const [products, setProducts] = useState<Product[] | null>(null);
    const [loadError, setLoadError] = useState("");
    const [step, setStep] = useState(1);
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState("Todos");
    const [onlyReady, setOnlyReady] = useState(false);
    const [notice, setNotice] = useState<Product | null>(null);

    const [product, setProduct] = useState<Product | null>(null);
    const [photoUrl, setPhotoUrl] = useState("");
    const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
    const [photoError, setPhotoError] = useState("");
    const [areaId, setAreaId] = useState<number | null>(null);
    const [placements, setPlacements] = useState<Record<number, Placement>>({});

    const [art, setArt] = useState<LoadedArt | null>(null);
    const [artError, setArtError] = useState("");
    const [artLoading, setArtLoading] = useState(false);
    const [artPreview, setArtPreview] = useState("");
    const [dragOver, setDragOver] = useState(false);

    const [lockRatio, setLockRatio] = useState(true);
    const [showArea, setShowArea] = useState(true);
    const [result, setResult] = useState<HTMLCanvasElement | null>(null);
    const [resultUrl, setResultUrl] = useState("");
    const [compare, setCompare] = useState(50);
    const [zoom, setZoom] = useState(false);
    const [busy, setBusy] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const fileRef = useRef<HTMLInputElement | null>(null);
    const dragRef = useRef<{ id: number; p0: [number, number]; cx: number; cy: number } | null>(null);
    const pinchRef = useRef<{ d0: number; s0: number } | null>(null);
    const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());

    // ── catálogo real ───────────────────────────────────────────────────────
    useEffect(() => {
        let alive = true;
        fetch("/api/personalization/products")
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Falha ao carregar o catálogo."))))
            .then((d: Product[]) => alive && setProducts(d))
            .catch((e) => alive && setLoadError(e.message || "Falha ao carregar o catálogo."));
        return () => { alive = false; };
    }, []);

    const categories = useMemo(() => {
        const set = new Set<string>();
        (products || []).forEach((p) => p.category && set.add(p.category));
        return ["Todos", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
    }, [products]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return (products || []).filter((p) => {
            if (category !== "Todos" && p.category !== category) return false;
            if (onlyReady && !p.customizable) return false;
            if (!q) return true;
            return `${p.name} ${p.category || ""} ${p.description || ""}`.toLowerCase().includes(q);
        });
    }, [products, query, category, onlyReady]);

    // ── produto / foto / áreas ──────────────────────────────────────────────
    const photosWithAreas = useMemo(() => (product ? product.photos.filter((u) => product.areas.some((a) => a.image_url === u)) : []), [product]);
    const areasOnPhoto = useMemo(() => (product ? product.areas.filter((a) => a.image_url === photoUrl) : []), [product, photoUrl]);
    const area = useMemo(() => areasOnPhoto.find((a) => a.id === areaId) || null, [areasOnPhoto, areaId]);

    useEffect(() => {
        if (!photoUrl) { setPhoto(null); return; }
        let alive = true;
        setPhotoError("");
        loadPhoto(photoUrl).then((img) => alive && setPhoto(img)).catch((e) => alive && setPhotoError(e.message));
        return () => { alive = false; };
    }, [photoUrl]);

    const initPlacements = useCallback((p: Product, url: string, a: LoadedArt | null, img: HTMLImageElement | null) => {
        const next: Record<number, Placement> = {};
        const list = p.areas.filter((x) => x.image_url === url);
        list.forEach((x, i) => {
            const w = img?.naturalWidth || 1000, h = img?.naturalHeight || 1000;
            next[x.id] = { t: defaultTransform(x, w, h, a?.canvas || null), enabled: i === 0 };
        });
        setPlacements(next);
    }, []);

    const chooseProduct = (p: Product) => {
        if (!p.customizable) { setNotice(p); return; }
        setNotice(null);
        setProduct(p);
        const url = p.photos.find((u) => p.areas.some((a) => a.image_url === u)) || p.photos[0];
        setPhotoUrl(url);
        const first = p.areas.find((a) => a.image_url === url);
        setAreaId(first ? first.id : null);
        setResult(null);
        setStep(art ? 3 : 2);
    };

    // reposiciona a arte quando a foto/arte/produto mudam (ajusta à área)
    useEffect(() => {
        if (product && photo) initPlacements(product, photoUrl, art, photo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [product, photoUrl, photo, art]);

    const changePhoto = (url: string) => {
        if (!product) return;
        setPhotoUrl(url);
        const first = product.areas.find((a) => a.image_url === url);
        setAreaId(first ? first.id : null);
    };

    // ── arte ────────────────────────────────────────────────────────────────
    const handleFile = async (file: File | undefined | null) => {
        if (!file) return;
        setArtError("");
        setArtLoading(true);
        try {
            const loaded = await loadArtFile(file);
            setArt(loaded);
            setArtPreview(loaded.canvas.toDataURL("image/png"));
        } catch (e: any) {
            setArtError(e?.message || "Não foi possível ler o arquivo.");
        } finally {
            setArtLoading(false);
        }
    };

    // ── composição ──────────────────────────────────────────────────────────
    const compose = useCallback((outWidth: number, draft: boolean): HTMLCanvasElement | null => {
        if (!photo || !product) return null;
        const pw = photo.naturalWidth, ph = photo.naturalHeight;
        const list = product.areas.filter((a) => a.image_url === photoUrl);
        let current: CanvasImageSource = photo;
        let out: HTMLCanvasElement | null = null;
        const w = Math.min(outWidth, pw);
        for (const a of list) {
            const pl = placements[a.id];
            if (!pl || !pl.enabled || !art) continue;
            out = renderComposite({ photo: current as any, photoW: pw, photoH: ph, area: a, art: art.canvas, t: pl.t, outWidth: w, draft });
            current = out; // as próximas áreas desenham sobre o resultado já composto
        }
        if (!out) {
            out = document.createElement("canvas");
            out.width = w;
            out.height = Math.round((ph * w) / pw);
            out.getContext("2d")!.drawImage(photo, 0, 0, out.width, out.height);
        }
        return out;
    }, [photo, product, photoUrl, placements, art]);

    // prévia ao vivo (rascunho rápido + versão final após uma pausa)
    useEffect(() => {
        if (step !== 3) return;
        const cv = canvasRef.current;
        if (!cv || !photo) return;
        const paint = (draft: boolean) => {
            const res = compose(draft ? 640 : 1100, draft);
            if (!res) return;
            cv.width = res.width;
            cv.height = res.height;
            cv.getContext("2d")!.drawImage(res, 0, 0);
        };
        const raf = requestAnimationFrame(() => paint(true));
        const id = setTimeout(() => paint(false), 220);
        return () => { cancelAnimationFrame(raf); clearTimeout(id); };
    }, [step, compose, photo]);

    const updateT = (patch: Partial<ArtTransform>, id = areaId) => {
        if (id == null) return;
        setPlacements((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], t: { ...prev[id].t, ...patch } } } : prev));
    };
    const cur = areaId != null ? placements[areaId] : undefined;

    const setSize = (key: "scale" | "sx" | "sy", v: number) => {
        if (!cur) return;
        if (key === "sx" && lockRatio) updateT({ sx: v, sy: v });
        else if (key === "sy" && lockRatio) updateT({ sx: v, sy: v });
        else updateT({ [key]: v } as Partial<ArtTransform>);
    };

    // arrastar / pinçar / roda sobre a prévia
    const toImage = (e: { clientX: number; clientY: number }): [number, number] | null => {
        const cv = canvasRef.current;
        if (!cv) return null;
        const r = cv.getBoundingClientRect();
        return [((e.clientX - r.left) / r.width) * cv.width, ((e.clientY - r.top) / r.height) * cv.height];
    };
    const mapperFor = (a: Area, curv: number) => {
        const cv = canvasRef.current!;
        return buildMapper(a, curv, cv.width, cv.height, photo!.naturalWidth, photo!.naturalHeight);
    };
    const onPointerDown = (e: React.PointerEvent) => {
        if (!area || !cur || !photo) return;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) {
            const [p, q] = Array.from(pointers.current.values());
            pinchRef.current = { d0: Math.hypot(p.x - q.x, p.y - q.y) || 1, s0: cur.t.scale };
            dragRef.current = null;
            return;
        }
        const pt = toImage(e);
        if (!pt) return;
        const p0 = imageToPlane(mapperFor(area, cur.t.curvature), pt[0], pt[1]);
        dragRef.current = { id: area.id, p0, cx: cur.t.cx, cy: cur.t.cy };
    };
    const onPointerMove = (e: React.PointerEvent) => {
        if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinchRef.current && pointers.current.size === 2 && cur) {
            const [p, q] = Array.from(pointers.current.values());
            const d = Math.hypot(p.x - q.x, p.y - q.y) || 1;
            updateT({ scale: clamp(pinchRef.current.s0 * (d / pinchRef.current.d0), 0.03, 2.5) });
            return;
        }
        const d = dragRef.current;
        if (!d || !area || !cur) return;
        const pt = toImage(e);
        if (!pt) return;
        const p = imageToPlane(mapperFor(area, cur.t.curvature), pt[0], pt[1]);
        if (!isFinite(p[0]) || !isFinite(p[1])) return;
        updateT({ cx: d.cx + (p[0] - d.p0[0]), cy: d.cy + (p[1] - d.p0[1]) }, d.id);
    };
    const onPointerUp = (e: React.PointerEvent) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size < 2) pinchRef.current = null;
        if (pointers.current.size === 0) dragRef.current = null;
    };
    useEffect(() => {
        const cv = canvasRef.current;
        if (!cv || step !== 3) return;
        const onWheel = (ev: WheelEvent) => {
            if (areaId == null) return;
            ev.preventDefault();
            setPlacements((prev) => {
                const p = prev[areaId];
                if (!p) return prev;
                return { ...prev, [areaId]: { ...p, t: { ...p.t, scale: clamp(p.t.scale * Math.exp(-ev.deltaY * 0.0015), 0.03, 2.5) } } };
            });
        };
        cv.addEventListener("wheel", onWheel, { passive: false });
        return () => cv.removeEventListener("wheel", onWheel);
    }, [step, areaId, photo]);

    // ── resultado ───────────────────────────────────────────────────────────
    const generate = () => {
        if (!photo) return;
        setBusy(true);
        setTimeout(() => {
            try {
                const res = compose(Math.min(photo.naturalWidth, 2000), false);
                setResult(res);
                setResultUrl(res ? res.toDataURL("image/jpeg", 0.92) : "");
                setStep(4);
            } finally {
                setBusy(false);
            }
        }, 30);
    };

    const download = () => {
        if (!result || !product) return;
        try {
            result.toBlob((blob) => {
                if (!blob) { alert("Não foi possível gerar o PNG."); return; }
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `simulacao-${product.slug || "produto"}.png`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(a.href), 4000);
            }, "image/png");
        } catch {
            alert("Não foi possível exportar a imagem (a foto do produto bloqueia a exportação).");
        }
    };

    const redo = () => {
        if (product && photo) initPlacements(product, photoUrl, art, photo);
        setStep(3);
    };

    const useOnOtherProduct = () => {
        setResult(null);
        setProduct(null);
        setStep(1);
    };

    const quoteUrl = product
        ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
            `Olá! Fiz uma simulação de personalização no site da Ecosopis. 🌿\n\n*Produto:* ${product.name}\n*Arte:* ${art?.name || ""}\n*Quantidade aproximada:* \n*Empresa/Evento:* \n\nVou enviar a imagem da simulação em seguida.`
        )}`
        : "#";

    const canGo = (n: number) => (n === 1) || (n === 2 && !!product) || (n === 3 && !!product && !!art) || (n === 4 && !!result);

    // ── render ──────────────────────────────────────────────────────────────
    return (
        <main>
            <Header />
            <div className={styles.page}>
                <section className={styles.hero}>
                    <div className="container">
                        <Link href="/experiencias" className={styles.back}><ArrowLeft size={16} /> Experiências</Link>
                        <h1>Personalize seu Produto</h1>
                        <p>Visualize seus produtos com sua própria identidade visual antes de solicitar a produção.</p>
                    </div>
                </section>

                <div className="container">
                    <ol className={styles.stepper}>
                        {STEPS.map((label, i) => {
                            const n = i + 1;
                            return (
                                <li key={label} className={`${styles.stepItem} ${step === n ? styles.stepActive : ""} ${step > n ? styles.stepDone : ""}`}>
                                    <button type="button" disabled={!canGo(n)} onClick={() => setStep(n)}>
                                        <span className={styles.stepNum}>{step > n ? <Check size={14} /> : n}</span>
                                        <span className={styles.stepLabel}>{label}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ol>

                    {/* ───────── ETAPA 1 ───────── */}
                    {step === 1 && (
                        <section className={styles.panel}>
                            <h2>1. Escolha o produto</h2>
                            {art && (
                                <p className={styles.keepArt}><Sparkles size={16} /> Sua arte <strong>{art.name}</strong> será aplicada ao produto escolhido.</p>
                            )}
                            <div className={styles.toolbar}>
                                <label className={styles.search}>
                                    <Search size={18} />
                                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar produto" aria-label="Buscar produto" />
                                </label>
                                <label className={styles.check}>
                                    <input type="checkbox" checked={onlyReady} onChange={(e) => setOnlyReady(e.target.checked)} /> Só com personalização disponível
                                </label>
                            </div>
                            <div className={styles.chips} role="tablist">
                                {categories.map((c) => (
                                    <button key={c} type="button" className={`${styles.chip} ${category === c ? styles.chipOn : ""}`} onClick={() => setCategory(c)}>{c}</button>
                                ))}
                            </div>

                            {notice && (
                                <div className={styles.notice} role="alert">
                                    <AlertCircle size={20} />
                                    <div>
                                        <strong>{notice.name}</strong> ainda não tem uma área de personalização configurada.
                                        <br />
                                        <small>Administrador: marque a área em <Link href="/admin/dashboard/personalizacao">Admin → Personalização</Link> para liberar este produto.</small>
                                    </div>
                                </div>
                            )}

                            {loadError && <p className={styles.error}>{loadError}</p>}
                            {!products && !loadError && <p className={styles.muted}>Carregando produtos…</p>}
                            {products && filtered.length === 0 && <p className={styles.muted}>Nenhum produto encontrado.</p>}
                            <div className={styles.grid}>
                                {filtered.map((p) => (
                                    <button key={p.id} type="button" className={`${styles.product} ${product?.id === p.id ? styles.productOn : ""}`} onClick={() => chooseProduct(p)}>
                                        <div className={styles.productImg}>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={p.photos[0]} alt={p.name} loading="lazy" />
                                            <span className={`${styles.badge} ${p.customizable ? styles.badgeOk : styles.badgeOff}`}>
                                                {p.customizable ? "Personalização disponível" : "Em configuração"}
                                            </span>
                                        </div>
                                        <div className={styles.productInfo}>
                                            <span className={styles.cat}>{p.category || "Produto"}</span>
                                            <strong>{p.name}</strong>
                                            {p.description && <p>{p.description}</p>}
                                            <span className={styles.opt}><Palette size={14} /> {p.customizable ? `${p.areas.length} área${p.areas.length > 1 ? "s" : ""} para personalizar` : "Aguardando configuração"}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ───────── ETAPA 2 ───────── */}
                    {step === 2 && product && (
                        <section className={styles.panel}>
                            <h2>2. Envie a sua arte</h2>
                            <p className={styles.muted}>Logotipo, identidade visual ou o rótulo completo. Formatos: PNG, JPG, SVG ou PDF. O arquivo fica só no seu navegador.</p>
                            <div className={styles.twoCols}>
                                <div
                                    className={`${styles.drop} ${dragOver ? styles.dropOver : ""}`}
                                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
                                    onClick={() => fileRef.current?.click()}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
                                >
                                    <Upload size={34} />
                                    <strong>{artLoading ? "Lendo arquivo…" : "Arraste sua arte aqui ou clique para escolher"}</strong>
                                    <span>PNG · JPG · SVG · PDF (até 25 MB)</span>
                                    <input ref={fileRef} type="file" hidden accept=".png,.jpg,.jpeg,.svg,.pdf,image/png,image/jpeg,image/svg+xml,application/pdf" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
                                </div>
                                <div className={styles.artPreview}>
                                    {art ? (
                                        <>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={artPreview} alt="Prévia da arte" />
                                            <small>{art.name} · {art.canvas.width}×{art.canvas.height}px</small>
                                        </>
                                    ) : (
                                        <div className={styles.empty}><ImagePlus size={36} /><span>A prévia da sua arte aparece aqui</span></div>
                                    )}
                                </div>
                            </div>
                            {artError && <p className={styles.error} role="alert">{artError}</p>}
                            <div className={styles.actions}>
                                <button type="button" className={styles.btnGhost} onClick={() => setStep(1)}><ArrowLeft size={16} /> Trocar produto</button>
                                <button type="button" className={styles.btnPrimary} disabled={!art} onClick={() => setStep(3)}>Aplicar no produto <ArrowRight size={16} /></button>
                            </div>
                        </section>
                    )}

                    {/* ───────── ETAPA 3 ───────── */}
                    {step === 3 && product && (
                        <section className={styles.panel}>
                            <h2>3. Personalize: {product.name}</h2>
                            {photoError && <p className={styles.error}>{photoError}</p>}
                            <div className={styles.editor}>
                                <div className={styles.stage}>
                                    <div className={styles.canvasWrap} style={photo ? { aspectRatio: `${photo.naturalWidth} / ${photo.naturalHeight}`, width: `min(100%, calc(78vh * ${photo.naturalWidth / photo.naturalHeight}))` } : undefined}>
                                        <canvas
                                            ref={canvasRef}
                                            className={styles.canvas}
                                            onPointerDown={onPointerDown}
                                            onPointerMove={onPointerMove}
                                            onPointerUp={onPointerUp}
                                            onPointerCancel={onPointerUp}
                                            aria-label="Prévia do produto personalizado. Arraste para mover a arte."
                                        />
                                        {showArea && area && (
                                            <svg className={styles.areaSvg} viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
                                                <polygon points={area.quad.map((p) => p.join(",")).join(" ")} vectorEffect="non-scaling-stroke" />
                                            </svg>
                                        )}
                                    </div>
                                    <p className={styles.hint}>Arraste a arte para mover · use a roda do mouse ou o gesto de pinça para o tamanho.</p>
                                    {photosWithAreas.length > 1 && (
                                        <div className={styles.thumbs}>
                                            {photosWithAreas.map((u) => (
                                                <button key={u} type="button" className={u === photoUrl ? styles.thumbOn : ""} onClick={() => changePhoto(u)} aria-label="Trocar fotografia">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={u} alt="" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <aside className={styles.controls}>
                                    {areasOnPhoto.length > 1 && (
                                        <div className={styles.areaPills}>
                                            <span className={styles.ctrlTitle}><Layers size={14} /> Áreas</span>
                                            {areasOnPhoto.map((a) => (
                                                <div key={a.id} className={`${styles.pill} ${a.id === areaId ? styles.pillOn : ""}`}>
                                                    <button type="button" onClick={() => setAreaId(a.id)}>{a.name}</button>
                                                    <label title="Aplicar a arte nesta área">
                                                        <input type="checkbox" checked={!!placements[a.id]?.enabled} onChange={(e) => setPlacements((p) => ({ ...p, [a.id]: { ...p[a.id], enabled: e.target.checked } }))} />
                                                        aplicar
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {cur && area && (
                                        <>
                                            <Slider label="Tamanho" min={0.05} max={1.6} step={0.01} value={cur.t.scale} onChange={(v) => updateT({ scale: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
                                            <div className={styles.lockRow}>
                                                <button type="button" onClick={() => setLockRatio(!lockRatio)} className={styles.lockBtn}>
                                                    {lockRatio ? <Lock size={14} /> : <Unlock size={14} />} {lockRatio ? "Proporção travada" : "Proporção livre"}
                                                </button>
                                            </div>
                                            <Slider label="Largura" min={0.2} max={2.5} step={0.01} value={cur.t.sx} onChange={(v) => setSize("sx", v)} fmt={(v) => `${Math.round(v * 100)}%`} />
                                            <Slider label="Altura" min={0.2} max={2.5} step={0.01} value={cur.t.sy} onChange={(v) => setSize("sy", v)} fmt={(v) => `${Math.round(v * 100)}%`} />
                                            <Slider label="Rotação" min={-180} max={180} step={1} value={cur.t.rotation} onChange={(v) => updateT({ rotation: v })} fmt={(v) => `${Math.round(v)}°`} />
                                            <Slider label="Transparência" min={0.1} max={1} step={0.01} value={cur.t.opacity} onChange={(v) => updateT({ opacity: v })} fmt={(v) => `${Math.round(v * 100)}% visível`} />
                                            <Slider label="Perspectiva horizontal" min={-0.6} max={0.6} step={0.01} value={cur.t.perspX} onChange={(v) => updateT({ perspX: v })} fmt={(v) => v.toFixed(2)} />
                                            <Slider label="Perspectiva vertical" min={-0.6} max={0.6} step={0.01} value={cur.t.perspY} onChange={(v) => updateT({ perspY: v })} fmt={(v) => v.toFixed(2)} />
                                            <Slider label="Curvatura da superfície" min={0} max={1} step={0.01} value={cur.t.curvature} onChange={(v) => updateT({ curvature: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
                                            <div className={styles.rowBtns}>
                                                <button type="button" className={styles.btnGhost} onClick={() => product && photo && initPlacements(product, photoUrl, art, photo)}><RotateCcw size={14} /> Ajustar à área</button>
                                                <label className={styles.check}><input type="checkbox" checked={showArea} onChange={(e) => setShowArea(e.target.checked)} /> Mostrar área</label>
                                            </div>
                                        </>
                                    )}
                                </aside>
                            </div>
                            <div className={styles.actions}>
                                <button type="button" className={styles.btnGhost} onClick={() => setStep(2)}><ArrowLeft size={16} /> Trocar arte</button>
                                <button type="button" className={styles.btnPrimary} disabled={busy || !art || !photo} onClick={generate}>{busy ? "Gerando…" : "Gerar visualização"} <Eye size={16} /></button>
                            </div>
                        </section>
                    )}

                    {/* ───────── ETAPA 4 ───────── */}
                    {step === 4 && product && result && (
                        <section className={styles.panel}>
                            <h2>4. Sua simulação</h2>
                            <div className={styles.compare} style={{ ["--pos" as any]: `${compare}%`, aspectRatio: `${result.width} / ${result.height}` }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img className={styles.cmpAfter} src={resultUrl} alt="Produto personalizado" />
                                <div className={styles.cmpBeforeWrap}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img className={styles.cmpBefore} src={photoUrl} alt="Produto original" />
                                </div>
                                <span className={`${styles.tag} ${styles.tagL}`}>Original</span>
                                <span className={`${styles.tag} ${styles.tagR}`}>Personalizado</span>
                                <div className={styles.cmpHandle} />
                                <input type="range" min={0} max={100} value={compare} onChange={(e) => setCompare(+e.target.value)} className={styles.cmpRange} aria-label="Comparar original e personalizado" />
                            </div>
                            <div className={styles.resultBtns}>
                                <button type="button" className={styles.btnPrimary} onClick={download}><Download size={16} /> Baixar PNG</button>
                                <button type="button" className={styles.btnGhost} onClick={() => setZoom(true)}><Maximize2 size={16} /> Ver ampliado</button>
                                <button type="button" className={styles.btnGhost} onClick={redo}><RotateCcw size={16} /> Refazer</button>
                                <a className={styles.btnWhats} href={quoteUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> Solicitar orçamento</a>
                            </div>
                            <div className={styles.again}>
                                <p>Gostou? Aplique a mesma identidade visual em outros produtos.</p>
                                <button type="button" className={styles.btnLight} onClick={useOnOtherProduct}><Layers size={16} /> Escolher outro produto</button>
                            </div>
                            <p className={styles.muted}>Simulação ilustrativa: o resultado final pode variar levemente conforme o processo de produção. Baixe a imagem e envie junto com o pedido de orçamento.</p>
                        </section>
                    )}
                </div>
            </div>

            {zoom && result && (
                <div className={styles.modal} role="dialog" aria-modal="true" onClick={() => setZoom(false)}>
                    <button type="button" className={styles.modalClose} aria-label="Fechar"><X size={22} /></button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resultUrl} alt="Simulação ampliada" onClick={(e) => e.stopPropagation()} />
                </div>
            )}
            <Footer />
        </main>
    );
}

function Slider({ label, min, max, step, value, onChange, fmt }: {
    label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; fmt: (v: number) => string;
}) {
    return (
        <label className={styles.slider}>
            <span><em>{label}</em><b>{fmt(value)}</b></span>
            <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
        </label>
    );
}
