/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminSidebar from '@/components/AdminSidebar/AdminSidebar';
import styles from './whatsapp.module.css';
import {
  MessageSquare,
  QrCode,
  CheckCircle,
  AlertCircle,
  Send,
  Zap,
  History,
  RefreshCw,
  PowerOff,
  ShoppingBag,
  CreditCard,
  Truck,
  ShoppingCart,
  Sparkles,
  Phone,
  Copy,
  Clock,
  CheckCheck
} from 'lucide-react';

interface WhatsAppStatus {
  status: 'DISCONNECTED' | 'CONNECTING' | 'QR_CODE' | 'CONNECTED';
  phone?: string | null;
  qrCode?: string | null;
  lastConnection?: string | null;
}

interface TemplateItem {
  id: number;
  trigger_type: string;
  title: string;
  message_template: string;
  is_enabled: boolean;
  delay_minutes: number;
}

interface MessageLogItem {
  id: number;
  to_phone: string;
  recipient_name?: string;
  message: string;
  trigger_type: string;
  status: string;
  error?: string;
  created_at: string;
}

const TRIGGER_ICONS: Record<string, React.ReactNode> = {
  order_paid: <ShoppingBag size={18} color="#16a34a" />,
  order_created_pix: <CreditCard size={18} color="#2563eb" />,
  order_shipped: <Truck size={18} color="#d97706" />,
  abandoned_cart: <ShoppingCart size={18} color="#ea580c" />,
  promotion: <Sparkles size={18} color="#9333ea" />,
};

const AVAILABLE_TAGS: Record<string, string[]> = {
  order_paid: ['{cliente}', '{pedido}', '{valor}', '{itens}'],
  order_created_pix: ['{cliente}', '{pedido}', '{valor}', '{pix_copia_cola}'],
  order_shipped: ['{cliente}', '{pedido}', '{codigo_rastreio}'],
  abandoned_cart: ['{cliente}', '{link_carrinho}', '{desconto}'],
  promotion: ['{cliente}', '{cupom}', '{link}'],
};

export default function AdminWhatsAppPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'connection' | 'templates' | 'logs'>('connection');
  const [statusData, setStatusData] = useState<WhatsAppStatus>({ status: 'DISCONNECTED' });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [qrCountdown, setQrCountdown] = useState<number>(60);

  // Formulário de teste rápido
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Olá! Esta é uma mensagem de teste enviada pela ECOSOPIS via WhatsApp.');
  const [sendingTest, setSendingTest] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Templates
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [savingTemplate, setSavingTemplate] = useState<string | null>(null);

  // Logs
  const [logs, setLogs] = useState<MessageLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const getAuthHeaders = (): Record<string, string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // 1. Carrega status inicial e conecta SSE
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/admin');
      return;
    }

    fetchStatus();
    fetchTemplates();
    fetchLogs();

    // Conecta Server-Sent Events (SSE)
    const eventSource = new EventSource('/api/whatsapp/events');

    eventSource.addEventListener('status', (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data);
        setStatusData(prev => ({ ...prev, ...parsed }));
        if (parsed.status === 'QR_CODE') {
          setQrCountdown(60);
        }
      } catch (err) {}
    });

    eventSource.addEventListener('qr', (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data);
        setStatusData(prev => ({
          ...prev,
          status: 'QR_CODE',
          qrCode: parsed.qrCode
        }));
        setQrCountdown(60);
      } catch (err) {}
    });

    eventSource.addEventListener('message_sent', () => {
      fetchLogs();
    });

    return () => {
      eventSource.close();
    };
  }, []);

  // Timer regressivo para o QR Code
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (statusData.status === 'QR_CODE' && qrCountdown > 0) {
      timer = setInterval(() => {
        setQrCountdown(c => (c > 0 ? c - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [statusData.status, qrCountdown]);

  // Polling resiliente de fallback a cada 2.5s caso o SSE seja bloqueado por proxy ou firewall
  useEffect(() => {
    let pollTimer: NodeJS.Timeout | null = null;
    if (statusData.status === 'CONNECTING' || statusData.status === 'QR_CODE') {
      pollTimer = setInterval(() => {
        fetchStatus();
      }, 2500);
    }
    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [statusData.status]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/status', {
        headers: getAuthHeaders()
      });
      if (res.status === 401) {
        localStorage.removeItem('token');
        router.push('/admin');
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setStatusData(json);
      }
    } catch (e) {
      console.error('Erro ao buscar status WhatsApp:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/whatsapp/templates', {
        headers: getAuthHeaders()
      });
      if (res.status === 401) {
        localStorage.removeItem('token');
        router.push('/admin');
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.templates || []);
      }
    } catch (e) {
      console.error('Erro ao carregar templates:', e);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/whatsapp/messages?limit=50', {
        headers: getAuthHeaders()
      });
      if (res.status === 401) {
        localStorage.removeItem('token');
        router.push('/admin');
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setLogs(json.messages || []);
      }
    } catch (e) {
      console.error('Erro ao carregar logs:', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleConnect = async (force: boolean = false) => {
    setConnecting(true);
    setAlert(null);
    try {
      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ force })
      });
      if (res.status === 401) {
        localStorage.removeItem('token');
        router.push('/admin');
        return;
      }
      const json = await res.json();
      setStatusData(prev => ({ ...prev, ...json }));
      if (json.status === 'QR_CODE' && json.qrCode) {
        setQrCountdown(60);
      }
    } catch (err: any) {
      setAlert({ type: 'error', text: 'Falha ao solicitar conexão do WhatsApp.' });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Deseja realmente desconectar o WhatsApp da loja?')) return;
    setDisconnecting(true);
    setAlert(null);
    try {
      await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logout: true })
      });
      setStatusData({ status: 'DISCONNECTED', phone: null, qrCode: null });
      setAlert({ type: 'success', text: 'WhatsApp desconectado com sucesso.' });
    } catch (err) {
      setAlert({ type: 'error', text: 'Erro ao desconectar WhatsApp.' });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone) {
      setAlert({ type: 'error', text: 'Informe um número de telefone com DDD.' });
      return;
    }
    setSendingTest(true);
    setAlert(null);

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testPhone,
          message: testMessage,
          triggerType: 'manual',
          recipientName: 'Teste Admin'
        })
      });

      const json = await res.json();
      if (res.ok) {
        setAlert({ type: 'success', text: '✓ Mensagem de teste enviada com sucesso no WhatsApp!' });
        fetchLogs();
      } else {
        setAlert({ type: 'error', text: json.error || 'Falha ao enviar mensagem.' });
      }
    } catch (err: any) {
      setAlert({ type: 'error', text: 'Erro ao comunicar com o servidor.' });
    } finally {
      setSendingTest(false);
    }
  };

  const handleSaveTemplate = async (item: TemplateItem) => {
    setSavingTemplate(item.trigger_type);
    setAlert(null);
    try {
      const res = await fetch('/api/whatsapp/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger_type: item.trigger_type,
          message_template: item.message_template,
          is_enabled: item.is_enabled,
          delay_minutes: item.delay_minutes || 0
        })
      });
      if (res.ok) {
        setAlert({ type: 'success', text: `Regra "${item.title}" atualizada com sucesso!` });
      } else {
        setAlert({ type: 'error', text: 'Erro ao salvar regra.' });
      }
    } catch (err) {
      setAlert({ type: 'error', text: 'Erro ao salvar configuração.' });
    } finally {
      setSavingTemplate(null);
    }
  };

  const insertTagIntoTemplate = (triggerType: string, tag: string) => {
    setTemplates(prev =>
      prev.map(t => {
        if (t.trigger_type === triggerType) {
          return {
            ...t,
            message_template: `${t.message_template} ${tag}`
          };
        }
        return t;
      })
    );
  };

  return (
    <div className={styles.whatsappContainer}>
      <AdminSidebar activePath="/admin/dashboard/whatsapp" />

      <main className={styles.contentWrapper}>
        {/* Cabeçalho */}
        <div className={styles.headerSection}>
          <div className={styles.titleArea}>
            <h1>
              <MessageSquare size={28} color="#25d366" />
              WhatsApp & Disparos Automáticos
            </h1>
            <p>
              Mecanismo profissional Baileys Multi-Device conectado ao banco de dados com disparos automáticos para clientes.
            </p>
          </div>

          <div>
            {statusData.status === 'CONNECTED' && (
              <span className={`${styles.statusBadge} ${styles.badgeConnected}`}>
                <span className={`${styles.pulseDot} ${styles.pulseConnected}`}></span>
                Conectado: {statusData.phone || 'WhatsApp Web'}
              </span>
            )}
            {statusData.status === 'QR_CODE' && (
              <span className={`${styles.statusBadge} ${styles.badgeConnecting}`}>
                <span className={`${styles.pulseDot} ${styles.pulseConnecting}`}></span>
                Aguardando Leitura do QR Code
              </span>
            )}
            {statusData.status === 'CONNECTING' && (
              <span className={`${styles.statusBadge} ${styles.badgeConnecting}`}>
                <span className={`${styles.pulseDot} ${styles.pulseConnecting}`}></span>
                Iniciando Conexão...
              </span>
            )}
            {statusData.status === 'DISCONNECTED' && (
              <span className={`${styles.statusBadge} ${styles.badgeDisconnected}`}>
                <span className={`${styles.pulseDot} ${styles.pulseDisconnected}`}></span>
                Desconectado
              </span>
            )}
          </div>
        </div>

        {/* Notificações de Alerta */}
        {alert && (
          <div className={alert.type === 'success' ? styles.alertSuccess : styles.alertError}>
            {alert.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span>{alert.text}</span>
          </div>
        )}

        {/* Abas */}
        <div className={styles.tabsContainer}>
          <button
            onClick={() => setActiveTab('connection')}
            className={`${styles.tabButton} ${activeTab === 'connection' ? styles.tabButtonActive : ''}`}
          >
            <QrCode size={18} />
            Conexão & Teste
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`${styles.tabButton} ${activeTab === 'templates' ? styles.tabButtonActive : ''}`}
          >
            <Zap size={18} />
            Automações por Ação ({templates.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`${styles.tabButton} ${activeTab === 'logs' ? styles.tabButtonActive : ''}`}
          >
            <History size={18} />
            Mensagens Enviadas ({logs.length})
          </button>
        </div>

        {/* ─── ABA 1: CONEXÃO E TESTE ─── */}
        {activeTab === 'connection' && (
          <div className={styles.connectionGrid}>
            {/* Card Conexão */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <QrCode size={20} color="#128c7e" />
                Conexão WhatsApp Multi-Device
              </h2>
              <p className={styles.cardSubtitle}>
                Escaneie o QR Code com o aplicativo WhatsApp no seu celular para autorizar os envios da loja.
              </p>

              {statusData.status === 'CONNECTED' ? (
                <div>
                  <div className={styles.connectedBox}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CheckCircle size={24} color="#16a34a" />
                      <div>
                        <div style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>WhatsApp Conectado e Ativo</div>
                        <div className={styles.connectedPhone}>{statusData.phone}</div>
                      </div>
                    </div>
                    {statusData.lastConnection && (
                      <div className={styles.connectedMeta}>
                        Última conexão: {new Date(statusData.lastConnection).toLocaleString('pt-BR')}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className={styles.btnDanger}
                  >
                    <PowerOff size={16} />
                    {disconnecting ? 'Desconectando...' : 'Desconectar WhatsApp'}
                  </button>
                </div>
              ) : statusData.status === 'QR_CODE' && statusData.qrCode ? (
                <div className={styles.qrBoxWrapper}>
                  <div className={styles.qrImageFrame}>
                    <img src={statusData.qrCode} alt="WhatsApp QR Code" />
                  </div>
                  <div className={styles.qrTimer}>
                    QR Code expira em: <strong>{qrCountdown}s</strong>
                  </div>

                  <ol className={styles.instructionsList}>
                    <li>Abra o <strong>WhatsApp</strong> no seu celular.</li>
                    <li>Toque em <strong>Mais opções</strong> (⋮ no Android) ou <strong>Configurações</strong> (no iPhone).</li>
                    <li>Toque em <strong>Aparelhos Conectados</strong> &gt; <strong>Conectar Aparelho</strong>.</li>
                    <li>Aponte a câmera do seu celular para este QR Code na tela.</li>
                  </ol>

                  <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                    <button
                      onClick={() => handleConnect(true)}
                      disabled={connecting}
                      className={styles.btnSecondary}
                    >
                      <RefreshCw size={14} className={connecting ? styles.spinner : ''} />
                      {connecting ? 'Gerando...' : 'Gerar Novo QR Code'}
                    </button>
                    <button
                      onClick={handleDisconnect}
                      className={styles.btnDanger}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (connecting || (statusData.status === 'CONNECTING' && !statusData.qrCode)) ? (
                <div className={styles.qrBoxWrapper}>
                  <div style={{ marginBottom: 16 }}>
                    <RefreshCw size={44} color="#128c7e" className={styles.spinner} />
                  </div>
                  <h3 style={{ fontSize: 16, margin: '0 0 8px 0', color: '#1e293b' }}>
                    Gerando QR Code...
                  </h3>
                  <p style={{ fontSize: 13, color: '#64748b', maxWidth: 360, margin: '0 0 20px 0' }}>
                    Estabelecendo conexão segura com os servidores do WhatsApp. O QR Code aparecerá em instantes.
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => handleConnect(true)}
                      disabled={connecting}
                      className={styles.btnSecondary}
                    >
                      <RefreshCw size={14} className={connecting ? styles.spinner : ''} />
                      {connecting ? 'Iniciando...' : 'Forçar Novo QR Code'}
                    </button>
                    <button
                      onClick={async () => {
                        setStatusData(prev => ({ ...prev, status: 'DISCONNECTED', qrCode: null }));
                        await handleDisconnect();
                      }}
                      className={styles.btnDanger}
                    >
                      Cancelar e Redefinir
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.qrBoxWrapper}>
                  <div style={{ marginBottom: 16 }}>
                    <Phone size={48} color="#94a3b8" />
                  </div>
                  <h3 style={{ fontSize: 16, margin: '0 0 8px 0', color: '#1e293b' }}>
                    Nenhum WhatsApp Conectado
                  </h3>
                  <p style={{ fontSize: 13, color: '#64748b', maxWidth: 360, margin: '0 0 20px 0' }}>
                    Clique no botão abaixo para gerar o QR Code de autenticação segura e sincronizar com o banco de dados.
                  </p>

                  <button
                    onClick={() => handleConnect(true)}
                    disabled={connecting}
                    className={styles.btnPrimary}
                  >
                    <QrCode size={18} />
                    {connecting ? 'Gerando QR Code...' : 'Conectar WhatsApp'}
                  </button>
                </div>
              )}
            </div>

            {/* Card Disparo de Teste */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <Send size={20} color="#128c7e" />
                Disparo Rápido de Teste
              </h2>
              <p className={styles.cardSubtitle}>
                Envie uma mensagem instantânea para conferir a entrega e formatação no seu celular.
              </p>

              <form onSubmit={handleSendTest}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>WhatsApp do Destinatário (com DDD):</label>
                  <input
                    type="text"
                    placeholder="Ex: 11999998888 ou 5511999998888"
                    value={testPhone}
                    onChange={e => setTestPhone(e.target.value)}
                    className={styles.formInput}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Texto da Mensagem:</label>
                  <textarea
                    value={testMessage}
                    onChange={e => setTestMessage(e.target.value)}
                    className={styles.formTextarea}
                    rows={4}
                    required
                  />
                </div>

                {/* Prévia da mensagem */}
                <div className={styles.previewBubbleWrapper}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 8 }}>
                    Pré-visualização no WhatsApp:
                  </div>
                  <div className={styles.whatsappBubble}>
                    {testMessage || 'Digite uma mensagem...'}
                    <div className={styles.bubbleMeta}>
                      <span>12:00</span>
                      <CheckCheck size={14} color="#53bdeb" />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={sendingTest || statusData.status !== 'CONNECTED'}
                  className={styles.btnPrimary}
                  style={{ width: '100%', marginTop: 20 }}
                >
                  <Send size={16} />
                  {sendingTest
                    ? 'Disparando Mensagem...'
                    : statusData.status !== 'CONNECTED'
                    ? 'Conecte o WhatsApp para Enviar'
                    : 'Enviar Mensagem de Teste'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ─── ABA 2: AUTOMAÇÕES & GATILHOS POR AÇÃO ─── */}
        {activeTab === 'templates' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
                Configuração de Mensagens Automáticas
              </h2>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                Defina o que o cliente recebe no WhatsApp a cada ação da loja (venda aprovada, chave PIX, envio com rastreio, carrinho abandonado e promoções).
              </p>
            </div>

            <div className={styles.templatesGrid}>
              {templates.map(tpl => {
                const availableTags = AVAILABLE_TAGS[tpl.trigger_type] || ['{cliente}', '{pedido}'];

                return (
                  <div key={tpl.id} className={styles.templateCard}>
                    <div className={styles.templateHeader}>
                      <div className={styles.templateTitleArea}>
                        {TRIGGER_ICONS[tpl.trigger_type] || <Zap size={18} color="#128c7e" />}
                        <div>
                          <div className={styles.templateTitle}>{tpl.title}</div>
                          <span style={{ fontSize: 11, color: '#64748b' }}>
                            Identificador: <code>{tpl.trigger_type}</code>
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: tpl.is_enabled ? '#166534' : '#64748b' }}>
                          {tpl.is_enabled ? 'Ativado' : 'Desativado'}
                        </span>
                        <label className={styles.toggleSwitch}>
                          <input
                            type="checkbox"
                            checked={tpl.is_enabled}
                            onChange={e => {
                              const checked = e.target.checked;
                              setTemplates(prev =>
                                prev.map(t =>
                                  t.trigger_type === tpl.trigger_type ? { ...t, is_enabled: checked } : t
                                )
                              );
                            }}
                          />
                          <span className={styles.slider}></span>
                        </label>
                      </div>
                    </div>

                    {/* Tags Dinâmicas Clicáveis */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                        Variáveis dinâmicas (clique para inserir no texto):
                      </div>
                      <div className={styles.tagsContainer}>
                        {availableTags.map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => insertTagIntoTemplate(tpl.trigger_type, tag)}
                            className={styles.tagPill}
                          >
                            + {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Textarea do Template */}
                    <div className={styles.formGroup}>
                      <textarea
                        value={tpl.message_template}
                        onChange={e => {
                          const val = e.target.value;
                          setTemplates(prev =>
                            prev.map(t =>
                              t.trigger_type === tpl.trigger_type ? { ...t, message_template: val } : t
                            )
                          );
                        }}
                        className={styles.formTextarea}
                        rows={5}
                      />
                    </div>

                    {/* Preview da Mensagem */}
                    <div className={styles.previewBubbleWrapper}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                        Visualização simulada:
                      </div>
                      <div className={styles.whatsappBubble}>
                        {tpl.message_template
                          .replace(/{cliente}/gi, 'Maria Silva')
                          .replace(/{pedido}/gi, '1042')
                          .replace(/{valor}/gi, '159,90')
                          .replace(/{itens}/gi, 'Sabonete Açafrão, Óleo Rosa Mosqueta')
                          .replace(/{pix_copia_cola}/gi, '00020126580014br.gov.bcb.pix0136...')
                          .replace(/{codigo_rastreio}/gi, 'NL123456789BR')
                          .replace(/{link_carrinho}/gi, 'https://ecosopis.com.br/carrinho')
                          .replace(/{desconto}/gi, '10%')
                          .replace(/{cupom}/gi, 'NATURAL15')
                          .replace(/{link}/gi, 'https://ecosopis.com.br/produtos')}
                        <div className={styles.bubbleMeta}>
                          <span>14:35</span>
                          <CheckCheck size={14} color="#53bdeb" />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                      <button
                        onClick={() => handleSaveTemplate(tpl)}
                        disabled={savingTemplate === tpl.trigger_type}
                        className={styles.btnPrimary}
                      >
                        <CheckCircle size={16} />
                        {savingTemplate === tpl.trigger_type ? 'Salvando...' : 'Salvar Regra'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── ABA 3: HISTÓRICO DE MENSAGENS ENVIADAS ─── */}
        {activeTab === 'logs' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>
                  Histórico de Mensagens Enviadas
                </h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                  Acompanhe todas as notificações e mensagens entregues aos clientes pelo WhatsApp.
                </p>
              </div>

              <button
                onClick={fetchLogs}
                disabled={loadingLogs}
                className={styles.btnSecondary}
              >
                <RefreshCw size={14} className={loadingLogs ? 'animate-spin' : ''} />
                Atualizar Lista
              </button>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Data / Hora</th>
                    <th>Destinatário</th>
                    <th>Ação / Gatilho</th>
                    <th>Mensagem Enviada</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                        Nenhuma mensagem enviada ainda. As notificações aparecerão aqui automaticamente.
                      </td>
                    </tr>
                  ) : (
                    logs.map(log => (
                      <tr key={log.id}>
                        <td style={{ whiteSpace: 'nowrap', color: '#64748b' }}>
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {log.recipient_name && <div>{log.recipient_name}</div>}
                          <div style={{ fontSize: 12, color: '#64748b' }}>{log.to_phone}</div>
                        </td>
                        <td>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
                            {log.trigger_type === 'order_paid'
                              ? '🛒 Venda Aprovada'
                              : log.trigger_type === 'order_created_pix'
                              ? '🔑 Chave PIX'
                              : log.trigger_type === 'order_shipped'
                              ? '🚚 Rastreio / Envio'
                              : log.trigger_type === 'abandoned_cart'
                              ? '🛍️ Carrinho Abandonado'
                              : log.trigger_type === 'promotion'
                              ? '🎉 Promoção'
                              : '📱 Disparo Manual'}
                          </span>
                        </td>
                        <td style={{ maxWidth: 380, lineHeight: 1.4 }}>
                          <span style={{ fontSize: 12 }}>{log.message}</span>
                        </td>
                        <td>
                          {log.status === 'SENT' ? (
                            <span className={styles.badgeSent}>
                              ✓ Entregue
                            </span>
                          ) : (
                            <span className={styles.badgeFailed} title={log.error || ''}>
                              ✗ Falha
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
