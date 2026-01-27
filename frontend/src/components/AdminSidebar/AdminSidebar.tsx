import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './AdminSidebar.module.css';

interface AdminSidebarProps {
    activePath: string;
}

export default function AdminSidebar({ activePath }: AdminSidebarProps) {
    const router = useRouter();

    const handleLogout = () => {
        localStorage.removeItem("token");
        router.push("/admin");
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles.logo}>ECOSOPIS ADMIN</div>
            <nav>
                <Link href="/admin/dashboard" className={activePath === '/admin/dashboard' ? styles.active : ''}>Produtos</Link>
                <Link href="/admin/compras" className={activePath === '/admin/compras' ? styles.active : ''}>Compras</Link>
                <Link href="/admin/subscriptions" className={activePath === '/admin/subscriptions' ? styles.active : ''}>Assinaturas</Link>
                <Link href="/admin/dashboard/usuarios" className={activePath === '/admin/dashboard/usuarios' ? styles.active : ''}>Usuários</Link>
                <Link href="/admin/dashboard/carousel" className={activePath === '/admin/dashboard/carousel' ? styles.active : ''}>Carrossel Hero</Link>
                <Link href="/admin/dashboard/announcement" className={activePath === '/admin/dashboard/announcement' ? styles.active : ''}>Faixa de Aviso</Link>
                <Link href="/admin/dashboard/box" className={activePath === '/admin/dashboard/box' ? styles.active : ''}>Assinaturas Box</Link>
                <Link href="/admin/dashboard/reviews" className={activePath === '/admin/dashboard/reviews' ? styles.active : ''}>Avaliações</Link>
                <Link href="/admin/dashboard/cupons" className={activePath === '/admin/dashboard/cupons' ? styles.active : ''}>Cupons</Link>
                <Link href="/admin/settings" className={activePath === '/admin/settings' ? styles.active : ''}>Configurações</Link>
                <Link href="/">Ver Site</Link>
                <button onClick={handleLogout} className={styles.logoutBtn}>Sair</button>
            </nav>
        </aside>
    );
}
