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

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

const ITEMS_PER_PAGE = 50;

type UserRole =
  | "SUPER_ADMIN"
  | "TEACHER";

type SubmissionStatus =
  | "PENDING"
  | "SUBMITTED"
  | "REVIEWED";

type LoginUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

type Teacher = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

type HomeworkImage = {
  id: number;
  image: string;
  marks?: number | null;
  remark?: string | null;
};

type Student = {
  id: number;
  studentCode: string;
  name: string;
  batchId: number;
};

type Reviewer = {
  id: number;
  name: string;
  email?: string;
};

type Submission = {
  id: number;
  homeworkId: number;
  studentId: number;
  reviewerId?: number | null;
  status: SubmissionStatus;
  submittedAt?: string | null;
  totalMarks?: number | null;
  remark?: string | null;
  student?: Student | null;
  images?: HomeworkImage[];
  reviewer?: Reviewer | null;
};

type Homework = {
  id: number;
  title: string;
  description?: string | null;
  dueDate: string;
  totalMarks?: number | null;
  batchId: number;
  batch?: {
    id: number;
    name: string;
    teacherId?: number;
    teacher?: Reviewer | null;
  } | null;
};

function getArray<T>(
  result: unknown,
): T[] {
  if (
    Array.isArray(
      result,
    )
  ) {
    return result as T[];
  }

  if (
    result &&
    typeof result ===
      "object" &&
    "data" in result &&
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

function getMessage(
  result: unknown,
  fallback: string,
) {
  if (
    result &&
    typeof result ===
      "object" &&
    "message" in result
  ) {
    const message =
      (
        result as {
          message?: unknown;
        }
      ).message;

    if (
      Array.isArray(
        message,
      )
    ) {
      return message.join(
        ", ",
      );
    }

    if (
      typeof message ===
      "string"
    ) {
      return message;
    }
  }

  return fallback;
}

function AdminHomeworkListContent() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const homeworkId =
    Number(
      searchParams.get(
        "homeworkId",
      ) ??
        searchParams.get(
          "id",
        ),
    );

  const initialStatus =
    searchParams.get(
      "status",
    ) ??
    "all";

  const [
    homework,
    setHomework,
  ] =
    useState<Homework | null>(
      null,
    );

  const [
    submissions,
    setSubmissions,
  ] =
    useState<Submission[]>([]);

  const [
    teachers,
    setTeachers,
  ] =
    useState<Teacher[]>([]);

  const [
    currentUser,
    setCurrentUser,
  ] =
    useState<LoginUser | null>(
      null,
    );

  const [
    searchTerm,
    setSearchTerm,
  ] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState(
      initialStatus,
    );

  const [
    selectedIds,
    setSelectedIds,
  ] =
    useState<number[]>([]);

  const [
    selectionCount,
    setSelectionCount,
  ] =
    useState("100");

  const [
    isSelectModalOpen,
    setIsSelectModalOpen,
  ] =
    useState(false);

  const [
    showTeacherDropdown,
    setShowTeacherDropdown,
  ] =
    useState(false);

  const [
    selectedTeacherId,
    setSelectedTeacherId,
  ] =
    useState("");

  const [
    assigning,
    setAssigning,
  ] =
    useState(false);

  const [
    assignError,
    setAssignError,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    currentPage,
    setCurrentPage,
  ] =
    useState(1);

  const apiFetch =
    useCallback(
      async (
        endpoint: string,
        options:
          RequestInit = {},
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
          "Content-Type",
          "application/json",
        );

        headers.set(
          "Authorization",
          `Bearer ${token}`,
        );

        const response =
          await fetch(
            `${API_URL}${endpoint}`,
            {
              ...options,
              headers,
              cache:
                options.cache ??
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
          response.status ===
          401
        ) {
          localStorage.removeItem(
            "accessToken",
          );

          localStorage.removeItem(
            "user",
          );

          router.replace("/");

          throw new Error(
            "Your login session has expired.",
          );
        }

        if (
          response.status ===
          403
        ) {
          throw new Error(
            "You do not have permission.",
          );
        }

        if (!response.ok) {
          throw new Error(
            getMessage(
              result,
              "Request failed.",
            ),
          );
        }

        return result;
      },
      [router],
    );

  const fetchData =
    useCallback(
      async (
        silent = false,
      ) => {
        if (
          !Number.isInteger(
            homeworkId,
          ) ||
          homeworkId <= 0
        ) {
          setError(
            "Invalid homework ID.",
          );

          setLoading(
            false,
          );

          return;
        }

        if (!silent) {
          setLoading(
            true,
          );
        }

        setError("");

        try {
          const [
            homeworkResult,
            submissionResult,
            userResult,
          ] =
            await Promise.all([
              apiFetch(
                `/homeworks/${homeworkId}`,
              ),

              apiFetch(
                `/homework-submissions?homeworkId=${homeworkId}`,
              ),

              apiFetch(
                "/users",
              ),
            ]);

          setHomework(
            homeworkResult?.data ??
              homeworkResult,
          );

          const allSubmissions =
            getArray<Submission>(
              submissionResult,
            );

          setSubmissions(
            allSubmissions.filter(
              (
                submission,
              ) =>
                submission.homeworkId ===
                homeworkId,
            ),
          );

          setTeachers(
            getArray<Teacher>(
              userResult,
            ).filter(
              (
                user,
              ) =>
                user.role ===
                  "TEACHER" &&
                user.isActive,
            ),
          );
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load submissions.",
          );
        } finally {
          if (!silent) {
            setLoading(
              false,
            );
          }
        }
      },
      [
        apiFetch,
        homeworkId,
      ],
    );

  useEffect(() => {
    const storedUser =
      localStorage.getItem(
        "user",
      );

    if (!storedUser) {
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
        "SUPER_ADMIN"
      ) {
        router.replace("/");
        return;
      }

      setCurrentUser(
        user,
      );

      void fetchData();
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
    fetchData,
    router,
  ]);

  /*
   * Keep statuses current while teachers
   * are reviewing homework.
   */
  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
            "visible"
          ) {
            void fetchData(
              true,
            );
          }
        },
        10000,
      );

    return () =>
      window.clearInterval(
        timer,
      );
  }, [fetchData]);

  const filteredSubmissions =
    useMemo(
      () => {
        const keyword =
          searchTerm
            .trim()
            .toLowerCase();

        return submissions.filter(
          (
            submission,
          ) => {
            const isUnassigned =
              submission.status ===
                "SUBMITTED" &&
              !submission.reviewer;

            const matchesStatus =
              statusFilter ===
                "all"
                ? true
                : statusFilter ===
                    "pending"
                  ? submission.status !==
                    "REVIEWED"
                  : statusFilter ===
                      "completed"
                    ? submission.status ===
                      "REVIEWED"
                    : statusFilter ===
                        "unassigned"
                      ? isUnassigned
                      : true;

            if (
              !matchesStatus
            ) {
              return false;
            }

            if (!keyword) {
              return true;
            }

            const searchText =
              [
                submission.student
                  ?.name,

                submission.student
                  ?.studentCode,

                submission.reviewer
                  ?.name,

                submission.status,
              ]
                .filter(
                  Boolean,
                )
                .join(
                  " ",
                )
                .toLowerCase();

            return searchText.includes(
              keyword,
            );
          },
        );
      },
      [
        submissions,
        searchTerm,
        statusFilter,
      ],
    );

  /*
   * Only submitted and currently
   * unassigned students may be selected.
   *
   * After assigning the first 100,
   * they disappear from this list.
   * The next Select 100 therefore picks
   * the next 100 automatically.
   */
  const assignableSubmissions =
    useMemo(
      () =>
        filteredSubmissions.filter(
          (
            submission,
          ) =>
            submission.status ===
              "SUBMITTED" &&
            !submission.reviewer,
        ),
      [
        filteredSubmissions,
      ],
    );

  const teacherWorkloads =
    useMemo(
      () => {
        const map =
          new Map<
            number,
            {
              assigned: number;
              reviewed: number;
              waiting: number;
            }
          >();

        for (
          const teacher of
          teachers
        ) {
          map.set(
            teacher.id,
            {
              assigned: 0,
              reviewed: 0,
              waiting: 0,
            },
          );
        }

        for (
          const submission of
          submissions
        ) {
          const reviewerId =
            submission.reviewer
              ?.id;

          if (
            !reviewerId
          ) {
            continue;
          }

          const current =
            map.get(
              reviewerId,
            );

          if (!current) {
            continue;
          }

          current.assigned +=
            1;

          if (
            submission.status ===
            "REVIEWED"
          ) {
            current.reviewed +=
              1;
          } else {
            current.waiting +=
              1;
          }
        }

        return map;
      },
      [
        submissions,
        teachers,
      ],
    );

  const toggleSelect = (
    submission:
      Submission,
  ) => {
    const selectable =
      submission.status ===
        "SUBMITTED" &&
      !submission.reviewer;

    if (!selectable) {
      return;
    }

    setSelectedIds(
      (
        previous,
      ) =>
        previous.includes(
          submission.id,
        )
          ? previous.filter(
              (
                id,
              ) =>
                id !==
                submission.id,
            )
          : [
              ...previous,
              submission.id,
            ],
    );
  };

  const handleSelectByCount =
    () => {
      const count =
        Number(
          selectionCount,
        );

      if (
        !Number.isInteger(
          count,
        ) ||
        count <= 0
      ) {
        setAssignError(
          "Enter a valid student count.",
        );

        return;
      }

      if (
        count >
        assignableSubmissions
          .length
      ) {
        setAssignError(
          `Only ${assignableSubmissions.length} unassigned submitted students are available.`,
        );

        return;
      }

      const ids =
        assignableSubmissions
          .slice(
            0,
            count,
          )
          .map(
            (
              submission,
            ) =>
              submission.id,
          );

      setSelectedIds(
        ids,
      );

      setAssignError("");

      setIsSelectModalOpen(
        false,
      );
    };

  const toggleTeacherDropdown =
    () => {
      setAssignError("");

      setShowTeacherDropdown(
        (
          current,
        ) =>
          !current,
      );
    };

  const handleAssignTeacher =
    async () => {
      if (
        selectedIds.length ===
        0
      ) {
        setAssignError(
          "Select students first.",
        );

        return;
      }

      if (
        !selectedTeacherId
      ) {
        setAssignError(
          "Select a teacher.",
        );

        return;
      }

      setAssigning(
        true,
      );

      setAssignError("");

      try {
        await apiFetch(
          "/homework-submissions/assign-reviewer",
          {
            method:
              "PATCH",

            body:
              JSON.stringify({
                submissionIds:
                  selectedIds,

                teacherId:
                  Number(
                    selectedTeacherId,
                  ),
              }),
          },
        );

        setSelectedIds(
          [],
        );

        setSelectedTeacherId(
          "",
        );

        setShowTeacherDropdown(
          false,
        );

        await fetchData();
      } catch (err) {
        setAssignError(
          err instanceof Error
            ? err.message
            : "Teacher assignment failed.",
        );
      } finally {
        setAssigning(
          false,
        );
      }
    };

  const formatDate = (
    date?: string | null,
  ) => {
    if (!date) {
      return {
        date: "-",
        time: "-",
      };
    }

    const value =
      new Date(date);

    if (
      Number.isNaN(
        value.getTime(),
      )
    ) {
      return {
        date: "-",
        time: "-",
      };
    }

    return {
      date:
        value.toLocaleDateString(),

      time:
        value.toLocaleTimeString(
          [],
          {
            hour:
              "2-digit",

            minute:
              "2-digit",
          },
        ),
    };
  };

  const getStatusLabel = (
    submission:
      Submission,
  ) => {
    if (
      submission.status ===
      "REVIEWED"
    ) {
      return "Reviewed";
    }

    if (
      submission.status ===
      "PENDING"
    ) {
      return "Not Submitted";
    }

    if (
      submission.reviewer
    ) {
      return "Assigned";
    }

    return "Ready to Assign";
  };

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredSubmissions
          .length /
          ITEMS_PER_PAGE,
      ),
    );

  useEffect(() => {
    setCurrentPage(
      1,
    );
  }, [
    searchTerm,
    statusFilter,
  ]);

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

  const startIndex =
    (
      currentPage - 1
    ) *
    ITEMS_PER_PAGE;

  const paginatedSubmissions =
    filteredSubmissions.slice(
      startIndex,
      startIndex +
        ITEMS_PER_PAGE,
    );

  const handleBackToHomepage =
    () => {
      router.push(
        "/admin/homeworks",
      );
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

  const handleLogout =
    () => {
      localStorage.removeItem(
        "accessToken",
      );

      localStorage.removeItem(
        "user",
      );

      setCurrentUser(
        null,
      );

      router.replace(
        "/",
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
            Dhamma Admin
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
                "/admin/admin",
              )
            }
          >
            Users
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
            onClick={
              handleBackToHomepage
            }
            title="Back to Homepage"
            aria-label="Back to Homepage"
            style={{
              minHeight: "36px",
              padding: "0 14px",
              border: "1px solid #d59a00",
              borderRadius: "6px",
              background: "#ffffff",
              color: "#a86f00",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
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

                <p
                  style={{
                    marginTop:
                      "6px",

                    color:
                      "#666",

                    fontSize:
                      "13px",
                  }}
                >
                  Total:{" "}
                  {
                    submissions.length
                  }
                  {" • "}
                  Unassigned submitted:{" "}
                  {
                    submissions.filter(
                      (
                        item,
                      ) =>
                        item.status ===
                          "SUBMITTED" &&
                        !item.reviewer,
                    ).length
                  }
                  {" • "}
                  Reviewed:{" "}
                  {
                    submissions.filter(
                      (
                        item,
                      ) =>
                        item.status ===
                        "REVIEWED",
                    ).length
                  }
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
                  disabled={
                    assignableSubmissions
                      .length ===
                    0
                  }
                  onClick={() => {
                    setSelectionCount(
                      String(
                        Math.min(
                          100,
                          assignableSubmissions
                            .length,
                        ),
                      ),
                    );

                    setAssignError(
                      "",
                    );

                    setShowTeacherDropdown(
                      false,
                    );

                    setSelectedTeacherId(
                      "",
                    );

                    setIsSelectModalOpen(
                      true,
                    );
                  }}
                >
                  Select Students
                  {selectedIds.length >
                  0
                    ? ` (${selectedIds.length})`
                    : ""}
                </button>

                <div
                  style={{
                    position:
                      "relative",
                  }}
                >
                  <button
                    type="button"
                    className={
                      styles.btnAssign
                    }
                    onClick={
                      toggleTeacherDropdown
                    }
                  >
                    Assign Teacher
                    {showTeacherDropdown
                      ? " ▲"
                      : " ▼"}
                  </button>

                  {showTeacherDropdown && (
                    <div
                      style={{
                        position:
                          "absolute",

                        top:
                          "calc(100% + 8px)",

                        right: 0,

                        width:
                          "320px",

                        zIndex:
                          1000,

                        background:
                          "#ffffff",

                        border:
                          "1px solid #e5e7eb",

                        borderRadius:
                          "10px",

                        boxShadow:
                          "0 10px 30px rgba(0,0,0,0.14)",

                        padding:
                          "14px",
                      }}
                    >
                      <div
                        style={{
                          fontWeight:
                            700,

                          marginBottom:
                            "10px",

                          color:
                            "#333",
                        }}
                      >
                        Assign{" "}
                        {
                          selectedIds.length
                        }{" "}
                        students
                      </div>

                      {assignError && (
                        <div
                          style={{
                            color:
                              "#dc2626",

                            background:
                              "#fef2f2",

                            padding:
                              "8px 10px",

                            borderRadius:
                              "6px",

                            marginBottom:
                              "10px",

                            fontSize:
                              "12px",
                          }}
                        >
                          {
                            assignError
                          }
                        </div>
                      )}

                      <select
                        value={
                          selectedTeacherId
                        }
                        onChange={(
                          event,
                        ) =>
                          setSelectedTeacherId(
                            event.target
                              .value,
                          )
                        }
                        style={{
                          width:
                            "100%",

                          minHeight:
                            "42px",

                          padding:
                            "0 10px",

                          border:
                            "1px solid #d1d5db",

                          borderRadius:
                            "7px",

                          background:
                            "#fff",

                          marginBottom:
                            "10px",
                        }}
                      >
                        <option value="">
                          Select teacher
                        </option>

                        {teachers.map(
                          (
                            teacher,
                          ) => {
                            const workload =
                              teacherWorkloads.get(
                                teacher.id,
                              );

                            return (
                              <option
                                key={
                                  teacher.id
                                }
                                value={
                                  teacher.id
                                }
                              >
                                {
                                  teacher.name
                                }
                                {" — "}
                                Waiting:{" "}
                                {
                                  workload?.waiting ??
                                  0
                                }
                                {" / "}
                                Reviewed:{" "}
                                {
                                  workload?.reviewed ??
                                  0
                                }
                              </option>
                            );
                          },
                        )}
                      </select>

                      {teachers.length ===
                        0 && (
                        <div
                          style={{
                            color:
                              "#777",

                            fontSize:
                              "13px",

                            padding:
                              "6px 0 10px",
                          }}
                        >
                          No active
                          teachers found.
                        </div>
                      )}

                      <div
                        style={{
                          display:
                            "flex",

                          justifyContent:
                            "flex-end",

                          gap:
                            "8px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setShowTeacherDropdown(
                              false,
                            );

                            setSelectedTeacherId(
                              "",
                            );

                            setAssignError(
                              "",
                            );
                          }}
                          style={{
                            padding:
                              "8px 12px",

                            border:
                              "1px solid #d1d5db",

                            borderRadius:
                              "6px",

                            background:
                              "#fff",

                            cursor:
                              "pointer",
                          }}
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          disabled={
                            assigning ||
                            !selectedTeacherId ||
                            selectedIds.length === 0
                          }
                          onClick={() =>
                            void handleAssignTeacher()
                          }
                          style={{
                            padding:
                              "8px 14px",

                            border:
                              "none",

                            borderRadius:
                              "6px",

                            background:
                              assigning ||
                              !selectedTeacherId ||
                              selectedIds.length === 0
                                ? "#d1d5db"
                                : "#cc8c00",

                            color:
                              "#fff",

                            cursor:
                              assigning ||
                              !selectedTeacherId ||
                              selectedIds.length === 0
                                ? "not-allowed"
                                : "pointer",

                            fontWeight:
                              700,
                          }}
                        >
                          {assigning
                            ? "Assigning..."
                            : "Assign"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <select
                  value={
                    statusFilter
                  }
                  onChange={(
                    event,
                  ) =>
                    setStatusFilter(
                      event.target
                        .value,
                    )
                  }
                  style={{
                    minHeight:
                      44,

                    padding:
                      "0 12px",

                    border:
                      "1px solid #ddd",

                    borderRadius:
                      8,

                    background:
                      "#fff",
                  }}
                >
                  <option value="all">
                    All Students
                  </option>

                  <option value="unassigned">
                    Ready to Assign
                  </option>

                  <option value="pending">
                    Pending / Submitted
                  </option>

                  <option value="completed">
                    Reviewed
                  </option>
                </select>

                <div
                  className={
                    styles.searchBox
                  }
                >
                  <input
                    type="text"
                    placeholder="Search name or ID"
                    value={
                      searchTerm
                    }
                    onChange={(
                      event:
                        ChangeEvent<HTMLInputElement>,
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

            {error && (
              <div
                style={{
                  color:
                    "#dc2626",

                  background:
                    "#fef2f2",

                  padding:
                    "10px 12px",

                  borderRadius:
                    "6px",

                  marginBottom:
                    "14px",
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
                className={
                  styles.table
                }
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        width:
                          "40px",
                      }}
                    />

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

                    <th>
                      Teacher
                    </th>

                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {loading && (
                    <tr>
                      <td
                        colSpan={
                          11
                        }
                        style={{
                          textAlign:
                            "center",

                          padding:
                            "30px",
                        }}
                      >
                        Loading
                        submissions...
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    paginatedSubmissions.map(
                      (
                        submission,
                        index,
                      ) => {
                        const date =
                          formatDate(
                            submission.submittedAt,
                          );

                        const images =
                          submission.images ??
                          [];

                        const selectable =
                          submission.status ===
                            "SUBMITTED" &&
                          !submission.reviewer;

                        return (
                          <tr
                            key={
                              submission.id
                            }
                            className={
                              selectable
                                ? styles.rowHighlight
                                : ""
                            }
                          >
                            <td>
                              <input
                                type="checkbox"
                                disabled={
                                  !selectable
                                }
                                checked={
                                  selectedIds.includes(
                                    submission.id,
                                  )
                                }
                                onChange={() =>
                                  toggleSelect(
                                    submission,
                                  )
                                }
                              />
                            </td>

                            <td
                              className={
                                styles.boldText
                              }
                            >
                              {String(
                                startIndex +
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
                                  date.date
                                }
                              </div>

                              <div
                                className={
                                  styles.subText
                                }
                              >
                                {
                                  date.time
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
                                imageIndex,
                              ) => (
                                <td
                                  key={
                                    imageIndex
                                  }
                                >
                                  <div
                                    className={
                                      styles.papperBox
                                    }
                                  >
                                    {images[
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

                            <td
                              className={
                                styles.boldText
                              }
                            >
                              {submission
                                .reviewer
                                ?.name ??
                                "-"}
                            </td>

                            <td>
                              {getStatusLabel(
                                submission,
                              )}
                            </td>
                          </tr>
                        );
                      },
                    )}

                  {!loading &&
                    paginatedSubmissions.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan={
                            11
                          }
                          style={{
                            textAlign:
                              "center",

                            padding:
                              "30px",
                          }}
                        >
                          No submissions
                          found.
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>

            {!loading &&
              filteredSubmissions.length >
                ITEMS_PER_PAGE && (
                <div
                  style={{
                    display:
                      "flex",

                    justifyContent:
                      "space-between",

                    alignItems:
                      "center",

                    padding:
                      "14px 4px",
                  }}
                >
                  <span
                    style={{
                      color:
                        "#666",
                    }}
                  >
                    Showing{" "}
                    {startIndex +
                      1}
                    -
                    {Math.min(
                      startIndex +
                        ITEMS_PER_PAGE,
                      filteredSubmissions
                        .length,
                    )}{" "}
                    of{" "}
                    {
                      filteredSubmissions.length
                    }
                  </span>

                  <div
                    style={{
                      display:
                        "flex",

                      gap:
                        "8px",
                    }}
                  >
                    <button
                      type="button"
                      disabled={
                        currentPage ===
                        1
                      }
                      onClick={() =>
                        setCurrentPage(
                          (
                            page,
                          ) =>
                            Math.max(
                              1,
                              page -
                                1,
                            ),
                        )
                      }
                    >
                      Previous
                    </button>

                    <span>
                      Page{" "}
                      {
                        currentPage
                      }{" "}
                      /{" "}
                      {
                        totalPages
                      }
                    </span>

                    <button
                      type="button"
                      disabled={
                        currentPage ===
                        totalPages
                      }
                      onClick={() =>
                        setCurrentPage(
                          (
                            page,
                          ) =>
                            Math.min(
                              totalPages,
                              page +
                                1,
                            ),
                        )
                      }
                    >
                      Next
                    </button>
                  </div>
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

      {isSelectModalOpen && (
        <div
          onClick={() =>
            setIsSelectModalOpen(
              false,
            )
          }
          style={{
            position:
              "fixed",

            inset: 0,

            zIndex:
              1200,

            background:
              "rgba(0,0,0,0.55)",

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "center",

            padding:
              "20px",
          }}
        >
          <div
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
            style={{
              width:
                "100%",

              maxWidth:
                "430px",

              background:
                "white",

              borderRadius:
                "12px",

              padding:
                "24px",
            }}
          >
            <h2>
              Select Students
            </h2>

            <p
              style={{
                margin:
                  "10px 0 16px",

                color:
                  "#666",
              }}
            >
              Unassigned submitted
              students available:{" "}
              {
                assignableSubmissions.length
              }
            </p>

            {assignError && (
              <p
                style={{
                  color:
                    "#dc2626",

                  marginBottom:
                    "12px",
                }}
              >
                {assignError}
              </p>
            )}

            <label>
              Number of students
            </label>

            <input
              type="number"
              min={1}
              max={
                assignableSubmissions
                  .length ||
                1
              }
              value={
                selectionCount
              }
              onChange={(
                event,
              ) =>
                setSelectionCount(
                  event.target
                    .value,
                )
              }
              style={{
                width:
                  "100%",

                padding:
                  "11px 12px",

                marginTop:
                  "6px",

                border:
                  "1px solid #ccc",

                borderRadius:
                  "7px",
              }}
            />

            <div
              style={{
                display:
                  "flex",

                justifyContent:
                  "flex-end",

                gap:
                  "10px",

                marginTop:
                  "20px",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setIsSelectModalOpen(
                    false,
                  )
                }
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  handleSelectByCount
                }
                style={{
                  background:
                    "#d49600",

                  color:
                    "white",

                  border:
                    "none",

                  borderRadius:
                    "7px",

                  padding:
                    "10px 18px",
                }}
              >
                Select{" "}
                {selectionCount ||
                  "0"}
              </button>
            </div>
          </div>
        </div>
      )}

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