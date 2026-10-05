/** @format */

'use client';

import {
	Suspense,
	useCallback,
	useEffect,
	useState,
} from 'react';
import {
	useRouter,
	useSearchParams,
} from 'next/navigation';
import { confirmAction } from '../lib/dialog';
import MobileNavigation from './MobileNavigation';
import styles from '../app/teacher/homework-details/homework-detail.module.css';

const API_URL =
	process.env.NEXT_PUBLIC_API_URL ??
	'http://localhost:3000';

const BACKEND_ORIGIN = (
	process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim() ||
	API_URL
).replace(/\/+$/, '');

type LoginUser = {
	id: number;
	name: string;
	email: string;
	role: 'SUPER_ADMIN' | 'TEACHER';
};

type HomeworkImage = {
	id: number;
	image: string;
	marks?: number | null;
	reviewedAt?: string | null;
	remark?: string | null;
};

type Submission = {
	id: number;
	status: 'PENDING' | 'SUBMITTED' | 'REVIEWED';
	submittedAt?: string | null;
	totalMarks?: number | null;
	remark?: string | null;

	student: {
		id: number;
		name: string;
		studentCode: string;
	};

	images: HomeworkImage[];

	homework: {
		id: number;
		title: string;
		description?: string | null;
		attachment?: string | null;
		attachmentName?: string | null;
		totalMarks?: number | null;

		batch: {
			id: number;
			name: string;
		};
	};
};

type ReviewValue = {
	imageId: number;
	marks: string;
	remark: string;
};

type PreviewImage = {
	id: number;
	url: string;
	alt: string;
};

function HomeworkDetailsContent({
	admin = false,
}: {
	admin?: boolean;
}) {
	const router = useRouter();
	const searchParams = useSearchParams();

	const submissionId = Number(
		searchParams.get('submissionId'),
	);

	const [currentUser, setCurrentUser] =
		useState<LoginUser | null>(null);

	const [submission, setSubmission] =
		useState<Submission | null>(null);

	const [reviews, setReviews] = useState<
		ReviewValue[]
	>([]);

	const [generalRemark, setGeneralRemark] =
		useState('');

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	/* ========================================
	   IMAGE PREVIEW
	   ======================================== */

	const [previewImage, setPreviewImage] =
		useState<PreviewImage | null>(null);
	const [isMobileView, setIsMobileView] = useState(false);

	useEffect(() => {
		const media = window.matchMedia('(max-width: 900px)');
		const updateMobileView = () => {
			setIsMobileView(media.matches);
			if (media.matches) setPreviewImage(null);
		};
		updateMobileView();
		media.addEventListener('change', updateMobileView);
		return () => media.removeEventListener('change', updateMobileView);
	}, []);

	/* ========================================
	   IMAGE ROTATIONS

	   Example:
	   {
		   1: 90,
		   2: 180
	   }

	   Each image has its own rotation.
	   ======================================== */

	const [imageRotations, setImageRotations] =
		useState<Record<number, number>>({});

	const DEFAULT_AVATAR =
		'data:image/svg+xml;charset=UTF-8,' +
		encodeURIComponent(`
			<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
				<rect width="160" height="160" fill="#f3f4f6"/>
				<circle cx="80" cy="60" r="30" fill="#c9a227"/>
				<path d="M30 145c8-32 27-48 50-48s42 16 50 48" fill="#c9a227"/>
			</svg>
		`);

	/* ========================================
	   API
	   ======================================== */

	const apiFetch = useCallback(
		async (
			endpoint: string,
			options: RequestInit = {},
		) => {
			const token =
				sessionStorage.getItem(
					'accessToken',
				);

			if (!token) {
				router.replace('/');

				throw new Error(
					'Please login first.',
				);
			}

			const headers = new Headers(
				options.headers,
			);

			headers.set(
				'Content-Type',
				'application/json',
			);

			headers.set(
				'Authorization',
				`Bearer ${token}`,
			);

			const response = await fetch(
				`${API_URL}${endpoint}`,
				{
					...options,
					headers,
				},
			);

			const result = await response
				.json()
				.catch(() => null);

			if (
				response.status === 401 ||
				response.status === 403
			) {
				throw new Error(
					'This homework is not assigned to your account.',
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

	/* ========================================
	   LOAD SUBMISSION
	   ======================================== */

	const loadSubmission =
		useCallback(async () => {
			if (
				!Number.isInteger(
					submissionId,
				) ||
				submissionId <= 0
			) {
				setError(
					'Invalid submission ID.',
				);

				setLoading(false);
				return;
			}

			setLoading(true);
			setError('');

			try {
				const result =
					await apiFetch(
						admin
							? `/homework-submissions/${submissionId}`
							: `/homework-submissions/teacher/assigned/${submissionId}`,
					);

				const data = (
					result?.data ?? result
				) as Submission;

				setSubmission(data);

				setReviews(
					data.images.map(
						(image) => ({
							imageId:
								image.id,

							marks:
								image.marks !==
									null &&
								image.marks !==
									undefined
									? String(
											image.marks,
										)
									: '',

							remark:
								image.remark ??
								'',
						}),
					),
				);

				setGeneralRemark(
					data.remark ?? '',
				);
			} catch (err) {
				setError(
					err instanceof Error
						? err.message
						: 'Failed to load homework.',
				);
			} finally {
				setLoading(false);
			}
		}, [
			apiFetch,
			submissionId,
			admin,
		]);

	/* ========================================
	   LOGIN CHECK
	   ======================================== */

	useEffect(() => {
		const storedUser =
			sessionStorage.getItem('user');

		if (!storedUser) {
			router.replace('/');
			return;
		}

		try {
			const user = JSON.parse(
				storedUser,
			) as LoginUser;

			if (
				user.role !==
				(admin
					? 'SUPER_ADMIN'
					: 'TEACHER')
			) {
				router.replace('/');
				return;
			}

			setCurrentUser(user);

			void loadSubmission();
		} catch {
			router.replace('/');
		}
	}, [
		loadSubmission,
		router,
		admin,
	]);

	/* ========================================
	   REFRESH CHANGED STUDENT IMAGES
	   ======================================== */

	useEffect(() => {
		if (!submission || saving) {
			return;
		}

		let active = true;
		let pending = false;

		const refresh = async () => {
			if (
				pending ||
				document.visibilityState !==
					'visible'
			) {
				return;
			}

			pending = true;

			try {
				const result =
					await apiFetch(
						admin
							? `/homework-submissions/${submissionId}`
							: `/homework-submissions/teacher/assigned/${submissionId}`,
					);

				const updated = (
					result?.data ?? result
				) as Submission;

				const oldImages =
					submission.images.map(
						(image) => [
							image.id,
							image.image,
						],
					);

				const newImages =
					updated.images.map(
						(image) => [
							image.id,
							image.image,
						],
					);

				if (
					active &&
					JSON.stringify(
						newImages,
					) !==
						JSON.stringify(
							oldImages,
						)
				) {
					setSubmission(updated);

					setReviews(
						(previous) =>
							updated.images.map(
								(image) =>
									previous.find(
										(
											review,
										) =>
											review.imageId ===
											image.id,
									) ?? {
										imageId:
											image.id,

										marks:
											image.marks ==
											null
												? ''
												: String(
														image.marks,
													),

										remark:
											image.remark ??
											'',
									},
							),
					);

					/* Remove rotation state for
					   deleted images */

					setImageRotations(
						(previous) => {
							const next: Record<
								number,
								number
							> = {};

							for (const image of updated.images) {
								if (
									previous[
										image.id
									] !==
									undefined
								) {
									next[
										image.id
									] =
										previous[
											image.id
										];
								}
							}

							return next;
						},
					);
				}
			} catch {
				/* Explicit load/save reports errors */
			} finally {
				pending = false;
			}
		};

		const timer =
			window.setInterval(
				() => void refresh(),
				5000,
			);

		window.addEventListener(
			'focus',
			refresh,
		);

		return () => {
			active = false;

			window.clearInterval(timer);

			window.removeEventListener(
				'focus',
				refresh,
			);
		};
	}, [
		submission,
		saving,
		apiFetch,
		admin,
		submissionId,
	]);

	/* ========================================
	   UPDATE REVIEW
	   ======================================== */

	const updateReview = (
		imageId: number,
		field: 'marks' | 'remark',
		value: string,
	) => {
		setReviews((previous) =>
			previous.map((review) =>
				review.imageId === imageId
					? {
							...review,
							[field]: value,
						}
					: review,
			),
		);
	};

	/* ========================================
	   ROTATE IMAGE
	   ======================================== */

	const rotateImage = (
		imageId: number,
		direction: 'left' | 'right',
	) => {
		setImageRotations(
			(previous) => {
				const currentRotation =
					previous[imageId] ?? 0;

				const change =
					direction ===
					'right'
						? 90
						: -90;

				const nextRotation =
					(
						currentRotation +
						change +
						360
					) % 360;

				return {
					...previous,
					[imageId]:
						nextRotation,
				};
			},
		);
	};

	/* ========================================
	   OPEN IMAGE PREVIEW
	   ======================================== */

	const openImagePreview = (
		image: HomeworkImage,
		index: number,
	) => {
		if (window.matchMedia('(max-width: 900px)').matches) return;
		setPreviewImage({
			id: image.id,
			url: getImageUrl(
				image.image,
			),
			alt: `Homework page ${
				index + 1
			}`,
		});
	};

	/* ========================================
	   CLOSE PREVIEW
	   ======================================== */

	const closeImagePreview = () => {
		setPreviewImage(null);
	};

	/* ========================================
	   CLOSE PREVIEW WITH ESC KEY
	   ======================================== */

	useEffect(() => {
		if (!previewImage) {
			return;
		}

		const handleKeyDown = (
			event: KeyboardEvent,
		) => {
			if (
				event.key === 'Escape'
			) {
				setPreviewImage(null);
			}
		};

		window.addEventListener(
			'keydown',
			handleKeyDown,
		);

		return () => {
			window.removeEventListener(
				'keydown',
				handleKeyDown,
			);
		};
	}, [previewImage]);

	/* ========================================
	   LOGOUT
	   ======================================== */

	const handleLogout = () => {
		sessionStorage.removeItem(
			'accessToken',
		);

		sessionStorage.removeItem('user');

		router.replace('/');
	};

	/* ========================================
	   IMAGE URL
	   ======================================== */

	const getImageUrl = (
		image: string,
	) => {
		if (
			image.startsWith('http') ||
			image.startsWith('data:') ||
			image.startsWith('blob:')
		) {
			return image;
		}

		const normalizedImage =
			image.replace(
				/^\/?uploads\/homeworks\//,
				'/uploads/homework/',
			);

		return `${BACKEND_ORIGIN}${
			normalizedImage.startsWith('/')
				? normalizedImage
				: `/${normalizedImage}`
		}`;
	};

	/* ========================================
	   FINISH REVIEW
	   ======================================== */

	const handleFinishReview =
		async () => {
			if (!submission) {
				return;
			}

			const clearingMarks = reviews.every((review) => review.marks.trim() === '');

			/* Validate marks */

			for (
				let index = 0;
				index < reviews.length;
				index += 1
			) {
				const review =
					reviews[index];

				if (
					!clearingMarks && review.marks.trim() ===
					''
				) {
					setError(
						`Please enter marks for Page ${
							index + 1
						}.`,
					);

					return;
				}

				const marks = Number(
					review.marks,
				);

				if (
					!Number.isInteger(marks) ||
					marks < 0
				) {
					setError(
						`Please enter valid marks for Page ${
							index + 1
						}.`,
					);

					return;
				}
			}

            if (submission.homework.totalMarks != null && earnedMarks > submission.homework.totalMarks) {
                setError(`Earned marks cannot exceed the total marks (${submission.homework.totalMarks}).`);
                return;
            }

			if (
				!(
					await confirmAction(
						'update',
						'this homework review',
					)
				)
			) {
				return;
			}

			setSaving(true);
			setError('');

			try {
				/* Save General Comment */

				await apiFetch(
					admin
						? `/homework-submissions/admin/${submission.id}/review`
						: `/homework-submissions/teacher/assigned/${submission.id}/review`,
					{
						method: 'PATCH',

						body: JSON.stringify(
							{
                                pages: reviews.map(review => ({
                                    imageId: review.imageId,
                                    marks: clearingMarks ? null : Number(review.marks),
                                    remark: review.remark.trim(),
                                })),
								remark:
									generalRemark.trim(),
							},
						),
					},
				);

				router.back();
			} catch (err) {
				setError(
					err instanceof Error
						? err.message
						: 'Failed to save homework review.',
				);
			} finally {
				setSaving(false);
			}
		};

	const earnedMarks = reviews.reduce((total, review) => {
		const marks = Number(review.marks);
		return total + (Number.isFinite(marks) && marks >= 0 ? marks : 0);
	}, 0);
    const marksChanged = submission?.status === 'REVIEWED' && reviews.some(review => {
        const original = submission.images.find(image => image.id === review.imageId)?.marks ?? null;
        const current = review.marks.trim() === '' ? null : Number(review.marks);
        return original !== current;
    });

	/* ========================================
	   LOADING
	   ======================================== */

	if (loading) {
		return (
			<div
				style={{
					padding: '40px',
					textAlign: 'center',
				}}
			>
				Loading Details...
			</div>
		);
	}

	/* ========================================
	   UI
	   ======================================== */

	return (
		<div className={styles.container}>
			{/* NAVBAR */}

			<header
				className={styles.navbar}
			>
				<div
					className={
						styles.navLeft
					}
				>
					<MobileNavigation />

					<div
						className={
							styles.logoIcon
						}
					>
						A
					</div>

					<span
						className={
							styles.brandName
						}
					>
						Dhamma{' '}
						{admin
							? 'Admin'
							: 'Teacher'}
					</span>
				</div>

				<div
					className={
						styles.navRight
					}
				>
					<img
						src={
							DEFAULT_AVATAR
						}
						alt='Profile'
						className={
							styles.profileImg
						}
					/>

					<span
						className={
							styles.profileName
						}
					>
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
					>
						<svg
							width='20'
							height='20'
							viewBox='0 0 24 24'
							fill='none'
							stroke='#b8860b'
							strokeWidth='2'
							strokeLinecap='round'
							strokeLinejoin='round'
						>
							<path d='M9 21H5a2 2 0 0 0-2-2V5a2 2 0 0 1 2-2h4' />

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

			{/* MAIN */}

			<main
				className={
					styles.mainContent
				}
			>
				<div
					className={
						styles.backBtnContainer
					}
				>
					<button
						type='button'
						className={
							styles.bigBackBtn
						}
						onClick={() =>
							router.back()
						}
					>
						← Back to Homework
						List
					</button>
				</div>

				{/* ERROR */}

				{error && (
					<div
						className={
							styles.errorMessage
						}
					>
						{error}
					</div>
				)}

				{!submission ? (
					<div
						className={
							styles.emptyState
						}
					>
						Homework not found or
						not assigned to you.
					</div>
				) : (
					<div
						className={
							styles.reviewLayout
						}
					>
						{/* =====================
						    HOMEWORK PAGES
						    ===================== */}

						<div
							tabIndex={0}
							role='region'
							aria-label='Homework pages'
							className={
								styles.pagesColumn
							}
						>
							{submission.images
								.length === 0 ? (
								<div
									className={
										styles.emptyImage
									}
								>
									No image
									uploaded.
								</div>
							) : (
								submission.images.map(
									(
										image,
										index,
									) => {
										const review =
											reviews.find(
												(
													item,
												) =>
													item.imageId ===
													image.id,
											);

										const rotation =
											imageRotations[
												image
													.id
											] ??
											0;

										return (
											<section
												key={
													image.id
												}
												className={
													styles.pageReview
												}
											>
												{/* PAGE HEADER */}

												<div
													className={
														styles.pageHeader
													}
												>
													<span>
														Homework
														Page{' '}
														{index +
															1}
													</span>

													<span
														className={
															styles.pageCount
														}
													>
														Page{' '}
														{index +
															1}{' '}
														/{' '}
														{
															submission
																.images
																.length
														}
													</span>
												</div>

												{/* IMAGE */}

												<div
													className={
														styles.pageImageWrapper
													}
												>
													<button
														type='button'
														className={
															styles.imageButton
														}
														onClick={() =>
															openImagePreview(
																image,
																index,
															)
														}
														disabled={isMobileView}
														title={isMobileView ? undefined : 'Click to enlarge image'}
													>
														<img
															src={getImageUrl(
																image.image,
															)}
															alt={`Homework page ${
																index +
																1
															}`}
															className={
																styles.pageImage
															}
															style={{
																transform: `rotate(${rotation}deg)`,
															}}
														/>
													</button>
												</div>

												{/* ROTATE */}

												<div
													className={
														styles.rotateControls
													}
												>
													<button
														type='button'
														className={
															styles.rotateButton
														}
														onClick={() =>
															rotateImage(
																image.id,
																'left',
															)
														}
													>
														<span
															className={
																styles.rotateIcon
															}
														>
															↶
														</span>

														Rotate
														Left
													</button>

													<span
														className={
															styles.rotationValue
														}
													>
														{
															rotation
														}
														°
													</span>

													<button
														type='button'
														className={
															styles.rotateButton
														}
														onClick={() =>
															rotateImage(
																image.id,
																'right',
															)
														}
													>
														Rotate
														Right

														<span
															className={
																styles.rotateIcon
															}
														>
															↷
														</span>
													</button>
												</div>

												{/* MARKS + PAGE COMMENT */}

												<div
													className={
														styles.pageReviewInputs
													}
												>
													<div
														className={
															styles.marksField
														}
													>
														<label
															htmlFor={`marks-${image.id}`}
														>
															Marks
														</label>

														<input
															id={`marks-${image.id}`}
															type='number'
															min='0'
															step='1'
															placeholder='0'
															value={
																review?.marks ??
																''
															}
															onChange={(
																event,
															) =>
																updateReview(
																	image.id,
																	'marks',
																	event
																		.target
																		.value,
																)
															}
														/>
													</div>

													<div
														className={
															styles.pageCommentField
														}
													>
														<label
															htmlFor={`comment-${image.id}`}
														>
															Page
															Comment
														</label>

														<textarea
															id={`comment-${image.id}`}
															rows={
																3
															}
															placeholder='Write page comment...'
															value={
																review?.remark ??
																''
															}
															onChange={(
																event,
															) =>
																updateReview(
																	image.id,
																	'remark',
																	event
																		.target
																		.value,
																)
															}
														/>
													</div>
												</div>
											</section>
										);
									},
								)
							)}
						</div>

						{/* =====================
						    RIGHT PANEL
						    ===================== */}

						<aside
							className={
								styles.rightPanel
							}
						>
							<div
								className={
									styles.stickyPanel
								}
							>
								{/* STUDENT INFO */}

								<div
									className={
										styles.infoCard
									}
								>
									<h3
										className={
											styles.cardHeader
										}
									>
										Student Info
									</h3>

									<div
										className={
											styles.infoRow
										}
									>
										<strong>
											Name:
										</strong>{' '}
										{
											submission
												.student
												.name
										}
									</div>

									<div
										className={
											styles.infoRow
										}
									>
										<strong>
											Student
											ID:
										</strong>{' '}
										{
											submission
												.student
												.studentCode
										}
									</div>

									<div
										className={
											styles.infoRow
										}
									>
										<strong>
											Batch:
										</strong>{' '}
										{
											submission
												.homework
												.batch
												.name
										}
									</div>

									<div
										className={
											styles.infoRow
										}
									>
										<strong>
											Submitted:
										</strong>{' '}

										{submission.submittedAt
											? new Date(
													submission.submittedAt,
												).toLocaleString()
											: '-'}
									</div>

									<div
										className={
											styles.divider
										}
									/>

									<h3
										className={
											styles.cardHeader
										}
									>
										Assignment
									</h3>

									<div
										className={
											styles.infoRow
										}
									>
										<strong>
											Title:
										</strong>{' '}
										{
											submission
												.homework
												.title
										}
									</div>

									<div
										className={
											styles.infoRowText
										}
									>
										{submission
											.homework
											.description ??
											'-'}
									</div>

									{submission
										.homework
										.attachment && (
										<a
											className={
												styles.attachmentLink
											}
											href={getImageUrl(
												submission
													.homework
													.attachment,
											)}
											target='_blank'
											rel='noopener noreferrer'
										>
											📎{' '}
											{submission
												.homework
												.attachmentName ||
												'Homework attachment'}
										</a>
									)}
								</div>

								{/* GENERAL COMMENT */}

								<div
									className={
										styles.gradingCard
									}
								>
									<div
										className={
											styles.formGroup
										}
									>
                                        <div className={styles.marksSummary} aria-live='polite'>
                                            <div><span>ပေးမှတ် :</span><strong>{submission.homework.totalMarks ?? '—'}</strong></div>
                                            <div><span>ရမှတ် :</span><strong>{earnedMarks}</strong></div>
                                        </div>

										<label
											className={
												styles.formLabel
											}
										>
											General
											Comment
										</label>

										<textarea
											className={
												styles.textArea
											}
											rows={6}
											placeholder='Write general comment...'
											value={
												generalRemark
											}
											onChange={(
												event,
											) =>
												setGeneralRemark(
													event
														.target
														.value,
												)
											}
										/>
									</div>

									<div
										className={
											styles.actionButtons
										}
									>
										<button
											type='button'
											className={
												styles.btnApprove
											}
											onClick={() =>
												void handleFinishReview()
											}
											disabled={
												saving ||
												submission
													.images
													.length ===
													0
											}
										>
											{saving
												? 'Saving...'
												: marksChanged ? 'Update' : 'Finish Review'}
										</button>

										<button
											type='button'
											className={
												styles.btnReject
											}
											onClick={() =>
												router.back()
											}
											disabled={
												saving
											}
										>
											Cancel
										</button>
									</div>
								</div>
							</div>
						</aside>
					</div>
				)}
			</main>

			<footer
				className={styles.footer}
			>
				O-Technique-Myanmar-2026@
			</footer>

			{/* ========================================
			    FULL SCREEN IMAGE PREVIEW
			    ======================================== */}

			{previewImage && (
				<div
					className={
						styles.imagePreviewOverlay
					}
					role='dialog'
					aria-modal='true'
					aria-label='Homework image preview'
					onClick={
						closeImagePreview
					}
				>
					<button
						type='button'
						className={
							styles.imagePreviewClose
						}
						onClick={
							closeImagePreview
						}
						aria-label='Close image preview'
					>
						×
					</button>

					<div
						className={
							styles.imagePreviewContent
						}
						onClick={(
							event,
						) =>
							event.stopPropagation()
						}
					>
						<img
							src={
								previewImage.url
							}
							alt={
								previewImage.alt
							}
							className={
								styles.imagePreviewImage
							}
							style={{
								transform: `rotate(${
									imageRotations[
										previewImage
											.id
									] ?? 0
								}deg)`,
							}}
						/>
					</div>

					{/* Preview Rotate Buttons */}

					<div
						className={
							styles.previewRotateControls
						}
						onClick={(
							event,
						) =>
							event.stopPropagation()
						}
					>
						<button
							type='button'
							onClick={() =>
								rotateImage(
									previewImage.id,
									'left',
								)
							}
						>
							↶ Rotate Left
						</button>

						<span>
							{imageRotations[
								previewImage
									.id
							] ?? 0}
							°
						</span>

						<button
							type='button'
							onClick={() =>
								rotateImage(
									previewImage.id,
									'right',
								)
							}
						>
							Rotate Right ↷
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

export default function HomeworkDetailsPage({
	admin = false,
}: {
	admin?: boolean;
}) {
	return (
		<Suspense
			fallback={
				<div>
					Loading Details...
				</div>
			}
		>
			<HomeworkDetailsContent
				admin={admin}
			/>
		</Suspense>
	);
}
