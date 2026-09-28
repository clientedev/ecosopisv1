/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  CheckCheck,
  Users,
  Search,
  Filter,
  CheckSquare,
  Square,
  PackageOpen,
  Eye,
  X,
  Package,
  ArrowRight
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

interface UserItem {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  has_phone: boolean;
  role: string;
  total_orders: number;
  created_at?: string;
  cart_updated_at?: string;
  has_cart?: boolean;
}

interface CartProductItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  image_url: string;
}

interface AbandonedCartItem {
  user_id: number;
  name: string;
  email: string;
  phone: string | null;
  has_phone: boolean;
  cart_updated_at: string;
  time_ago: string;
  items: CartProductItem[];
  items_count: number;
  total_value: number;
}

const TRIGGER_ICONS: Record<string, React.ReactNode> = {
  order_paid: <ShoppingBag size={18} color="#16a34a" />,
  order_shipped: <Truck size={18} color="#d97706" />,
  abandoned_cart: <ShoppingCart size={18} color="#ea580c" />,
  promotion: <Sparkles size={18} color="#9333ea" />,
};

const AVAILABLE_TAGS: Record<string, string[]> = {
  order_paid: ['{cliente}', '{pedido}', '{valor}', '{itens}'],
  order_shipped: ['{cliente}', '{pedido}', '{codigo_rastreio}'],
  abandoned_cart: ['{cliente}', '{link_carrinho}', '{desconto}'],
  promotion: ['{cliente}', '{cupom}', '{link}'],
};

export default function AdminWhatsAppPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'connection' | 'users' | 'abandoned_carts' | 'templates' | 'logs'>('connection');
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

  // Templates & Logs
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [savingTemplate, setSavingTemplate] = useState<string | null>(null);
  const [logs, setLogs] = useState<MessageLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // ── ABA USUÁRIOS ──
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'has_phone' | 'buyers'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userMessageText, setUserMessageText] = useState('Olá {cliente}! Temos novidades exclusivas na Ecosopis com cosméticos naturais e veganos. Confira em {link}');
  const [sendingBulkUsers, setSendingBulkUsers] = useState(false);
  const [bulkUsersProgress, setBulkUsersProgress] = useState<{ sent: number; failed: number; total: number } | null>(null);

  // ── ABA CARRINHOS ABANDONADOS ──
  const [abandonedCarts, setAbandonedCarts] = useState<AbandonedCartItem[]>([]);
  const [loadingCarts, setLoadingCarts] = useState(false);
  const [cartSearch, setCartSearch] = useState('');
  const [selectedCartUserIds, setSelectedCartUserIds] = useState<number[]>([]);
  const [cartStats, setCartStats] = useState({ totalValue: 0, totalCount: 0, withPhoneCount: 0 });
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [singleCartTarget, setSingleCartTarget] = useState<AbandonedCartItem | null>(null);
  const [cartMessageText, setCartMessageText] = useState(
    'Olá {cliente}! Notamos que você deixou itens especiais no seu carrinho na Ecosopis: {itens}. Para te ajudar a finalizar seu pedido, use o cupom VOLTA10 e garanta 10% OFF: https://ecosopis.com.br/carrinho'
  );
  const [sendingBulkCarts, setSendingBulkCarts] = useState(false);
  const [bulkCartsProgress, setBulkCartsProgress] = useState<{ sent: number; failed: number; total: number } | null>(null);

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
    fetchAbandonedCarts();

    // Conecta Server-Sent Events (SSE)
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/whatsapp/events');

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
    } catch (e) {}

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  // Timer regressivo para o QR Code
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (statusData.status === 'QR_CODE' && qrCountdown > 0) {
      timer = setInterval(() => {
        setQrCountdown(prev => {
          if (prev <= 1) {
            handleConnect(true);
            return 60;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [statusData.status, qrCountdown]);

  // Polling resiliente de fallback a cada 2.5s caso o SSE seja bloqueado
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

  // Carrega dados de acordo com a aba ativa
  useEffect(() => {
    if (activeTab === 'users' && usersList.length === 0) {
      fetchUsersList();
    } else if (activeTab === 'abandoned_carts') {
      fetchAbandonedCarts();
    } else if (activeTab === 'templates') {
      fetchTemplates();
    } else if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab]);

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
      if (res.ok) {
        const json = await res.json();
        setLogs(json.messages || []);
      }
    } catch (e) {
      console.error('Erro ao buscar logs:', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchUsersList = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/whatsapp/users', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        setUsersList(json.users || []);
      }
    } catch (e) {
      console.error('Erro ao carregar usuários:', e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchAbandonedCarts = async () => {
    setLoadingCarts(true);
    try {
      const res = await fetch('/api/whatsapp/abandoned-carts', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        setAbandonedCarts(json.carts || []);
        setCartStats({
          totalValue: json.total_abandoned_value || 0,
          totalCount: json.total_carts_count || 0,
          withPhoneCount: json.carts_with_phone_count || 0
        });
      }
    } catch (e) {
      console.error('Erro ao carregar carrinhos abandonados:', e);
    } finally {
      setLoadingCarts(false);
    }
  };

  // Conexão manual / Forçar novo QR Code
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
      const data = await res.json();
      if (res.ok) {
        setStatusData(prev => ({
          ...prev,
          status: data.status as any,
          qrCode: data.qrCode || prev.qrCode
        }));
        if (data.status === 'QR_CODE') {
          setQrCountdown(60);
        }
      } else {
        setAlert({ type: 'error', text: data.error || 'Erro ao iniciar conexão do WhatsApp' });
      }
    } catch (e: any) {
      setAlert({ type: 'error', text: e.message || 'Falha de comunicação ao conectar WhatsApp' });
    } finally {
      setConnecting(false);
    }
  };

  // Desconexão
  const handleDisconnect = async () => {
    if (!confirm('Deseja realmente desconectar a sessão do WhatsApp?')) return;
    setDisconnecting(true);
    setAlert(null);
    try {
      const res = await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setStatusData({ status: 'DISCONNECTED', phone: null, qrCode: null });
        setAlert({ type: 'success', text: 'WhatsApp desconectado com sucesso.' });
      }
    } catch (e: any) {
      setAlert({ type: 'error', text: e.message || 'Erro ao desconectar WhatsApp' });
    } finally {
      setDisconnecting(false);
    }
  };

  // Envio de teste individual
  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim() || !testMessage.trim()) {
      setAlert({ type: 'error', text: 'Preencha o telefone e a mensagem de teste.' });
      return;
    }
    setSendingTest(true);
    setAlert(null);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          phone: testPhone,
          message: testMessage,
          trigger_type: 'manual_test',
          recipient_name: 'Teste Manual'
        })
      });
      const json = await res.json();
      if (res.ok) {
        setAlert({ type: 'success', text: 'Mensagem enviada com sucesso no WhatsApp!' });
        fetchLogs();
      } else {
        setAlert({ type: 'error', text: json.error || 'Erro ao enviar mensagem de teste.' });
      }
    } catch (e: any) {
      setAlert({ type: 'error', text: e.message || 'Falha na requisição de envio.' });
    } finally {
      setSendingTest(false);
    }
  };

  // Salvar template
  const handleSaveTemplate = async (template: TemplateItem) => {
    setSavingTemplate(template.trigger_type);
    try {
      const res = await fetch('/api/whatsapp/templates', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(template)
      });
      if (res.ok) {
        setAlert({ type: 'success', text: `Template "${template.title}" atualizado com sucesso!` });
      } else {
        const json = await res.json();
        setAlert({ type: 'error', text: json.error || 'Erro ao salvar template.' });
      }
    } catch (e: any) {
      setAlert({ type: 'error', text: e.message || 'Erro de conexão ao salvar template.' });
    } finally {
      setSavingTemplate(null);
    }
  };

  // ── FILTROS E SELEÇÃO DE USUÁRIOS ──
  const filteredUsers = useMemo(() => {
    return usersList.filter(user => {
      const matchesSearch =
        user.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        user.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        (user.phone && user.phone.includes(userSearch));

      if (!matchesSearch) return false;

      if (userFilter === 'has_phone') return user.has_phone;
      if (userFilter === 'buyers') return user.total_orders > 0;
      return true;
    });
  }, [usersList, userSearch, userFilter]);

  const toggleSelectUser = (id: number) => {
    setSelectedUserIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFilteredUsers = () => {
    const selectable = filteredUsers.filter(u => u.has_phone).map(u => u.id);
    const allSelected = selectable.every(id => selectedUserIds.includes(id));
    if (allSelected) {
      setSelectedUserIds(prev => prev.filter(id => !selectable.includes(id)));
    } else {
      setSelectedUserIds(prev => Array.from(new Set([...prev, ...selectable])));
    }
  };

  // Disparo em massa para usuários selecionados
  const handleSendBulkUsers = async () => {
    if (selectedUserIds.length === 0) return;
    const recipients = usersList
      .filter(u => selectedUserIds.includes(u.id) && u.has_phone && u.phone)
      .map(u => ({
        phone: u.phone!,
        name: u.name,
        vars: {
          cliente: u.name,
          email: u.email,
          link: 'https://ecosopis.com.br',
          cupom: 'ESPECIAL10'
        }
      }));

    if (recipients.length === 0) {
      setAlert({ type: 'error', text: 'Nenhum dos usuários selecionados possui telefone válido para WhatsApp.' });
      return;
    }

    setSendingBulkUsers(true);
    setBulkUsersProgress({ sent: 0, failed: 0, total: recipients.length });

    try {
      const res = await fetch('/api/whatsapp/bulk-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          recipients,
          messageTemplate: userMessageText,
          triggerType: 'manual_user_campaign',
          delayMs: 1200
        })
      });

      const data = await res.json();
      if (res.ok) {
        setAlert({
          type: 'success',
          text: `Disparo concluído: ${data.sent_count} enviadas com sucesso e ${data.failed_count} falhas.`
        });
        setUserModalOpen(false);
        setSelectedUserIds([]);
        fetchLogs();
      } else {
        setAlert({ type: 'error', text: data.error || 'Erro ao processar disparo.' });
      }
    } catch (e: any) {
      setAlert({ type: 'error', text: e.message || 'Erro de comunicação no envio em massa.' });
    } finally {
      setSendingBulkUsers(false);
      setBulkUsersProgress(null);
    }
  };

  // ── FILTROS E SELEÇÃO DE CARRINHOS ABANDONADOS ──
  const filteredCarts = useMemo(() => {
    return abandonedCarts.filter(cart => {
      const matchesSearch =
        cart.name.toLowerCase().includes(cartSearch.toLowerCase()) ||
        cart.email.toLowerCase().includes(cartSearch.toLowerCase()) ||
        (cart.phone && cart.phone.includes(cartSearch)) ||
        cart.items.some(item => item.name.toLowerCase().includes(cartSearch.toLowerCase()));

      return matchesSearch;
    });
  }, [abandonedCarts, cartSearch]);

  const toggleSelectCart = (userId: number) => {
    setSelectedCartUserIds(prev =>
      prev.includes(userId) ? prev.filter(x => x !== userId) : [...prev, userId]
    );
  };

  const toggleSelectAllFilteredCarts = () => {
    const selectable = filteredCarts.filter(c => c.has_phone).map(c => c.user_id);
    const allSelected = selectable.every(id => selectedCartUserIds.includes(id));
    if (allSelected) {
      setSelectedCartUserIds(prev => prev.filter(id => !selectable.includes(id)));
    } else {
      setSelectedCartUserIds(prev => Array.from(new Set([...prev, ...selectable])));
    }
  };

  // Abre modal para enviar mensagem de recuperação (individual ou em massa)
  const openCartModal = (targetCart?: AbandonedCartItem) => {
    if (targetCart) {
      setSingleCartTarget(targetCart);
      const itemsFormatted = targetCart.items.map(i => `${i.quantity}x ${i.name}`).join(', ');
      setCartMessageText(
        `Olá ${targetCart.name}! Notamos que você deixou itens no seu carrinho na Ecosopis: ${itemsFormatted}. Para te ajudar a finalizar com frete reduzido, use o cupom VOLTA10 para 10% OFF: https://ecosopis.com.br/carrinho`
      );
    } else {
      setSingleCartTarget(null);
      setCartMessageText(
        'Olá {cliente}! Notamos que você deixou itens especiais no seu carrinho na Ecosopis: {itens}. Para te ajudar a finalizar seu pedido, use o cupom VOLTA10 e garanta 10% de desconto: https://ecosopis.com.br/carrinho'
      );
    }
    setCartModalOpen(true);
  };

  // Envio de recuperação de carrinho
  const handleSendCartRecovery = async () => {
    let targets: AbandonedCartItem[] = [];

    if (singleCartTarget) {
      targets = [singleCartTarget];
    } else {
      targets = abandonedCarts.filter(c => selectedCartUserIds.includes(c.user_id) && c.has_phone && c.phone);
    }

    if (targets.length === 0) {
      setAlert({ type: 'error', text: 'Nenhum carrinho com telefone WhatsApp selecionado.' });
      return;
    }

    const recipients = targets.map(c => ({
      phone: c.phone!,
      name: c.name,
      vars: {
        cliente: c.name,
        itens: c.items.map(i => `${i.quantity}x ${i.name}`).join(', '),
        total: `R$ ${c.total_value.toFixed(2).replace('.', ',')}`,
        link: 'https://ecosopis.com.br/carrinho',
        cupom: 'VOLTA10'
      }
    }));

    setSendingBulkCarts(true);
    setBulkCartsProgress({ sent: 0, failed: 0, total: recipients.length });

    try {
      const res = await fetch('/api/whatsapp/bulk-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          recipients,
          messageTemplate: cartMessageText,
          triggerType: 'abandoned_cart_manual',
          delayMs: 1200
        })
      });

      const data = await res.json();
      if (res.ok) {
        setAlert({
          type: 'success',
          text: `Recuperação enviada: ${data.sent_count} mensagens entregues com sucesso!`
        });
        setCartModalOpen(false);
        setSelectedCartUserIds([]);
        setSingleCartTarget(null);
        fetchLogs();
      } else {
        setAlert({ type: 'error', text: data.error || 'Erro ao disparar mensagens de recuperação.' });
      }
    } catch (e: any) {
      setAlert({ type: 'error', text: e.message || 'Erro de comunicação no envio.' });
    } finally {
      setSendingBulkCarts(false);
      setBulkCartsProgress(null);
    }
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
              WhatsApp & Disparos da Loja
            </h1>
            <p>
              Painel profissional Baileys Multi-Device com disparo segmentado por usuários e recuperação de carrinhos abandonados.
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
                Aguardando Leitura do QR Code ({qrCountdown}s)
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
            onClick={() => setActiveTab('users')}
            className={`${styles.tabButton} ${activeTab === 'users' ? styles.tabButtonActive : ''}`}
          >
            <Users size={18} />
            Envio para Usuários
            {usersList.length > 0 && <span className={styles.tabBadge}>{usersList.length}</span>}
          </button>
          <button
            onClick={() => setActiveTab('abandoned_carts')}
            className={`${styles.tabButton} ${activeTab === 'abandoned_carts' ? styles.tabButtonActive : ''}`}
          >
            <ShoppingCart size={18} />
            Carrinhos Abandonados
            {abandonedCarts.length > 0 && <span className={styles.tabBadge}>{abandonedCarts.length}</span>}
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`${styles.tabButton} ${activeTab === 'templates' ? styles.tabButtonActive : ''}`}
          >
            <Zap size={18} />
            Automações ({templates.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`${styles.tabButton} ${activeTab === 'logs' ? styles.tabButtonActive : ''}`}
          >
            <History size={18} />
            Histórico ({logs.length})
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
                        <div style={{ fontSize: 18, color: '#14532d', fontWeight: 800 }}>+{statusData.phone}</div>
                      </div>
                    </div>
                    {statusData.lastConnection && (
                      <div style={{ fontSize: 12, color: '#15803d', marginTop: 8 }}>
                        Conectado desde: {new Date(statusData.lastConnection).toLocaleString('pt-BR')}
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 20 }}>
                    <button
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      className={`${styles.btn} ${styles.btnDanger}`}
                    >
                      <PowerOff size={16} />
                      {disconnecting ? 'Desconectando...' : 'Desconectar WhatsApp'}
                    </button>
                  </div>
                </div>
              ) : statusData.status === 'QR_CODE' && statusData.qrCode ? (
                <div className={styles.qrCodeWrapper}>
                  <div className={styles.qrCodeContainer}>
                    <img src={statusData.qrCode} alt="WhatsApp QR Code" className={styles.qrImage} />
                  </div>
                  <div className={styles.qrCountdown}>
                    <Clock size={16} />
                    <span>Atualiza em {qrCountdown}s</span>
                  </div>
                  <p className={styles.qrInstructions}>
                    1. Abra o WhatsApp no seu celular.<br />
                    2. Toque em <strong>Aparelhos conectados</strong> e depois em <strong>Conectar um aparelho</strong>.<br />
                    3. Aponte a câmera para a tela para escanear este código.
                  </p>
                  <button
                    onClick={() => handleConnect(true)}
                    disabled={connecting}
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    style={{ marginTop: 12 }}
                  >
                    <RefreshCw size={16} className={connecting ? styles.spinner : ''} />
                    Recarregar QR Code Agora
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                  <div style={{ marginBottom: 16 }}>
                    <MessageSquare size={48} color="#94a3b8" style={{ margin: '0 auto' }} />
                  </div>
                  <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
                    Nenhuma sessão ativa no momento. Clique no botão abaixo para gerar o QR Code de pareamento.
                  </p>
                  <button
                    onClick={() => handleConnect(false)}
                    disabled={connecting}
                    className={`${styles.btn} ${styles.btnPrimary}`}
                  >
                    <RefreshCw size={16} className={connecting ? styles.spinner : ''} />
                    {connecting ? 'Iniciando Baileys...' : 'Gerar QR Code de Conexão'}
                  </button>
                </div>
              )}
            </div>

            {/* Card Teste Rápido */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <Send size={20} color="#128c7e" />
                Envio de Teste Imediato
              </h2>
              <p className={styles.cardSubtitle}>
                Envie uma mensagem instantânea para conferir se o seu número conectado está respondendo e entregando.
              </p>

              <form onSubmit={handleSendTest}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Número do Destinatário (com DDD):</label>
                  <input
                    type="text"
                    placeholder="Ex: 11999998888 ou 5511999998888"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className={styles.input}
                    required
                  />
                  <small style={{ color: '#64748b', fontSize: 11, marginTop: 4, display: 'block' }}>
                    O sistema adiciona o DDI +55 do Brasil automaticamente caso não seja informado.
                  </small>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Mensagem:</label>
                  <textarea
                    rows={4}
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className={styles.textarea}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={sendingTest || statusData.status !== 'CONNECTED'}
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <Send size={16} />
                  {sendingTest ? 'Enviando Mensagem...' : 'Enviar Teste no WhatsApp'}
                </button>

                {statusData.status !== 'CONNECTED' && (
                  <p style={{ color: '#dc2626', fontSize: 12, marginTop: 10, textAlign: 'center' }}>
                    ⚠️ Conecte o WhatsApp pelo QR Code acima antes de realizar envios.
                  </p>
                )}
              </form>
            </div>
          </div>
        )}

        {/* ─── ABA 2: ENVIO PARA USUÁRIOS (SELEÇÃO E DISPARO) ─── */}
        {activeTab === 'users' && (
          <div>
            {/* Barra de Filtro e Busca */}
            <div className={styles.filterBar}>
              <div className={styles.searchBox}>
                <Search size={16} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Pesquisar por nome, email ou telefone..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              <div className={styles.filterPills}>
                <button
                  onClick={() => setUserFilter('all')}
                  className={`${styles.pillButton} ${userFilter === 'all' ? styles.pillButtonActive : ''}`}
                >
                  Todos ({usersList.length})
                </button>
                <button
                  onClick={() => setUserFilter('has_phone')}
                  className={`${styles.pillButton} ${userFilter === 'has_phone' ? styles.pillButtonActive : ''}`}
                >
                  Com WhatsApp ({usersList.filter(u => u.has_phone).length})
                </button>
                <button
                  onClick={() => setUserFilter('buyers')}
                  className={`${styles.pillButton} ${userFilter === 'buyers' ? styles.pillButtonActive : ''}`}
                >
                  Com Compras ({usersList.filter(u => u.total_orders > 0).length})
                </button>
                <button
                  onClick={fetchUsersList}
                  disabled={loadingUsers}
                  className={styles.pillButton}
                  title="Atualizar lista de clientes"
                >
                  <RefreshCw size={14} className={loadingUsers ? styles.spinner : ''} />
                </button>
              </div>
            </div>

            {/* Barra Flutuante de Seleção em Massa */}
            {selectedUserIds.length > 0 && (
              <div className={styles.bulkActionBar}>
                <div className={styles.bulkActionInfo}>
                  <CheckSquare size={20} color="#25d366" />
                  <span>{selectedUserIds.length} cliente(s) selecionado(s)</span>
                </div>
                <div className={styles.bulkActionButtons}>
                  <button
                    onClick={() => setUserModalOpen(true)}
                    disabled={statusData.status !== 'CONNECTED'}
                    className={styles.btnPrimaryGreen}
                  >
                    <MessageSquare size={16} />
                    Escrever Mensagem WhatsApp
                  </button>
                  <button
                    onClick={() => setSelectedUserIds([])}
                    className={styles.btnSecondaryDark}
                  >
                    Desmarcar
                  </button>
                </div>
              </div>
            )}

            {/* Tabela de Usuários */}
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: 44, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={
                          filteredUsers.length > 0 &&
                          filteredUsers.filter(u => u.has_phone).every(u => selectedUserIds.includes(u.id))
                        }
                        onChange={toggleSelectAllFilteredUsers}
                        title="Selecionar todos com WhatsApp"
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th>Cliente</th>
                    <th>WhatsApp / Telefone</th>
                    <th>E-mail</th>
                    <th>Compras</th>
                    <th style={{ textAlign: 'right' }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px' }}>
                        <RefreshCw size={24} className={styles.spinner} style={{ margin: '0 auto 8px auto' }} />
                        <div style={{ color: '#64748b' }}>Carregando clientes...</div>
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                        Nenhum usuário encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(user => {
                      const isSelected = selectedUserIds.includes(user.id);
                      return (
                        <tr key={user.id} style={{ background: isSelected ? '#f0fdf4' : 'transparent' }}>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!user.has_phone}
                              onChange={() => toggleSelectUser(user.id)}
                              style={{ cursor: user.has_phone ? 'pointer' : 'not-allowed' }}
                            />
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{user.name}</div>
                            {user.role === 'admin' && (
                              <span style={{ fontSize: 10, background: '#e0e7ff', color: '#3730a3', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                                ADMIN
                              </span>
                            )}
                          </td>
                          <td>
                            {user.has_phone ? (
                              <span className={`${styles.phoneBadge} ${styles.hasPhoneBadge}`}>
                                <Phone size={12} color="#166534" />
                                {user.phone}
                              </span>
                            ) : (
                              <span className={`${styles.phoneBadge} ${styles.noPhoneBadge}`}>
                                Sem Telefone
                              </span>
                            )}
                          </td>
                          <td style={{ color: '#475569' }}>{user.email}</td>
                          <td>
                            <span style={{ fontWeight: 600, color: user.total_orders > 0 ? '#16a34a' : '#64748b' }}>
                              {user.total_orders} pedido(s)
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => {
                                setSelectedUserIds([user.id]);
                                setUserModalOpen(true);
                              }}
                              disabled={!user.has_phone || statusData.status !== 'CONNECTED'}
                              className={styles.btnSecondary}
                              style={{ padding: '6px 12px', fontSize: 12 }}
                            >
                              <Send size={12} />
                              Enviar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── ABA 3: CARRINHOS ABANDONADOS ─── */}
        {activeTab === 'abandoned_carts' && (
          <div>
            {/* Cards de Métricas */}
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statIconWrapper} style={{ background: '#fef3c7', color: '#d97706' }}>
                  <ShoppingCart size={24} />
                </div>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>Carrinhos Abandonados</span>
                  <span className={styles.statValue}>{cartStats.totalCount}</span>
                </div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statIconWrapper} style={{ background: '#dcfce7', color: '#16a34a' }}>
                  <ShoppingBag size={24} />
                </div>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>Valor Total em Carrinhos</span>
                  <span className={styles.statValue}>R$ {cartStats.totalValue.toFixed(2).replace('.', ',')}</span>
                </div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statIconWrapper} style={{ background: '#e0f2fe', color: '#0284c7' }}>
                  <Phone size={24} />
                </div>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>Com WhatsApp para Contato</span>
                  <span className={styles.statValue}>{cartStats.withPhoneCount}</span>
                </div>
              </div>
            </div>

            {/* Barra de Busca e Seleção */}
            <div className={styles.filterBar}>
              <div className={styles.searchBox}>
                <Search size={16} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Pesquisar por cliente, email ou nome do produto..."
                  value={cartSearch}
                  onChange={(e) => setCartSearch(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              <div className={styles.filterPills}>
                <button
                  onClick={toggleSelectAllFilteredCarts}
                  className={styles.pillButton}
                >
                  <CheckSquare size={14} />
                  Selecionar Todos com WhatsApp ({filteredCarts.filter(c => c.has_phone).length})
                </button>
                <button
                  onClick={fetchAbandonedCarts}
                  disabled={loadingCarts}
                  className={styles.pillButton}
                >
                  <RefreshCw size={14} className={loadingCarts ? styles.spinner : ''} />
                  Atualizar
                </button>
              </div>
            </div>

            {/* Barra Flutuante de Disparo em Massa para Carrinhos */}
            {selectedCartUserIds.length > 0 && (
              <div className={styles.bulkActionBar}>
                <div className={styles.bulkActionInfo}>
                  <ShoppingCart size={20} color="#25d366" />
                  <span>{selectedCartUserIds.length} carrinho(s) selecionado(s)</span>
                </div>
                <div className={styles.bulkActionButtons}>
                  <button
                    onClick={() => openCartModal()}
                    disabled={statusData.status !== 'CONNECTED'}
                    className={styles.btnPrimaryGreen}
                  >
                    <MessageSquare size={16} />
                    Disparar Recuperação via WhatsApp
                  </button>
                  <button
                    onClick={() => setSelectedCartUserIds([])}
                    className={styles.btnSecondaryDark}
                  >
                    Desmarcar
                  </button>
                </div>
              </div>
            )}

            {/* Grid de Carrinhos Abandonados com Produtos Detalhados */}
            {loadingCarts ? (
              <div style={{ textAlign: 'center', padding: '40px', background: 'white', borderRadius: 16 }}>
                <RefreshCw size={32} className={styles.spinner} style={{ margin: '0 auto 12px auto', color: '#128c7e' }} />
                <div style={{ color: '#475569', fontWeight: 600 }}>Carregando carrinhos abandonados...</div>
              </div>
            ) : filteredCarts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', background: 'white', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                <CheckCircle size={48} color="#16a34a" style={{ margin: '0 auto 12px auto' }} />
                <h3 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>Nenhum carrinho abandonado no momento!</h3>
                <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
                  Todos os carrinhos iniciados foram finalizados ou ainda estão vazios.
                </p>
              </div>
            ) : (
              <div className={styles.abandonedCartsGrid}>
                {filteredCarts.map(cart => {
                  const isSelected = selectedCartUserIds.includes(cart.user_id);
                  return (
                    <div
                      key={cart.user_id}
                      className={styles.cartCard}
                      style={{ border: isSelected ? '2px solid #22c55e' : '1px solid #e2e8f0' }}
                    >
                      {/* Header do Card */}
                      <div className={styles.cartCardHeader}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!cart.has_phone}
                            onChange={() => toggleSelectCart(cart.user_id)}
                            style={{ marginTop: 3, cursor: cart.has_phone ? 'pointer' : 'not-allowed' }}
                          />
                          <div className={styles.cartUserInfo}>
                            <h4>{cart.name}</h4>
                            <div className={styles.cartUserMeta}>
                              <span>{cart.email}</span>
                              {cart.has_phone ? (
                                <span style={{ color: '#166534', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <Phone size={11} /> {cart.phone}
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>Sem WhatsApp</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <span className={styles.cartTimeBadge}>
                          <Clock size={12} />
                          {cart.time_ago}
                        </span>
                      </div>

                      {/* Lista de Itens no Carrinho (O que tem no carrinho) */}
                      <div className={styles.cartItemsList}>
                        {cart.items.map((item, idx) => (
                          <div key={idx} className={styles.cartItemRow}>
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className={styles.cartItemThumb}
                              onError={(e) => { (e.target as any).src = '/images/placeholder.png'; }}
                            />
                            <div className={styles.cartItemDetails}>
                              <div className={styles.cartItemName} title={item.name}>
                                {item.name}
                              </div>
                              <div className={styles.cartItemMeta}>
                                <span>Qtd: <strong>{item.quantity}</strong></span>
                                <span className={styles.cartItemPrice}>
                                  R$ {item.subtotal.toFixed(2).replace('.', ',')}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Rodapé do Card com Total e Ação de WhatsApp */}
                      <div className={styles.cartFooter}>
                        <div className={styles.cartTotalAmount}>
                          <span className={styles.cartTotalLabel}>Total ({cart.items_count} itens)</span>
                          <span className={styles.cartTotalValue}>
                            R$ {cart.total_value.toFixed(2).replace('.', ',')}
                          </span>
                        </div>

                        <button
                          onClick={() => openCartModal(cart)}
                          disabled={!cart.has_phone || statusData.status !== 'CONNECTED'}
                          className={styles.btnPrimaryGreen}
                          style={{ fontSize: 12, padding: '7px 14px' }}
                        >
                          <Send size={13} />
                          Recuperar WhatsApp
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── ABA 4: AUTOMAÇÕES POR AÇÃO ─── */}
        {activeTab === 'templates' && (
          <div className={styles.templatesContainer}>
            <div style={{ marginBottom: 20 }}>
              <p style={{ color: '#475569', fontSize: 14, margin: 0 }}>
                Personalize os textos automáticos disparados para os clientes através do WhatsApp conectado.
              </p>
            </div>

            {templates.map(tmpl => {
              const tags = AVAILABLE_TAGS[tmpl.trigger_type] || [];
              const isSaving = savingTemplate === tmpl.trigger_type;

              return (
                <div key={tmpl.id} className={styles.templateCard}>
                  <div className={styles.templateHeader}>
                    <div className={styles.templateTitleArea}>
                      {TRIGGER_ICONS[tmpl.trigger_type] || <MessageSquare size={18} color="#25d366" />}
                      <h3>{tmpl.title}</h3>
                    </div>
                    <label className={styles.switchWrapper}>
                      <input
                        type="checkbox"
                        checked={tmpl.is_enabled}
                        onChange={(e) => {
                          const updated = { ...tmpl, is_enabled: e.target.checked };
                          setTemplates(prev => prev.map(t => t.id === tmpl.id ? updated : t));
                        }}
                      />
                      <span className={styles.switchSlider}></span>
                    </label>
                  </div>

                  <div className={styles.templateBody}>
                    <label className={styles.label}>Mensagem:</label>
                    <textarea
                      rows={5}
                      value={tmpl.message_template}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTemplates(prev => prev.map(t => t.id === tmpl.id ? { ...t, message_template: val } : t));
                      }}
                      className={styles.textarea}
                    />

                    {tags.length > 0 && (
                      <div className={styles.tagChips}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>Tags disponíveis:</span>
                        {tags.map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              const newText = tmpl.message_template + ' ' + tag;
                              setTemplates(prev => prev.map(t => t.id === tmpl.id ? { ...t, message_template: newText } : t));
                            }}
                            className={styles.tagChip}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={styles.templateFooter}>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveTemplate(tmpl)}
                      className={`${styles.btn} ${styles.btnPrimary}`}
                    >
                      <CheckCircle size={16} />
                      {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── ABA 5: HISTÓRICO DE MENSAGENS ─── */}
        {activeTab === 'logs' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ color: '#475569', fontSize: 14, margin: 0 }}>
                Últimas mensagens processadas pelo serviço de WhatsApp da Ecosopis.
              </p>
              <button
                onClick={fetchLogs}
                disabled={loadingLogs}
                className={`${styles.btn} ${styles.btnSecondary}`}
              >
                <RefreshCw size={14} className={loadingLogs ? styles.spinner : ''} />
                Atualizar Lista
              </button>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Data/Hora</th>
                    <th>Destinatário</th>
                    <th>Telefone</th>
                    <th>Gatilho</th>
                    <th>Mensagem</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingLogs ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px' }}>
                        Carregando mensagens...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                        Nenhuma mensagem disparada até o momento.
                      </td>
                    </tr>
                  ) : (
                    logs.map(log => (
                      <tr key={log.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: '#64748b' }}>
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </td>
                        <td style={{ fontWeight: 600 }}>{log.recipient_name || 'Cliente'}</td>
                        <td style={{ fontFamily: 'monospace' }}>{log.to_phone}</td>
                        <td>
                          <span style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>
                            {log.trigger_type}
                          </span>
                        </td>
                        <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.message}>
                          {log.message}
                        </td>
                        <td>
                          {log.status === 'SENT' ? (
                            <span className={styles.badgeSent}>Enviado</span>
                          ) : (
                            <span className={styles.badgeFailed} title={log.error}>Falha</span>
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

        {/* ─── MODAL DE DISPARO PARA USUÁRIOS SELECIONADOS ─── */}
        {userModalOpen && (
          <div className={styles.modalBackdrop}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3>
                  <MessageSquare size={20} color="#25d366" />
                  Enviar WhatsApp para Clientes Selecionados
                </h3>
                <button onClick={() => setUserModalOpen(false)} className={styles.modalCloseBtn}>
                  <X size={18} />
                </button>
              </div>

              <div className={styles.modalBody}>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 12, borderRadius: 10, fontSize: 13, color: '#166534' }}>
                  <strong>{selectedUserIds.length} cliente(s)</strong> selecionado(s) para receber este disparo.
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Mensagem:</label>
                  <textarea
                    rows={5}
                    value={userMessageText}
                    onChange={(e) => setUserMessageText(e.target.value)}
                    className={styles.textarea}
                  />

                  <div className={styles.tagChips} style={{ marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Inserir variável:</span>
                    {['{cliente}', '{cupom}', '{link}'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setUserMessageText(prev => prev + ' ' + tag)}
                        className={styles.tagChip}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {bulkUsersProgress && (
                  <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span>Progresso do Envio:</span>
                      <strong>{bulkUsersProgress.sent + bulkUsersProgress.failed} de {bulkUsersProgress.total}</strong>
                    </div>
                    <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          background: '#25d366',
                          width: `${((bulkUsersProgress.sent + bulkUsersProgress.failed) / bulkUsersProgress.total) * 100}%`,
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  disabled={sendingBulkUsers}
                  className={styles.btnSecondary}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSendBulkUsers}
                  disabled={sendingBulkUsers || !userMessageText.trim()}
                  className={styles.btnPrimaryGreen}
                >
                  <Send size={15} />
                  {sendingBulkUsers ? 'Enviando Mensagens...' : `Disparar para ${selectedUserIds.length} Clientes`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL DE RECUPERAÇÃO DE CARRINHO ABANDONADO ─── */}
        {cartModalOpen && (
          <div className={styles.modalBackdrop}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3>
                  <ShoppingCart size={20} color="#25d366" />
                  {singleCartTarget ? `Recuperar Carrinho de ${singleCartTarget.name}` : `Disparo para ${selectedCartUserIds.length} Carrinhos`}
                </h3>
                <button onClick={() => setCartModalOpen(false)} className={styles.modalCloseBtn}>
                  <X size={18} />
                </button>
              </div>

              <div className={styles.modalBody}>
                {singleCartTarget && (
                  <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 6 }}>
                      Itens no carrinho do cliente:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {singleCartTarget.items.map((it, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569' }}>
                          <span>{it.quantity}x {it.name}</span>
                          <strong style={{ color: '#0f172a' }}>R$ {it.subtotal.toFixed(2).replace('.', ',')}</strong>
                        </div>
                      ))}
                    </div>
                    <div style={{ borderTop: '1px dashed #cbd5e1', marginTop: 8, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#166534', fontSize: 13 }}>
                      <span>Total:</span>
                      <span>R$ {singleCartTarget.total_value.toFixed(2).replace('.', ',')}</span>
                    </div>
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label className={styles.label}>Mensagem que o cliente receberá no WhatsApp:</label>
                  <textarea
                    rows={6}
                    value={cartMessageText}
                    onChange={(e) => setCartMessageText(e.target.value)}
                    className={styles.textarea}
                  />

                  <div className={styles.tagChips} style={{ marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Tags automáticas:</span>
                    {['{cliente}', '{itens}', '{total}', '{link}', '{cupom}'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setCartMessageText(prev => prev + ' ' + tag)}
                        className={styles.tagChip}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {bulkCartsProgress && (
                  <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span>Enviando mensagens de recuperação:</span>
                      <strong>{bulkCartsProgress.sent + bulkCartsProgress.failed} de {bulkCartsProgress.total}</strong>
                    </div>
                    <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          background: '#25d366',
                          width: `${((bulkCartsProgress.sent + bulkCartsProgress.failed) / bulkCartsProgress.total) * 100}%`,
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setCartModalOpen(false)}
                  disabled={sendingBulkCarts}
                  className={styles.btnSecondary}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSendCartRecovery}
                  disabled={sendingBulkCarts || !cartMessageText.trim()}
                  className={styles.btnPrimaryGreen}
                >
                  <Send size={15} />
                  {sendingBulkCarts ? 'Enviando...' : singleCartTarget ? 'Enviar WhatsApp para este Cliente' : `Disparar para ${selectedCartUserIds.length} Carrinhos`}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
