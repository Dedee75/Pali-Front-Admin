/** @format */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ChangeEvent, FormEvent } from 'react';

import { useRouter } from 'next/navigation';

import { confirmAction } from '../../../lib/dialog';

import Sidebar from '../../../components/Sidebar';

import MobileNavigation from '../../../components/MobileNavigation';

import styles from './homework.module.css';

const API_URL = (

    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

).replace(/\/$/, '');

type UserRole = 'SUPER_ADMIN' | 'TEACHER';

type SubmissionStatus = 'PENDING' | 'SUBMITTED' | 'REVIEWED';

type LoginUser = {

    id: number;

    name: string;

    email: string;

    role: UserRole;

    isActive: boolean;

};

type Batch = {

    id: number;

    name: string;

    status: boolean;

    teacherId: number | null;

    teacher?: {

        id: number;

        name: string;

        email: string;

    } | null;

};

type HomeworkSubmissionSummary = {

    id: number;

    homeworkId: number;

    status: SubmissionStatus;

    reviewerId?: number | null;

};

type Homework = {

    attachment?: string | null;

    attachmentName?: string | null;

    id: number;

    title: string;

    description?: string | null;

    dueDate: string;

    totalMarks?: number | null;

    batchId: number;

    batch?: Batch | null;

    submissions?: HomeworkSubmissionSummary[];

    createdAt?: string;

    updatedAt?: string;

};

type HomeworkForm = {

    title: string;

    description: string;

    batchId: string;

    dueDate: string;

    totalMarks: string;

};

function getTomorrow(): string {

    const date = new Date();

    date.setDate(date.getDate() + 1);

    return date.toISOString().slice(0, 10);

}

function createDefaultForm(): HomeworkForm {

    return {

        title: '',

        description: '',

        batchId: '',

        dueDate: getTomorrow(),

        totalMarks: '100',

    };

}

function getArray<T>(result: unknown): T[] {

    if (Array.isArray(result)) {

        return result as T[];

    }

    if (

        result &&

        typeof result === 'object' &&

        'data' in result &&

        Array.isArray(

            (

                result as {

                    data?: unknown;

                }

            ).data,

        )

    ) {

        return (

            result as {

                data: T[];

            }

        ).data;

    }

    return [];

}

export default function AdminHomeworkPage() {

    const router = useRouter();

    const mainRef = useRef<HTMLElement>(null);

    const cardsRef = useRef<HTMLDivElement>(null);

    const restorePosition = useRef<{ main: number; cards: number } | null>(null);

    const [homeworks, setHomeworks] = useState<Homework[]>([]);

    const [batches, setBatches] = useState<Batch[]>([]);

    /* Batch Filter */

    const [selectedBatchId, setSelectedBatchId] =

        useState<number | 'all'>('all');

    const [currentUser, setCurrentUser] =

        useState<LoginUser | null>(null);

    const [formData, setFormData] =

        useState<HomeworkForm>(createDefaultForm());

    const [attachment, setAttachment] =

        useState<File | null>(null);

    const [editingId, setEditingId] =

        useState<number | null>(null);

    const [isModalOpen, setIsModalOpen] =

        useState(false);

    const [loading, setLoading] =

        useState(true);

    const [saving, setSaving] =

        useState(false);

    const [deletingId, setDeletingId] =

        useState<number | null>(null);

    const [error, setError] =

        useState('');

    const [modalError, setModalError] =

        useState('');

    /* =========================

       API

       ========================= */

    const apiFetch = useCallback(

        async (

            endpoint: string,

            options: RequestInit = {},

        ) => {

            const token =

                sessionStorage.getItem('accessToken');

            if (!token) {

                router.replace('/');

                throw new Error(

                    'Please login first.',

                );

            }

            const headers =

                new Headers(options.headers);

            if (!(options.body instanceof FormData)) {

                headers.set(

                    'Content-Type',

                    'application/json',

                );

            }

            headers.set(

                'Authorization',

                `Bearer ${token}`,

            );

            const response = await fetch(

                `${API_URL}${endpoint}`,

                {

                    ...options,

                    headers,

                    cache:

                        options.cache ??

                        'no-store',

                },

            );

            const result = await response

                .json()

                .catch(() => null);

            if (response.status === 401) {

                sessionStorage.removeItem(

                    'accessToken',

                );

                sessionStorage.removeItem(

                    'user',

                );

                router.replace('/');

                throw new Error(

                    'Your login session has expired.',

                );

            }

            if (response.status === 403) {

                throw new Error(

                    'You do not have permission.',

                );

            }

            if (!response.ok) {

                const message =

                    Array.isArray(

                        result?.message,

                    )

                        ? result.message.join(

                                ', ',

                            )

                        : (result?.message ??

                            'Request failed.');

                throw new Error(message);

            }

            return result;

        },

        [router],

    );

    /* =========================

       FETCH DATA

       ========================= */

    const fetchData = useCallback(

        async (silent = false) => {

            if (!silent) {

                setLoading(true);

            }

            setError('');

            try {

                const [

                    homeworkResult,

                    batchResult,

                    submissionResult,

                ] = await Promise.all([

                    apiFetch('/homeworks'),

                    apiFetch('/batches'),

                    apiFetch(

                        '/homework-submissions',

                    ),

                ]);

                const homeworkList =

                    getArray<Homework>(

                        homeworkResult,

                    );

                const submissionList =

                    getArray<HomeworkSubmissionSummary>(

                        submissionResult,

                    );

                const mergedHomeworks =

                    homeworkList.map(

                        (homework) => ({

                            ...homework,

                            submissions:

                                submissionList.filter(

                                    (

                                        submission,

                                    ) =>

                                        submission.homeworkId ===

                                        homework.id,

                                ),

                        }),

                    );

                setHomeworks(

                    mergedHomeworks,

                );

                setBatches(

                    getArray<Batch>(

                        batchResult,

                    ).filter(

                        (batch) =>

                            batch.status,

                    ),

                );

            } catch (err) {

                setError(

                    err instanceof Error

                        ? err.message

                        : 'Failed to load homework.',

                );

            } finally {

                if (!silent) {

                    setLoading(false);

                }

            }

        },

        [apiFetch],

    );

    useEffect(() => {

        if (loading || !restorePosition.current) return;

        const position = restorePosition.current;

        const frame = requestAnimationFrame(() => {

            if (mainRef.current) mainRef.current.scrollTop = position.main;

            if (cardsRef.current) cardsRef.current.scrollTop = position.cards;

            restorePosition.current = null;

        });

        return () => cancelAnimationFrame(frame);

    }, [loading]);

    /* =========================

       LOGIN CHECK

       ========================= */

    useEffect(() => {

        const storedUser =

            sessionStorage.getItem('user');

        if (!storedUser) {

            router.replace('/');

            return;

        }

        try {

            const user =

                JSON.parse(

                    storedUser,

                ) as LoginUser;

            if (

                user.role !==

                'SUPER_ADMIN'

            ) {

                router.replace(

                    '/teacher/teacher-dashboard',

                );

                return;

            }

            setCurrentUser(user);

            try {

                const key = `adminHomeworkView:${user.id}`;

                const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null');

                if (saved && (saved.batch === 'all' || (Number.isInteger(saved.batch) && saved.batch > 0))) {

                    setSelectedBatchId(saved.batch);

                    restorePosition.current = {

                        main: Number.isFinite(saved.main) ? Math.max(0, saved.main) : 0,

                        cards: Number.isFinite(saved.cards) ? Math.max(0, saved.cards) : 0,

                    };

                }

                sessionStorage.removeItem(key);

            } catch { /* A malformed saved view must not affect login. */ }

            void fetchData();

        } catch {

            sessionStorage.removeItem(

                'accessToken',

            );

            sessionStorage.removeItem(

                'user',

            );

            router.replace('/');

        }

    }, [fetchData, router]);

    /* =========================

       AUTO REFRESH

       ========================= */

    useEffect(() => {

        const timer =

            window.setInterval(() => {

                if (

                    document.visibilityState ===

                    'visible'

                ) {

                    void fetchData(true);

                }

            }, 10000);

        const handleFocus = () => {

            void fetchData(true);

        };

        window.addEventListener(

            'focus',

            handleFocus,

        );

        return () => {

            window.clearInterval(timer);

            window.removeEventListener(

                'focus',

                handleFocus,

            );

        };

    }, [fetchData]);

    /* =========================

       BATCH FILTER

       ========================= */

    const homeworksByBatch =

        useMemo(() => {

            return batches

                .filter((batch) => {

                    if (

                        selectedBatchId ===

                        'all'

                    ) {

                        return true;

                    }

                    return (

                        batch.id ===

                        selectedBatchId

                    );

                })

                .map((batch) => ({

                    batch,

                    homeworks:

                        homeworks.filter(

                            (homework) =>

                                homework.batchId ===

                                batch.id,

                        ),

                }))

                .filter(

                    (group) =>

                        group.homeworks

                            .length > 0,

                );

        }, [

            batches,

            homeworks,

            selectedBatchId,

        ]);

    /* =========================

       BATCH TAB INFO

       ========================= */

    const getOpenHomeworkCount = (items: Homework[]) =>
        items.filter((homework) => !isHomeworkClosed(homework.dueDate)).length;

    const getBatchTabInfo = (batchId: number) => {

        const batchHomeworks = homeworks.filter(

            (homework) => homework.batchId === batchId,

        );

        return {

            homeworkCount: batchHomeworks.length,

            openHomeworkCount: getOpenHomeworkCount(batchHomeworks),

            hasPending: batchHomeworks.some((homework) =>

                (homework.submissions ?? []).some(

                    (submission) => submission.status === 'SUBMITTED',

                ),

            ),

        };

    };

    const allHomeworkCount = homeworks.length;

    const allOpenHomeworkCount = getOpenHomeworkCount(homeworks);

    const hasAnyPending = homeworks.some((homework) =>

        (homework.submissions ?? []).some(

            (submission) => submission.status === 'SUBMITTED',

        ),

    );

    /* =========================

       COUNTS

       ========================= */

    const getCounts = (

        homework: Homework,

    ) => {

        const submissions =

            homework.submissions ?? [];

        const totalStudents =

            submissions.length;

        const notSubmitted =

            submissions.filter(

                (submission) =>

                    submission.status ===

                    'PENDING',

            ).length;

        const waitingCheck =

            submissions.filter(

                (submission) =>

                    submission.status ===

                    'SUBMITTED',

            ).length;

        const checked =

            submissions.filter(

                (submission) =>

                    submission.status ===

                    'REVIEWED',

            ).length;

        const uploaded =

            waitingCheck + checked;

        return {

            totalStudents,

            notSubmitted,

            uploaded,

            waitingCheck,

            checked,

            allUploadedReviewed:

                uploaded > 0 &&

                waitingCheck === 0,

        };

    };

    const formatDate = (

        date?: string,

    ) => {

        if (!date) {

            return '-';

        }

        return new Date(

            date,

        ).toLocaleDateString();

    };

    function isHomeworkClosed(

        dueDate?: string,

    ) {

        if (!dueDate) {

            return false;

        }

        const dueTime = new Date(

            dueDate,

        ).getTime();

        if (Number.isNaN(dueTime)) {

            return false;

        }

        return Date.now() >= dueTime;

    }

    /* =========================

       OPEN HOMEWORK

       ========================= */

    const openHomeworkList = (

        homework: Homework,

        status:

            | 'pending'

            | 'completed'

            | 'all',

    ) => {

        const params =

            new URLSearchParams({

                homeworkId: String(

                    homework.id,

                ),

                status,

            });

        if (currentUser) {

            try {

                sessionStorage.setItem(`adminHomeworkView:${currentUser.id}`, JSON.stringify({

                    batch: selectedBatchId,

                    main: mainRef.current?.scrollTop ?? 0,

                    cards: cardsRef.current?.scrollTop ?? 0,

                }));

            } catch { /* Navigation still works when browser storage is unavailable. */ }

        }

        router.push(

            `/admin/homework-list?${params.toString()}`,

        );

    };

    /* =========================

       CREATE

       ========================= */

    const handleOpenCreate = () => {

        const form =

            createDefaultForm();

        if (batches[0]) {

            form.batchId = String(

                batches[0].id,

            );

        }

        setFormData(form);

        setEditingId(null);

        setModalError('');

        setAttachment(null);

        setIsModalOpen(true);

    };

    /* =========================

       EDIT

       ========================= */

    const handleOpenEdit = (

        homework: Homework,

    ) => {

        setFormData({

            title: homework.title,

            description:

                homework.description ??

                '',

            batchId: String(

                homework.batchId,

            ),

            dueDate:

                homework.dueDate.slice(

                    0,

                    10,

                ),

            totalMarks: String(

                homework.totalMarks ?? 100,

            ),

        });

        setEditingId(homework.id);

        setModalError('');

        setAttachment(null);

        setIsModalOpen(true);

    };

    const handleCloseModal = () => {

        if (saving) {

            return;

        }

        setIsModalOpen(false);

        setEditingId(null);

        setModalError('');

        setAttachment(null);

        setFormData(

            createDefaultForm(),

        );

    };

    const handleChange = (

        event: ChangeEvent<

            | HTMLInputElement

            | HTMLTextAreaElement

            | HTMLSelectElement

        >,

    ) => {

        const { name, value } =

            event.target;

        setFormData((previous) => ({

            ...previous,

            [name]: value,

        }));

    };

    /* =========================

       SAVE

       ========================= */

    const handleSubmit = async (

        event: FormEvent<HTMLFormElement>,

    ) => {

        event.preventDefault();

        setModalError('');

        if (!formData.batchId) {

            setModalError(

                'Please select a batch.',

            );

            return;

        }

        const parsedTotalMarks = Number(

            formData.totalMarks,

        );

        if (

            !Number.isFinite(parsedTotalMarks) ||

            parsedTotalMarks <= 0

        ) {

            setModalError(

                'Total marks must be greater than 0.',

            );

            return;

        }

        const payload = {

            title:

                formData.title.trim(),

            description:

                formData.description.trim(),

            batchId: Number(

                formData.batchId,

            ),

            totalMarks: parsedTotalMarks,

            dueDate: new Date(

                `${formData.dueDate}T23:59:59.000Z`,

            ).toISOString(),

        };

        if (

            editingId !== null &&

            !(await confirmAction(

                'update',

                'this homework',

            ))

        ) {

            return;

        }

        setSaving(true);

        try {

            const requestBody =

                new FormData();

            Object.entries(

                payload,

            ).forEach(

                ([key, value]) => {

                    requestBody.append(

                        key,

                        String(value),

                    );

                },

            );

            if (attachment) {

                requestBody.append(

                    'attachment',

                    attachment,

                );

            }

            if (editingId === null) {

                await apiFetch(

                    '/homeworks',

                    {

                        method: 'POST',

                        body: requestBody,

                    },

                );

            } else {

                await apiFetch(

                    `/homeworks/${editingId}`,

                    {

                        method: 'PATCH',

                        body: requestBody,

                    },

                );

            }

            setIsModalOpen(false);

            setEditingId(null);

            setAttachment(null);

            setFormData(

                createDefaultForm(),

            );

            await fetchData();

        } catch (err) {

            setModalError(

                err instanceof Error

                    ? err.message

                    : 'Failed to save homework.',

            );

        } finally {

            setSaving(false);

        }

    };

    /* =========================

       AVATAR

       ========================= */

    const DEFAULT_AVATAR =

        'data:image/svg+xml;charset=UTF-8,' +

        encodeURIComponent(`

            <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">

                <rect width="160" height="160" fill="#f3f4f6"/>

                <circle cx="80" cy="60" r="30" fill="#c9a227"/>

                <path d="M30 145c8-32 27-48 50-48s42 16 50 48" fill="#c9a227"/>

            </svg>

        `);

    /* =========================

       DELETE

       ========================= */

    const handleDelete = async (

        homework: Homework,

    ) => {

        const confirmed =

            await confirmAction(

                'delete',

                'this homework',

            );

        if (!confirmed) {

            return;

        }

        setDeletingId(homework.id);

        setError('');

        try {

            await apiFetch(

                `/homeworks/${homework.id}`,

                {

                    method: 'DELETE',

                },

            );

            setHomeworks(

                (previous) =>

                    previous.filter(

                        (item) =>

                            item.id !==

                            homework.id,

                    ),

            );

        } catch (err) {

            setError(

                err instanceof Error

                    ? err.message

                    : 'Failed to delete homework.',

            );

        } finally {

            setDeletingId(null);

        }

    };

    /* =========================

       LOGOUT

       ========================= */

    const handleLogout = () => {

        sessionStorage.removeItem(

            'accessToken',

        );

        sessionStorage.removeItem(

            'user',

        );

        router.replace('/');

    };

    return (

        <div className={styles.container}>

            {/* =========================

                NAVBAR

                ========================= */}

            <header className={styles.navbar}>

                <div className={styles.navLeft}>

                    <MobileNavigation />

                    <div className={styles.logoIcon}>

                        A

                    </div>

                    <span

                        className={

                            styles.brandName

                        }>

                        Dhamma Admin

                    </span>

                </div>

                <div className={styles.navRight}>

                    <img

                        src={DEFAULT_AVATAR}

                        alt='Profile'

                        className={

                            styles.profileImg

                        }

                    />

                    <span

                        className={

                            styles.profileName

                        }>

                        {currentUser?.name ??

                            'Super Admin'}

                    </span>

                    <button

                        type='button'

                        className={

                            styles.logoutBtn

                        }

                        onClick={

                            handleLogout

                        }

                        title='Logout'

                        aria-label='Logout'>

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

                            <line

                                x1='21'

                                y1='12'

                                x2='9'

                                y2='12'

                            />

                        </svg>

                    </button>

                </div>

            </header>

            <div

                className={

                    styles.layoutWrapper

                }>

                <Sidebar />

                <main

                    ref={mainRef}

                    className={

                        styles.mainContent

                    }>

                    {/* HEADER */}

                    <div

                        className={

                            styles.contentHeader

                        }>

                        <div>

                            <h1

                                className={

                                    styles.pageTitle

                                }>

                                Homeworks

                            </h1>

                            <p

                                className={

                                    styles.pageSubtitle

                                }>

                                Create and manage all

                                registered homework.

                            </p>

                        </div>

                        <div

                            className={

                                styles.headerActions

                            }>

                            <button

                                type='button'

                                className={

                                    styles.btnAdd

                                }

                                onClick={

                                    handleOpenCreate

                                }

                                disabled={

                                    loading ||

                                    batches.length ===

                                        0

                                }>

                                Add New Homework

                            </button>

                        </div>

                    </div>

                    {/* =========================

                        BATCH FILTER

                        ========================= */}

                    <div className={styles.batchFilterWrapper}>

                        <div className={styles.batchFilterTabs}>

                            <button

                                type='button'

                                className={`${styles.batchFilterBtn} ${

                                    selectedBatchId === 'all' ? styles.batchFilterActive : ''

                                }`}

                                onClick={() => setSelectedBatchId('all')}>

                                <span className={styles.batchFilterContent}>

                                    <span>All</span>

                                    <span className={styles.batchHomeworkCount} title='Open homeworks / Total homeworks'>{allOpenHomeworkCount}/{allHomeworkCount}</span>

                                </span>

                                {hasAnyPending && (

                                    <span className={styles.batchNotificationDot} aria-label='Homework waiting to be checked' />

                                )}

                            </button>

                            {batches.map((batch) => {

                                const batchInfo = getBatchTabInfo(batch.id);

                                return (

                                    <button

                                        key={batch.id}

                                        type='button'

                                        className={`${styles.batchFilterBtn} ${

                                            selectedBatchId === batch.id ? styles.batchFilterActive : ''

                                        }`}

                                        onClick={() => setSelectedBatchId(batch.id)}>

                                        <span className={styles.batchFilterContent}>

                                            <span>{batch.name}</span>

                                            <span className={styles.batchHomeworkCount} title='Open homeworks / Total homeworks'>{batchInfo.openHomeworkCount}/{batchInfo.homeworkCount}</span>

                                        </span>

                                        {batchInfo.hasPending && (

                                            <span className={styles.batchNotificationDot} aria-label='Homework waiting to be checked' />

                                        )}

                                    </button>

                                );

                            })}

                        </div>

                    </div>

                    {/* ERROR */}

                    {error && (

                        <div

                            className={

                                styles.errorMessage

                            }>

                            {error}

                        </div>

                    )}

                    {/* =========================

                        HOMEWORK LIST

                        ========================= */}

                    <div

                        ref={cardsRef}

                        className={

                            styles.scrollContainer

                        }>

                        {loading && (

                            <p

                                className={

                                    styles.loadingText

                                }>

                                Loading homework...

                            </p>

                        )}

                        {!loading &&

                            homeworksByBatch.length ===

                                0 && (

                                <div

                                    className={

                                        styles.emptyState

                                    }>

                                    No homework found

                                    for this batch.

                                </div>

                            )}

                        {!loading &&

                            homeworksByBatch.map(

                                ({

                                    batch,

                                    homeworks:

                                        batchHomeworks,

                                }) => (

                                    <div

                                        key={

                                            batch.id

                                        }

                                        className={

                                            styles.batchSection

                                        }>

                                        <h2

                                            className={

                                                styles.batchTitle

                                            }>

                                            {

                                                batch.name

                                            }

                                        </h2>

                                        <div

                                            className={

                                                styles.cardRowWrapper

                                            }>

                                            <div

                                                className={

                                                    styles.cardRow

                                                }>

                                                {batchHomeworks.map(

                                                    (

                                                        homework,

                                                    ) => {

                                                        const counts =

                                                            getCounts(

                                                                homework,

                                                            );

                                                        const isPending =

                                                            counts.waitingCheck >

                                                            0;

                                                        const isClosed =

                                                            isHomeworkClosed(

                                                                homework.dueDate,

                                                            );

                                                        const totalMarks =

                                                            homework.totalMarks ??

                                                            100;

                                                        return (

                                                            <div

                                                                key={

                                                                    homework.id

                                                                }

                                                                className={`${styles.card} ${

                                                                    isPending

                                                                        ? styles.cardPending

                                                                        : `${styles.cardCompleted} homeworkNoActiveHover`

                                                                }`}

                                                                onClick={() =>

                                                                    openHomeworkList(

                                                                        homework,

                                                                        isPending

                                                                            ? 'pending'

                                                                            : 'all',

                                                                    )

                                                                }

                                                                style={{

                                                                    cursor:

                                                                        'pointer',

                                                                }}>

                                                                {/* ACTIONS */}

                                                                <div

                                                                    className={

                                                                        styles.cardActions

                                                                    }>

                                                                    <button

                                                                        type='button'

                                                                        className={

                                                                            styles.editBtn

                                                                        }

                                                                        onClick={(

                                                                            event,

                                                                        ) => {

                                                                            event.stopPropagation();

                                                                            handleOpenEdit(

                                                                                homework,

                                                                            );

                                                                        }}

                                                                        title='Edit Homework'>

                                                                        <svg

                                                                            width='15'

                                                                            height='15'

                                                                            viewBox='0 0 24 24'

                                                                            fill='none'

                                                                            stroke='currentColor'

                                                                            strokeWidth='2'

                                                                            strokeLinecap='round'

                                                                            strokeLinejoin='round'>

                                                                            <path d='M12 20h9' />

                                                                            <path d='M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z' />

                                                                        </svg>

                                                                        <span>

                                                                            Edit

                                                                        </span>

                                                                    </button>

                                                                    <button

                                                                        type='button'

                                                                        className={

                                                                            styles.deleteBtn

                                                                        }

                                                                        onClick={(

                                                                            event,

                                                                        ) => {

                                                                            event.stopPropagation();

                                                                            void handleDelete(

                                                                                homework,

                                                                            );

                                                                        }}

                                                                        disabled={

                                                                            deletingId ===

                                                                            homework.id

                                                                        }

                                                                        title='Delete Homework'>

                                                                        {deletingId ===

                                                                        homework.id ? (

                                                                            <>

                                                                                <span

                                                                                    className={

                                                                                        styles.deleteSpinner

                                                                                    }

                                                                                />

                                                                                <span>

                                                                                    Deleting

                                                                                </span>

                                                                            </>

                                                                        ) : (

                                                                            <>

                                                                                <svg

                                                                                    width='15'

                                                                                    height='15'

                                                                                    viewBox='0 0 24 24'

                                                                                    fill='none'

                                                                                    stroke='currentColor'

                                                                                    strokeWidth='2'

                                                                                    strokeLinecap='round'

                                                                                    strokeLinejoin='round'>

                                                                                    <polyline points='3 6 5 6 21 6' />

                                                                                    <path d='M19 6l-1 14H6L5 6' />

                                                                                    <path d='M10 11v6' />

                                                                                    <path d='M14 11v6' />

                                                                                    <path d='M9 6V4h6v2' />

                                                                                </svg>

                                                                                <span>

                                                                                    Delete

                                                                                </span>

                                                                            </>

                                                                        )}

                                                                    </button>

                                                                </div>

                                                                <h3

                                                                    className={

                                                                        styles.cardTitle

                                                                    }>

                                                                    {

                                                                        homework.title

                                                                    }

                                                                </h3>

                                                                <div

                                                                    className={

                                                                        styles.cardMarksBox

                                                                    }>

                                                                    <span>

                                                                        ပေးမှတ် :

                                                                    </span>

                                                                    <strong>

                                                                        {totalMarks}

                                                                    </strong>

                                                                </div>

                                                                {/* DETAILS */}

                                                                <div

                                                                    className={

                                                                        styles.cardDetails

                                                                    }>

                                                                    <div

                                                                        className={

                                                                            styles.detailRow

                                                                        }>

                                                                        <span

                                                                            className={

                                                                                styles.detailLabel

                                                                            }>

                                                                            Date

                                                                        </span>

                                                                        <span

                                                                            className={

                                                                                styles.detailValue

                                                                            }>

                                                                            {formatDate(

                                                                                homework.createdAt,

                                                                            )}

                                                                        </span>

                                                                    </div>

                                                                    <div

                                                                        className={

                                                                            styles.detailRow

                                                                        }>

                                                                        <span

                                                                            className={

                                                                                styles.detailLabel

                                                                            }>

                                                                            Due Date

                                                                        </span>

                                                                        <div

                                                                            className={

                                                                                styles.detailValueGroup

                                                                            }>

                                                                            <span

                                                                                className={

                                                                                    isClosed

                                                                                        ? styles.statusClosed

                                                                                        : styles.statusOpen

                                                                                }>

                                                                                {isClosed

                                                                                    ? 'Close'

                                                                                    : 'Open'}

                                                                            </span>

                                                                            <span

                                                                                className={

                                                                                    styles.detailValue

                                                                                }>

                                                                                {formatDate(

                                                                                    homework.dueDate,

                                                                                )}

                                                                            </span>

                                                                        </div>

                                                                    </div>

                                                                    <div

                                                                        className={

                                                                            styles.detailRow

                                                                        }>

                                                                        <span

                                                                            className={

                                                                                styles.detailLabel

                                                                            }>

                                                                            Upload

                                                                        </span>

                                                                        <span

                                                                            className={

                                                                                styles.countBadge

                                                                            }>

                                                                            {

                                                                                counts.uploaded

                                                                            }

                                                                        </span>

                                                                    </div>

                                                                    <div

                                                                        className={

                                                                            styles.detailRow

                                                                        }>

                                                                        <span

                                                                            className={

                                                                                styles.detailLabel

                                                                            }>

                                                                            Waiting

                                                                            Check

                                                                        </span>

                                                                        <span

                                                                            className={

                                                                                counts.waitingCheck >

                                                                                0

                                                                                    ? styles.pendingCount

                                                                                    : styles.countBadge

                                                                            }>

                                                                            {

                                                                                counts.waitingCheck

                                                                            }

                                                                        </span>

                                                                    </div>

                                                                    <div

                                                                        className={

                                                                            styles.detailRow

                                                                        }>

                                                                        <span

                                                                            className={

                                                                                styles.detailLabel

                                                                            }>

                                                                            Checked

                                                                        </span>

                                                                        <span

                                                                            className={

                                                                                styles.checkedCount

                                                                            }>

                                                                            {

                                                                                counts.checked

                                                                            }

                                                                        </span>

                                                                    </div>

                                                                </div>

                                                                {/* BOTTOM */}

                                                                <div

                                                                    className={

                                                                        styles.cardBottom

                                                                    }>

                                                                    <div

                                                                        className={

                                                                            styles.studentCount

                                                                        }>

                                                                        <svg

                                                                            width='16'

                                                                            height='16'

                                                                            viewBox='0 0 24 24'

                                                                            fill='none'

                                                                            stroke='currentColor'

                                                                            strokeWidth='2'>

                                                                            <path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />

                                                                            <circle

                                                                                cx='9'

                                                                                cy='7'

                                                                                r='4'

                                                                            />

                                                                            <path d='M22 21v-2a4 4 0 0 0-3-3.87' />

                                                                        </svg>

                                                                        <span>

                                                                            {

                                                                                counts.totalStudents

                                                                            }{' '}

                                                                            Students

                                                                        </span>

                                                                    </div>

                                                                    {isPending ? (

                                                                        <button

                                                                            type='button'

                                                                            className={

                                                                                styles.btnCheck

                                                                            }

                                                                            onClick={(

                                                                                event,

                                                                            ) => {

                                                                                event.stopPropagation();

                                                                                openHomeworkList(

                                                                                    homework,

                                                                                    'pending',

                                                                                );

                                                                            }}>

                                                                            Check

                                                                        </button>

                                                                    ) : (

                                                                        <button

                                                                            type='button'

                                                                            className={

                                                                                styles.btnView

                                                                            }

                                                                            onClick={(

                                                                                event,

                                                                            ) => {

                                                                                event.stopPropagation();

                                                                                openHomeworkList(

                                                                                    homework,

                                                                                    'all',

                                                                                );

                                                                            }}>

                                                                            View

                                                                        </button>

                                                                    )}

                                                                </div>

                                                            </div>

                                                        );

                                                    },

                                                )}

                                            </div>

                                        </div>

                                    </div>

                                ),

                            )}

                    </div>


                    <div

                        className={

                            styles.footerBrand

                        }>

                        O-Technique-Myanmar-2026@

                    </div>

                </main>

            </div>

            {/* =========================

                CREATE / EDIT MODAL

                ========================= */}

            {isModalOpen && (

                <div

                    className={

                        styles.modalOverlay

                    }

                    onClick={

                        handleCloseModal

                    }>

                    <div

                        className={

                            styles.modalContent

                        }

                        onClick={(event) =>

                            event.stopPropagation()

                        }>

                        <div

                            className={

                                styles.modalHeader

                            }>

                            <div>

                                <h2

                                    className={

                                        styles.modalTitle

                                    }>

                                    {editingId

                                        ? 'Edit Homework'

                                        : 'Add New Homework'}

                                </h2>

                                <p

                                    className={

                                        styles.modalSubtitle

                                    }>

                                    {editingId

                                        ? 'Update homework information.'

                                        : 'Create a new homework assignment.'}

                                </p>

                            </div>

                            <button

                                type='button'

                                className={

                                    styles.modalCloseBtn

                                }

                                onClick={

                                    handleCloseModal

                                }

                                disabled={

                                    saving

                                }>

                                ×

                            </button>

                        </div>

                        {modalError && (

                            <div

                                className={

                                    styles.modalError

                                }>

                                {

                                    modalError

                                }

                            </div>

                        )}

                        <form

                            className={

                                styles.modalForm

                            }

                            onSubmit={

                                handleSubmit

                            }>

                            <label

                                className={

                                    styles.formLabel

                                }>

                                Homework Title

                            </label>

                            <input

                                type='text'

                                name='title'

                                required

                                value={

                                    formData.title

                                }

                                onChange={

                                    handleChange

                                }

                                className={

                                    styles.formControl

                                }

                            />

                            <label

                                className={

                                    styles.formLabel

                                }>

                                Description

                            </label>

                            <textarea

                                name='description'

                                value={

                                    formData.description

                                }

                                onChange={

                                    handleChange

                                }

                                rows={4}

                                className={

                                    styles.formControl

                                }

                            />

                            <label

                                className={

                                    styles.formLabel

                                }>

                                Attachment

                                (PDF / JPG /

                                PNG / WebP,

                                up to 10 MB)

                            </label>

                            <input

                                type='file'

                                className={

                                    styles.formControl

                                }

                                accept='.pdf,.jpg,.jpeg,.png,.webp'

                                onChange={(

                                    event,

                                ) => {

                                    const file =

                                        event

                                            .target

                                            .files?.[0] ??

                                        null;

                                    if (

                                        file &&

                                        file.size >

                                            10 *

                                                1024 *

                                                1024

                                    ) {

                                        setModalError(

                                            'Attachment must be at most 10 MB',

                                        );

                                        event.target.value =

                                            '';

                                        setAttachment(

                                            null,

                                        );

                                        return;

                                    }

                                    setAttachment(

                                        file,

                                    );

                                    setModalError(

                                        '',

                                    );

                                }}

                            />

                            {editingId &&

                                homeworks.find(

                                    (item) =>

                                        item.id ===

                                        editingId,

                                )?.attachment && (

                                    <a

                                        className={

                                            styles.currentAttachment

                                        }

                                        target='_blank'

                                        rel='noopener noreferrer'

                                        href={`${API_URL}${

                                            homeworks.find(

                                                (

                                                    item,

                                                ) =>

                                                    item.id ===

                                                    editingId,

                                            )

                                                ?.attachment

                                        }`}>

                                        View current

                                        attachment

                                    </a>

                                )}

                            <label

                                className={

                                    styles.formLabel

                                }>

                                Batch

                            </label>

                            <select

                                name='batchId'

                                required

                                value={

                                    formData.batchId

                                }

                                onChange={

                                    handleChange

                                }

                                className={

                                    styles.formControl

                                }>

                                <option value=''>

                                    Select batch

                                </option>

                                {batches.map(

                                    (batch) => (

                                        <option

                                            key={

                                                batch.id

                                            }

                                            value={

                                                batch.id

                                            }>

                                            {

                                                batch.name

                                            }

                                        </option>

                                    ),

                                )}

                            </select>

                            <label

                                className={

                                    styles.formLabel

                                }>

                                Total Marks

                            </label>

                            <input

                                type='number'

                                name='totalMarks'

                                required

                                min='1'

                                step='1'

                                value={

                                    formData.totalMarks

                                }

                                onChange={

                                    handleChange

                                }

                                className={

                                    styles.formControl

                                }

                            />

                            <label

                                className={

                                    styles.formLabel

                                }>

                                Due Date

                            </label>

                            <input

                                type='date'

                                name='dueDate'

                                required

                                value={

                                    formData.dueDate

                                }

                                onChange={

                                    handleChange

                                }

                                className={

                                    styles.formControl

                                }

                            />

                            <div

                                className={

                                    styles.modalActions

                                }>

                                <button

                                    type='button'

                                    className={

                                        styles.cancelBtn

                                    }

                                    onClick={

                                        handleCloseModal

                                    }

                                    disabled={

                                        saving

                                    }>

                                    Cancel

                                </button>

                                <button

                                    type='submit'

                                    className={

                                        styles.saveBtn

                                    }

                                    disabled={

                                        saving

                                    }>

                                    {saving

                                        ? 'Saving...'

                                        : editingId

                                            ? 'Update'

                                            : 'Create'}

                                </button>

                            </div>

                        </form>

                    </div>

                </div>

            )}

            <style jsx global>{`

                .homeworkNoActiveHover:hover {

                    transform: none !important;

                    box-shadow: none !important;

                }

            `}</style>

        </div>

    );

}
