/** @format */

'use client';

import { usePathname, useRouter } from 'next/navigation';
import styles from './Sidebar.module.css';

export default function Sidebar() {
	const router = useRouter();
	const pathname = usePathname();

	const isTeacher = pathname.startsWith('/teacher');

	const isActive = (path: string) => {
		return pathname.startsWith(path);
	};

	/* =========================
	   TEACHER SIDEBAR
	   ========================= */

	if (isTeacher) {
		return (
			<aside className={styles.sidebar}>
				<button
					type='button'
					className={`${styles.sideBtn} ${styles.activeBtn}`}
					onClick={() =>
						router.push('/teacher/teacher-dashboard')
					}>
					Homework
				</button>
			</aside>
		);
	}

	/* =========================
	   ADMIN SIDEBAR
	   ========================= */

	return (
		<aside className={styles.sidebar}>
			{/* Homework */}
			<button
				type='button'
				className={`${styles.sideBtn} ${
					isActive('/admin/homeworks') ||
					isActive('/admin/homework-list') ||
					isActive('/admin/homework-details')
						? styles.activeBtn
						: ''
				}`}
				onClick={() =>
					router.push('/admin/homeworks')
				}>
				Homework
			</button>

			<div className={styles.separator} />

			{/* Admin Management */}
			<button
				type='button'
				className={`${styles.sideBtn} ${
					isActive('/admin/admin')
						? styles.activeBtn
						: ''
				}`}
				onClick={() =>
					router.push('/admin/admin')
				}>
				Admin Management
			</button>

			{/* Batches */}
			<button
				type='button'
				className={`${styles.sideBtn} ${
					isActive('/admin/batches')
						? styles.activeBtn
						: ''
				}`}
				onClick={() =>
					router.push('/admin/batches')
				}>
				Batches
			</button>

			{/* Students */}
			<button
				type='button'
				className={`${styles.sideBtn} ${
					isActive('/admin/students')
						? styles.activeBtn
						: ''
				}`}
				onClick={() =>
					router.push('/admin/students')
				}>
				Students
			</button>
		</aside>
	);
}