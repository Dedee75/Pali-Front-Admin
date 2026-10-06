/** @format */

'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '../../../components/Sidebar';
import MobileNavigation from '../../../components/MobileNavigation';
import { EntriesControl, ListPagination, useListPagination } from '../../../components/ListPagination';
import styles from './homework-list.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type LoginUser = {
	id: number;
	name: string;
	email: string;
	role: 'SUPER_ADMIN' | 'TEACHER';
};

type SubmissionStatus = 'PENDING' | 'SUBMITTED' | 'REVIEWED';

type HomeworkImage = {
	id: number;
	image: string;
	marks?: number | null;
	remark?: string | null;
};

type Submission = {
	id: number;
	homeworkId: number;
	status: SubmissionStatus;
	submittedAt?: string | null;
	totalMarks?: number | null;
	student: {
		id: number;
		name: string;
		studentCode: string;
	};
	images: HomeworkImage[];
	homework: {
		id: number;
		title: string;
		batch: {
			id: number;
			name: string;
		};
	};
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

function HomeworkListContent() {
	const router = useRouter();
	const searchParams = useSearchParams();

	const homeworkId = Number(searchParams.get('homeworkId'));

	const status = searchParams.get('status') ?? 'pending';

	const [currentUser, setCurrentUser] = useState<LoginUser | null>(null);
	const [submissions, setSubmissions] = useState<Submission[]>([]);
	const [searchTerm, setSearchTerm] = useState('');
	const [searchBy, setSearchBy] = useState<'ALL' | 'ID' | 'NAME' | 'DATE' | 'STATUS'>('ALL');
	const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUBMITTED' | 'REVIEWED'>(status === 'completed' ? 'REVIEWED' : status === 'all' ? 'ALL' : 'SUBMITTED');
	const [sortKey, setSortKey] = useState<'ID' | 'DATE' | 'STUDENT' | 'PAGES' | 'STATUS'>('ID');
	const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
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

			if (response.status === 401 || response.status === 403) {
				sessionStorage.removeItem('accessToken');
				sessionStorage.removeItem('user');
				router.replace('/');

				throw new Error('You cannot access this homework.');
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

	const DEFAULT_AVATAR =
		'data:image/svg+xml;charset=UTF-8,' +
		encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
      <rect width="160" height="160" fill="#f3f4f6"/>
      <circle cx="80" cy="60" r="30" fill="#c9a227"/>
      <path d="M30 145c8-32 27-48 50-48s42 16 50 48" fill="#c9a227"/>
    </svg>
  `);

	const loadSubmissions = useCallback(async () => {
		if (!Number.isInteger(homeworkId) || homeworkId <= 0) {
			setError('Invalid homework ID.');
			setLoading(false);
			return;
		}

		setLoading(true);
		setError('');

		try {
			const result = await apiFetch(`/homework-submissions/teacher/assigned?homeworkId=${homeworkId}&status=all`);

			setSubmissions(getArray<Submission>(result));
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load homework.');
		} finally {
			setLoading(false);
		}
	}, [apiFetch, homeworkId]);

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
			void loadSubmissions();
		} catch {
			router.replace('/');
		}
	}, [loadSubmissions, router]);

    const filteredData = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return submissions.filter((submission, index) => {
            if (statusFilter !== 'ALL' && submission.status !== statusFilter) return false;
            if (!term) return true;
            const date = submission.submittedAt ? new Date(submission.submittedAt) : null;
            const validDate = date && !Number.isNaN(date.getTime());
            const localDate = validDate ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '';
            const ids = [submission.student.studentCode.toLowerCase(), String(submission.id), String(index + 1).padStart(2, '0')];
            const name = submission.student.name.toLowerCase();
            const dateText = validDate ? `${localDate} ${date.toLocaleDateString()}`.toLowerCase() : '';
            const statusText = submission.status === 'REVIEWED' ? 'reviewed completed' : submission.status === 'PENDING' ? 'pending' : 'assigned submitted pending';
            if (searchBy === 'ID') return ids.some(id => id.includes(term));
            if (searchBy === 'NAME') return name.includes(term);
            if (searchBy === 'DATE') return localDate === term;
            if (searchBy === 'STATUS') return statusText.includes(term);
            return ids.some(id => id.includes(term)) || name.includes(term) || dateText.includes(term) || statusText.includes(term);
        });
    }, [searchTerm, searchBy, statusFilter, submissions]);

    const sortedData = [...filteredData].sort((first, second) => {
        let comparison = first.id - second.id;
        if (sortKey === 'DATE') comparison = (Date.parse(first.submittedAt ?? '') || 0) - (Date.parse(second.submittedAt ?? '') || 0);
        if (sortKey === 'STUDENT') comparison = first.student.name.localeCompare(second.student.name, undefined, { numeric: true, sensitivity: 'base' });
        if (sortKey === 'PAGES') comparison = (first.images?.length ?? 0) - (second.images?.length ?? 0);
        if (sortKey === 'STATUS') comparison = first.status.localeCompare(second.status);
        return sortDirection === 'asc' ? comparison : -comparison;
    });
    const handleSort = (key: typeof sortKey) => {
        setSortDirection(sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc');
        setSortKey(key);
    };
    const { rows: paginatedData, pageSize, setPageSize, currentPage, setCurrentPage, startIndex } = useListPagination(sortedData, `${homeworkId}:${statusFilter}:${searchBy}:${searchTerm}:${sortKey}:${sortDirection}`);

	const title = submissions[0]?.homework.title ?? 'Assignment Details';

	const batchName = submissions[0]?.homework.batch.name ?? 'Batch';

	const formatDate = (value?: string | null) => {
		if (!value) {
			return {
				date: '-',
				time: '-',
			};
		}

		const date = new Date(value);

		return {
			date: date.toLocaleDateString(),
			time: date.toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
			}),
		};
	};

	const openDetails = (submissionId: number) => {
		router.push(`/teacher/homework-details?submissionId=${submissionId}`);
	};

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
					<div className={styles.backBtnContainer}>
						<button
							type='button'
							className={styles.backBtn}
							onClick={() => router.push('/teacher/teacher-dashboard')}>
							<span aria-hidden='true'>←</span>
							Back to Homework
						</button>
					</div>

					<div className={styles.contentCard}>
					<div className={styles.contentHeader}>
						<div>
							<h1 className={styles.pageTitle}>{batchName}</h1>
							<p className={styles.pageSubtitle}>{title}</p>
<p className={styles.summary}>Showing: {filteredData.length} • {statusFilter === 'ALL' ? 'All statuses' : statusFilter === 'REVIEWED' ? 'Reviewed' : 'Assigned'}</p>
						</div>

						<div className={styles.filters}>
							<select className={styles.filterDropdown} aria-label='Search field' value={searchBy} onChange={event => { setSearchBy(event.target.value as typeof searchBy); setSearchTerm(''); }}>
                                <option value='ALL'>Search: All fields</option>
                                <option value='ID'>Search by ID</option>
                                <option value='NAME'>Search by Name</option>
                                <option value='DATE'>Search by Date</option>
                                <option value='STATUS'>Search by Status</option>
                            </select>
                            <select className={styles.filterDropdown} aria-label='Submission status' value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}>
                                <option value='ALL'>All statuses</option>
                                <option value='SUBMITTED'>Assigned / Submitted</option>
                                <option value='REVIEWED'>Reviewed</option>
                            </select>

							<div className={styles.searchBox}>
								<input
									type={searchBy === 'DATE' ? 'date' : 'text'}
                                    aria-label={searchBy === 'DATE' ? 'Submission date' : 'Search assigned homework'}
                                    placeholder={searchBy === 'ID' ? 'Search ID...' : searchBy === 'NAME' ? 'Search Name...' : searchBy === 'STATUS' ? 'Search Status...' : 'Search ID, Name, Date or Status...'}
									value={searchTerm}
									onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchTerm(event.target.value)}
								/>
							</div>
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

					<EntriesControl pageSize={pageSize} onChange={setPageSize} />
					<div className={styles.tableContainer}>
						<table className={styles.table}>
							<thead>
								<tr>
									<th aria-sort={sortKey === 'ID' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                                        <button type='button' className={styles.sortButton} onClick={() => handleSort('ID')}>ID {sortKey === 'ID' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</button>
                                    </th>
									<th aria-sort={sortKey === 'DATE' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                                        <button type='button' className={styles.sortButton} onClick={() => handleSort('DATE')}>Date Time {sortKey === 'DATE' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</button>
                                    </th>
									<th aria-sort={sortKey === 'STUDENT' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                                        <button type='button' className={styles.sortButton} onClick={() => handleSort('STUDENT')}>Student Name / ID {sortKey === 'STUDENT' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</button>
                                    </th>
									<th aria-sort={sortKey === 'PAGES' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                                        <button type='button' className={styles.sortButton} onClick={() => handleSort('PAGES')}>Pages {sortKey === 'PAGES' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</button>
                                    </th>

									<th aria-sort={sortKey === 'STATUS' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                                        <button type='button' className={styles.sortButton} onClick={() => handleSort('STATUS')}>Status {sortKey === 'STATUS' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</button>
                                    </th><th aria-label='Review submission' />
								</tr>
							</thead>

							<tbody>
								{loading && (
									<tr>
										<td
											colSpan={6}
											style={{
												textAlign: 'center',
												padding: '30px',
											}}>
											Loading assigned students...
										</td>
									</tr>
								)}

								{!loading &&
									paginatedData.map((submission, index) => {
										const date = formatDate(submission.submittedAt);

										return (
											<tr
												key={submission.id}
												className={`${submission.status !== 'REVIEWED' ? styles.rowPending : ''} ${styles.submissionRow}`}
												>
												<td data-label="ID" className={styles.boldText}>{String(startIndex + index + 1).padStart(2, '0')}</td>

												<td data-label="Submitted">
													<div className={styles.boldText}>{date.date}</div>
													<div className={styles.subText}>{date.time}</div>
												</td>

												<td data-label="Student">
													<div className={styles.boldText}>{submission.student.name}</div>
													<div className={styles.subText}>{submission.student.studentCode}</div>
												</td>

												<td data-label="Pages">{submission.images?.length ?? 0}</td>
<td data-label="Status"><span className={submission.status === 'REVIEWED' ? styles.reviewedBadge : styles.assignedBadge}>{submission.status === 'REVIEWED' ? 'Reviewed' : 'Assigned'}</span></td>

												<td>
													<button
														type='button'
														className={styles.reviewBtn}
														onClick={(event) => {
															event.stopPropagation();
															openDetails(submission.id);
														}}>
														Review
													</button>
												</td>
											</tr>
										);
									})}

								{!loading && filteredData.length === 0 && (
									<tr>
										<td
											colSpan={6}
											style={{
												textAlign: 'center',
												padding: '30px',
												color: '#777',
											}}>
											No assigned students found.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
					<ListPagination total={filteredData.length} pageSize={pageSize} currentPage={currentPage} onChange={setCurrentPage} />
				</div>
<footer className={styles.footer}>O-Technique-Myanmar-2026@</footer>
</main>
			</div>
		</div>
	);
}

export default function HomeworkListPage() {
	return (
		<Suspense fallback={<div>Loading Data...</div>}>
			<HomeworkListContent />
		</Suspense>
	);
}
