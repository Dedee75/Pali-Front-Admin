"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import styles from "./student.module.css";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

const API_URL =
  API_BASE_URL;

const PAGE_SIZE = 10;

type UserRole =
  | "SUPER_ADMIN"
  | "TEACHER";

type LoginUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

type Feedback = {
  submissionId: number;
  homeworkId: number;
  homeworkTitle: string;
  mark: number | null;
  maximumMark: number | null;
  comment: string | null;
  reviewedAt: string | null;
};

type StudentData = {
  id: number;
  studentCode: string;
  name: string;
  batchId: number;
  batchName: string;
  phone: string | null;
  township: string | null;
  region: string | null;
  image?: string | null;
  imagePath?: string | null;
  imageUrl?: string | null;
  feedback: Feedback[];
};

type DatabaseStudent = {
  id: number;
  studentCode: string;
  image: string | null;
};

function getArray<T>(
  value: unknown,
): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (
    value &&
    typeof value === "object" &&
    "data" in value &&
    Array.isArray(
      (value as { data?: unknown }).data,
    )
  ) {
    return (
      value as { data: T[] }
    ).data;
  }

  return [];
}

function getErrorMessage(
  value: unknown,
  fallback: string,
): string {
  if (
    value &&
    typeof value === "object" &&
    "message" in value
  ) {
    const message = (
      value as {
        message?: unknown;
      }
    ).message;

    if (
      typeof message === "string"
    ) {
      return message;
    }

    if (
      Array.isArray(message)
    ) {
      return message.join(", ");
    }
  }

  return fallback;
}

const DEFAULT_STUDENT_IMAGE =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
      <rect width="160" height="160" fill="#f3f4f6"/>
      <circle cx="80" cy="60" r="30" fill="#c9a227"/>
      <path d="M30 145c8-32 27-48 50-48s42 16 50 48" fill="#c9a227"/>
    </svg>
  `);

function resolveImageUrl(
  value:
    | string
    | null
    | undefined,
): string {
  const image =
    String(
      value ?? "",
    ).trim();

  if (!image) {
    return DEFAULT_STUDENT_IMAGE;
  }

  if (
    image.startsWith(
      "http://",
    ) ||
    image.startsWith(
      "https://",
    ) ||
    image.startsWith(
      "data:image/",
    ) ||
    image.startsWith(
      "blob:",
    )
  ) {
    return image;
  }

  if (
    image.startsWith(
      "/",
    )
  ) {
    return `${API_BASE_URL}${image}`;
  }

  return `${API_BASE_URL}/${image}`;
}

function getStudentImage(
  student:
    StudentData,
): string {
  return resolveImageUrl(
    student.image ??
      student.imagePath ??
      student.imageUrl ??
      null,
  );
}

function formatReviewedDate(
  value: string | null,
): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleString();
}

export default function TeacherStudentPage() {
  const router = useRouter();

  const [
    currentUser,
    setCurrentUser,
  ] =
    useState<LoginUser | null>(
      null,
    );

  const [
    students,
    setStudents,
  ] =
    useState<StudentData[]>([]);

  const [
    selectedStudent,
    setSelectedStudent,
  ] =
    useState<StudentData | null>(
      null,
    );

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const apiFetch = useCallback(
    async (
      endpoint: string,
      options: RequestInit = {},
    ) => {
      const token =
        localStorage.getItem(
          "accessToken",
        );

      if (!token) {
        router.replace("/");
        throw new Error(
          "Please login first.",
        );
      }

      const headers =
        new Headers(
          options.headers,
        );

      headers.set(
        "Accept",
        "application/json",
      );

      headers.set(
        "Authorization",
        `Bearer ${token.trim()}`,
      );

      const response =
        await fetch(
          `${API_URL}${endpoint}`,
          {
            ...options,
            headers,
            cache:
              "no-store",
          },
        );

      const result =
        await response
          .json()
          .catch(
            () => null,
          );

      if (
        response.status === 401
      ) {
        localStorage.removeItem(
          "accessToken",
        );

        localStorage.removeItem(
          "user",
        );

        router.replace("/");

        throw new Error(
          getErrorMessage(
            result,
            "Your login session has expired.",
          ),
        );
      }

      if (
        response.status === 403
      ) {
        throw new Error(
          getErrorMessage(
            result,
            "Teacher permission is required.",
          ),
        );
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            result,
            "Failed to load students.",
          ),
        );
      }

      return result;
    },
    [router],
  );

  const loadStudents =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        /*
         * 1. Load only the students that belong on the
         *    Teacher Students page.
         */
        const teacherResult =
          await apiFetch(
            "/homework-submissions/teacher/students",
          );

        const teacherStudents =
          getArray<StudentData>(
            teacherResult,
          );

        /*
         * 2. Load the main Student database list used by
         *    Admin /students.
         *
         *    This is intentional:
         *    some teacher-student endpoints return the
         *    student data but omit/null the image field.
         *
         *    We merge by student.id so Teacher uses the
         *    exact same database image as Admin.
         */
        let databaseStudents:
          DatabaseStudent[] = [];

        try {
          const databaseResult =
            await apiFetch(
              "/students",
            );

          databaseStudents =
            getArray<DatabaseStudent>(
              databaseResult,
            );
        } catch (
          imageRequestError
        ) {
          /*
           * Do not break the whole page if /students
           * is unavailable to this account.
           * The original teacher response is still usable.
           */
          console.warn(
            "Could not load database student images:",
            imageRequestError,
          );
        }

        const imageByStudentId =
          new Map<
            number,
            string | null
          >();

        const imageByStudentCode =
          new Map<
            string,
            string | null
          >();

        for (
          const student of
          databaseStudents
        ) {
          imageByStudentId.set(
            student.id,
            student.image,
          );

          imageByStudentCode.set(
            student.studentCode
              .trim()
              .toUpperCase(),
            student.image,
          );
        }

        const mergedStudents =
          teacherStudents.map(
            (
              student,
            ): StudentData => {
              const databaseImage =
                imageByStudentId.get(
                  student.id,
                ) ??
                imageByStudentCode.get(
                  student.studentCode
                    .trim()
                    .toUpperCase(),
                ) ??
                null;

              return {
                ...student,

                /*
                 * Database image gets priority.
                 *
                 * Example:
                 * /uploads/students/1786332811562-....jpg
                 */
                image:
                  databaseImage ??
                  student.image ??
                  student.imagePath ??
                  student.imageUrl ??
                  null,
              };
            },
          );

        console.log(
          "TEACHER STUDENTS WITH DATABASE IMAGES:",
          mergedStudents,
        );

        setStudents(
          mergedStudents,
        );
      } catch (
        requestError
      ) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Failed to load students.",
        );
      } finally {
        setLoading(false);
      }
    }, [apiFetch]);

  useEffect(() => {
    const storedUser =
      localStorage.getItem(
        "user",
      );

    const token =
      localStorage.getItem(
        "accessToken",
      );

    if (
      !storedUser ||
      !token
    ) {
      router.replace("/");
      return;
    }

    try {
      const user =
        JSON.parse(
          storedUser,
        ) as LoginUser;

      if (
        user.role !==
          "TEACHER" ||
        user.isActive ===
          false
      ) {
        localStorage.removeItem(
          "accessToken",
        );

        localStorage.removeItem(
          "user",
        );

        router.replace("/");
        return;
      }

      setCurrentUser(user);
      void loadStudents();
    } catch {
      localStorage.removeItem(
        "accessToken",
      );

      localStorage.removeItem(
        "user",
      );

      router.replace("/");
    }
  }, [
    loadStudents,
    router,
  ]);

  useEffect(() => {
    if (!selectedStudent) {
      return;
    }

    const closeOnEscape = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key === "Escape"
      ) {
        setSelectedStudent(
          null,
        );
      }
    };

    document.addEventListener(
      "keydown",
      closeOnEscape,
    );

    document.body.style.overflow =
      "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        closeOnEscape,
      );

      document.body.style.overflow =
        "";
    };
  }, [selectedStudent]);

   const DEFAULT_AVATAR =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
      <rect width="160" height="160" fill="#f3f4f6"/>
      <circle cx="80" cy="60" r="30" fill="#c9a227"/>
      <path d="M30 145c8-32 27-48 50-48s42 16 50 48" fill="#c9a227"/>
    </svg>
  `);
  
  const filteredStudents =
    useMemo(() => {
      const keyword =
        searchTerm
          .trim()
          .toLowerCase();

      if (!keyword) {
        return students;
      }

      return students.filter(
        (student) =>
          student.name
            .toLowerCase()
            .includes(keyword) ||
          student.studentCode
            .toLowerCase()
            .includes(keyword) ||
          (student.phone ?? "")
            .toLowerCase()
            .includes(keyword) ||
          (student.township ?? "")
            .toLowerCase()
            .includes(keyword) ||
          (student.region ?? "")
            .toLowerCase()
            .includes(keyword) ||
          student.batchName
            .toLowerCase()
            .includes(keyword),
      );
    }, [
      searchTerm,
      students,
    ]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredStudents.length /
          PAGE_SIZE,
      ),
    );

  const paginatedStudents =
    useMemo(() => {
      const start =
        (currentPage - 1) *
        PAGE_SIZE;

      return filteredStudents.slice(
        start,
        start + PAGE_SIZE,
      );
    }, [
      currentPage,
      filteredStudents,
    ]);

  const firstEntry =
    filteredStudents.length ===
      0
      ? 0
      : (currentPage - 1) *
          PAGE_SIZE +
        1;

  const lastEntry =
    Math.min(
      currentPage *
        PAGE_SIZE,
      filteredStudents.length,
    );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (
      currentPage >
      totalPages
    ) {
      setCurrentPage(
        totalPages,
      );
    }
  }, [
    currentPage,
    totalPages,
  ]);

  const handleLogout = () => {
    localStorage.removeItem(
      "accessToken",
    );

    localStorage.removeItem(
      "user",
    );

    router.replace("/");
  };

  const closeModal = () => {
    setSelectedStudent(
      null,
    );
  };

  return (
    <div
      className={
        styles.container
      }
    >
      <header
        className={
          styles.navbar
        }
      >
        <div
          className={
            styles.navLeft
          }
        >
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
            Dhamma Teacher
          </span>
        </div>

        <div
          className={
            styles.navRight
          }
        >
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
            onClick={
              handleLogout
            }
            title="Logout"
            aria-label="Logout"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
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

      <div
        className={
          styles.layoutWrapper
        }
      >
        <aside
          className={
            styles.sidebar
          }
        >
          <button
            type="button"
            className={
              styles.sideBtn
            }
            onClick={() =>
              router.push(
                "/teacher/teacher-dashboard",
              )
            }
          >
            Homework
          </button>

          <button
            type="button"
            className={`${styles.sideBtn} ${styles.activeBtn}`}
            onClick={() =>
              router.push(
                "/teacher/student",
              )
            }
          >
            Students
          </button>
        </aside>

        <main
          className={
            styles.mainContent
          }
        >
          <div
            className={
              styles.contentHeader
            }
          >
            <div>
              <h1
                className={
                  styles.pageTitle
                }
              >
                Students
              </h1>

              <p
                className={
                  styles.pageSubtitle
                }
              >
                Students from batches
                assigned to your teacher
                account are shown.
              </p>
            </div>

            <div
              className={
                styles.filters
              }
            >
              <div
                className={
                  styles.filterDropdown
                }
              >
                My Batch Students
              </div>

              <label
                className={
                  styles.searchBox
                }
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="8"
                  />

                  <line
                    x1="21"
                    y1="21"
                    x2="16.65"
                    y2="16.65"
                  />
                </svg>

                <input
                  type="search"
                  aria-label="Search assigned students"
                  placeholder="Search name, ID, phone or batch"
                  value={
                    searchTerm
                  }
                  onChange={(
                    event,
                  ) =>
                    setSearchTerm(
                      event.target
                        .value,
                    )
                  }
                />
              </label>
            </div>
          </div>

          {error && (
            <div
              className={
                styles.errorMessage
              }
            >
              <span>{error}</span>

              <button
                type="button"
                onClick={() =>
                  void loadStudents()
                }
              >
                Retry
              </button>
            </div>
          )}

          <div
            className={
              styles.tableContainer
            }
          >
            <table
              className={
                styles.table
              }
            >
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Image</th>
                  <th>Name</th>
                  <th>
                    Phone Number
                  </th>
                  <th>Town</th>
                  <th>City</th>
                  <th>
                    <span
                      className={
                        styles.visuallyHidden
                      }
                    >
                      Actions
                    </span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={7}
                      className={
                        styles.stateCell
                      }
                    >
                      Loading assigned
                      students...
                    </td>
                  </tr>
                )}

                {!loading &&
                  paginatedStudents.map(
                    (student) => (
                      <tr
                        key={
                          student.id
                        }
                        className={
                          styles.tableRow
                        }
                        onClick={() =>
                          setSelectedStudent(
                            student,
                          )
                        }
                      >
                        <td
                          className={
                            styles.boldText
                          }
                        >
                          {
                            student.studentCode
                          }
                        </td>

                        <td>
                          <img
                            src={getStudentImage(
                              student,
                            )}
                            alt={
                              student.name
                            }
                            className={
                              styles.tableAvatar
                            }
                            loading="lazy"
                            onError={(
                              event,
                            ) => {
                              if (
                                event.currentTarget.src !==
                                DEFAULT_STUDENT_IMAGE
                              ) {
                                event.currentTarget.src =
                                  DEFAULT_STUDENT_IMAGE;
                              }
                            }}
                          />
                        </td>

                        <td>
                          <div
                            className={
                              styles.boldText
                            }
                          >
                            {
                              student.name
                            }
                          </div>

                          <div
                            className={
                              styles.subText
                            }
                          >
                            {
                              student.batchName
                            }
                          </div>
                        </td>

                        <td
                          className={
                            styles.boldText
                          }
                        >
                          {student.phone ??
                            "-"}
                        </td>

                        <td
                          className={
                            styles.boldText
                          }
                        >
                          {student.township ??
                            "-"}
                        </td>

                        <td
                          className={
                            styles.boldText
                          }
                        >
                          {student.region ??
                            "-"}
                        </td>

                        <td>
                          <button
                            type="button"
                            className={
                              styles.actionBtn
                            }
                            onClick={(
                              event,
                            ) => {
                              event.stopPropagation();

                              setSelectedStudent(
                                student,
                              );
                            }}
                            aria-label={`View ${student.name}`}
                            title="View student details"
                          >
                            ⋮
                          </button>
                        </td>
                      </tr>
                    ),
                  )}

                {!loading &&
                  paginatedStudents.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className={
                          styles.stateCell
                        }
                      >
                        No assigned
                        students found.
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>

          <div
            className={
              styles.paginationFooter
            }
          >
            <div
              className={
                styles.entriesText
              }
            >
              Showing {firstEntry} to{" "}
              {lastEntry} of{" "}
              {filteredStudents.length}{" "}
              assigned students
            </div>

            <div
              className={
                styles.paginationControls
              }
            >
              <button
                type="button"
                className={
                  styles.pageBtn
                }
                disabled={
                  currentPage <= 1
                }
                onClick={() =>
                  setCurrentPage(
                    (page) =>
                      Math.max(
                        1,
                        page - 1,
                      ),
                  )
                }
                aria-label="Previous page"
              >
                &lt;
              </button>

              <button
                type="button"
                className={`${styles.pageBtn} ${styles.pageActive}`}
                aria-current="page"
              >
                {currentPage} /{" "}
                {totalPages}
              </button>

              <button
                type="button"
                className={
                  styles.pageBtn
                }
                disabled={
                  currentPage >=
                  totalPages
                }
                onClick={() =>
                  setCurrentPage(
                    (page) =>
                      Math.min(
                        totalPages,
                        page + 1,
                      ),
                  )
                }
                aria-label="Next page"
              >
                &gt;
              </button>
            </div>
          </div>

          <div
            className={
              styles.footerBrand
            }
          >
            O-Technique-Myanmar-2026@
          </div>
        </main>
      </div>

      {selectedStudent && (
        <div
          className={
            styles.modalOverlay
          }
          onClick={
            closeModal
          }
          role="presentation"
        >
          <section
            className={
              styles.modalContent
            }
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-details-title"
          >
            <button
              type="button"
              className={
                styles.closeModalBtn
              }
              onClick={
                closeModal
              }
              aria-label="Close student details"
              title="Close"
            >
              ×
            </button>

            <div
              className={
                styles.modalProfileHeader
              }
            >
              <img
                src={getStudentImage(
                  selectedStudent,
                )}
                alt={
                  selectedStudent.name
                }
                className={
                  styles.modalAvatar
                }
                onError={(
                  event,
                ) => {
                  if (
                    event.currentTarget.src !==
                    DEFAULT_STUDENT_IMAGE
                  ) {
                    event.currentTarget.src =
                      DEFAULT_STUDENT_IMAGE;
                  }
                }}
              />

              <div>
                <h2
                  id="student-details-title"
                  className={
                    styles.modalName
                  }
                >
                  {
                    selectedStudent.name
                  }
                </h2>

                <p
                  className={
                    styles.modalEmail
                  }
                >
                  {
                    selectedStudent.studentCode
                  }
                </p>
              </div>
            </div>

            <div
              className={
                styles.modalDetailsList
              }
            >
              <div
                className={
                  styles.modalRow
                }
              >
                <strong>
                  Student ID:
                </strong>

                <span>
                  {
                    selectedStudent.studentCode
                  }
                </span>
              </div>

              <div
                className={
                  styles.modalRow
                }
              >
                <strong>
                  Batch:
                </strong>

                <span>
                  {
                    selectedStudent.batchName
                  }
                </span>
              </div>

              <div
                className={
                  styles.modalRow
                }
              >
                <strong>
                  Phone Number:
                </strong>

                <span>
                  {selectedStudent.phone ??
                    "-"}
                </span>
              </div>

              <div
                className={
                  styles.modalRow
                }
              >
                <strong>
                  Town:
                </strong>

                <span>
                  {selectedStudent.township ??
                    "-"}
                </span>
              </div>

              <div
                className={
                  styles.modalRow
                }
              >
                <strong>
                  City:
                </strong>

                <span>
                  {selectedStudent.region ??
                    "-"}
                </span>
              </div>
            </div>

            <div
              className={
                styles.feedbackContainer
              }
            >
              {selectedStudent.feedback
                .length > 0 ? (
                selectedStudent.feedback.map(
                  (feedback) => (
                    <article
                      key={
                        feedback.submissionId
                      }
                      className={
                        styles.feedbackCard
                      }
                    >
                      <div
                        className={
                          styles.feedbackTop
                        }
                      >
                        <span>
                          {
                            feedback.homeworkTitle
                          }
                        </span>

                        <span>
                          Mark:{" "}
                          {feedback.mark ??
                            "-"}
                          {feedback.maximumMark !==
                            null
                            ? ` / ${feedback.maximumMark}`
                            : ""}
                        </span>
                      </div>

                      <div
                        className={
                          styles.feedbackComment
                        }
                      >
                        Comment:{" "}
                        {feedback.comment ??
                          "No comment"}
                      </div>

                      {feedback.reviewedAt && (
                        <div
                          className={
                            styles.feedbackDate
                          }
                        >
                          Reviewed:{" "}
                          {formatReviewedDate(
                            feedback.reviewedAt,
                          )}
                        </div>
                      )}
                    </article>
                  ),
                )
              ) : (
                <p
                  className={
                    styles.emptyFeedback
                  }
                >
                  No reviewed homework
                  feedback yet.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}