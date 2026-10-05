/** @format */

'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import type { ChangeEvent } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { confirmAction } from '../../../lib/dialog';

import Sidebar from '../../../components/Sidebar';

import MobileNavigation from '../../../components/MobileNavigation';

import styles from './homework-list.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type LoginUser = {

    id: number;

    name: string;

    email: string;

    role: 'SUPER_ADMIN' | 'TEACHER';

};

type Teacher = {

    id: number;

    name: string;

    email: string;

    role: 'SUPER_ADMIN' | 'TEACHER';

    isActive?: boolean;

};

type SubmissionStatus = 'PENDING' | 'SUBMITTED' | 'REVIEWED';

type HomeworkImage = {

    id: number;

    image: string;

    marks?: number | null;

    remark?: string | null;

};

type Reviewer = {

    id: number;

    name: string;

    email?: string;

};

type Submission = {

    id: number;

    homeworkId: number;

    status: SubmissionStatus;

    submittedAt?: string | null;

    totalMarks?: number | null;

    reviewerId?: number | null;

    student: {

        id: number;

        name: string;

        studentCode: string;

    };

    images: HomeworkImage[];

    reviewer?: Reviewer | null;

};

type Homework = {

    id: number;

    title: string;

    description?: string | null;

    dueDate?: string;

    totalMarks?: number;

    batch?: {

        id: number;

        name: string;

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

function getMessage(value: unknown, fallback: string) {

    if (value && typeof value === 'object' && 'message' in value) {

        const message = (value as { message?: unknown }).message;

        if (Array.isArray(message)) {

            return message.join(', ');

        }

        if (typeof message === 'string') {

            return message;

        }

    }

    return fallback;

}

function HomeworkListContent() {

    const router = useRouter();

    const searchParams = useSearchParams();

    const homeworkId = Number(searchParams.get('homeworkId'));

    /* =========================

       STATES

       \========================= */

    const [currentUser, setCurrentUser] = useState<LoginUser | null>(null);

    const [homework, setHomework] = useState<Homework | null>(null);

    const [submissions, setSubmissions] = useState<Submission[]>([]);

    const [teachers, setTeachers] = useState<Teacher[]>([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterBy, setFilterBy] = useState<'ALL' | 'STUDENT' | 'TEACHER' | 'UNASSIGNED'>('ALL');
    const [sortKey, setSortKey] = useState<'ID' | 'DATE' | 'STUDENT' | 'PAGES' | 'TEACHER' | 'STATUS'>('ID');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    const [selectedTeacherId, setSelectedTeacherId] = useState('');

    const [rangeFrom, setRangeFrom] = useState('');

    const [rangeTo, setRangeTo] = useState('');

    const [loading, setLoading] = useState(true);

    const [assigning, setAssigning] = useState(false);

    const [error, setError] = useState('');

    const [assignError, setAssignError] = useState('');

    /* =========================

       API

       \========================= */

    const apiFetch = useCallback(

        async (endpoint: string, options: RequestInit = {}) => {

            const token = sessionStorage.getItem('accessToken');

            if (!token) {

                router.replace('/');

                throw new Error('Please login first.');

            }

            const headers = new Headers(options.headers);

            headers.set('Authorization', `Bearer ${token}`);

            if (options.body) {

                headers.set('Content-Type', 'application/json');

            }

            const response = await fetch(`${API_URL}${endpoint}`, {

                ...options,

                headers,

                cache: 'no-store',

            });

            const result = await response.json().catch(() => null);

            if (response.status === 401) {

                sessionStorage.removeItem('accessToken');

                sessionStorage.removeItem('user');

                router.replace('/');

                throw new Error('Login session expired.');

            }

            if (response.status === 403) {

                throw new Error('You do not have permission.');

            }

            if (!response.ok) {

                throw new Error(getMessage(result, 'Request failed.'));

            }

            return result;

        },

        [router],

    );

    /* =========================

       LOAD DATA

       \========================= */

    const fetchData = useCallback(

        async (silent = false) => {

            if (!Number.isInteger(homeworkId) || homeworkId <= 0) {

                setError('Invalid homework ID.');

                setLoading(false);

                return;

            }

            if (!silent) {

                setLoading(true);

            }

            setError('');

            try {

                const [homeworkResult, submissionResult, userResult] = await Promise.all([

                    apiFetch(`/homeworks/${homeworkId}`),

                    apiFetch(`/homework-submissions?homeworkId=${homeworkId}`),

                    apiFetch('/users'),

                ]);

                setHomework(homeworkResult?.data ?? homeworkResult);

                const allSubmissions = getArray<Submission>(submissionResult);

                setSubmissions(allSubmissions.filter((item) => item.homeworkId === homeworkId));

                setTeachers(getArray<Teacher>(userResult).filter((user) => user.role === 'TEACHER' && user.isActive !== false));

            } catch (err) {

                setError(err instanceof Error ? err.message : 'Failed to load data.');

            } finally {

                if (!silent) {

                    setLoading(false);

                }

            }

        },

        [apiFetch, homeworkId],

    );

    /* =========================

       AUTH

       \========================= */

    useEffect(() => {

        const storedUser = sessionStorage.getItem('user');

        if (!storedUser) {

            router.replace('/');

            return;

        }

        try {

            const user = JSON.parse(storedUser) as LoginUser;

            if (user.role !== 'SUPER_ADMIN') {

                router.replace('/');

                return;

            }

            setCurrentUser(user);

            void fetchData();

        } catch {

            sessionStorage.removeItem('accessToken');

            sessionStorage.removeItem('user');

            router.replace('/');

        }

    }, [fetchData, router]);

    /* =========================

       FILTER / SEARCH / SORT / PAGINATION

       ========================= */

    const filteredData = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return submissions.filter((submission) => {
            const studentName = submission.student?.name?.toLowerCase() ?? '';
            const studentCode = submission.student?.studentCode?.toLowerCase() ?? '';
            const teacherName = submission.reviewer?.name?.toLowerCase() ?? '';
            const unassigned = !submission.reviewerId && !submission.reviewer;
            if (filterBy === 'UNASSIGNED') return unassigned && (!term || studentName.includes(term) || studentCode.includes(term));
            if (!term) return true;
            if (filterBy === 'STUDENT') return studentName.includes(term) || studentCode.includes(term);
            if (filterBy === 'TEACHER') return teacherName.includes(term);
            return studentName.includes(term) || studentCode.includes(term) || teacherName.includes(term);
        });
    }, [filterBy, searchTerm, submissions]);

    const sortedData = useMemo(() => {
        const data = [...filteredData];
        const statusValue = (item: Submission) => item.status === 'PENDING' ? 0 : item.status === 'REVIEWED' ? 3 : (item.reviewerId || item.reviewer) ? 2 : 1;
        data.sort((a, b) => {
            let value = 0;
            if (sortKey === 'ID') value = submissions.indexOf(a) - submissions.indexOf(b);
            if (sortKey === 'DATE') value = new Date(a.submittedAt ?? 0).getTime() - new Date(b.submittedAt ?? 0).getTime();
            if (sortKey === 'STUDENT') value = (a.student?.name ?? '').localeCompare(b.student?.name ?? '');
            if (sortKey === 'PAGES') value = (a.images?.length ?? 0) - (b.images?.length ?? 0);
            if (sortKey === 'TEACHER') value = (a.reviewer?.name ?? '').localeCompare(b.reviewer?.name ?? '');
            if (sortKey === 'STATUS') value = statusValue(a) - statusValue(b);
            return sortDirection === 'asc' ? value : -value;
        });
        return data;
    }, [filteredData, sortDirection, sortKey, submissions]);

    const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const pageStart = (safeCurrentPage - 1) * pageSize;
    const pageEnd = Math.min(pageStart + pageSize, sortedData.length);
    const paginatedData = sortedData.slice(pageStart, pageEnd);

    useEffect(() => { setCurrentPage(1); }, [filterBy, searchTerm, pageSize]);
    useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

    const handleSort = (key: typeof sortKey) => {
        if (sortKey === key) setSortDirection((d) => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDirection('asc'); }
        setCurrentPage(1);
    };
    const sortArrow = (key: typeof sortKey) => sortKey !== key ? ' ↕' : sortDirection === 'asc' ? ' ↑' : ' ↓';

    /* =========================

       SELECT CHECKBOX

       \========================= */

    const toggleSelect = (submission: Submission) => {

        if (assigning || submission.status === 'PENDING') {

            return;

        }

        setSelectedIds((previous) =>

            previous.includes(submission.id) ? previous.filter((id) => id !== submission.id) : [...previous, submission.id],

        );

        setAssignError('');

    };

    /* =========================

       SELECT RANGE

       1 -> 2 selects BOTH

       \========================= */

    const handleClearRange = () => {
        if (assigning) return;
        setSelectedIds([]);
        setRangeFrom('');
        setRangeTo('');
        setAssignError('');
    };

    const handleSelectRange = () => {

        if (assigning) return;

        const from = Number(rangeFrom);

        const to = Number(rangeTo);

        if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {

            setAssignError('Enter a valid list ID range.');

            return;

        }

        // Match the visible row numbering, including both range endpoints.

        const ids = sortedData

            .filter((submission, index) => index + 1 >= from && index + 1 <= to && submission.status !== 'PENDING')

            .map((submission) => submission.id);

        setSelectedIds(ids);

        if (ids.length === 0) {

            setAssignError(`No selectable rows found from ${from} to ${to}.`);

        } else {

            setAssignError('');

        }

    };

    /* =========================

       SELECTED DATA

       \========================= */

    const selectedSubmissions = useMemo(

        () => submissions.filter((submission) => selectedIds.includes(submission.id)),

        [submissions, selectedIds],

    );

    const hasAssignedSelected = selectedSubmissions.some((submission) => Boolean(submission.reviewerId || submission.reviewer));

    const hasUnassignedSelected = selectedSubmissions.some((submission) => !submission.reviewerId && !submission.reviewer);

    const mixedSelection = hasAssignedSelected && hasUnassignedSelected;

    const selectedAssignedIds = selectedSubmissions

        .filter((submission) => Boolean(submission.reviewerId || submission.reviewer))

        .map((submission) => submission.id);

    const handleUnassign = async (ids: number[]) => {

        if (assigning || !ids.length) return;

        setAssigning(true);

        try {

            if (!(await confirmAction('update', `teacher assignments for ${ids.length} student(s) — remove assignment`))) return;

            setAssignError('');

            await apiFetch('/homework-submissions/unassign-reviewer', {

                method: 'PATCH',

                body: JSON.stringify({ submissionIds: ids }),

            });

            setSelectedIds((previous) => previous.filter((id) => !ids.includes(id)));

            await fetchData(true);

        } catch (err) {

            setAssignError(err instanceof Error ? err.message : 'Failed to remove assignment.');

        } finally {

            setAssigning(false);

        }

    };

    /* =========================

       ASSIGN

       \========================= */

    const handleAssignTeacher = async () => {

        if (!selectedIds.length) {

            setAssignError('Select students first.');

            return;

        }

        if (!selectedTeacherId) {

            setAssignError('Select a teacher.');

            return;

        }

        if (mixedSelection) {

            setAssignError('Select either assigned students or unassigned students.');

            return;

        }

        setAssigning(true);

        setAssignError('');

        try {

            /*

             * For already assigned students:

             * unassign first, then assign

             * selected teacher.

             */

            if (hasAssignedSelected) {

                await apiFetch('/homework-submissions/unassign-reviewer', {

                    method: 'PATCH',

                    body: JSON.stringify({

                        submissionIds: selectedIds,

                    }),

                });

            }

            await apiFetch('/homework-submissions/assign-reviewer', {

                method: 'PATCH',

                body: JSON.stringify({

                    submissionIds: selectedIds,

                    teacherId: Number(selectedTeacherId),

                }),

            });

            setSelectedIds([]);

            setSelectedTeacherId('');

            setRangeFrom('');

            setRangeTo('');

            await fetchData(true);

        } catch (err) {

            setAssignError(err instanceof Error ? err.message : 'Teacher assignment failed.');

        } finally {

            setAssigning(false);

        }

    };

    /* =========================

       DATE

       \========================= */

    const formatDate = (value?: string | null) => {

        if (!value) {

            return {

                date: '-',

                time: '-',

            };

        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {

            return {

                date: '-',

                time: '-',

            };

        }

        return {

            date: date.toLocaleDateString(),

            time: date.toLocaleTimeString([], {

                hour: '2-digit',

                minute: '2-digit',

            }),

        };

    };

    /* =========================

       STATUS

       \========================= */

    const getStatus = (submission: Submission) => {

        if (submission.status === 'REVIEWED') {

            return 'Reviewed';

        }

        if (submission.status === 'PENDING') {

            return 'Not Submitted';

        }

        if (submission.reviewerId || submission.reviewer) {

            return 'Assigned';

        }

        return 'Ready';

    };

    /* =========================

       COUNTS

       \========================= */

    const readyCount = submissions.filter((item) => item.status === 'SUBMITTED' && !item.reviewerId && !item.reviewer).length;

    const reviewedCount = submissions.filter((item) => item.status === 'REVIEWED').length;

    /* =========================

       LOGOUT

       \========================= */

    const handleLogout = () => {

        sessionStorage.removeItem('accessToken');

        sessionStorage.removeItem('user');

        router.replace('/');

    };

    const DEFAULT_AVATAR =

        'data:image/svg+xml;charset=UTF-8,' +

        encodeURIComponent(`

            <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">

                <rect width="160" height="160" fill="#f3f4f6"/>

                <circle cx="80" cy="60" r="30" fill="#c9a227"/>

                <path d="M30 145c8-32 27-48 50-48s42 16 50 48" fill="#c9a227"/>

            </svg>

        `);

    return (

        <div className={styles.container}>

            <header className={styles.navbar}>

                <div className={styles.navLeft}>

                    <MobileNavigation />

                    <div className={styles.logoIcon}>A</div>

                    <span className={styles.brandName}>Dhamma Admin</span>

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

                            <path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' />

                            <polyline points='16 17 21 12 16 7' />

                            <line x1='21' y1='12' x2='9' y2='12' />

                        </svg>

                    </button>

                </div>

            </header>

            <div className={styles.layoutWrapper}>

                <Sidebar />

                <main className={styles.mainContent}>

                    {/* BACK */}

                    <div className={styles.backBtnContainer}>

                        <button type='button' className={styles.backBtn} onClick={() => router.push('/admin/homeworks')}>

                            <span>←</span>

                            Back to Homework

                        </button>

                    </div>

                    <div className={styles.contentCard}>

                        {/* HEADER */}

                        <div className={styles.contentHeader}>

                            {/* LEFT */}

                            <div className={styles.homeworkInfo}>

                                <h1 className={styles.pageTitle}>{homework?.batch?.name ?? 'Batch'}</h1>

                                <p className={styles.pageSubtitle}>{homework?.title ?? 'Homework'}</p>

                                <p className={styles.summary}>

                                    Total: {submissions.length}

                                    {' • '}

                                    Ready: {readyCount}

                                    {' • '}

                                    Reviewed: {reviewedCount}

                                </p>

                            </div>

                            {/* RIGHT */}

                            <div className={styles.headerActions}>

                                <select className={`${styles.teacherSelect} ${styles.filterSelect}`} value={filterBy} onChange={(event) => setFilterBy(event.target.value as typeof filterBy)}>
                                    <option value='ALL'>Filter: All</option>
                                    <option value='STUDENT'>Filter by Student</option>
                                    <option value='TEACHER'>Filter by Teacher</option>
                                    <option value='UNASSIGNED'>Filter by Unassigned</option>
                                </select>

                                {/* SEARCH */}

                                <div className={styles.searchBox}>

                                    <input

                                        type='text'

                                        placeholder={filterBy === 'TEACHER' ? 'Search Teacher...' : filterBy === 'STUDENT' ? 'Search Student Name or ID...' : 'Search Student / Teacher / ID...'}

                                        value={searchTerm}

                                        onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchTerm(event.target.value)}

                                    />

                                </div>

                                {/* TEACHER */}

                                <select

                                    className={styles.teacherSelect}

                                    value={selectedTeacherId}

                                    onChange={(event) => setSelectedTeacherId(event.target.value)}

                                    disabled={assigning}>

                                    <option value=''>Select Teacher</option>

                                    {teachers.map((teacher) => (

                                        <option key={teacher.id} value={teacher.id}>

                                            {teacher.name}

                                        </option>

                                    ))}

                                </select>

                                <button

                                    type='button'

                                    className={styles.unassignBtn}

                                    disabled={assigning || !selectedAssignedIds.length}

                                    onClick={() => void handleUnassign(selectedAssignedIds)}>

                                    Unassign ({selectedAssignedIds.length})

                                </button>

                                {/* ASSIGN / REASSIGN */}

                                <button

                                    type='button'

                                    className={`${styles.assignBtn} ${hasAssignedSelected ? styles.reassignBtn : ''}`}

                                    disabled={assigning || !selectedTeacherId || !selectedIds.length || mixedSelection}

                                    onClick={() => void handleAssignTeacher()}>

                                    {assigning ?

                                        'Saving...'

                                    : hasAssignedSelected ?

                                        `Reassign (${selectedIds.length})`

                                    :   `Assign (${selectedIds.length})`}

                                </button>

                            </div>

                        </div>

                        {(error || assignError) && <div className={styles.errorMessage}>{error || assignError}</div>}

                        {/* =========================

                            DESKTOP / TABLET TABLE

                        \========================= */}

                        <div className={styles.desktopHomeworkTable}>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                                <span>Show</span><select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{height:36,padding:'0 10px'}}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select><span>entries</span>
                            </div>
                            <div className={styles.tableContainer}>

                                <table className={styles.table}>

                                    <thead>

                                        <tr>

                                            {/* RANGE */}

                                            <th className={styles.rangeColumn}>

                                                <div className={styles.idRange}>

                                                    <div className={styles.rangeInputs}>

                                                        <label className={styles.rangeItem}>

                                                            <span>From</span>

                                                            <input

                                                                type='number'

                                                                min='1'

                                                                placeholder='1'

                                                                value={rangeFrom}

                                                                onChange={(event) => setRangeFrom(event.target.value)}

                                                            />

                                                        </label>

                                                        <label className={styles.rangeItem}>

                                                            <span>To</span>

                                                            <input

                                                                type='number'

                                                                min='1'

                                                                placeholder='2'

                                                                value={rangeTo}

                                                                onChange={(event) => setRangeTo(event.target.value)}

                                                            />

                                                        </label>

                                                    </div>

                                                    <div className={styles.rangeActions}>
                                                        <button
                                                            type='button'
                                                            className={styles.rangeSelectBtn}
                                                            onClick={handleSelectRange}
                                                            disabled={assigning}>
                                                            Select
                                                        </button>
                                                        <button
                                                            type='button'
                                                            className={styles.rangeClearBtn}
                                                            onClick={handleClearRange}
                                                            disabled={assigning}
                                                            aria-label='Clear ID range and selection'
                                                            title='Clear ID range and selection'>
                                                            ×
                                                        </button>
                                                    </div>

                                                </div>

                                            </th>

                                            <th onClick={() => handleSort('ID')} style={{cursor:'pointer'}}>ID{sortArrow('ID')}</th>

                                            <th onClick={() => handleSort('DATE')} style={{cursor:'pointer'}}>Date Time{sortArrow('DATE')}</th>

                                            <th onClick={() => handleSort('STUDENT')} style={{cursor:'pointer'}}>Student Name / ID{sortArrow('STUDENT')}</th>

                                            <th onClick={() => handleSort('PAGES')} style={{cursor:'pointer'}}>Pages{sortArrow('PAGES')}</th>

                                            <th onClick={() => handleSort('STATUS')} style={{cursor:'pointer'}}>Status{sortArrow('STATUS')}</th>

                                            <th aria-label='Review' />

                                            <th onClick={() => handleSort('TEACHER')} style={{cursor:'pointer'}}>Teacher{sortArrow('TEACHER')}</th>

                                            <th aria-label='Remove assignment' />

                                        </tr>

                                    </thead>

                                    <tbody>

                                        {loading && (

                                            <tr>

                                                <td colSpan={9} className={styles.emptyCell}>

                                                    Loading submissions...

                                                </td>

                                            </tr>

                                        )}

                                        {!loading &&

                                            paginatedData.map((submission, index) => {

                                                const date = formatDate(submission.submittedAt);

                                                const selected = selectedIds.includes(submission.id);

                                                const selectable = submission.status !== 'PENDING';

                                                return (

                                                    <tr

                                                        key={submission.id}

                                                        className={

                                                            selected ? styles.selectedRow

                                                            : submission.reviewer ?

                                                                styles.assignedRow

                                                            :   ''

                                                        }>

                                                        {/* CHECKBOX */}

                                                        <td>

                                                            <input

                                                                type='checkbox'

                                                                className={styles.checkbox}

                                                                checked={selected}

                                                                disabled={!selectable || assigning}

                                                                onChange={() => toggleSelect(submission)}

                                                            />

                                                        </td>

                                                        {/* STUDENT ID */}

                                                        <td className={styles.boldText}>{String(pageStart + index + 1).padStart(2, '0')}</td>

                                                        {/* DATE */}

                                                        <td>

                                                            <div className={styles.boldText}>{date.date}</div>

                                                            <div className={styles.subText}>{date.time}</div>

                                                        </td>

                                                        {/* STUDENT */}

                                                        <td>

                                                            <div className={styles.boldText}>{submission.student?.name ?? '-'}</div>

                                                            <div className={styles.subText}>

                                                                {submission.student?.studentCode ?? '-'}

                                                            </div>

                                                        </td>

                                                        {/* PAGES */}

                                                        <td>{submission.images?.length ?? 0}</td>

                                                        {/* STATUS */}

                                                        <td>

                                                            <span

                                                                className={

                                                                    submission.status === 'REVIEWED' ? styles.reviewedStatus

                                                                    : submission.reviewer ?

                                                                        styles.assignedStatus

                                                                    :   styles.readyStatus

                                                                }>

                                                                {getStatus(submission)}

                                                            </span>

                                                        </td>

                                                        {/* REVIEW */}

                                                        <td>

                                                            <div className={styles.actionButtons}>

                                                                <button

                                                                    type='button'

                                                                    className={styles.reviewBtn}

                                                                    disabled={submission.status === 'PENDING'}

                                                                    onClick={() =>

                                                                        router.push(

                                                                            `/admin/homework-details?submissionId=${submission.id}`,

                                                                        )

                                                                    }>

                                                                    Review

                                                                </button>

                                                            </div>

                                                        </td>

                                                        {/* TEACHER */}

                                                        <td className={styles.boldText}>{submission.reviewer?.name ?? '-'}</td>

                                                        {/* REMOVE ASSIGNMENT */}

                                                        <td>

                                                            <div className={styles.actionButtons}>

                                                                {Boolean(submission.reviewerId || submission.reviewer) && (

                                                                    <button

                                                                        type='button'

                                                                        className={styles.unassignBtn2}

                                                                        disabled={assigning}

                                                                        aria-label={`Remove assignment for ${

                                                                            submission.student?.name ?? 'student'

                                                                        }`}

                                                                        onClick={() => void handleUnassign([submission.id])}>

                                                                        Remove Assign

                                                                    </button>

                                                                )}

                                                            </div>

                                                        </td>

                                                    </tr>

                                                );

                                            })}

                                        {!loading && sortedData.length === 0 && (

                                            <tr>

                                                <td colSpan={9} className={styles.emptyCell}>

                                                    No students found.

                                                </td>

                                            </tr>

                                        )}

                                    </tbody>

                                </table>
                            </div>
                            {!loading && sortedData.length > 0 && (
                                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginTop:14,flexWrap:'wrap'}}>
                                    <span style={{fontSize:12,color:'#777'}}>Showing {pageStart + 1}-{pageEnd} of {sortedData.length} entries</span>
                                    <div style={{display:'flex',gap:6,alignItems:'center'}}>
                                        <button type='button' className={styles.reviewBtn} disabled={safeCurrentPage === 1} onClick={() => setCurrentPage(p => Math.max(1,p-1))}>&lt;</button>
                                        {Array.from({length: totalPages}, (_,i) => i+1).filter(p => p === 1 || p === totalPages || Math.abs(p-safeCurrentPage) <= 2).map((p,i,pages) => <span key={p} style={{display:'contents'}}>{i>0 && p-pages[i-1]>1 && <span>...</span>}<button type='button' className={styles.reviewBtn} onClick={() => setCurrentPage(p)} style={p===safeCurrentPage ? {background:'#c48a00',color:'#fff',borderColor:'#c48a00'} : undefined}>{p}</button></span>)}
                                        <button type='button' className={styles.reviewBtn} disabled={safeCurrentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages,p+1))}>&gt;</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* =========================

                            MOBILE HOMEWORK LIST

                        \========================= */}

                        <div className={styles.mobileHomeworkList}>

                            <div className={styles.mobileRangeCard}>

                                <div className={styles.mobileRangeHeader}>

                                    <h3>Quick Range Selector</h3>

                                    <button

                                        type='button'

                                        className={styles.mobileSelectAll}

                                        onClick={() => {

                                            const ids = sortedData

                                                .filter((item) => item.status !== 'PENDING')

                                                .map((item) => item.id);

                                            setSelectedIds(ids);

                                            setAssignError('');

                                        }}>

                                        Select All

                                    </button>

                                </div>

                                <div className={styles.mobileRangeControls}>

                                    <label>

                                        <span>From</span>

                                        <input

                                            type='number'

                                            min='1'

                                            placeholder='1'

                                            value={rangeFrom}

                                            onChange={(event) => setRangeFrom(event.target.value)}

                                        />

                                    </label>

                                    <label>

                                        <span>To</span>

                                        <input

                                            type='number'

                                            min='1'

                                            placeholder='2'

                                            value={rangeTo}

                                            onChange={(event) => setRangeTo(event.target.value)}

                                        />

                                    </label>

                                    <button

                                        type='button'

                                        className={styles.mobileApplyRange}

                                        onClick={handleSelectRange}

                                        disabled={assigning}>

                                        Apply Range

                                    </button>

                                </div>

                            </div>

                            {loading && <div className={styles.mobileEmpty}>Loading submissions...</div>}

                            {!loading &&

                                paginatedData.map((submission, index) => {

                                    const date = formatDate(submission.submittedAt);

                                    const statusText = getStatus(submission);

                                    const selectable = submission.status !== 'PENDING';

                                    const selected = selectedIds.includes(submission.id);

                                    return (

                                        <div

                                            key={submission.id}

                                            className={`${styles.mobileStudentCard} ${

                                                selected ? styles.mobileStudentSelected : ''

                                            }`}>

                                            <div className={styles.mobileCardTop}>

                                                <div className={styles.mobileIdArea}>

                                                    <input

                                                        type='checkbox'

                                                        className={styles.mobileCheckbox}

                                                        checked={selected}

                                                        disabled={!selectable || assigning}

                                                        onChange={() => toggleSelect(submission)}

                                                    />

                                                    <span className={styles.mobileIdBadge}>

                                                        ID: {String(pageStart + index + 1).padStart(2, '0')}

                                                    </span>

                                                </div>

                                                <span

                                                    className={`${styles.mobileStatus} ${

                                                        statusText === 'Reviewed'

                                                            ? styles.mobileStatusReviewed

                                                            : statusText === 'Assigned'

                                                                ? styles.mobileStatusAssigned

                                                                : styles.mobileStatusReady

                                                    }`}>

                                                    {statusText}

                                                </span>

                                            </div>

                                            <div className={styles.mobileStudentMain}>

                                                <div className={styles.mobileStudentInfo}>

                                                    <strong>{submission.student?.name ?? '-'}</strong>

                                                    <span>{submission.student?.studentCode ?? '-'}</span>

                                                </div>

                                                <div className={styles.mobileDateInfo}>

                                                    <strong>{date.date}</strong>

                                                    <span>{date.time}</span>

                                                </div>

                                            </div>

                                            <div className={styles.mobileInfoPanel}>

                                                <div className={styles.mobileInfoItem}>

                                                    <span>Pages</span>

                                                    <strong>{submission.images?.length ?? 0} Pages</strong>

                                                </div>

                                                <div className={styles.mobileInfoItem}>

                                                    <span>Assigned Teacher</span>

                                                    <strong>{submission.reviewer?.name ?? '-'}</strong>

                                                </div>

                                            </div>

                                            <div className={styles.mobileActions}>

                                                <button

                                                    type='button'

                                                    className={styles.mobileReviewBtn}

                                                    disabled={submission.status === 'PENDING'}

                                                    onClick={() =>

                                                        router.push(`/admin/homework-details?submissionId=${submission.id}`)

                                                    }>

                                                    Review Submission

                                                </button>

                                                {Boolean(submission.reviewerId || submission.reviewer) && (

                                                    <button

                                                        type='button'

                                                        className={styles.mobileRemoveBtn}

                                                        disabled={assigning}

                                                        onClick={() => void handleUnassign([submission.id])}>

                                                        Remove Assign

                                                    </button>

                                                )}

                                            </div>

                                        </div>

                                    );

                                })}

                            {!loading && sortedData.length === 0 && (

                                <div className={styles.mobileEmpty}>No students found.</div>

                            )}

                        </div>

                    </div>

                    <div className={styles.footerBrand}>O-Technique-Myanmar-2026@</div>

                </main>

            </div>

        </div>

    );

}

export default function HomeworkListPage() {

    return (

        <Suspense fallback={<div>Loading...</div>}>

            <HomeworkListContent />

        </Suspense>

    );

}
