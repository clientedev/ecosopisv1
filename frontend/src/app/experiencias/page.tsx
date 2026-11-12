"use client";

import React, { useState } from "react";
import Image from "next/image";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import { Sparkles, Droplets, Bath, Gift, MessageCircle, ChevronDown, Package, MapPin, Layers, ClipboardList, Wand2 } from "lucide-react";
import styles from "./page.module.css";

const WHATSAPP_NUMBER = "5511951559212";

const buildWhatsAppUrl = (message: string) =>
    `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

const WORKSHOPS = [
    {
        value: "Body Splash",
        icon: Droplets,
        title: "Body Splash",
        quote: "“Crie uma fragrância que tenha a sua essência!”",
        text: "Uma variedade de aromas para explorar, combinar e criar uma fragrância exclusiva. Aqui, a criatividade é livre! Cada pessoa cria um Body Splash único, que transmite sua personalidade e desperta sensações e memórias.",
    },
    {
        value: "Balm Labial",
        icon: Sparkles,
        title: "Balm Labial",
        quote: "“Crie seu próprio cuidado!”",
        text: "Uma experiência criativa em que você participa da produção do seu próprio balm labial. Conheça os ingredientes, acompanhe cada etapa e personalize seu produto para levar consigo uma criação feita por você!",
    },
    {
        value: "Espuma para Banho",
        icon: Bath,
        title: "Espuma para Banho",
        quote: "“Transforme o banho em um momento especial!”",
        text: "Uma experiência divertida e sensorial para criar sua própria espuma para banho. Explore as possibilidades, participe de cada etapa da produção e leve para casa um produto feito por você!",
    },
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
    {
        q: "Precisa de alguma estrutura para realizar a oficina?",
        a: [
            "Sim! A Ecosopis leva todos os materiais e utensílios necessários para a realização da oficina escolhida, incluindo matérias-primas, embalagens e itens de apoio para a produção.",
            "A estrutura do evento fica por conta do contratante, que deverá disponibilizar mesas, cadeiras, água e, caso deseje, café da manhã, petiscos ou outros itens de recepção aos participantes.",
        ],
    },
    {
        q: "Como é feito o orçamento?",
        a: [
            "O orçamento é personalizado de acordo com a quantidade de participantes, oficina escolhida, combinações de oficinas, data e local do evento.",
            "Após o primeiro contato pelo WhatsApp, conversamos sobre a proposta e as necessidades do evento. Em seguida, enviaremos um orçamento completo com valores, condições de pagamento e demais informações.",
        ],
    },
    {
        q: "O kit personalizado muda o produto?",
        a: [
            "Os kits são montados de acordo com a proposta de cada evento. A personalização pode incluir embalagens, tags, cartões e outros elementos visuais com a identidade da empresa ou ocasião. Os produtos são escolhidos conforme cada projeto.",
        ],
    },
];

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
    const [openFaq, setOpenFaq] = useState<number | null>(0);

    const scrollTo = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const whatsappWorkshopUrl = buildWhatsAppUrl(
        "Olá! Gostaria de solicitar um orçamento de oficina da Ecosopis para o meu evento. 🌿\n\n*Tipo:* Oficina\n*Oficina de interesse:* \n*Nº aproximado de pessoas:* \n*Data prevista:* \n*Local do evento:* "
    );
    const whatsappKitUrl = buildWhatsAppUrl(
        "Olá! Gostaria de solicitar um orçamento de kit personalizado da Ecosopis para o meu evento. 🌿\n\n*Tipo:* Kit personalizado\n*Quantidade aproximada:* \n*Data prevista:* \n*Empresa/Evento:* "
    );
    const whatsappGeneralUrl = buildWhatsAppUrl(
        "Olá! Gostaria de solicitar um orçamento de experiência Ecosopis para o meu evento. 🌿\n\n*Tipo (Oficina ou Kit personalizado):* \n*Nº aproximado de pessoas:* \n*Data prevista:* \n*Local/Empresa:* "
    );

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
                            {WORKSHOPS.map(({ icon: Icon, title, quote, text }) => (
                                <article key={title} className={styles.card}>
                                    <div className={styles.cardIcon}><Icon size={28} /></div>
                                    <h3>{title}</h3>
                                    <p className={styles.cardQuote}>{quote}</p>
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
                            <a href={whatsappWorkshopUrl} target="_blank" rel="noopener noreferrer" className={styles.btnPrimary}>
                                <MessageCircle size={18} /> Solicitar orçamento de oficina
                            </a>
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
                            <a href={whatsappKitUrl} target="_blank" rel="noopener noreferrer" className={styles.btnPrimary}>
                                <MessageCircle size={18} /> Solicitar orçamento de kit
                            </a>
                        </div>
                    </div>
                </section>

                <section id="orcamento" className={styles.section}>
                    <div className="container">
                        <h2 className={styles.sectionTitle}>Solicite seu orçamento</h2>
                        <p className={styles.lead}>Fale diretamente com a nossa equipe pelo WhatsApp com a mensagem já preenchida para agilizar o seu atendimento.</p>
                        <div className={`${styles.center} ${styles.whatsappCtaWrap}`}>
                            <a href={whatsappGeneralUrl} target="_blank" rel="noopener noreferrer" className={styles.btnPrimary}>
                                <MessageCircle size={18} /> Solicitar orçamento pelo WhatsApp
                            </a>
                        </div>
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
                                    {openFaq === i && (
                                        <div className={styles.faqA}>
                                            {item.a.map((paragraph, idx) => (
                                                <p key={idx}>{paragraph}</p>
                                            ))}
                                        </div>
                                    )}
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
