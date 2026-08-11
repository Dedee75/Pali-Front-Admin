"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import styles from "./homework-detail.module.css";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000";

const BACKEND_ORIGIN =
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN ??
  "http://localhost:3000";

type LoginUser = {
  id: number;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "TEACHER";
};

type HomeworkImage = {
  id: number;
  image: string;
  marks?: number | null;
  remark?: string | null;
};

type Submission = {
  id: number;
  status:
    | "PENDING"
    | "SUBMITTED"
    | "REVIEWED";
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
    totalMarks?: number | null;
    batch: {
      id: number;
      name: string;
    };
  };
};
 const DEFAULT_AVATAR =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
      <rect width="160" height="160" fill="#f3f4f6"/>
      <circle cx="80" cy="60" r="30" fill="#c9a227"/>
      <path d="M30 145c8-32 27-48 50-48s42 16 50 48" fill="#c9a227"/>
    </svg>
  `);

type ReviewValue = {
  imageId: number;
  marks: string;
  remark: string;
};

function HomeworkDetailsContent() {
  const router = useRouter();
  const searchParams =
    useSearchParams();

  const submissionId = Number(
    searchParams.get("submissionId"),
  );

  const [currentUser, setCurrentUser] =
    useState<LoginUser | null>(null);
  const [submission, setSubmission] =
    useState<Submission | null>(null);
  const [reviews, setReviews] =
    useState<ReviewValue[]>([]);

  const [
    savedImageIds,
    setSavedImageIds,
  ] = useState<Set<number>>(
    new Set(),
  );

  const [generalRemark, setGeneralRemark] =
    useState("");
  const [
    currentImageIndex,
    setCurrentImageIndex,
  ] = useState(0);
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [error, setError] =
    useState("");

  const apiFetch = useCallback(
    async (
      endpoint: string,
      options: RequestInit = {},
    ) => {
      const token =
        localStorage.getItem("accessToken");

      if (!token) {
        router.replace("/");
        throw new Error(
          "Please login first.",
        );
      }

      const headers =
        new Headers(options.headers);

      headers.set(
        "Content-Type",
        "application/json",
      );
      headers.set(
        "Authorization",
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
          "This homework is not assigned to your account.",
        );
      }

      if (!response.ok) {
        const message = Array.isArray(
          result?.message,
        )
          ? result.message.join(", ")
          : result?.message ??
            "Request failed.";

        throw new Error(message);
      }

      return result;
    },
    [router],
  );

  const loadSubmission =
    useCallback(async () => {
      if (
        !Number.isInteger(
          submissionId,
        ) ||
        submissionId <= 0
      ) {
        setError(
          "Invalid submission ID.",
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const result = await apiFetch(
          `/homework-submissions/teacher/assigned/${submissionId}`,
        );

        const data =
          (result?.data ??
            result) as Submission;

        setSubmission(data);
        setReviews(
          data.images.map(
            (image) => ({
              imageId: image.id,
              marks:
                image.marks ===
                  null ||
                image.marks ===
                  undefined
                  ? ""
                  : String(
                      image.marks,
                    ),
              remark:
                image.remark ?? "",
            }),
          ),
        );
        setSavedImageIds(
          new Set(
            data.images
              .filter(
                (image) =>
                  image.marks !== null &&
                  image.marks !== undefined,
              )
              .map(
                (image) => image.id,
              ),
          ),
        );

        setGeneralRemark(
          data.remark ?? "",
        );
        setCurrentImageIndex(0);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load homework.",
        );
      } finally {
        setLoading(false);
      }
    }, [
      apiFetch,
      submissionId,
    ]);

  useEffect(() => {
    const storedUser =
      localStorage.getItem("user");

    if (!storedUser) {
      router.replace("/");
      return;
    }

    try {
      const user =
        JSON.parse(
          storedUser,
        ) as LoginUser;

      if (user.role !== "TEACHER") {
        router.replace("/");
        return;
      }

      setCurrentUser(user);
      void loadSubmission();
    } catch {
      router.replace("/");
    }
  }, [
    loadSubmission,
    router,
  ]);

  const currentImage =
    submission?.images[
      currentImageIndex
    ];

  const currentReview =
    currentImage
      ? reviews.find(
          (review) =>
            review.imageId ===
            currentImage.id,
        )
      : undefined;

  useEffect(() => {
    if (!currentImage) return;

    document
      .getElementById(
        `homework-thumbnail-${currentImage.id}`,
      )
      ?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
  }, [currentImage]);

  const totalMarks = useMemo(
    () =>
      reviews.reduce(
        (total, review) =>
          total +
          (Number(review.marks) || 0),
        0,
      ),
    [reviews],
  );

  const updateCurrentReview = (
    field: "marks" | "remark",
    value: string,
  ) => {
    if (!currentImage) return;

    setReviews((previous) =>
      previous.map((review) =>
        review.imageId ===
        currentImage.id
          ? {
              ...review,
              [field]: value,
            }
          : review,
      ),
    );
  };

  const previousImage = () => {
    if (!submission) return;

    setCurrentImageIndex(
      (previous) =>
        (previous -
          1 +
          submission.images.length) %
        submission.images.length,
    );
  };

  const nextImage = () => {
    if (!submission) return;

    setCurrentImageIndex(
      (previous) =>
        (previous + 1) %
        submission.images.length,
    );
  };

    const handleLogout = () => {
    localStorage.removeItem(
      "accessToken",
    );
    localStorage.removeItem("user");
    router.replace("/");
  };

  const getImageUrl = (
    image: string,
  ) => {
    if (
      image.startsWith("http") ||
      image.startsWith("data:") ||
      image.startsWith("blob:")
    ) {
      return image;
    }

    const normalizedImage =
      image.replace(
        /^\/?uploads\/homeworks\//,
        "/uploads/homework/",
      );

    return `${BACKEND_ORIGIN}${
      normalizedImage.startsWith("/")
        ? normalizedImage
        : `/${normalizedImage}`
    }`;
  };

  const saveCurrentPageAndNext =
    async () => {
      if (
        !submission ||
        !currentImage ||
        !currentReview
      ) {
        return;
      }

      const marks =
        Number(
          currentReview.marks,
        );

      if (
        currentReview.marks.trim() ===
          "" ||
        !Number.isFinite(marks) ||
        marks < 0
      ) {
        setError(
          "Enter valid marks for the current page.",
        );
        return;
      }

      const projectedTotal =
        reviews.reduce(
          (total, review) =>
            total +
            (Number(
              review.marks,
            ) || 0),
          0,
        );

      if (
        submission.homework
          .totalMarks &&
        projectedTotal >
          submission.homework
            .totalMarks
      ) {
        setError(
          `Total cannot be greater than ${submission.homework.totalMarks}.`,
        );
        return;
      }

      setSaving(true);
      setError("");

      try {
        await apiFetch(
          `/homework-images/teacher/assigned/${currentImage.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              marks,
              remark:
                currentReview.remark.trim(),
            }),
          },
        );

        const nextSavedImageIds =
          new Set(
            savedImageIds,
          );

        nextSavedImageIds.add(
          currentImage.id,
        );

        setSavedImageIds(
          nextSavedImageIds,
        );

        const allPagesSaved =
          nextSavedImageIds.size >=
          submission.images.length;

        if (!allPagesSaved) {
          let nextIndex = -1;

          for (
            let offset = 1;
            offset <=
            submission.images.length;
            offset += 1
          ) {
            const candidateIndex =
              (currentImageIndex +
                offset) %
              submission.images.length;

            const candidateImage =
              submission.images[
                candidateIndex
              ];

            if (
              !nextSavedImageIds.has(
                candidateImage.id,
              )
            ) {
              nextIndex =
                candidateIndex;
              break;
            }
          }

          if (nextIndex >= 0) {
            setCurrentImageIndex(
              nextIndex,
            );
          }

          return;
        }

        await apiFetch(
          `/homework-submissions/teacher/assigned/${submission.id}/review`,
          {
            method: "PATCH",
            body: JSON.stringify({
              totalMarks:
                projectedTotal,
              remark:
                generalRemark.trim(),
            }),
          },
        );

        router.back();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to save this page review.",
        );
      } finally {
        setSaving(false);
      }
    };

  const isCurrentPageSaved =
    currentImage
      ? savedImageIds.has(
          currentImage.id,
        )
      : false;

  const isFinalUnsavedPage =
    currentImage &&
    submission
      ? !isCurrentPageSaved &&
        savedImageIds.size ===
          submission.images.length -
            1
      : false;

  if (loading) {
    return (
      <div
        style={{
          padding: "40px",
          textAlign: "center",
        }}
      >
        Loading Details...
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.navbar}>
        <div className={styles.navLeft}>
          <div
            className={styles.logoIcon}
          >
            A
          </div>
          <span
            className={styles.brandName}
          >
            Dhamma Teacher
          </span>
        </div>

        <div className={styles.navRight}>
          <img src={DEFAULT_AVATAR} alt="Profile" className={styles.profileImg} />
          <span
            className={styles.profileName}
          >
            {currentUser?.name ??
              "Super Admin"}
          </span>
           <button
            type="button"
            className={
              styles.logoutBtn
            }
            onClick={handleLogout}
            title="Logout"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#b8860b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 0-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line
                x1="21"
                y1="12"
                x2="9"
                y2="12"
              />
            </svg>
          </button>
        </div>
      </header>

      <main
        className={styles.mainContent}
      >
        <div
          className={
            styles.backBtnContainer
          }
        >
          <button
            type="button"
            className={
              styles.bigBackBtn
            }
            onClick={() =>
              router.back()
            }
          >
            Back to Homework List
          </button>
        </div>

        {error && (
          <div
            style={{
              color: "#dc2626",
              background:
                "#fef2f2",
              padding:
                "12px 14px",
              borderRadius: "8px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        {!submission ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
            }}
          >
            Homework not found or not
            assigned to you.
          </div>
        ) : (
          <div
            className={
              styles.gridLayout
            }
          >
            <div
              className={
                styles.imagePanel
              }
            >
              <div
                className={
                  styles.imageViewerSection
                }
              >
                <button
                  type="button"
                  className={
                    styles.navArrow
                  }
                  onClick={previousImage}
                  disabled={
                    submission.images
                      .length <= 1
                  }
                  aria-label="Previous homework image"
                >
                  ‹
                </button>

                <div
                  className={
                    styles.imageWrapper
                  }
                >
                  {currentImage ? (
                    <img
                      src={getImageUrl(
                        currentImage.image,
                      )}
                      alt={`Homework page ${currentImageIndex + 1}`}
                      className={
                        styles.homeworkImg
                      }
                    />
                  ) : (
                    <div
                      className={
                        styles.emptyImage
                      }
                    >
                      No image uploaded.
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className={
                    styles.navArrow
                  }
                  onClick={nextImage}
                  disabled={
                    submission.images
                      .length <= 1
                  }
                  aria-label="Next homework image"
                >
                  ›
                </button>
              </div>

              {submission.images.length >
                0 && (
                <div
                  className={
                    styles.thumbnailSection
                  }
                >
                  <div
                    className={
                      styles.thumbnailHeader
                    }
                  >
                    <span>
                      Homework Pages
                    </span>

                    <span>
                      {savedImageIds.size} /{" "}
                      {
                        submission.images
                          .length
                      }{" "}
                      checked
                    </span>
                  </div>

                  <div
                    className={
                      styles.thumbnailStrip
                    }
                  >
                    {submission.images.map(
                      (
                        image,
                        imageIndex,
                      ) => {
                        const isActive =
                          imageIndex ===
                          currentImageIndex;

                        const isSaved =
                          savedImageIds.has(
                            image.id,
                          );

                        return (
                          <button
                            id={`homework-thumbnail-${image.id}`}
                            key={
                              image.id
                            }
                            type="button"
                            className={`${styles.thumbnailButton} ${
                              isActive
                                ? styles.thumbnailActive
                                : ""
                            } ${
                              isSaved
                                ? styles.thumbnailReviewed
                                : ""
                            }`}
                            onClick={() =>
                              setCurrentImageIndex(
                                imageIndex,
                              )
                            }
                            aria-label={`Open homework page ${imageIndex + 1}`}
                            aria-current={
                              isActive
                                ? "true"
                                : undefined
                            }
                          >
                            <img
                              src={getImageUrl(
                                image.image,
                              )}
                              alt=""
                              className={
                                styles.thumbnailImg
                              }
                            />

                            <span
                              className={
                                styles.thumbnailNumber
                              }
                            >
                              {imageIndex + 1}
                            </span>

                            {isSaved && (
                              <span
                                className={
                                  styles.thumbnailCheck
                                }
                                aria-label="Reviewed"
                              >
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
              )}
            </div>

            <div
              className={
                styles.gradingSection
              }
            >
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
                  <strong>Name:</strong>{" "}
                  {
                    submission.student
                      .name
                  }
                </div>

                <div
                  className={
                    styles.infoRow
                  }
                >
                  <strong>
                    Student ID:
                  </strong>{" "}
                  {
                    submission.student
                      .studentCode
                  }
                </div>

                <div
                  className={
                    styles.infoRow
                  }
                >
                  <strong>Batch:</strong>{" "}
                  {
                    submission.homework
                      .batch.name
                  }
                </div>

                <div
                  className={
                    styles.infoRow
                  }
                >
                  <strong>
                    Submitted:
                  </strong>{" "}
                  {submission.submittedAt
                    ? new Date(
                        submission.submittedAt,
                      ).toLocaleString()
                    : "-"}
                </div>

                <hr
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
                  </strong>{" "}
                  {
                    submission.homework
                      .title
                  }
                </div>

                <div
                  className={
                    styles.infoRowText
                  }
                >
                  {submission.homework
                    .description ??
                    "-"}
                </div>
              </div>

              <div
                className={
                  styles.gradingCard
                }
              >
                <div
                  style={{
                    marginBottom:
                      "12px",
                    fontWeight: 700,
                  }}
                >
                  Page{" "}
                  {currentImageIndex +
                    1}{" "}
                  /{" "}
                  {
                    submission.images
                      .length
                  }
                </div>

                <div
                  className={
                    styles.formGroup
                  }
                >
                  <label
                    className={
                      styles.formLabel
                    }
                  >
                    Page Marks
                  </label>

                  <input
                    type="number"
                    min={0}
                    className={
                      styles.textArea
                    }
                    value={
                      currentReview?.marks ??
                      ""
                    }
                    onChange={(event) =>
                      updateCurrentReview(
                        "marks",
                        event.target
                          .value,
                      )
                    }
                  />
                </div>

                <div
                  className={
                    styles.formGroup
                  }
                >
                  <label
                    className={
                      styles.formLabel
                    }
                  >
                    Page Comment
                  </label>

                  <textarea
                    className={
                      styles.textArea
                    }
                    rows={3}
                    value={
                      currentReview?.remark ??
                      ""
                    }
                    onChange={(event) =>
                      updateCurrentReview(
                        "remark",
                        event.target
                          .value,
                      )
                    }
                  />
                </div>

                <div
                  className={
                    styles.formGroup
                  }
                >
                  <label
                    className={
                      styles.formLabel
                    }
                  >
                    General Comment
                  </label>

                  <textarea
                    className={
                      styles.textArea
                    }
                    rows={4}
                    value={
                      generalRemark
                    }
                    onChange={(event) =>
                      setGeneralRemark(
                        event.target
                          .value,
                      )
                    }
                  />
                </div>

                <div
                  style={{
                    marginBottom:
                      "14px",
                    fontWeight: 700,
                  }}
                >
                  Total: {totalMarks}
                  {submission.homework
                    .totalMarks
                    ? ` / ${submission.homework.totalMarks}`
                    : ""}
                </div>

                <div
                  className={
                    styles.actionButtons
                  }
                >
                  <button
                    type="button"
                    className={
                      styles.btnReject
                    }
                    onClick={() =>
                      router.back()
                    }
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className={
                      styles.btnApprove
                    }
                    onClick={() =>
                      void saveCurrentPageAndNext()
                    }
                    disabled={
                      saving ||
                      !currentImage
                    }
                  >
                    {saving
                      ? "Saving..."
                      : isFinalUnsavedPage
                        ? "Finish Review"
                        : isCurrentPageSaved
                          ? "Update & Next"
                          : "Save & Next"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer
        className={styles.footer}
      >
        O-Technique-Myanmar-2026@
      </footer>
    </div>
  );
}

export default function HomeworkDetailsPage() {
  return (
    <Suspense
      fallback={
        <div>
          Loading Details...
        </div>
      }
    >
      <HomeworkDetailsContent />
    </Suspense>
  );
}