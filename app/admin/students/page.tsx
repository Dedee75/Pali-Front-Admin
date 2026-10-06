/** @format */

'use client';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { confirmAction, showMessage } from '../../../lib/dialog';

import Sidebar from '../../../components/Sidebar';

import MobileNavigation from '../../../components/MobileNavigation';

import { EntriesControl, ListPagination, useListPagination } from '../../../components/ListPagination';
import styles from './student.module.css';

// Backend Student API

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

const API_URL = `${API_BASE_URL}/students`;


const DEFAULT_AVATAR =
	'data:image/svg+xml;charset=UTF-8,' +
	encodeURIComponent(`

    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">

      <rect width="160" height="160" fill="#f3f4f6"/>

      <circle cx="80" cy="60" r="30" fill="#c9a227"/>

      <path d="M30 145c8-32 27-48 50-48s42 16 50 48" fill="#c9a227"/>

    </svg>

  `);

type BackendBatch = {
	id: number;

	name: string;
};

type BackendStudent = {
	id: number;

	studentCode: string;

	name: string;

	batchId: number;

	batch?: BackendBatch | null;

	phone: string;

	age: number;

	township: string;

	region: string;

	image: string | null;
};

interface StudentData {
	id: string;

	displayId: string;

	name: string;

	batchId: string;

	batchName: string;

	phone: string;

	dob: string;

	town: string;

	city: string;

	imagePath: string;

	imageUrl: string;
}

const STUDENT_FIELDS = [
	{ key: 'displayId', label: 'Student ID' },
	{ key: 'name', label: 'Student Name' },
	{ key: 'batchName', label: 'Batch' },
	{ key: 'phone', label: 'Phone Number' },
	{ key: 'dob', label: 'Age' },
	{ key: 'town', label: 'Township' },
	{ key: 'city', label: 'Region/City' },
] as const;

type StudentField = (typeof STUDENT_FIELDS)[number]['key'];

interface CurrentUser {
	id?: number;

	name?: string;

	email?: string;

	role?: string;
}

function resolveImageUrl(value: string | null | undefined) {
	const image = String(value ?? '').trim();

	if (!image) {
		return DEFAULT_AVATAR;
	}

	if (
		image.startsWith('http://') ||
		image.startsWith('https://') ||
		image.startsWith('data:image/') ||
		image.startsWith('blob:')
	) {
		return image;
	}

	if (image.startsWith('/')) {
		return `${API_BASE_URL}${image}`;
	}

	return `${API_BASE_URL}/${image}`;
}

function getErrorMessage(payload: unknown, fallback: string) {
	if (payload && typeof payload === 'object' && 'message' in payload) {
		const message = (
			payload as {
				message?: unknown;
			}
		).message;

		if (Array.isArray(message)) {
			return message.join(', ');
		}

		if (typeof message === 'string') {
			return message;
		}
	}

	return fallback;
}

function getAuthHeaders(): Record<string, string> {
	const token = sessionStorage.getItem('accessToken');

	return token ?
			{
				Authorization: `Bearer ${token}`,
			}
		:	{};
}

export default function AdminStudentPage() {
	const router = useRouter();

	const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

	// --- STATE MANAGEMENT ---

	const [students, setStudents] = useState<StudentData[]>([]);

	const [isLoading, setIsLoading] = useState(true);

	const [searchTerm, setSearchTerm] = useState('');
	const [searchField, setSearchField] = useState<StudentField>('name');
	const [sortField, setSortField] = useState<StudentField>('displayId');
	const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
	const [batches, setBatches] = useState<BackendBatch[]>([]);
	const [batchesLoading, setBatchesLoading] = useState(true);


	// Student Registration ON / OFF
	const [registrationEnabled, setRegistrationEnabled] = useState(true);
	const [registrationLoading, setRegistrationLoading] = useState(true);
	const [registrationUpdating, setRegistrationUpdating] = useState(false);

	// Modal States

	const [isFormModalOpen, setIsFormModalOpen] = useState(false);

	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

	// Tracking IDs for Actions

	const [editingId, setEditingId] = useState<string | null>(null);

	const [deletingId, setDeletingId] = useState<string | null>(null);

	// Form State

	const defaultForm = {
		displayId: '',

		name: '',

		batch: '',

		phone: '',

		dob: '20',

		town: '',

		city: '',

		image: '',
	};

	const [formData, setFormData] = useState(defaultForm);

	const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

	const [imagePreviewUrl, setImagePreviewUrl] = useState('');

	// --- 1. FETCH DATA (READ) ---

	const fetchStudents = async () => {
		try {
			setIsLoading(true);

			const res = await fetch(API_URL, {
				method: 'GET',

				headers: {
					Accept: 'application/json',

					...getAuthHeaders(),
				},

				cache: 'no-store',
			});

			const payload: unknown = await res.json().catch(() => null);

			if (!res.ok) {
				throw new Error(getErrorMessage(payload, 'Failed to fetch students.'));
			}

			const data: BackendStudent[] = Array.isArray(payload) ? payload : [];

			const formatted: StudentData[] = data.map((item) => ({
				id: String(item.id),

				displayId: item.studentCode,

				name: item.name,

				batchId: String(item.batchId),

				batchName: item.batch?.name ?? `Batch-${item.batchId}`,

				phone: item.phone,

				dob: String(item.age),

				town: item.township,

				city: item.region,

				imagePath: item.image ?? '',

				imageUrl: resolveImageUrl(item.image),
			}));

			formatted.sort((firstStudent, secondStudent) =>
				firstStudent.displayId.localeCompare(secondStudent.displayId, undefined, {
					numeric: true,

					sensitivity: 'base',
				}),
			);

			setStudents(formatted);
		} catch (error) {
			console.error('Error fetching students:', error);

			void showMessage(error instanceof Error ? error.message : 'Failed to fetch students.');
		} finally {
			setIsLoading(false);
		}
	};

	const fetchBatches = async () => {
		try {
			setBatchesLoading(true);
			const response = await fetch(`${API_BASE_URL}/batches`, {
				headers: { Accept: 'application/json', ...getAuthHeaders() },
				cache: 'no-store',
			});
			const result: unknown = await response.json().catch(() => null);
			if (!response.ok) throw new Error(getErrorMessage(result, 'Failed to load batches.'));
			setBatches(Array.isArray(result) ? result : []);
		} catch (error) {
			void showMessage(error instanceof Error ? error.message : 'Failed to load batches.');
		} finally {
			setBatchesLoading(false);
		}
	};

	// =============================================
	// STUDENT REGISTRATION SETTING
	// =============================================
	const fetchRegistrationSetting = async () => {
		try {
			setRegistrationLoading(true);
			const response = await fetch(`${API_BASE_URL}/system-settings/public`, {
				method: 'GET',
				headers: { Accept: 'application/json' },
				cache: 'no-store',
			});
			const result: unknown = await response.json().catch(() => null);
			if (!response.ok) {
				throw new Error(getErrorMessage(result, 'Failed to load registration setting.'));
			}
			const data = result as { studentRegistrationEnabled?: boolean } | null;
			setRegistrationEnabled(data?.studentRegistrationEnabled === true);
		} catch (error) {
			console.error('Error loading registration setting:', error);
			setRegistrationEnabled(false);
			void showMessage(error instanceof Error ? error.message : 'Failed to load registration setting.');
		} finally {
			setRegistrationLoading(false);
		}
	};

	const handleRegistrationToggle = async () => {
		if (registrationLoading || registrationUpdating) return;
		const nextValue = !registrationEnabled;
		try {
			setRegistrationUpdating(true);
			const response = await fetch(`${API_BASE_URL}/system-settings/student-registration`, {
				method: 'PATCH',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
					...getAuthHeaders(),
				},
				body: JSON.stringify({ enabled: nextValue }),
			});
			const result: unknown = await response.json().catch(() => null);
			if (!response.ok) {
				throw new Error(getErrorMessage(result, 'Failed to update registration setting.'));
			}
			const data = result as { studentRegistrationEnabled?: boolean } | null;
			setRegistrationEnabled(data?.studentRegistrationEnabled === true);
		} catch (error) {
			console.error('Error updating registration setting:', error);
			void showMessage(error instanceof Error ? error.message : 'Failed to update registration setting.');
		} finally {
			setRegistrationUpdating(false);
		}
	};

	useEffect(() => {
		const storedUser = sessionStorage.getItem('user');

		if (!storedUser || !sessionStorage.getItem('accessToken')) {
			router.replace('/');

			return;
		}

		try {
			const parsedUser = JSON.parse(storedUser) as CurrentUser | { user?: CurrentUser };

			const resolvedUser = ('user' in parsedUser && parsedUser.user ? parsedUser.user : parsedUser) as CurrentUser;

			if (resolvedUser.role !== 'SUPER_ADMIN') {
				router.replace(resolvedUser.role === 'TEACHER' ? '/teacher/teacher-dashboard' : '/');

				return;
			}

			setCurrentUser(resolvedUser);

			void Promise.all([fetchStudents(), fetchRegistrationSetting(), fetchBatches()]);
		} catch {
			sessionStorage.removeItem('user');

			sessionStorage.removeItem('accessToken');

			router.replace('/');
		}
	}, []);

	// --- HANDLERS ---

	const handleLogout = () => {
		sessionStorage.removeItem('accessToken');

		sessionStorage.removeItem('user');

		setCurrentUser(null);

		router.replace('/');
	};

	// Open Create Form

	const handleOpenCreate = () => {
		if (imagePreviewUrl) {
			URL.revokeObjectURL(imagePreviewUrl);
		}

		setFormData(defaultForm);

		setSelectedImageFile(null);

		setImagePreviewUrl('');

		setEditingId(null);

		setIsFormModalOpen(true);
	};

	// Open Edit Form

	const handleOpenEdit = (student: StudentData) => {
		setFormData({
			displayId: student.displayId,

			name: student.name,

			batch: student.batchId,

			phone: student.phone,

			dob: student.dob,

			town: student.town,

			city: student.city,

			image: student.imageUrl,
		});

		if (imagePreviewUrl) {
			URL.revokeObjectURL(imagePreviewUrl);
		}

		setSelectedImageFile(null);

		setImagePreviewUrl('');

		setEditingId(student.id);

		setIsFormModalOpen(true);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		const batchId = Number(formData.batch);

		const age = Number(formData.dob);

		if (!Number.isInteger(batchId) || batchId < 1) {
			void showMessage('Batch ID must be a positive number.');

			return;
		}

		if (!Number.isInteger(age) || age < 0 || age > 150) {
			void showMessage('Age must be between 0 and 150.');

			return;
		}

		if (!editingId && !selectedImageFile) {
			void showMessage('Please choose a student image.');

			return;
		}

		if (editingId && !(await confirmAction('update', 'this student'))) return;

		const requestBody = new FormData();

		requestBody.append('name', formData.name.trim());

		requestBody.append('phone', formData.phone.trim());

		requestBody.append('township', formData.town.trim());

		requestBody.append('region', formData.city.trim());

		if (!editingId) requestBody.append('batchId', String(batchId));

		requestBody.append('age', String(age));

		requestBody.append('gender', 'Not Specified');

		requestBody.append('occupation', 'Student');

		if (selectedImageFile) {
			requestBody.append('image', selectedImageFile, selectedImageFile.name);
		}

		try {
			const res = await fetch(editingId ? `${API_URL}/${editingId}` : `${API_URL}/create`, {
				method: editingId ? 'PATCH' : 'POST',

				/*

                 * Do NOT set Content-Type here.

                 * Browser creates the multipart boundary.

                 */

				headers: {
					Accept: 'application/json',

					...getAuthHeaders(),
				},

				body: requestBody,
			});

			const result: unknown = await res.json().catch(() => null);

			if (!res.ok) {
				throw new Error(getErrorMessage(result, editingId ? 'Failed to update student.' : 'Failed to create student.'));
			}

			setIsFormModalOpen(false);

			setEditingId(null);

			setSelectedImageFile(null);

			if (imagePreviewUrl) {
				URL.revokeObjectURL(imagePreviewUrl);
			}

			setImagePreviewUrl('');

			await fetchStudents();
		} catch (error) {
			console.error('Error saving student:', error);

			void showMessage(error instanceof Error ? error.message : 'Something went wrong.');
		}
	};

	const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		setFormData({
			...formData,

			[e.target.name]: e.target.value,
		});
	};

	const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0] ?? null;

		if (!file) {
			return;
		}

		const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

		if (!allowedTypes.has(file.type)) {
			void showMessage('Only JPG, PNG and WEBP images are allowed.');

			event.target.value = '';

			return;
		}

		if (file.size > 20 * 1024 * 1024) {
			void showMessage('Image must be 20 MB or smaller.');

			event.target.value = '';

			return;
		}

		if (imagePreviewUrl) {
			URL.revokeObjectURL(imagePreviewUrl);
		}

		const previewUrl = URL.createObjectURL(file);

		setSelectedImageFile(file);

		setImagePreviewUrl(previewUrl);
	};

	// --- 3. DELETE FLOW ---

	const handleOpenDelete = (id: string) => {
		setDeletingId(id);

		setIsDeleteModalOpen(true);
	};

	const handleConfirmDelete = async () => {
		if (!deletingId) {
			return;
		}

		try {
			const res = await fetch(`${API_URL}/${deletingId}`, {
				method: 'DELETE',

				headers: {
					Accept: 'application/json',

					...getAuthHeaders(),
				},
			});

			const result: unknown = await res.json().catch(() => null);

			if (!res.ok) {
				throw new Error(getErrorMessage(result, 'Failed to delete student.'));
			}

			setIsDeleteModalOpen(false);

			setDeletingId(null);

			await fetchStudents();
		} catch (error) {
			console.error('Error deleting student:', error);

			void showMessage(error instanceof Error ? error.message : 'Failed to delete student.');
		}
	};

	const handleSort = (field: StudentField) => {
		setSortDirection(sortField === field && sortDirection === 'asc' ? 'desc' : 'asc');
		setSortField(field);
		setCurrentPage(1);
	};

	const query = searchTerm.trim().toLocaleLowerCase();
	const filteredStudents = students
		.filter((student) => {
			return student[searchField].toLocaleLowerCase().includes(query);
		})
		.sort((first, second) => {
			const comparison =
				sortField === 'dob' ?
					Number(first.dob) - Number(second.dob)
				:	first[sortField].localeCompare(second[sortField], undefined, { numeric: true, sensitivity: 'base' });
			const result = comparison || first.displayId.localeCompare(second.displayId, undefined, { numeric: true });
			return sortDirection === 'asc' ? result : -result;
		});

	const { rows: paginatedStudents, pageSize, setPageSize, currentPage, setCurrentPage, startIndex } = useListPagination(filteredStudents, `${searchTerm}:${searchField}:${sortField}:${sortDirection}`);

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

					<button type='button' className={styles.logoutBtn} onClick={handleLogout} title='Logout' aria-label='Logout'>
						<svg
							width='20'
							height='20'
							viewBox='0 0 24 24'
							fill='none'
							stroke='#b8860b'
							strokeWidth='2'
							strokeLinecap='round'
							strokeLinejoin='round'>
							<path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4'></path>

							<polyline points='16 17 21 12 16 7'></polyline>

							<line x1='21' y1='12' x2='9' y2='12'></line>
						</svg>
					</button>
				</div>
			</header>

			<div className={styles.layoutWrapper}>
				<Sidebar />

				{/* Main Content Area */}

				<main className={styles.mainContent}>
					<div className={styles.contentHeader}>
						<div>
							<h1 className={styles.pageTitle}>Students</h1>

							<p className={styles.pageSubtitle}>Manage all registered Students.</p>
						</div>

						<div className={styles.headerActions}>
							<button
								type='button'
								className={`${styles.registrationToggle} ${
									registrationEnabled ? styles.registrationToggleOn : styles.registrationToggleOff
								}`}
								onClick={handleRegistrationToggle}
								disabled={registrationLoading || registrationUpdating}
								aria-pressed={registrationEnabled}
								title={registrationEnabled ? 'Student registration is ON' : 'Student registration is OFF'}>
								<span className={styles.registrationToggleText}>Registration</span>
								<span className={styles.registrationSwitch}>
									<span className={styles.registrationSwitchCircle} />
								</span>
								<span className={styles.registrationStatus}>
									{registrationLoading || registrationUpdating ?
										'...'
									: registrationEnabled ?
										'ON'
									:	'OFF'}
								</span>
							</button>

							<div className={styles.filterDropdown}>
								<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='#666' strokeWidth='2'>
									<polygon points='22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3'></polygon>
								</svg>

								<select
									className={styles.filterSelect}
									aria-label='Filter students by'
									value={searchField}
									onChange={(event) => {
										setSearchField(event.target.value as StudentField);
										setCurrentPage(1);
									}}>
									<option value='displayId'>Filter With Student ID</option>
									<option value='name'>Filter With Name</option>
									<option value='phone'>Filter With Phone Number</option>
									<option value='dob'>Filter With Age</option>
									<option value='town'>Filter With Town</option>
									<option value='city'>Filter With City</option>
								</select>
							</div>

							<div className={styles.searchBox}>
								<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='#666' strokeWidth='2'>
									<circle cx='11' cy='11' r='8'></circle>

									<line x1='21' y1='21' x2='16.65' y2='16.65'></line>
								</svg>

								<input
									type='text'
									placeholder={`Search ${STUDENT_FIELDS.find(({ key }) => key === searchField)?.label.toLowerCase()}...`}
									aria-label='Search students'
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
								/>
							</div>

							<button className={styles.btnAdd} onClick={handleOpenCreate}>
								<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
									<path d='M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'></path>

									<circle cx='8.5' cy='7' r='4'></circle>

									<line x1='20' y1='8' x2='20' y2='14'></line>

									<line x1='23' y1='11' x2='17' y2='11'></line>
								</svg>
								Add New
							</button>
						</div>
					</div>

					<EntriesControl pageSize={pageSize} onChange={setPageSize} />

					{isLoading ?
						<p
							style={{
								padding: 20,
							}}>
							Loading data from server...
						</p>
					:	<div className={styles.tableContainer}>
							<table className={styles.table}>
								<thead>
									<tr>
										<th
											aria-sort={
												sortField === 'displayId' ?
													sortDirection === 'asc' ?
														'ascending'
													:	'descending'
												:	'none'
											}>
											<button
												type='button'
												className={styles.sortHeader}
												onClick={() => handleSort('displayId')}>
												Student ID{' '}
												{sortField === 'displayId' ?
													sortDirection === 'asc' ?
														'↑'
													:	'↓'
												:	'↕'}
											</button>
										</th>

										<th>Image</th>

										<th
											aria-sort={
												sortField === 'name' ?
													sortDirection === 'asc' ?
														'ascending'
													:	'descending'
												:	'none'
											}>
											<button
												type='button'
												className={styles.sortHeader}
												onClick={() => handleSort('name')}>
												Name{' '}
												{sortField === 'name' ?
													sortDirection === 'asc' ?
														'↑'
													:	'↓'
												:	'↕'}
											</button>
										</th>

										<th
											aria-sort={
												sortField === 'phone' ?
													sortDirection === 'asc' ?
														'ascending'
													:	'descending'
												:	'none'
											}>
											<button
												type='button'
												className={styles.sortHeader}
												onClick={() => handleSort('phone')}>
												Phone Number{' '}
												{sortField === 'phone' ?
													sortDirection === 'asc' ?
														'↑'
													:	'↓'
												:	'↕'}
											</button>
										</th>

										<th
											aria-sort={
												sortField === 'dob' ?
													sortDirection === 'asc' ?
														'ascending'
													:	'descending'
												:	'none'
											}>
											<button type='button' className={styles.sortHeader} onClick={() => handleSort('dob')}>
												Age{' '}
												{sortField === 'dob' ?
													sortDirection === 'asc' ?
														'↑'
													:	'↓'
												:	'↕'}
											</button>
										</th>

										<th
											aria-sort={
												sortField === 'town' ?
													sortDirection === 'asc' ?
														'ascending'
													:	'descending'
												:	'none'
											}>
											<button
												type='button'
												className={styles.sortHeader}
												onClick={() => handleSort('town')}>
												Town{' '}
												{sortField === 'town' ?
													sortDirection === 'asc' ?
														'↑'
													:	'↓'
												:	'↕'}
											</button>
										</th>

										<th
											aria-sort={
												sortField === 'city' ?
													sortDirection === 'asc' ?
														'ascending'
													:	'descending'
												:	'none'
											}>
											<button
												type='button'
												className={styles.sortHeader}
												onClick={() => handleSort('city')}>
												City{' '}
												{sortField === 'city' ?
													sortDirection === 'asc' ?
														'↑'
													:	'↓'
												:	'↕'}
											</button>
										</th>

										<th>Action</th>
									</tr>
								</thead>

								<tbody>
									{paginatedStudents.length > 0 ?
										paginatedStudents.map((student, index) => (
											<tr
												key={student.id}
												className={`${(startIndex + index) % 2 === 0 ? styles.rowEven : styles.rowOdd} ${styles.clickableRow}`}>
												<td className={styles.boldText}>{student.displayId}</td>

												<td>
													<img
														src={student.imageUrl}
														alt={student.name}
														className={styles.tableAvatar}
														onError={(event) => {
															event.currentTarget.src = DEFAULT_AVATAR;
														}}
													/>
												</td>

												<td>
													<div className={styles.boldText}>{student.name}</div>

													<div className={styles.subText}>{student.batchName}</div>
												</td>

												<td className={styles.boldText}>{student.phone}</td>

												<td className={styles.boldText}>{student.dob}</td>

												<td className={styles.boldText}>{student.town}</td>

												<td className={styles.boldText}>{student.city}</td>

												<td>
													<div className={styles.actionButtonsRow}>
														<button
															type='button'
															className={styles.editAction}
															onClick={() => handleOpenEdit(student)}>
															<svg
																width='18'
																height='18'
																viewBox='0 0 24 24'
																fill='none'
																stroke='currentColor'
																strokeWidth='2'
																strokeLinecap='round'
																strokeLinejoin='round'>
																<path d='M12 20h9' />

																<path d='M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z' />
															</svg>

															<span>Edit</span>
														</button>

														<button
															type='button'
															className={styles.deleteAction}
															onClick={(event) => {
																event.stopPropagation();

																handleOpenDelete(student.id);
															}}>
															<svg
																width='18'
																height='18'
																viewBox='0 0 24 24'
																fill='none'
																stroke='currentColor'
																strokeWidth='2'
																strokeLinecap='round'
																strokeLinejoin='round'>
																<path d='M3 6h18' />

																<path d='M8 6V4h8v2' />

																<path d='M19 6l-1 14H6L5 6' />

																<path d='M10 11v5' />

																<path d='M14 11v5' />
															</svg>

															<span>Delete</span>
														</button>
													</div>
												</td>
											</tr>
										))
									:	<tr>
											<td colSpan={8} style={{ textAlign: 'center', padding: '20px' }}>
												No students found.
											</td>
										</tr>
									}
								</tbody>
							</table>
						</div>
					}

					<ListPagination total={filteredStudents.length} pageSize={pageSize} currentPage={currentPage} onChange={setCurrentPage} />

					<div className={styles.footerBrand}>O-Technique-Myanmar-2026@</div>
				</main>
			</div>

			{isFormModalOpen && (
				<div className={styles.modalOverlay} onClick={() => setIsFormModalOpen(false)}>
					<div className={styles.formModalContent} onClick={(e) => e.stopPropagation()}>
						<div className={styles.formHeader}>
							<svg width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2'>
								<path d='M4 19.5A2.5 2.5 0 0 1 6.5 17H20'></path>

								<path d='M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'></path>

								<text
									x='12'
									y='14'
									fill='white'
									fontSize='10'
									stroke='none'
									textAnchor='middle'
									fontWeight='bold'>
									A
								</text>
							</svg>
						</div>

						<form onSubmit={handleSubmit} className={styles.formBody}>
							<div className={styles.profileImgContainer}>
								<img
									src={imagePreviewUrl || formData.image || DEFAULT_AVATAR}
									alt='Profile'
									className={styles.formProfileImg}
									onError={(event) => {
										event.currentTarget.src = DEFAULT_AVATAR;
									}}
								/>
							</div>

							<div
								style={{
									marginBottom: '14px',

									fontSize: '13px',

									textAlign: 'center',

									color: '#777',
								}}>
								{editingId ?
									'Choose a new image only when you want to replace the current image.'
								:	'Student image is required when creating a new student.'}
							</div>

							<div className={styles.formField}>
								<span className={styles.fieldLabel}>Student Photo{!editingId && ' *'}</span>
								<div className={styles.photoPicker}>
									<input
										id='student-photo'
										type='file'
										accept='image/jpeg,image/png,image/webp'
										onChange={handleImageChange}
										className={styles.photoInput}
										aria-label='Choose student photo'
										required={!editingId}
									/>
									<label htmlFor='student-photo' className={styles.choosePhoto}>
										Choose Photo
									</label>
									<span className={styles.photoFilename}>
										{selectedImageFile?.name ?? (editingId ? 'Current photo' : 'No photo selected')}
									</span>
								</div>
							</div>
							<label className={styles.formField}>
								<span className={styles.fieldLabel}>Student ID</span>
								<input
									type='text'
									name='displayId'
									value={formData.displayId}
									readOnly
									className={styles.goldInput}
									placeholder='Student ID (Auto Generated)'
								/>
							</label>
							<label className={styles.formField}>
								<span className={styles.fieldLabel}>Student Name *</span>
								<input
									type='text'
									name='name'
									value={formData.name}
									onChange={handleChange}
									className={styles.goldInput}
									placeholder='Student Name'
									required
								/>
							</label>
							<label className={styles.formField}>
								<span className={styles.fieldLabel}>Age *</span>
								<input
									type='number'
									name='dob'
									value={formData.dob}
									onChange={handleChange}
									className={styles.goldInput}
									placeholder='Age (e.g. 20)'
									min='0'
									max='150'
									required
								/>
							</label>
							<label className={styles.formField}>
								<span className={styles.fieldLabel}>Phone Number *</span>
								<input
									type='tel'
									name='phone'
									value={formData.phone}
									onChange={handleChange}
									className={styles.goldInput}
									placeholder='Phone Number'
									required
								/>
							</label>
							<label className={styles.formField}>
								<span className={styles.fieldLabel}>Batch{!editingId && ' *'}</span>
								{editingId ?
									<input
										type='text'
										readOnly
										value={
											students.find((student) => student.id === editingId)?.batchName ??
											`Batch ${formData.batch}`
										}
										className={styles.goldInput}
									/>
								:	<select
										name='batch'
										value={formData.batch}
										onChange={handleChange}
										className={styles.goldInput}
										disabled={batchesLoading}
										required>
										<option value=''>{batchesLoading ? 'Loading batches...' : 'Select Batch'}</option>
										{batches.map((batch) => (
											<option key={batch.id} value={batch.id}>
												{batch.name}
											</option>
										))}
									</select>
								}
							</label>
							<label className={styles.formField}>
								<span className={styles.fieldLabel}>Township *</span>
								<input
									type='text'
									name='town'
									value={formData.town}
									onChange={handleChange}
									className={styles.goldInput}
									placeholder='Township'
									required
								/>
							</label>
							<label className={styles.formField}>
								<span className={styles.fieldLabel}>Region/City *</span>
								<input
									type='text'
									name='city'
									value={formData.city}
									onChange={handleChange}
									className={styles.goldInput}
									placeholder='Region/City'
									required
								/>
							</label>

							<button type='submit' className={styles.btnConfirmForm}>
								{editingId ? 'Update Student' : 'Create Student'}
							</button>

							{editingId && (
								<button
									type='button'
									className={styles.btnCancelEdit}
									onClick={() => {
										setIsFormModalOpen(false);
										setEditingId(null);
										setSelectedImageFile(null);

										if (imagePreviewUrl) {
											URL.revokeObjectURL(imagePreviewUrl);
										}

										setImagePreviewUrl('');
									}}>
									Cancel
								</button>
							)}
						</form>
					</div>
				</div>
			)}

			{isDeleteModalOpen && (
				<div className={styles.modalOverlay} onClick={() => setIsDeleteModalOpen(false)}>
					<div className={styles.deleteModalContent} onClick={(e) => e.stopPropagation()}>
						<div className={styles.warningIconWrapper}>
							<svg
								width='24'
								height='24'
								viewBox='0 0 24 24'
								fill='none'
								stroke='#d32f2f'
								strokeWidth='2'
								strokeLinecap='round'
								strokeLinejoin='round'>
								<path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'></path>

								<line x1='12' y1='9' x2='12' y2='13'></line>

								<line x1='12' y1='17' x2='12.01' y2='17'></line>
							</svg>
						</div>

						<h2 className={styles.deleteTitle}>Are you sure?</h2>

						<p className={styles.deleteDesc}>
							This action cannot be undone. All values associated with this student will be lost.
						</p>

						<div className={styles.deleteActions}>
							<button className={styles.btnDeleteField} onClick={handleConfirmDelete}>
								Delete
							</button>

							<button className={styles.btnCancelField} onClick={() => setIsDeleteModalOpen(false)}>
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
