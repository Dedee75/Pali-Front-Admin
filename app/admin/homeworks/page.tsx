"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  ChangeEvent,
  FormEvent,
} from "react";
import { useRouter } from "next/navigation";

import styles from "./homework.module.css";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

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

type Batch = {
  id: number;
  name: string;
  status: boolean;
  teacherId: number;
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

  date.setDate(
    date.getDate() + 1,
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function createDefaultForm():
  HomeworkForm {
  return {
    title: "",
    description: "",
    batchId: "",
    dueDate: getTomorrow(),
    totalMarks: "100",
  };
}

function getArray<T>(
  result: unknown,
): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }

  if (
    result &&
    typeof result === "object" &&
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

export default function AdminHomeworkPage() {
  const router = useRouter();

  const [
    homeworks,
    setHomeworks,
  ] =
    useState<Homework[]>([]);

  const [
    batches,
    setBatches,
  ] =
    useState<Batch[]>([]);

  const [
    currentUser,
    setCurrentUser,
  ] =
    useState<LoginUser | null>(
      null,
    );

  const [
    formData,
    setFormData,
  ] =
    useState<HomeworkForm>(
      createDefaultForm(),
    );

  const [
    editingId,
    setEditingId,
  ] =
    useState<number | null>(
      null,
    );

  const [
    isModalOpen,
    setIsModalOpen,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    deletingId,
    setDeletingId,
  ] =
    useState<number | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    modalError,
    setModalError,
  ] =
    useState("");

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
          const message =
            Array.isArray(
              result?.message,
            )
              ? result.message.join(
                  ", ",
                )
              : result?.message ??
                "Request failed.";

          throw new Error(
            message,
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
        if (!silent) {
          setLoading(true);
        }

        setError("");

        try {
          const [
            homeworkResult,
            batchResult,
            submissionResult,
          ] =
            await Promise.all([
              apiFetch(
                "/homeworks",
              ),

              apiFetch(
                "/batches",
              ),

              apiFetch(
                "/homework-submissions",
              ),
            ]);

          const homeworkList =
            getArray<Homework>(
              homeworkResult,
            );

          const submissionList =
            getArray<
              HomeworkSubmissionSummary
            >(
              submissionResult,
            );

          const mergedHomeworks =
            homeworkList.map(
              (
                homework,
              ) => ({
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
              (
                batch,
              ) =>
                batch.status,
            ),
          );
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load homework.",
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
        router.replace(
          "/teacher/teacher-dashboard",
        );

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
   * Auto-refresh status.
   *
   * When teachers finish reviewing,
   * REVIEWED counts update here and
   * the pending hover/highlight disappears.
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

    const handleFocus =
      () => {
        void fetchData(
          true,
        );
      };

    window.addEventListener(
      "focus",
      handleFocus,
    );

    return () => {
      window.clearInterval(
        timer,
      );

      window.removeEventListener(
        "focus",
        handleFocus,
      );
    };
  }, [fetchData]);

  const homeworksByBatch =
    useMemo(
      () =>
        batches
          .map(
            (
              batch,
            ) => ({
              batch,

              homeworks:
                homeworks.filter(
                  (
                    homework,
                  ) =>
                    homework.batchId ===
                    batch.id,
                ),
            }),
          )
          .filter(
            (
              group,
            ) =>
              group.homeworks
                .length >
              0,
          ),
      [
        batches,
        homeworks,
      ],
    );

  const getCounts = (
    homework: Homework,
  ) => {
    const submissions =
      homework.submissions ??
      [];

    const totalStudents =
      submissions.length;

    const notSubmitted =
      submissions.filter(
        (
          submission,
        ) =>
          submission.status ===
          "PENDING",
      ).length;

    const waitingCheck =
      submissions.filter(
        (
          submission,
        ) =>
          submission.status ===
          "SUBMITTED",
      ).length;

    const checked =
      submissions.filter(
        (
          submission,
        ) =>
          submission.status ===
          "REVIEWED",
      ).length;

    const uploaded =
      waitingCheck +
      checked;

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
      return "-";
    }

    return new Date(
      date,
    ).toLocaleDateString();
  };

  const openHomeworkList = (
    homework: Homework,
    status:
      | "pending"
      | "completed"
      | "all",
  ) => {
    const params =
      new URLSearchParams({
        homeworkId:
          String(
            homework.id,
          ),

        status,
      });

    router.push(
      `/admin/homework-list?${params.toString()}`,
    );
  };

  const handleOpenCreate =
    () => {
      const form =
        createDefaultForm();

      if (batches[0]) {
        form.batchId =
          String(
            batches[0].id,
          );
      }

      setFormData(
        form,
      );

      setEditingId(
        null,
      );

      setModalError("");

      setIsModalOpen(
        true,
      );
    };

  const handleOpenEdit = (
    homework: Homework,
  ) => {
    setFormData({
      title:
        homework.title,

      description:
        homework.description ??
        "",

      batchId:
        String(
          homework.batchId,
        ),

      dueDate:
        homework.dueDate.slice(
          0,
          10,
        ),

      totalMarks:
        String(
          homework.totalMarks ??
          100,
        ),
    });

    setEditingId(
      homework.id,
    );

    setModalError("");

    setIsModalOpen(
      true,
    );
  };

  const handleCloseModal =
    () => {
      if (saving) {
        return;
      }

      setIsModalOpen(
        false,
      );

      setEditingId(
        null,
      );

      setModalError("");

      setFormData(
        createDefaultForm(),
      );
    };

  const handleChange = (
    event:
      ChangeEvent<
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
      >,
  ) => {
    const {
      name,
      value,
    } =
      event.target;

    setFormData(
      (
        previous,
      ) => ({
        ...previous,
        [name]: value,
      }),
    );
  };

  const handleSubmit =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      setModalError("");

      if (
        !formData.batchId
      ) {
        setModalError(
          "Please select a batch.",
        );

        return;
      }

      const totalMarks =
        Number(
          formData.totalMarks,
        );

      if (
        !Number.isInteger(
          totalMarks,
        ) ||
        totalMarks <= 0
      ) {
        setModalError(
          "Total marks must be greater than 0.",
        );

        return;
      }

      const payload = {
        title:
          formData.title.trim(),

        description:
          formData.description.trim(),

        batchId:
          Number(
            formData.batchId,
          ),

        dueDate:
          new Date(
            `${formData.dueDate}T23:59:59.000Z`,
          ).toISOString(),

        totalMarks,
      };

      setSaving(
        true,
      );

      try {
        if (
          editingId ===
          null
        ) {
          await apiFetch(
            "/homeworks",
            {
              method:
                "POST",

              body:
                JSON.stringify(
                  payload,
                ),
            },
          );
        } else {
          await apiFetch(
            `/homeworks/${editingId}`,
            {
              method:
                "PATCH",

              body:
                JSON.stringify(
                  payload,
                ),
            },
          );
        }

        setIsModalOpen(
          false,
        );

        setEditingId(
          null,
        );

        setFormData(
          createDefaultForm(),
        );

        await fetchData();
      } catch (err) {
        setModalError(
          err instanceof Error
            ? err.message
            : "Failed to save homework.",
        );
      } finally {
        setSaving(
          false,
        );
      }
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

  const handleDelete =
    async (
      homework: Homework,
    ) => {
      const confirmed =
        window.confirm(
          `Delete "${homework.title}"?`,
        );

      if (!confirmed) {
        return;
      }

      setDeletingId(
        homework.id,
      );

      setError("");

      try {
        await apiFetch(
          `/homeworks/${homework.id}`,
          {
            method:
              "DELETE",
          },
        );

        setHomeworks(
          (
            previous,
          ) =>
            previous.filter(
              (
                item,
              ) =>
                item.id !==
                homework.id,
            ),
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to delete homework.",
        );
      } finally {
        setDeletingId(
          null,
        );
      }
    };

  const handleLogout =
    () => {
      localStorage.removeItem(
        "accessToken",
      );

      localStorage.removeItem(
        "user",
      );

      router.replace("/");
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b8860b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
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
              styles.contentHeader
            }
          >
            <div>
              <h1
                className={
                  styles.pageTitle
                }
              >
                Homeworks
              </h1>

              <p
                className={
                  styles.pageSubtitle
                }
              >
                Create and manage all
                registered homework.
              </p>
            </div>

            <div
              className={
                styles.headerActions
              }
            >
              <div
                className={
                  styles.filterDropdown
                }
              >
                All Batches and
                Assignments
              </div>

              <button
                type="button"
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
                }
              >
                Add New Homework
              </button>
            </div>
          </div>

          {error && (
            <div
              className={
                styles.errorMessage
              }
            >
              {error}
            </div>
          )}

          <div
            className={
              styles.scrollContainer
            }
          >
            {loading && (
              <p
                className={
                  styles.loadingText
                }
              >
                Loading homework...
              </p>
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
                    }
                  >
                    <h2
                      className={
                        styles.batchTitle
                      }
                    >
                      {batch.name}
                    </h2>

                    <div
                      className={
                        styles.cardRowWrapper
                      }
                    >
                      <div
                        className={
                          styles.cardRow
                        }
                      >
                        {batchHomeworks.map(
                          (
                            homework,
                          ) => {
                            const counts =
                              getCounts(
                                homework,
                              );

                            /*
                             * Active only while at least
                             * one uploaded homework still
                             * needs teacher review.
                             */
                            const isPending =
                              counts.waitingCheck >
                              0;

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
 
                              >
                                <div
                                  className={
                                    styles.cardActions
                                  }
                                >
                                  <button
                                    type="button"
                                    className={
                                      styles.editBtn
                                    }
                                    onClick={() =>
                                      handleOpenEdit(
                                        homework,
                                      )
                                    }
                                    title="Edit Homework"
                                    aria-label={`Edit ${homework.title}`}
                                  >
                                    <svg
                                      width="15"
                                      height="15"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      aria-hidden="true"
                                    >
                                      <path d="M12 20h9" />
                                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                    </svg>

                                    <span>
                                      Edit
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    className={
                                      styles.deleteBtn
                                    }
                                    onClick={() =>
                                      void handleDelete(
                                        homework,
                                      )
                                    }
                                    disabled={
                                      deletingId ===
                                      homework.id
                                    }
                                    title="Delete Homework"
                                    aria-label={`Delete ${homework.title}`}
                                  >
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
                                          width="15"
                                          height="15"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          aria-hidden="true"
                                        >
                                          <polyline points="3 6 5 6 21 6" />
                                          <path d="M19 6l-1 14H6L5 6" />
                                          <path d="M10 11v6" />
                                          <path d="M14 11v6" />
                                          <path d="M9 6V4h6v2" />
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
                                  }
                                >
                                  {
                                    homework.title
                                  }
                                </h3>

                                <div
                                  className={
                                    styles.cardDetails
                                  }
                                >
                                  <div
                                    className={
                                      styles.detailRow
                                    }
                                  >
                                    <span
                                      className={
                                        styles.detailLabel
                                      }
                                    >
                                      Date
                                    </span>

                                    <span
                                      className={
                                        styles.detailValue
                                      }
                                    >
                                      {formatDate(
                                        homework.createdAt,
                                      )}
                                    </span>
                                  </div>

                                  <div
                                    className={
                                      styles.detailRow
                                    }
                                  >
                                    <span
                                      className={
                                        styles.detailLabel
                                      }
                                    >
                                      Close
                                    </span>

                                    <span
                                      className={
                                        styles.detailValue
                                      }
                                    >
                                      {formatDate(
                                        homework.dueDate,
                                      )}
                                    </span>
                                  </div>

                                  <div
                                    className={
                                      styles.detailRow
                                    }
                                  >
                                    <span
                                      className={
                                        styles.detailLabel
                                      }
                                    >
                                      Upload
                                    </span>

                                    <span
                                      className={
                                        styles.countBadge
                                      }
                                    >
                                      {
                                        counts.uploaded
                                      }
                                    </span>
                                  </div>

                                  <div
                                    className={
                                      styles.detailRow
                                    }
                                  >
                                    <span
                                      className={
                                        styles.detailLabel
                                      }
                                    >
                                      Waiting Check
                                    </span>

                                    <span
                                      className={
                                        counts.waitingCheck > 0
                                          ? styles.pendingCount
                                          : styles.countBadge
                                      }
                                    >
                                      {
                                        counts.waitingCheck
                                      }
                                    </span>
                                  </div>

                                  <div
                                    className={
                                      styles.detailRow
                                    }
                                  >
                                    <span
                                      className={
                                        styles.detailLabel
                                      }
                                    >
                                      Checked
                                    </span>

                                    <span
                                      className={
                                        styles.checkedCount
                                      }
                                    >
                                      {
                                        counts.checked
                                      }
                                    </span>
                                  </div>
                                </div>

                                <div
                                  className={
                                    styles.cardBottom
                                  }
                                >
                                  <div
                                    className={
                                      styles.studentCount
                                    }
                                  >
                                    <svg
                                      width="16"
                                      height="16"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      aria-hidden="true"
                                    >
                                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                      <circle cx="9" cy="7" r="4" />
                                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                    </svg>

                                    <span>
                                      {counts.totalStudents} Students
                                    </span>
                                  </div>

                                  {isPending ? (
                                    <button
                                      type="button"
                                      className={
                                        styles.btnCheck
                                      }
                                      onClick={() =>
                                        openHomeworkList(
                                          homework,
                                          "pending",
                                        )
                                      }
                                    >
                                      <svg
                                        width="15"
                                        height="15"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                      >
                                        <path d="M9 11l3 3L22 4" />
                                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                                      </svg>

                                      Check
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className={
                                        styles.btnView
                                      }
                                      onClick={() =>
                                        openHomeworkList(
                                          homework,
                                          "all",
                                        )
                                      }
                                    >
                                      <svg
                                        width="15"
                                        height="15"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                      >
                                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                                        <circle cx="12" cy="12" r="3" />
                                      </svg>

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
            }
          >
            O-Technique-Myanmar-2026@
          </div>
        </main>
      </div>

      {isModalOpen && (
        <div
          className={
            styles.modalOverlay
          }
          onClick={
            handleCloseModal
          }
        >
          <div
            className={
              styles.modalContent
            }
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
          >
            <div
              className={
                styles.modalHeader
              }
            >
              <div>
                <h2
                  className={
                    styles.modalTitle
                  }
                >
                  {editingId
                    ? "Edit Homework"
                    : "Add New Homework"}
                </h2>

                <p
                  className={
                    styles.modalSubtitle
                  }
                >
                  {editingId
                    ? "Update the homework information below."
                    : "Create a new homework assignment for a batch."}
                </p>
              </div>

              <button
                type="button"
                className={
                  styles.modalCloseBtn
                }
                onClick={
                  handleCloseModal
                }
                disabled={
                  saving
                }
                aria-label="Close"
                title="Close"
              >
                ×
              </button>
            </div>

            {modalError && (
              <div
                className={
                  styles.modalError
                }
              >
                {modalError}
              </div>
            )}

            <form
              className={
                styles.modalForm
              }
              onSubmit={
                handleSubmit
              }
            >
              <label className={styles.formLabel}>
                Homework Title
              </label>

              <input
                type="text"
                name="title"
                required
                value={
                  formData.title
                }
                onChange={
                  handleChange
                }
                className={styles.formControl}
              />

              <label className={styles.formLabel}>
                Description
              </label>

              <textarea
                name="description"
                value={
                  formData.description
                }
                onChange={
                  handleChange
                }
                rows={4}
                className={styles.formControl}
              />

              <label className={styles.formLabel}>
                Batch
              </label>

              <select
                name="batchId"
                required
                value={
                  formData.batchId
                }
                onChange={
                  handleChange
                }
                className={styles.formControl}
              >
                <option value="">
                  Select batch
                </option>

                {batches.map(
                  (
                    batch,
                  ) => (
                    <option
                      key={
                        batch.id
                      }
                      value={
                        batch.id
                      }
                    >
                      {batch.name}
                    </option>
                  ),
                )}
              </select>

              <label className={styles.formLabel}>
                Due Date
              </label>

              <input
                type="date"
                name="dueDate"
                required
                value={
                  formData.dueDate
                }
                onChange={
                  handleChange
                }
                className={styles.formControl}
              />

              <label className={styles.formLabel}>
                Total Marks
              </label>

              <input
                type="number"
                name="totalMarks"
                required
                min={1}
                value={
                  formData.totalMarks
                }
                onChange={
                  handleChange
                }
                className={styles.formControl}
              />

              <div
                className={
                  styles.modalActions
                }
              >
                <button
                  type="button"
                  className={
                    styles.cancelBtn
                  }
                  onClick={
                    handleCloseModal
                  }
                  disabled={
                    saving
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={
                    styles.saveBtn
                  }
                  disabled={
                    saving
                  }
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Update"
                      : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        /*
         * Remove hover/active effect after
         * all submitted homework is reviewed.
         */
        .homeworkNoActiveHover:hover {
          transform: none !important;
          box-shadow: none !important;
          cursor: default !important;
        }
      `}</style>
    </div>
  );
}