import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './AdminSidebar.module.css';
import {
    LayoutDashboard,
    ShoppingBag,
    Users,
    Image as ImageIcon,
    Megaphone,
    MessageSquare,
    Package,
    ShieldCheck,
    Ticket,
    BarChart3,
    TrendingUp,
    Gamepad2,
    Settings,
    LogOut,
    ExternalLink,
    ChevronDown,
    ChevronRight,
    History,
    CreditCard
} from 'lucide-react';

interface AdminSidebarProps {
    activePath: string;
}

interface NavItem {
    label: string;
    path: string;
    icon: React.ReactNode;
}

interface Category {
    label: string;
    items: NavItem[];
}

const CATEGORIES: Category[] = [
    {
        label: "Catálogo",
        items: [
            { label: "Produtos", path: "/admin/dashboard", icon: <Package size={18} /> },
            { label: "Avaliações", path: "/admin/dashboard/reviews", icon: <MessageSquare size={18} /> },
            { label: "Novidades", path: "/admin/dashboard/novidades", icon: <ImageIcon size={18} /> },
        ]
    },
    {
        label: "Vendas",
        items: [
            { label: "Pedidos", path: "/admin/pedidos", icon: <ShoppingBag size={18} /> },
            { label: "Assinaturas", path: "/admin/subscriptions", icon: <ShieldCheck size={18} /> },
            { label: "Assinaturas Box", path: "/admin/dashboard/box", icon: <Package size={18} /> },
        ]
    },
    {
        label: "Marketing",
        items: [
            { label: "Roleta", path: "/admin/dashboard/roleta", icon: <Gamepad2 size={18} /> },
            { label: "Cupons", path: "/admin/dashboard/cupons", icon: <Ticket size={18} /> },
            { label: "Banner Principal", path: "/admin/dashboard/carousel", icon: <ImageIcon size={18} /> },
            { label: "Faixa de Aviso", path: "/admin/dashboard/announcement", icon: <Megaphone size={18} /> },
        ]
    },
    {
        label: "Gestão",
        items: [
            { label: "Usuários", path: "/admin/dashboard/usuarios", icon: <Users size={18} /> },
            { label: "Permissões Blog", path: "/admin/dashboard/blog-permissions", icon: <ShieldCheck size={18} /> },
            { label: "Métricas", path: "/admin/dashboard/metrics", icon: <BarChart3 size={18} /> },
            { label: "CRM de Vendas", path: "/admin/dashboard/crm", icon: <TrendingUp size={18} /> },
            { label: "Configurações", path: "/admin/settings", icon: <Settings size={18} /> },
        ]
    }
];

export default function AdminSidebar({ activePath }: AdminSidebarProps) {
    const router = useRouter();
    const [openCategories, setOpenCategories] = useState<string[]>(["Catálogo"]);
    const [recentPaths, setRecentPaths] = useState<NavItem[]>([]);

    useEffect(() => {
        // Load recent paths from localStorage
        // We only store the string paths to avoid React element serialization issues
        const storedRecents = JSON.parse(localStorage.getItem("admin_recents_paths") || "[]");

        // Reconstruct NavItems from stored paths
        const allItems = CATEGORIES.flatMap(c => c.items);
        const reconstructed = storedRecents.map((path: string) => allItems.find(i => i.path === path)).filter(Boolean) as NavItem[];
        setRecentPaths(reconstructed);

        // Update recents if current path is a nav item
        const currentItem = allItems.find(i => i.path === activePath);
        if (currentItem) {
            const filtered = storedRecents.filter((path: string) => path !== activePath);
            const newRecents = [activePath, ...filtered].slice(0, 3);
            localStorage.setItem("admin_recents_paths", JSON.stringify(newRecents));

            const newReconstructed = newRecents.map((path: string) => allItems.find(i => i.path === path)).filter(Boolean) as NavItem[];
            setRecentPaths(newReconstructed);

            // Auto open current category
            const cat = CATEGORIES.find(c => c.items.some(i => i.path === activePath));
            if (cat && !openCategories.includes(cat.label)) {
                setOpenCategories(prev => [...prev, cat.label]);
            }
        }
    }, [activePath]);

    const handleLogout = () => {
        localStorage.removeItem("token");
        router.push("/admin");
    };

    const toggleCategory = (label: string) => {
        setOpenCategories(prev =>
            prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
        );
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles.logo}>
                <div className={styles.logoCircle}>ES</div>
                <span>ECOSOPIS</span>
            </div>

            <nav className={styles.nav}>
                {recentPaths.length > 0 && (
                    <div className={styles.recentSection}>
                        <div className={styles.sectionHeader}>
                            <History size={14} /> RECEM ACESSADOS
                        </div>
                        {recentPaths.map((item) => (
                            <Link
                                key={item.path}
                                href={item.path}
                                className={`${styles.navItem} ${activePath === item.path ? styles.active : ''}`}
                            >
                                <span className={styles.iconWrapper}>{item.icon}</span>
                                {item.label}
                            </Link>
                        ))}
                        <div className={styles.divider} />
                    </div>
                )}

                {CATEGORIES.map(category => (
                    <div key={category.label} className={styles.categoryWrap}>
                        <button
                            onClick={() => toggleCategory(category.label)}
                            className={styles.categoryToggle}
                        >
                            {category.label}
                            {openCategories.includes(category.label) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>

                        <div className={`${styles.drawer} ${openCategories.includes(category.label) ? styles.open : ''}`}>
                            {category.items.map(item => (
                                <Link
                                    key={item.path}
                                    href={item.path}
                                    className={`${styles.navItem} ${activePath === item.path ? styles.active : ''}`}
                                >
                                    <span className={styles.iconWrapper}>{item.icon}</span>
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                ))}

                <div className={styles.footerNav}>
                    <Link href="/" className={styles.navItem}>
                        <span className={styles.iconWrapper}><ExternalLink size={18} /></span>
                        Ver Site
                    </Link>
                    <button onClick={handleLogout} className={styles.logoutBtn}>
                        <LogOut size={18} /> Sair
                    </button>
                </div>
            </nav>
        </aside>
    );
}
