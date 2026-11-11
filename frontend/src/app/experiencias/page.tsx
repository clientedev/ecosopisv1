"use client";

import React, { useState } from "react";
import Image from "next/image";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import { useToast } from "@/components/Toast/Toast";
import { Sparkles, Droplets, Bath, Gift, MessageCircle, ChevronDown, Package, MapPin, Layers, ClipboardList, Wand2 } from "lucide-react";
import styles from "./page.module.css";

const WHATSAPP_NUMBER = "5511951559212";

const WORKSHOPS = [
    { value: "Body Splash", icon: Droplets, title: "Body Splash", text: "Uma variedade de aromas para você explorar, combinar e criar uma fragrância exclusiva! Aqui, a criatividade é livre. Cada pessoa cria um Body Splash único, que transmite sua personalidade, desperta sensações e memórias." },
    { value: "Balm labial", icon: Sparkles, title: "Balm labial", text: "Cada participante cria o seu próprio balm labial, do começo ao fim." },
    { value: "Espuma para Banho", icon: Bath, title: "Espuma para Banho", text: "Cada participante cria a sua espuma de banho para levar para casa." },
];

const STEPS = [
    { icon: MessageCircle, title: "Você conta sobre o seu evento", text: "Local, público e o que você imagina." },
    { icon: ClipboardList, title: "Montamos uma proposta sob medida", text: "Tudo pensado para o seu evento." },
    { icon: Wand2, title: "Levamos tudo e conduzimos a oficina", text: "Material, condução e mão na massa." },
];

const KITS = [
    {
        name: "EBEM",
        src: "/experiencias/kit-ebem.jpg",
        label: "Kit EBEM",
        text: "Sabonete líquido, óleo essencial e sabonete em barra dentro da sacolinha kraft com o logo Ecosopis e tag personalizada.",
    },
    {
        name: "EBEM sacolinhas",
        src: "/experiencias/kit-ebem-sacolinhas.jpg",
        label: "Kit EBEM · produção para o evento",
        text: "Sacolinhas kraft com o logo Ecosopis, fitinha de juta e tag com a mensagem do evento, prontas para entrega.",
    },
    {
        name: "Balance Saúde",
        src: "/experiencias/kit-balance-saude.jpg",
        label: "Kit Balance Saúde",
        text: "Frasco com conta-gotas em sachê de organza, acompanhado de cartinha personalizada.",
    },
];

const FAQ = [
    { q: "Vocês vão até o local?", a: "Sim. A Ecosopis vai até a sua empresa, escola ou evento e leva todo o material necessário." },
    { q: "Precisa de alguma estrutura?", a: "Conversamos sobre o espaço no pedido de orçamento e, se necessário, orientamos o que preparar. Em geral, uma mesa para os participantes já ajuda bastante." },
    { q: "Como é feito o orçamento?", a: "Você preenche o formulário, a mensagem é enviada para o nosso WhatsApp e montamos uma proposta de acordo com o seu evento." },
    { q: "O kit personalizado muda o produto?", a: "Não. A personalização é na embalagem: sacolinha kraft com o logo Ecosopis, tag personalizada e cartinha ou panfleto do seu evento ou empresa." },
];

type FormState = {
    nome: string; empresa: string; whatsapp: string; tipo: "" | "Oficina" | "Kit personalizado";
    oficina: string; pessoas: string; data: string; mensagem: string;
};

const EMPTY: FormState = { nome: "", empresa: "", whatsapp: "", tipo: "", oficina: "Ainda não sei", pessoas: "", data: "", mensagem: "" };

function KitImage({ name, src }: { name: string; src: string }) {
    const [failed, setFailed] = useState(false);
    if (failed) {
        return (
            <div className={styles.kitPlaceholder} role="img" aria-label={`Kit ${name}`}>
                <Gift size={44} />
            </div>
        );
    }
    return (
        <Image src={src} alt={`Kit ${name}`} fill sizes="(max-width: 768px) 100vw, 50vw" style={{ objectFit: "cover" }} unoptimized onError={() => setFailed(true)} />
    );
}

export default function ExperienciasPage() {
    const { showToast } = useToast();
    const [form, setForm] = useState<FormState>(EMPTY);
    const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
    const [openFaq, setOpenFaq] = useState<number | null>(0);

    const scrollTo = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const chooseType = (tipo: "Oficina" | "Kit personalizado") => {
        setForm((f) => ({ ...f, tipo }));
        setErrors((e) => ({ ...e, tipo: undefined }));
        scrollTo("orcamento");
    };

    const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setForm((f) => ({ ...f, [k]: e.target.value }));
        setErrors((er) => ({ ...er, [k]: undefined }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const er: Partial<Record<keyof FormState, string>> = {};
        if (!form.nome.trim()) er.nome = "Informe o seu nome.";
        if (form.whatsapp.replace(/\D/g, "").length < 10) er.whatsapp = "Informe um WhatsApp válido com DDD.";
        if (!form.tipo) er.tipo = "Escolha o tipo de experiência.";
        setErrors(er);
        if (Object.keys(er).length) {
            showToast("Confira os campos destacados.", "error");
            return;
        }

        const lines = [
            "Olá! Gostaria de solicitar um orçamento de experiência Ecosopis. 🌿",
            "",
            `*Nome:* ${form.nome.trim()}`,
            form.empresa.trim() && `*Empresa/Evento:* ${form.empresa.trim()}`,
            `*WhatsApp:* ${form.whatsapp.trim()}`,
            `*Tipo:* ${form.tipo}`,
            form.tipo === "Oficina" && `*Oficina de interesse:* ${form.oficina}`,
            form.pessoas.trim() && `*Nº aproximado de pessoas:* ${form.pessoas.trim()}`,
            form.data && `*Data prevista:* ${form.data.split("-").reverse().join("/")}`,
            form.mensagem.trim() && `*Mensagem:* ${form.mensagem.trim()}`,
        ].filter(Boolean);

        const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
        window.open(url, "_blank", "noopener,noreferrer");
        showToast("Abrindo o WhatsApp com o seu pedido de orçamento!", "success");
    };

    return (
        <main>
            <Header />
            <div className={styles.page}>
                <section className={styles.hero}>
                    <div className="container">
                        <h1>Experiências Ecosopis</h1>
                        <p className={styles.subtitle}>Oficinas e kits de cosméticos naturais para o seu evento</p>
                        <div className={styles.heroButtons}>
                            <button type="button" className={styles.btnLight} onClick={() => scrollTo("oficinas")}>Oficinas</button>
                            <button type="button" className={styles.btnOutline} onClick={() => scrollTo("kits")}>Kits personalizados</button>
                        </div>
                    </div>
                </section>

                <section id="oficinas" className={styles.section}>
                    <div className="container">
                        <h2 className={styles.sectionTitle}>Oficinas</h2>
                        <p className={styles.lead}>
                            A Ecosopis vai até o local do cliente (empresa, escola, evento, festa) levando todo o material, e cada participante cria o seu próprio produto.
                        </p>
                        <div className={styles.cards}>
                            {WORKSHOPS.map(({ icon: Icon, title, text }) => (
                                <article key={title} className={styles.card}>
                                    <div className={styles.cardIcon}><Icon size={28} /></div>
                                    <h3>{title}</h3>
                                    <p>{text}</p>
                                </article>
                            ))}
                        </div>

                        <p className={styles.combo}>
                            <Layers size={18} />
                            <span>Você pode contratar uma oficina individual ou combinar duas ou mais no mesmo evento, como <strong>Body Splash + Espuma para Banho</strong>.</span>
                        </p>

                        <h3 className={styles.subTitle}>Como funciona</h3>
                        <ol className={styles.steps}>
                            {STEPS.map(({ icon: Icon, title, text }, i) => (
                                <li key={title} className={styles.step}>
                                    <span className={styles.stepNum}>{i + 1}</span>
                                    <Icon size={22} className={styles.stepIcon} />
                                    <strong>{title}</strong>
                                    <span>{text}</span>
                                </li>
                            ))}
                        </ol>
                        <div className={styles.center}>
                            <button type="button" className={styles.btnPrimary} onClick={() => chooseType("Oficina")}>Solicitar orçamento de oficina</button>
                        </div>
                    </div>
                </section>

                <section id="kits" className={`${styles.section} ${styles.sectionAlt}`}>
                    <div className="container">
                        <h2 className={styles.sectionTitle}>Kits personalizados</h2>
                        <p className={styles.lead}>
                            Desenvolvemos kits de cosméticos para presentear colaboradores, clientes e convidados, com apresentação personalizada para a identidade do seu evento ou empresa.
                        </p>
                        <ul className={styles.chips}>
                            <li>Eventos corporativos</li>
                            <li>Colaboradores</li>
                            <li>Clientes</li>
                            <li>Ações especiais</li>
                        </ul>
                        <p className={styles.lead}>
                            A personalização está na embalagem: sacolinha kraft com o logo Ecosopis, tag personalizada e cartinha ou panfleto do seu evento ou da sua empresa.
                        </p>
                        <p className={styles.leadSmall}>
                            Exemplos de produtos: sabonete em barra de açafrão, sabonete líquido e óleos essenciais (alecrim, lavanda).
                        </p>
                        <h3 className={styles.subTitle}>Kits que já realizamos</h3>
                        <div className={styles.kitGrid}>
                            {KITS.map((k) => (
                                <figure key={k.name} className={styles.kit}>
                                    <div className={styles.kitImage}><KitImage name={k.name} src={k.src} /></div>
                                    <figcaption>
                                        <strong><Package size={16} /> {k.label}</strong>
                                        <span>{k.text}</span>
                                    </figcaption>
                                </figure>
                            ))}
                        </div>
                        <p className={styles.note}>Cada proposta é montada de acordo com o seu evento ou a sua empresa.</p>
                        <div className={styles.center}>
                            <button type="button" className={styles.btnPrimary} onClick={() => chooseType("Kit personalizado")}>Solicitar orçamento de kit</button>
                        </div>
                    </div>
                </section>

                <section id="orcamento" className={styles.section}>
                    <div className="container">
                        <h2 className={styles.sectionTitle}>Solicite seu orçamento</h2>
                        <p className={styles.lead}>Preencha os dados e enviaremos o seu pedido pelo WhatsApp.</p>
                        <form className={styles.form} onSubmit={handleSubmit} noValidate>
                            <div className={styles.field}>
                                <label htmlFor="exp-nome">Nome *</label>
                                <input id="exp-nome" value={form.nome} onChange={set("nome")} autoComplete="name" aria-invalid={!!errors.nome} />
                                {errors.nome && <span className={styles.error}>{errors.nome}</span>}
                            </div>
                            <div className={styles.field}>
                                <label htmlFor="exp-empresa">Empresa/Evento</label>
                                <input id="exp-empresa" value={form.empresa} onChange={set("empresa")} autoComplete="organization" />
                            </div>
                            <div className={styles.field}>
                                <label htmlFor="exp-whats">WhatsApp *</label>
                                <input id="exp-whats" type="tel" inputMode="tel" placeholder="(11) 90000-0000" value={form.whatsapp} onChange={set("whatsapp")} autoComplete="tel" aria-invalid={!!errors.whatsapp} />
                                {errors.whatsapp && <span className={styles.error}>{errors.whatsapp}</span>}
                            </div>
                            <div className={styles.field}>
                                <label htmlFor="exp-tipo">Tipo *</label>
                                <select id="exp-tipo" value={form.tipo} onChange={set("tipo")} aria-invalid={!!errors.tipo}>
                                    <option value="">Selecione</option>
                                    <option value="Oficina">Oficina</option>
                                    <option value="Kit personalizado">Kit personalizado</option>
                                </select>
                                {errors.tipo && <span className={styles.error}>{errors.tipo}</span>}
                            </div>
                            {form.tipo === "Oficina" && (
                                <div className={styles.field}>
                                    <label htmlFor="exp-oficina">Oficina de interesse</label>
                                    <select id="exp-oficina" value={form.oficina} onChange={set("oficina")}>
                                        <option>Body Splash</option>
                                        <option>Balm labial</option>
                                        <option>Espuma para Banho</option>
                                        <option>Ainda não sei</option>
                                    </select>
                                </div>
                            )}
                            <div className={styles.field}>
                                <label htmlFor="exp-pessoas">Nº aproximado de pessoas</label>
                                <input id="exp-pessoas" type="number" inputMode="numeric" min={1} value={form.pessoas} onChange={set("pessoas")} />
                            </div>
                            <div className={styles.field}>
                                <label htmlFor="exp-data">Data prevista</label>
                                <input id="exp-data" type="date" value={form.data} onChange={set("data")} />
                            </div>
                            <div className={`${styles.field} ${styles.full}`}>
                                <label htmlFor="exp-msg">Mensagem</label>
                                <textarea id="exp-msg" rows={4} value={form.mensagem} onChange={set("mensagem")} />
                            </div>
                            <div className={`${styles.full} ${styles.center}`}>
                                <button type="submit" className={styles.btnPrimary}><MessageCircle size={18} /> Enviar pelo WhatsApp</button>
                            </div>
                        </form>
                    </div>
                </section>

                <section className={`${styles.section} ${styles.sectionAlt}`}>
                    <div className="container">
                        <h2 className={styles.sectionTitle}>Perguntas frequentes</h2>
                        <div className={styles.faq}>
                            {FAQ.map((item, i) => (
                                <div key={item.q} className={styles.faqItem}>
                                    <button type="button" className={styles.faqQ} aria-expanded={openFaq === i} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                                        <span>{item.q}</span>
                                        <ChevronDown size={20} className={openFaq === i ? styles.chevOpen : ""} />
                                    </button>
                                    {openFaq === i && <p className={styles.faqA}>{item.a}</p>}
                                </div>
                            ))}
                        </div>
                        <p className={styles.where}><MapPin size={16} /> Atendemos eventos no local do cliente.</p>
                    </div>
                </section>
            </div>
            <Footer />
        </main>
    );
}
