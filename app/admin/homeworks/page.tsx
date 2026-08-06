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

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000";

type UserRole = "SUPER_ADMIN" | "TEACHER";
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
  status: SubmissionStatus;
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
  _count?: {
    submissions: number;
  };
  uploadCount?: number;
  checkedCount?: number;
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
    title: "",
    description: "",
    batchId: "",
    dueDate: getTomorrow(),
    totalMarks: "100",
  };
}

function getArray<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }

  if (
    result &&
    typeof result === "object" &&
    "data" in result &&
    Array.isArray(
      (result as { data?: unknown }).data,
    )
  ) {
    return (result as { data: T[] }).data;
  }

  return [];
}

export default function AdminHomeworkPage() {
  const router = useRouter();

  const [homeworks, setHomeworks] =
    useState<Homework[]>([]);
  const [batches, setBatches] =
    useState<Batch[]>([]);
  const [currentUser, setCurrentUser] =
    useState<LoginUser | null>(null);

  const [formData, setFormData] =
    useState<HomeworkForm>(
      createDefaultForm,
    );

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
    useState("");
  const [modalError, setModalError] =
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

      if (response.status === 401) {
        localStorage.removeItem(
          "accessToken",
        );
        localStorage.removeItem("user");
        router.replace("/");

        throw new Error(
          "Your login session has expired.",
        );
      }

      if (response.status === 403) {
        throw new Error(
          "You do not have permission.",
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

  const fetchData =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const [
          homeworkResult,
          batchResult,
        ] = await Promise.all([
          apiFetch("/homeworks"),
          apiFetch("/batches"),
        ]);

        setHomeworks(
          getArray<Homework>(
            homeworkResult,
          ),
        );

        setBatches(
          getArray<Batch>(
            batchResult,
          ).filter(
            (batch) => batch.status,
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
    }, [apiFetch]);

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

      if (
        user.role !== "SUPER_ADMIN"
      ) {
        router.replace(
          "/teacher/teacher-dashboard",
        );
        return;
      }

      setCurrentUser(user);
      void fetchData();
    } catch {
      localStorage.removeItem(
        "accessToken",
      );
      localStorage.removeItem("user");
      router.replace("/");
    }
  }, [fetchData, router]);

  const homeworksByBatch =
    useMemo(() => {
      return batches
        .map((batch) => ({
          batch,
          homeworks: homeworks.filter(
            (homework) =>
              homework.batchId ===
              batch.id,
          ),
        }))
        .filter(
          (group) =>
            group.homeworks.length > 0,
        );
    }, [batches, homeworks]);

  const getCounts = (
    homework: Homework,
  ) => {
    const submissions =
      homework.submissions ?? [];

    const uploaded =
      homework.uploadCount ??
      homework._count?.submissions ??
      submissions.length;

    const checked =
      homework.checkedCount ??
      submissions.filter(
        (submission) =>
          submission.status ===
          "REVIEWED",
      ).length;

    return {
      uploaded,
      checked,
      pending: Math.max(
        0,
        uploaded - checked,
      ),
    };
  };

  const formatDate = (
    date?: string,
  ) => {
    if (!date) return "-";

    return new Date(
      date,
    ).toLocaleDateString();
  };

  const openHomeworkList = (
    homework: Homework,
    status: "pending" | "completed",
  ) => {
    const params =
      new URLSearchParams({
        homeworkId: String(
          homework.id,
        ),
        status,
      });

    router.push(
      `/admin/homework-list?${params.toString()}`,
    );
  };

  const handleOpenCreate = () => {
    const form = createDefaultForm();

    if (batches[0]) {
      form.batchId = String(
        batches[0].id,
      );
    }

    setFormData(form);
    setEditingId(null);
    setModalError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (
    homework: Homework,
  ) => {
    setFormData({
      title: homework.title,
      description:
        homework.description ?? "",
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
    setModalError("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (saving) return;

    setIsModalOpen(false);
    setEditingId(null);
    setModalError("");
    setFormData(
      createDefaultForm(),
    );
  };

  const handleChange = (
    event: ChangeEvent<
      HTMLInputElement |
      HTMLTextAreaElement |
      HTMLSelectElement
    >,
  ) => {
    const { name, value } =
      event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setModalError("");

    if (!formData.batchId) {
      setModalError(
        "Please select a batch.",
      );
      return;
    }

    const totalMarks = Number(
      formData.totalMarks,
    );

    if (
      !Number.isInteger(totalMarks) ||
      totalMarks <= 0
    ) {
      setModalError(
        "Total marks must be greater than 0.",
      );
      return;
    }

    const payload = {
      title: formData.title.trim(),
      description:
        formData.description.trim(),
      batchId: Number(
        formData.batchId,
      ),
      dueDate: new Date(
        `${formData.dueDate}T23:59:59.000Z`,
      ).toISOString(),
      totalMarks,
    };

    setSaving(true);

    try {
      if (editingId === null) {
        await apiFetch(
          "/homeworks",
          {
            method: "POST",
            body: JSON.stringify(
              payload,
            ),
          },
        );
      } else {
        await apiFetch(
          `/homeworks/${editingId}`,
          {
            method: "PATCH",
            body: JSON.stringify(
              payload,
            ),
          },
        );
      }

      setIsModalOpen(false);
      setEditingId(null);
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
      setSaving(false);
    }
  };

  const handleDelete = async (
    homework: Homework,
  ) => {
    const confirmed =
      window.confirm(
        `Delete "${homework.title}"?`,
      );

    if (!confirmed) return;

    setDeletingId(homework.id);
    setError("");

    try {
      await apiFetch(
        `/homeworks/${homework.id}`,
        {
          method: "DELETE",
        },
      );

      setHomeworks((previous) =>
        previous.filter(
          (item) =>
            item.id !== homework.id,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete homework.",
      );
    } finally {
      setDeletingId(null);
    }
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
            Dhamma Admin
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
              "Super Admin"}
          </span>

          <button
            type="button"
            className={styles.logoutBtn}
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
        <aside className={styles.sidebar}>
  <button
    type="button"
    className={styles.sideBtn}
    onClick={() =>
      router.push("/admin/admin")
    }
  >
    Users
  </button>

  <button
    type="button"
    className={styles.sideBtn}
    onClick={() =>
      router.push("/admin/batches")
    }
  >
    Batches
  </button>

  <button
    type="button"
    className={`${styles.sideBtn} ${styles.activeBtn}`}
    onClick={() =>
      router.push("/admin/homeworks")
    }
  >
    Homework
  </button>

  <button
    type="button"
    className={styles.sideBtn}
    onClick={() =>
      router.push("/admin/students")
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
                <span>
                  All Batches and
                  Assignments
                </span>
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
                  batches.length === 0
                }
              >
                Add New Homework
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                color: "#dc2626",
                background: "#fef2f2",
                padding: "10px 12px",
                borderRadius: "6px",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          {!loading &&
            batches.length === 0 && (
              <div
                style={{
                  color: "#92400e",
                  background: "#fffbeb",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  marginBottom: "16px",
                }}
              >
                Create an active batch
                before creating homework.
              </div>
            )}

          <div
            className={
              styles.scrollContainer
            }
          >
            {loading && (
              <p
                style={{
                  padding: "20px",
                }}
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
                    key={batch.id}
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
                          (homework) => {
                            const counts =
                              getCounts(
                                homework,
                              );

                            const isPending =
                              counts.pending >
                              0;

                            return (
                              <div
                                key={
                                  homework.id
                                }
                                className={`${styles.card} ${
                                  isPending
                                    ? styles.cardPending
                                    : styles.cardCompleted
                                }`}
                                style={{
                                  position:
                                    "relative",
                                }}
                              >
                                <div
                                  style={{
                                    position:
                                      "absolute",
                                    top: "8px",
                                    right: "8px",
                                    display:
                                      "flex",
                                    gap: "6px",
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenEdit(
                                        homework,
                                      )
                                    }
                                    title="Edit homework"
                                    style={{
                                      border:
                                        "none",
                                      background:
                                        "transparent",
                                      color:
                                        "#2563eb",
                                      cursor:
                                        "pointer",
                                      fontSize:
                                        "12px",
                                    }}
                                  >
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleDelete(
                                        homework,
                                      )
                                    }
                                    disabled={
                                      deletingId ===
                                      homework.id
                                    }
                                    title="Delete homework"
                                    style={{
                                      border:
                                        "none",
                                      background:
                                        "transparent",
                                      color:
                                        "#dc2626",
                                      cursor:
                                        "pointer",
                                      fontSize:
                                        "12px",
                                    }}
                                  >
                                    {deletingId ===
                                    homework.id
                                      ? "..."
                                      : "Delete"}
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
                                    <span>
                                      Date
                                    </span>
                                    <span>
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
                                    <span>
                                      Close
                                    </span>
                                    <span>
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
                                    <span>
                                      Upload
                                    </span>
                                    <span>
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
                                    <span>
                                      Checked
                                    </span>
                                    <span>
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
                                      styles.avatarGroup
                                    }
                                  >
                                    <img
                                      src="https://i.pravatar.cc/100?img=1"
                                      alt="Student"
                                    />
                                    <img
                                      src="https://i.pravatar.cc/100?img=2"
                                      alt="Student"
                                    />
                                    <img
                                      src="https://i.pravatar.cc/100?img=3"
                                      alt="Student"
                                    />
                                    <div
                                      className={
                                        styles.avatarMore
                                      }
                                    >
                                      {
                                        counts.uploaded
                                      }
                                      +
                                    </div>
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
                                          "completed",
                                        )
                                      }
                                    >
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

            {!loading &&
              homeworks.length === 0 && (
                <p
                  style={{
                    padding: "30px",
                    textAlign:
                      "center",
                  }}
                >
                  No homework found.
                </p>
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
          onClick={handleCloseModal}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background:
              "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              width: "100%",
              maxWidth: "520px",
              background: "white",
              borderRadius: "12px",
              padding: "24px",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h2
              style={{
                marginBottom: "18px",
              }}
            >
              {editingId
                ? "Edit Homework"
                : "Add New Homework"}
            </h2>

            {modalError && (
              <div
                style={{
                  color: "#dc2626",
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
                {modalError}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
            >
              <div
                style={{
                  marginBottom:
                    "14px",
                }}
              >
                <label>
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
                  placeholder="Assignment - 01"
                  style={{
                    width: "100%",
                    padding:
                      "10px 12px",
                    marginTop: "6px",
                  }}
                />
              </div>

              <div
                style={{
                  marginBottom:
                    "14px",
                }}
              >
                <label>
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
                  placeholder="Homework instructions"
                  style={{
                    width: "100%",
                    padding:
                      "10px 12px",
                    marginTop: "6px",
                    resize:
                      "vertical",
                  }}
                />
              </div>

              <div
                style={{
                  marginBottom:
                    "14px",
                }}
              >
                <label>Batch</label>
                <select
                  name="batchId"
                  required
                  value={
                    formData.batchId
                  }
                  onChange={
                    handleChange
                  }
                  style={{
                    width: "100%",
                    padding:
                      "10px 12px",
                    marginTop: "6px",
                  }}
                >
                  <option value="">
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
                        }
                      >
                        {batch.name}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div
                style={{
                  marginBottom:
                    "14px",
                }}
              >
                <label>
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
                  style={{
                    width: "100%",
                    padding:
                      "10px 12px",
                    marginTop: "6px",
                  }}
                />
              </div>

              <div
                style={{
                  marginBottom:
                    "18px",
                }}
              >
                <label>
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
                  style={{
                    width: "100%",
                    padding:
                      "10px 12px",
                    marginTop: "6px",
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "flex-end",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={
                    handleCloseModal
                  }
                  disabled={saving}
                  style={{
                    padding:
                      "10px 18px",
                    cursor:
                      "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding:
                      "10px 18px",
                    background:
                      "#b8860b",
                    color: "white",
                    border: "none",
                    borderRadius:
                      "6px",
                    cursor:
                      "pointer",
                  }}
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
    </div>
  );
}