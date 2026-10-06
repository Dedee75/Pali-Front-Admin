'use client';

import { Fragment, useState } from 'react';
import styles from './ListPagination.module.css';

export function useListPagination<T>(items: T[], resetKey = '') {
    const [pageSize, setSize] = useState(10);
    const [position, setPosition] = useState({ page: 1, key: resetKey });
    if (position.key !== resetKey) {
        setPosition({ page: 1, key: resetKey });
    }
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const currentPage = Math.min(position.key === resetKey ? position.page : 1, totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const setCurrentPage = (page: number | ((current: number) => number)) => {
        setPosition({ key: resetKey, page: Math.max(1, Math.min(typeof page === 'function' ? page(currentPage) : page, totalPages)) });
    };
    const setPageSize = (size: number) => {
        setSize(size);
        setPosition({ key: resetKey, page: 1 });
    };
    return { rows: items.slice(startIndex, startIndex + pageSize), pageSize, setPageSize, currentPage, setCurrentPage, totalPages, startIndex };
}

export function EntriesControl({ pageSize, onChange }: { pageSize: number; onChange: (size: number) => void }) {
    return <div className={styles.toolbar}>
        <label className={styles.entries}>Show
            <select aria-label='Entries per page' value={pageSize} onChange={event => onChange(Number(event.target.value))}>
                {[10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
            </select>entries
        </label>
    </div>;
}

export function ListPagination({ total, pageSize, currentPage, onChange }: { total: number; pageSize: number; currentPage: number; onChange: (page: number) => void }) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.max(1, Math.min(currentPage, totalPages));
    const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const last = Math.min(page * pageSize, total);
    const pages = [...new Set([1, page - 1, page, page + 1, totalPages])].filter(value => value >= 1 && value <= totalPages).sort((a, b) => a - b);
    return <div className={styles.footer}>
        <span className={styles.summary}>Showing {first}-{last} of {total} entries</span>
        <nav className={styles.controls} aria-label='List pagination'>
            <button type='button' disabled={page === 1} aria-label='Previous page' onClick={() => onChange(page - 1)}>‹</button>
            {pages.map((value, index) => <Fragment key={value}>
                {index > 0 && value - pages[index - 1] > 1 && <span>…</span>}
                <button type='button' aria-label={`Page ${value}`} aria-current={value === page ? 'page' : undefined} onClick={() => onChange(value)}>{value}</button>
            </Fragment>)}
            <button type='button' disabled={page === totalPages} aria-label='Next page' onClick={() => onChange(page + 1)}>›</button>
        </nav>
    </div>;
}
