"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import styles from "./homework-list.module.css";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

type HomeworkImage = {
  id: number;
  image: string;
  marks: number | null;
  remark: string | null;
};

type Student = {
  id: number;
  studentCode: string;
  name: string;
  image: string | null;
  phone?: string;
};

type Reviewer = {
  id: number;
  name: string;
  email: string;
};

type HomeworkSubmission = {
  id: number;
  status: string;
  submittedAt: string | null;
  totalMarks: number | null;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
  student: Student;
  reviewer: Reviewer | null;
  images: HomeworkImage[];
};

type HomeworkDetail = {
  id: number;
  title: string;
  description: string | null;
  dueDate: string;
  totalMarks: number;
  batchId: number;
  batch: {
    id: number;
    name: string;
    teacher: Reviewer | null;
  } | null;
  submissions: HomeworkSubmission[];
  _count?: {
    submissions: number;
  };
};

function getErrorMessage(
  payload: unknown,
  fallback: string,
) {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload
  ) {
    const message = (
      payload as {
        message?: unknown;
      }
    ).message;

    if (Array.isArray(message)) {
      return message.join(", ");
    }

    if (typeof message === "string") {
      return message;
    }
  }

  return fallback;
}

function formatSubmissionDate(
  value: string | null | undefined,
) {
  if (!value) {
    return {
      date: "-",
      time: "-",
    };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      date: "-",
      time: "-",
    };
  }

  return {
    date: new Intl.DateTimeFormat(
      "en-GB",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      },
    ).format(date),

    time: new Intl.DateTimeFormat(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      },
    ).format(date),
  };
}

function getPaperMark(
  images: HomeworkImage[],
  index: number,
) {
  const marks = images[index]?.marks;

  return marks === null ||
    marks === undefined
    ? ""
    : String(marks);
}

function getSubmissionTotal(
  submission: HomeworkSubmission,
) {
  if (
    submission.totalMarks !== null &&
    submission.totalMarks !== undefined
  ) {
    return String(submission.totalMarks);
  }

  const marks = submission.images
    .map((image) => image.marks)
    .filter(
      (mark): mark is number =>
        typeof mark === "number",
    );

  if (marks.length === 0) {
    return "-";
  }

  return String(
    marks.reduce(
      (total, mark) => total + mark,
      0,
    ),
  );
}

function AdminHomeworkListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const homeworkIdText =
    searchParams.get("homeworkId") ??
    searchParams.get("id") ??
    "";

  const homeworkId = Number(
    homeworkIdText,
  );

  const [homework, setHomework] =
    useState<HomeworkDetail | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [searchTerm, setSearchTerm] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [selectedIds, setSelectedIds] =
    useState<Set<number>>(
      new Set(),
    );

  useEffect(() => {
    if (
      !Number.isInteger(homeworkId) ||
      homeworkId < 1
    ) {
      setLoading(false);
      setError(
        "Homework ID is missing. Open this page from a homework card.",
      );
      return;
    }

    const controller =
      new AbortController();

    const loadHomework =
      async () => {
        setLoading(true);
        setError("");

        try {
          const token =
            window.localStorage.getItem(
              "accessToken",
            );

          const response = await fetch(
            `${API_URL}/homeworks/${homeworkId}`,
            {
              method: "GET",

              headers: {
                Accept:
                  "application/json",

                ...(token
                  ? {
                      Authorization:
                        `Bearer ${token}`,
                    }
                  : {}),
              },

              cache: "no-store",
              signal:
                controller.signal,
            },
          );

          const payload: unknown =
            await response
              .json()
              .catch(() => null);

          if (!response.ok) {
            throw new Error(
              getErrorMessage(
                payload,
                "Unable to load homework details.",
              ),
            );
          }

          const normalized =
            payload &&
            typeof payload ===
              "object" &&
            "data" in payload
              ? (
                  payload as {
                    data:
                      HomeworkDetail;
                  }
                ).data
              : (
                  payload as
                    HomeworkDetail
                );

          setHomework({
            ...normalized,

            submissions:
              Array.isArray(
                normalized
                  ?.submissions,
              )
                ? normalized
                    .submissions
                : [],
          });
        } catch (requestError) {
          if (
            requestError instanceof
              DOMException &&
            requestError.name ===
              "AbortError"
          ) {
            return;
          }

          console.error(
            "Homework detail request failed:",
            requestError,
          );

          setError(
            requestError instanceof
              Error
              ? requestError.message
              : "Unable to load homework details.",
          );
        } finally {
          setLoading(false);
        }
      };

    void loadHomework();

    return () => {
      controller.abort();
    };
  }, [homeworkId]);

  const filteredSubmissions =
    useMemo(() => {
      const submissions =
        homework?.submissions ?? [];

      const keyword =
        searchTerm
          .trim()
          .toLowerCase();

      return submissions.filter(
        (submission) => {
          const matchesStatus =
            statusFilter ===
              "ALL" ||
            submission.status ===
              statusFilter;

          if (!matchesStatus) {
            return false;
          }

          if (!keyword) {
            return true;
          }

          const searchText = [
            submission.id,
            submission.student
              ?.name,
            submission.student
              ?.studentCode,
            submission.reviewer
              ?.name,
            submission.status,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchText.includes(
            keyword,
          );
        },
      );
    }, [
      homework,
      searchTerm,
      statusFilter,
    ]);

  const allVisibleSelected =
    filteredSubmissions.length >
      0 &&
    filteredSubmissions.every(
      (submission) =>
        selectedIds.has(
          submission.id,
        ),
    );

  const toggleSubmission = (
    submissionId: number,
  ) => {
    setSelectedIds(
      (current) => {
        const next =
          new Set(current);

        if (
          next.has(submissionId)
        ) {
          next.delete(
            submissionId,
          );
        } else {
          next.add(
            submissionId,
          );
        }

        return next;
      },
    );
  };

  const toggleAllVisible = () => {
    setSelectedIds(
      (current) => {
        const next =
          new Set(current);

        if (allVisibleSelected) {
          for (
            const submission of
            filteredSubmissions
          ) {
            next.delete(
              submission.id,
            );
          }
        } else {
          for (
            const submission of
            filteredSubmissions
          ) {
            next.add(
              submission.id,
            );
          }
        }

        return next;
      },
    );
  };

  const handleLogout = () => {
    window.localStorage.removeItem(
      "accessToken",
    );

    window.localStorage.removeItem(
      "user",
    );

    router.replace("/");
  };

  return (
    <div className={styles.container}>
      <header className={styles.navbar}>
        <div className={styles.navLeft}>
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
            Dhamma Admin
          </span>
        </div>

        <div className={styles.navRight}>
          <img
            src="https://i.pravatar.cc/150?img=47"
            alt="Profile"
            className={
              styles.profileImg
            }
          />

          <span
            className={
              styles.profileName
            }
          >
            Super Admin
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
              stroke="#b8860b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
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
            className={
              styles.sideBtn
            }
            onClick={() =>
              router.push(
                "/admin/admin",
              )
            }
          >
            Teachers
          </button>

          <button
            type="button"
            className={
              styles.sideBtn
            }
            onClick={() =>
              router.push(
                "/admin/batches",
              )
            }
          >
            Batches
          </button>

          <button
            type="button"
            className={`${styles.sideBtn} ${styles.activeBtn}`}
            onClick={() =>
              router.push(
                "/admin/homeworks",
              )
            }
          >
            Homework
          </button>

          <button
            type="button"
            className={
              styles.sideBtn
            }
            onClick={() =>
              router.push(
                "/admin/students",
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
              className={
                styles.backBtn
              }
              onClick={() =>
                router.push(
                  "/admin/homeworks",
                )
              }
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
              >
                <line
                  x1="19"
                  y1="12"
                  x2="5"
                  y2="12"
                />
                <polyline points="12 19 5 12 12 5" />
              </svg>

              Back to Homework
            </button>
          </div>

          <div
            className={
              styles.blueBorderContainer
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
                  {homework?.batch
                    ?.name ??
                    "Batch"}
                </h1>

                <p
                  className={
                    styles.pageSubtitle
                  }
                >
                  {homework?.title ??
                    "Homework"}
                </p>
              </div>

              <div
                className={
                  styles.headerActions
                }
              >
                <button
                  type="button"
                  className={
                    styles.btnSelect
                  }
                  onClick={
                    toggleAllVisible
                  }
                  disabled={
                    filteredSubmissions
                      .length === 0
                  }
                >
                  {allVisibleSelected
                    ? "Clear Selection"
                    : "Select Students"}
                </button>

                <button
                  type="button"
                  className={
                    styles.btnAssign
                  }
                  disabled={
                    selectedIds.size ===
                    0
                  }
                  title={
                    selectedIds.size ===
                    0
                      ? "Select at least one submission."
                      : "Teacher assignment API is not configured yet."
                  }
                >
                  Assign Teacher
                  {selectedIds.size >
                    0
                    ? ` (${selectedIds.size})`
                    : ""}
                </button>

                <select
                  value={
                    statusFilter
                  }
                  onChange={(event) =>
                    setStatusFilter(
                      event.target
                        .value,
                    )
                  }
                  aria-label="Filter by submission status"
                  style={{
                    minHeight: 44,
                    padding:
                      "0 14px",
                    border:
                      "1px solid #d8d8d8",
                    borderRadius: 8,
                    background:
                      "#ffffff",
                  }}
                >
                  <option value="ALL">
                    All Status
                  </option>
                  <option value="PENDING">
                    Pending
                  </option>
                  <option value="SUBMITTED">
                    Submitted
                  </option>
                  <option value="REVIEWED">
                    Reviewed
                  </option>
                </select>

                <div
                  className={
                    styles.searchBox
                  }
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#666"
                    strokeWidth="2"
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
                    type="text"
                    placeholder="Search name or ID"
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
                </div>
              </div>
            </div>

            {loading ? (
              <div
                style={{
                  padding: 40,
                  textAlign:
                    "center",
                }}
              >
                Loading homework
                data...
              </div>
            ) : error ? (
              <div
                style={{
                  margin: 20,
                  padding: 14,
                  borderRadius: 8,
                  background:
                    "#fff4f4",
                  color:
                    "#b42318",
                }}
              >
                {error}
              </div>
            ) : (
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
                      <th
                        style={{
                          width: 40,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={
                            allVisibleSelected
                          }
                          onChange={
                            toggleAllVisible
                          }
                          aria-label="Select all visible submissions"
                        />
                      </th>

                      <th>ID</th>
                      <th>
                        Date Time
                      </th>
                      <th>
                        Student Name /
                        ID
                      </th>
                      <th>
                        Paper - 1
                      </th>
                      <th>
                        Paper - 2
                      </th>
                      <th>
                        Paper - 3
                      </th>
                      <th>
                        Paper - 4
                      </th>
                      <th>Total</th>
                      <th>Teacher</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredSubmissions
                      .length === 0 ? (
                      <tr>
                        <td
                          colSpan={11}
                          style={{
                            padding:
                              "36px 16px",
                            textAlign:
                              "center",
                          }}
                        >
                          No submissions
                          found.
                        </td>
                      </tr>
                    ) : (
                      filteredSubmissions.map(
                        (
                          submission,
                          index,
                        ) => {
                          const dateTime =
                            formatSubmissionDate(
                              submission
                                .submittedAt ??
                                submission
                                  .createdAt,
                            );

                          const teacherName =
                            submission
                              .reviewer
                              ?.name ??
                            homework
                              ?.batch
                              ?.teacher
                              ?.name ??
                            "-";

                          return (
                            <tr
                              key={
                                submission.id
                              }
                            >
                              <td>
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(
                                    submission.id,
                                  )}
                                  onChange={() =>
                                    toggleSubmission(
                                      submission.id,
                                    )
                                  }
                                  aria-label={`Select ${submission.student?.name ?? "student"}`}
                                />
                              </td>

                              <td
                                className={
                                  styles.boldText
                                }
                              >
                                {String(
                                  index +
                                    1,
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
                                  {
                                    dateTime.date
                                  }
                                </div>

                                <div
                                  className={
                                    styles.subText
                                  }
                                >
                                  {
                                    dateTime.time
                                  }
                                </div>
                              </td>

                              <td>
                                <div
                                  className={
                                    styles.boldText
                                  }
                                >
                                  {submission
                                    .student
                                    ?.name ??
                                    "-"}
                                </div>

                                <div
                                  className={
                                    styles.subText
                                  }
                                >
                                  {submission
                                    .student
                                    ?.studentCode ??
                                    "-"}
                                </div>
                              </td>

                              {[0, 1, 2, 3].map(
                                (
                                  paperIndex,
                                ) => (
                                  <td
                                    key={
                                      paperIndex
                                    }
                                  >
                                    <div
                                      className={
                                        styles.papperBox
                                      }
                                    >
                                      {getPaperMark(
                                        submission.images ??
                                          [],
                                        paperIndex,
                                      )}
                                    </div>
                                  </td>
                                ),
                              )}

                              <td
                                className={
                                  styles.boldText
                                }
                              >
                                {getSubmissionTotal(
                                  submission,
                                )}
                              </td>

                              <td
                                className={
                                  styles.boldText
                                }
                              >
                                {
                                  teacherName
                                }
                              </td>

                              <td>
                                {
                                  submission.status
                                }
                              </td>
                            </tr>
                          );
                        },
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
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
    </div>
  );
}

export default function AdminHomeworkListPage() {
  return (
    <Suspense
      fallback={
        <div>
          Loading...
        </div>
      }
    >
      <AdminHomeworkListContent />
    </Suspense>
  );
}