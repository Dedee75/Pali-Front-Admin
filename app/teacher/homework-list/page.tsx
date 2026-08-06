"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  ChangeEvent,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import styles from "./homework-list.module.css";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000";

type LoginUser = {
  id: number;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "TEACHER";
};

type SubmissionStatus =
  | "PENDING"
  | "SUBMITTED"
  | "REVIEWED";

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

  if (
    value &&
    typeof value === "object" &&
    "data" in value &&
    Array.isArray(
      (value as { data?: unknown }).data,
    )
  ) {
    return (value as { data: T[] }).data;
  }

  return [];
}

function HomeworkListContent() {
  const router = useRouter();
  const searchParams =
    useSearchParams();

  const homeworkId = Number(
    searchParams.get("homeworkId"),
  );

  const status =
    searchParams.get("status") ??
    "pending";

  const [currentUser, setCurrentUser] =
    useState<LoginUser | null>(null);
  const [submissions, setSubmissions] =
    useState<Submission[]>([]);
  const [searchTerm, setSearchTerm] =
    useState("");
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState("");

  const apiFetch = useCallback(
    async (endpoint: string) => {
      const token =
        localStorage.getItem("accessToken");

      if (!token) {
        router.replace("/");
        throw new Error(
          "Please login first.",
        );
      }

      const response = await fetch(
        `${API_URL}${endpoint}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const result = await response
        .json()
        .catch(() => null);

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        localStorage.removeItem(
          "accessToken",
        );
        localStorage.removeItem("user");
        router.replace("/");

        throw new Error(
          "You cannot access this homework.",
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

  const loadSubmissions =
    useCallback(async () => {
      if (
        !Number.isInteger(homeworkId) ||
        homeworkId <= 0
      ) {
        setError(
          "Invalid homework ID.",
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const result = await apiFetch(
          `/homework-submissions/teacher/assigned?homeworkId=${homeworkId}&status=${status}`,
        );

        setSubmissions(
          getArray<Submission>(
            result,
          ),
        );
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
      homeworkId,
      status,
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
      void loadSubmissions();
    } catch {
      router.replace("/");
    }
  }, [
    loadSubmissions,
    router,
  ]);

  const filteredData = useMemo(() => {
    const term =
      searchTerm.trim().toLowerCase();

    return submissions.filter(
      (submission) =>
        !term ||
        submission.student.name
          .toLowerCase()
          .includes(term) ||
        submission.student.studentCode
          .toLowerCase()
          .includes(term),
    );
  }, [searchTerm, submissions]);

  const title =
    submissions[0]?.homework.title ??
    "Assignment Details";

  const batchName =
    submissions[0]?.homework.batch
      .name ?? "Batch";

  const formatDate = (
    value?: string | null,
  ) => {
    if (!value) {
      return {
        date: "-",
        time: "-",
      };
    }

    const date = new Date(value);

    return {
      date:
        date.toLocaleDateString(),
      time:
        date.toLocaleTimeString(
          [],
          {
            hour: "2-digit",
            minute: "2-digit",
          },
        ),
    };
  };

  const openDetails = (
    submissionId: number,
  ) => {
    router.push(
      `/teacher/homework-details?submissionId=${submissionId}`,
    );
  };

  const handleLogout = () => {
    localStorage.removeItem(
      "accessToken",
    );
    localStorage.removeItem("user");
    router.replace("/");
  };

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
          <img
            src="https://i.pravatar.cc/150?img=47"
            alt="Profile"
            className={styles.profileImg}
          />
          <span
            className={styles.profileName}
          >
            {currentUser?.name ??
              "Teacher"}
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

      <div
        className={
          styles.layoutWrapper
        }
      >
        <aside
          className={styles.sidebar}
        >
          <button
            type="button"
            className={`${styles.sideBtn} ${styles.activeBtn}`}
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
            className={styles.sideBtn}
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
              styles.backBtnContainer
            }
          >
            <button
              type="button"
              className={styles.backBtn}
              onClick={() =>
                router.push(
                  "/teacher/teacher-dashboard",
                )
              }
            >
              <span aria-hidden="true">
                ←
              </span>
              Back to Dashboard
            </button>
          </div>

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
                {batchName}
              </h1>
              <p
                className={
                  styles.pageSubtitle
                }
              >
                {title}
              </p>
            </div>

            <div
              className={styles.filters}
            >
              <div
                className={
                  styles.filterDropdown
                }
              >
                {status === "completed"
                  ? "Reviewed"
                  : "Pending"}
              </div>

              <div
                className={
                  styles.searchBox
                }
              >
                <input
                  type="text"
                  placeholder="Search Name or ID..."
                  value={searchTerm}
                  onChange={(
                    event: ChangeEvent<HTMLInputElement>,
                  ) =>
                    setSearchTerm(
                      event.target.value,
                    )
                  }
                />
              </div>
            </div>
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

          <div
            className={
              styles.tableContainer
            }
          >
            <table
              className={styles.table}
            >
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date Time</th>
                  <th>
                    Student Name / ID
                  </th>
                  <th>Paper - 1</th>
                  <th>Paper - 2</th>
                  <th>Paper - 3</th>
                  <th>Paper - 4</th>
                  <th>Paper - 5</th>
                  <th>Paper - 6</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={11}
                      style={{
                        textAlign:
                          "center",
                        padding: "30px",
                      }}
                    >
                      Loading assigned
                      students...
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredData.map(
                    (
                      submission,
                      index,
                    ) => {
                      const date =
                        formatDate(
                          submission.submittedAt,
                        );

                      return (
                        <tr
                          key={
                            submission.id
                          }
                          className={`${submission.status !== "REVIEWED" ? styles.rowPending : ""} ${styles.clickableRow}`}
                          onClick={() =>
                            openDetails(
                              submission.id,
                            )
                          }
                        >
                          <td
                            className={
                              styles.boldText
                            }
                          >
                            {String(
                              index + 1,
                            ).padStart(
                              2,
                              "0",
                            )}
                          </td>

                          <td>
                            <div
                              className={
                                styles.boldText
                              }
                            >
                              {date.date}
                            </div>
                            <div
                              className={
                                styles.subText
                              }
                            >
                              {date.time}
                            </div>
                          </td>

                          <td>
                            <div
                              className={
                                styles.boldText
                              }
                            >
                              {
                                submission
                                  .student
                                  .name
                              }
                            </div>
                            <div
                              className={
                                styles.subText
                              }
                            >
                              {
                                submission
                                  .student
                                  .studentCode
                              }
                            </div>
                          </td>

                          {[
                            0, 1, 2, 3,
                            4, 5,
                          ].map(
                            (
                              imageIndex,
                            ) => (
                              <td
                                key={
                                  imageIndex
                                }
                              >
                                <div
                                  className={
                                    styles.docIcon
                                  }
                                >
                                  {submission
                                    .images[
                                    imageIndex
                                  ]?.marks ??
                                    ""}
                                </div>
                              </td>
                            ),
                          )}

                          <td
                            className={
                              styles.boldText
                            }
                          >
                            {submission.status ===
                            "REVIEWED"
                              ? submission.totalMarks ??
                                0
                              : "-"}
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
                                openDetails(
                                  submission.id,
                                );
                              }}
                            >
                              ⋮
                            </button>
                          </td>
                        </tr>
                      );
                    },
                  )}

                {!loading &&
                  filteredData.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={11}
                        style={{
                          textAlign:
                            "center",
                          padding: "30px",
                          color: "#777",
                        }}
                      >
                        No assigned
                        students found.
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function HomeworkListPage() {
  return (
    <Suspense
      fallback={
        <div>Loading Data...</div>
      }
    >
      <HomeworkListContent />
    </Suspense>
  );
}