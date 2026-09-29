/** @format */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../../components/Sidebar';
import MobileNavigation from '../../../components/MobileNavigation';
import styles from './teacher-dashboard.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type LoginUser = {
	id: number;
	name: string;
	email: string;
	role: 'SUPER_ADMIN' | 'TEACHER';
	isActive: boolean;
};

type HomeworkSummary = {
	homeworkId: number;
	title: string;
	createdAt: string;
	dueDate: string;
	batch: {
		id: number;
		name: string;
	};
	assignedCount: number;
	checkedCount: number;
	pendingCount: number;
};

function getArray<T>(value: unknown): T[] {
	if (Array.isArray(value)) {
		return value as T[];
	}

	if (value && typeof value === 'object' && 'data' in value && Array.isArray((value as { data?: unknown }).data)) {
		return (value as { data: T[] }).data;
	}

	return [];
}

export default function TeacherDashboardPage() {
	const router = useRouter();

	const [currentUser, setCurrentUser] = useState<LoginUser | null>(null);
	const [assignments, setAssignments] = useState<HomeworkSummary[]>([]);
	const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const apiFetch = useCallback(
		async (endpoint: string) => {
			const token = sessionStorage.getItem('accessToken');

			if (!token) {
				router.replace('/');
				throw new Error('Please login first.');
			}

			const response = await fetch(`${API_URL}${endpoint}`, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			const result = await response.json().catch(() => null);

			if (response.status === 401) {
				sessionStorage.removeItem('accessToken');
				sessionStorage.removeItem('user');
				router.replace('/');
				throw new Error('Your login session has expired.');
			}

			if (response.status === 403) {
				router.replace('/');
				throw new Error('Teacher account required.');
			}

			if (!response.ok) {
				const message =
					Array.isArray(result?.message) ? result.message.join(', ') : (result?.message ?? 'Request failed.');
				throw new Error(message);
			}

			return result;
		},
		[router],
	);

	const loadDashboard = useCallback(async () => {
		setLoading(true);
		setError('');

		try {
			const result = await apiFetch('/homework-submissions/teacher/dashboard');
			setAssignments(getArray<HomeworkSummary>(result));
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
		} finally {
			setLoading(false);
		}
	}, [apiFetch]);

	useEffect(() => {
		const storedUser = sessionStorage.getItem('user');

		if (!storedUser) {
			router.replace('/');
			return;
		}

		try {
			const user = JSON.parse(storedUser) as LoginUser;

			if (user.role !== 'TEACHER') {
				router.replace('/');
				return;
			}

			setCurrentUser(user);
			void loadDashboard();
		} catch {
			sessionStorage.removeItem('accessToken');
			sessionStorage.removeItem('user');
			router.replace('/');
		}
	}, [loadDashboard, router]);

	const DEFAULT_AVATAR =
		'data:image/svg+xml;charset=UTF-8,' +
		encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
      <rect width="160" height="160" fill="#f3f4f6"/>
      <circle cx="80" cy="60" r="30" fill="#c9a227"/>
      <path d="M30 145c8-32 27-48 50-48s42 16 50 48" fill="#c9a227"/>
    </svg>
  `);

	const groupedAssignments = useMemo(() => {
		const groups = new Map<number, HomeworkSummary[]>();

		for (const assignment of assignments) {
			const batchId = assignment.batch.id;
			const current = groups.get(batchId) ?? [];

			current.push(assignment);
			groups.set(batchId, current);
		}

		return Array.from(groups.entries()).map(([batchId, items]) => ({
			batchId,
			batchName: items[0].batch.name,

			// Newest homework first
			items: [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),

			homeworkCount: items.length,

			hasPending: items.some((item) => item.pendingCount > 0),
		}));
	}, [assignments]);

	const allHomeworkCount = assignments.length;
	const hasAnyPending = assignments.some((assignment) => assignment.pendingCount > 0);

	const openHomework = (assignment: HomeworkSummary) => {
		const status = assignment.pendingCount > 0 ? 'pending' : 'completed';
		router.push(`/teacher/homework-list?homeworkId=${assignment.homeworkId}&status=${status}`);
	};

	const formatDate = (value: string) => new Date(value).toLocaleDateString();

	const handleLogout = () => {
		sessionStorage.removeItem('accessToken');
		sessionStorage.removeItem('user');
		router.replace('/');
	};

	return (
		<div className={styles.container}>
			<header className={styles.navbar}>
				<div className={styles.navLeft}>
					<MobileNavigation />
					<div className={styles.logoIcon}>A</div>
					<span className={styles.brandName}>Dhamma Teacher</span>
				</div>

				<div className={styles.navRight}>
					<img src={DEFAULT_AVATAR} alt='Profile' className={styles.profileImg} />
					<span className={styles.profileName}>{currentUser?.name ?? 'Super Admin'}</span>
					<button type='button' className={styles.logoutBtn} onClick={handleLogout} title='Logout'>
						<svg
							width='20'
							height='20'
							viewBox='0 0 24 24'
							fill='none'
							stroke='#b8860b'
							strokeWidth='2'
							strokeLinecap='round'
							strokeLinejoin='round'>
							<path d='M9 21H5a2 2 0 0 0-2-2V5a2 2 0 0 1 2-2h4' />
							<polyline points='16 17 21 12 16 7' />
							<line x1='21' y1='12' x2='9' y2='12' />
						</svg>
					</button>
				</div>
			</header>

			<div className={styles.layoutWrapper}>
				<Sidebar />

				<main className={styles.mainContent}>
					<div className={styles.contentHeader}>
						<div>
							<h1 className={styles.pageTitle}>Homework</h1>
							<p className={styles.pageSubtitle}>Only homework assigned to your account is shown.</p>
						</div>
					</div>

					{error && (
						<div
							style={{
								color: '#dc2626',
								background: '#fef2f2',
								padding: '12px 14px',
								borderRadius: '8px',
								marginBottom: '16px',
							}}>
							{error}
						</div>
					)}

					<nav className={styles.batchTabs} aria-label='Filter homework by batch'>
						<button type='button' aria-pressed={selectedBatch === null} onClick={() => setSelectedBatch(null)}>
							<span className={styles.batchTabContent}>
								<span>All</span>
								<span className={styles.batchHomeworkCount}>{allHomeworkCount}</span>
							</span>
							{hasAnyPending && (
								<span className={styles.batchNotificationDot} aria-label='Homework waiting to be checked' />
							)}
						</button>

						{groupedAssignments.map((group) => (
							<button
								type='button'
								key={group.batchId}
								aria-pressed={selectedBatch === group.batchId}
								onClick={() => setSelectedBatch(group.batchId)}>
								<span className={styles.batchTabContent}>
									<span>{group.batchName}</span>
									<span className={styles.batchHomeworkCount}>{group.homeworkCount}</span>
								</span>
								{group.hasPending && (
									<span className={styles.batchNotificationDot} aria-label='Homework waiting to be checked' />
								)}
							</button>
						))}
					</nav>

					<div className={styles.scrollContainer}>
						{loading && <div style={{ padding: '40px', textAlign: 'center' }}>Loading assigned homework...</div>}

						{!loading &&
							groupedAssignments
								.filter((group) => selectedBatch === null || group.batchId === selectedBatch)
								.map((group) => (
									<section key={group.batchId} className={styles.batchSection}>
										<h2 className={styles.batchTitle}>{group.batchName}</h2>

										<div className={styles.cardRowWrapper}>
											<div className={styles.cardRow}>
												{group.items.map((task) => {
													const isPending = task.pendingCount > 0;

													return (
														<div
															key={task.homeworkId}
															className={`${styles.card} ${
																isPending ? styles.cardPending : styles.cardCompleted
															}`}>
															<h3 className={styles.cardTitle}>{task.title}</h3>

															<div className={styles.cardDetails}>
																<div className={styles.detailRow}>
																	<span>Date</span>
																	<span>{formatDate(task.createdAt)}</span>
																</div>

																<div className={styles.detailRow}>
																	<span>Close</span>
																	<span>{formatDate(task.dueDate)}</span>
																</div>

																<div className={styles.detailRow}>
																	<span>Assigned</span>
																	<span>{task.assignedCount}</span>
																</div>

																<div className={styles.detailRow}>
																	<span>Checked</span>
																	<span>{task.checkedCount}</span>
																</div>
															</div>

															<div className={styles.cardBottom}>
																<div className={styles.avatarGroup}>
																	<div className={styles.avatarMore}>+{task.assignedCount}</div>
																</div>

																<button
																	type='button'
																	className={isPending ? styles.btnCheck : styles.btnView}
																	onClick={() => openHomework(task)}>
																	{isPending ? `Check (${task.pendingCount})` : 'View'}
																</button>
															</div>
														</div>
													);
												})}
											</div>
										</div>
									</section>
								))}

						{!loading && assignments.length === 0 && (
							<div style={{ padding: '50px', textAlign: 'center', color: '#777' }}>
								No homework has been assigned to your account.
							</div>
						)}
					</div>

					<footer className={styles.footer}>O-Technique-Myanmar-2026@</footer>
				</main>
			</div>
		</div>
	);
}
