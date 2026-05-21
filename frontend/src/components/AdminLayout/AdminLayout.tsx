'use client';

import styles from './AdminLayout.module.css';

interface AdminLayoutProps {
    children: React.ReactNode;
}

/**
 * AdminLayout wraps the main content area for admin pages.
 * On desktop: flex row (sidebar + main, full height)
 * On mobile: column layout with top padding to account for the fixed mobile top bar
 */
export default function AdminLayout({ children }: AdminLayoutProps) {
    return (
        <div className={styles.adminPageWrapper}>
            {children}
        </div>
    );
}
