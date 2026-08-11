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
import styles from "./batches.module.css";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000";

const PAGE_SIZE = 10;

type UserRole = "SUPER_ADMIN" | "TEACHER";

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

type Batch = {
  id: number;
  name: string;
  status: boolean;
  startDate: string;
  endDate: string;
  teacherId: number;
  teacher?: {
    id: number;
    name: string;
    email: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
};

type BatchForm = {
  name: string;
  teacherId: string;
  startDate: string;
  endDate: string;
  status: "true" | "false";
};

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultEndDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 3);
  return date.toISOString().slice(0, 10);
}

function createDefaultForm(): BatchForm {
  return {
    name: "",
    teacherId: "",
    startDate: getToday(),
    endDate: getDefaultEndDate(),
    status: "true",
  };
}

export default function BatchesPage() {
  const router = useRouter();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [currentUser, setCurrentUser] =
    useState<LoginUser | null>(null);

  const [formData, setFormData] =
    useState<BatchForm>(createDefaultForm);

  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [isModalOpen, setIsModalOpen] =
    useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] =
    useState<number | null>(null);

  const [error, setError] = useState("");
  const [modalError, setModalError] =
    useState("");

  const [currentPage, setCurrentPage] =
    useState(1);

  const apiFetch = useCallback(
    async (
      endpoint: string,
      options: RequestInit = {},
    ) => {
      const token =
        localStorage.getItem("accessToken");

      if (!token) {
        router.replace("/");
        throw new Error("Please login first.");
      }

      const headers = new Headers(options.headers);
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
        localStorage.removeItem("accessToken");
        localStorage.removeItem("user");
        router.replace("/");

        throw new Error(
          "Your login session has expired.",
        );
      }

      if (response.status === 403) {
        throw new Error(
          "You do not have permission to perform this action.",
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [batchResult, userResult] =
        await Promise.all([
          apiFetch("/batches"),
          apiFetch("/users"),
        ]);

      const batchList: Batch[] =
        Array.isArray(batchResult)
          ? batchResult
          : batchResult?.data ?? [];

      const userList: Teacher[] =
        Array.isArray(userResult)
          ? userResult
          : userResult?.data ?? [];

      setBatches(batchList);

      setTeachers(
        userList.filter(
          (user) =>
            user.role === "TEACHER" &&
            user.isActive,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load data.",
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
      const parsedUser =
        JSON.parse(storedUser) as LoginUser;

      if (
        parsedUser.role !== "SUPER_ADMIN"
      ) {
        router.replace(
          "/teacher/teacher-dashboard",
        );
        return;
      }

      setCurrentUser(parsedUser);
      void fetchData();
    } catch {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      router.replace("/");
    }
  }, [fetchData, router]);
   const DEFAULT_AVATAR =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
      <rect width="160" height="160" fill="#f3f4f6"/>
      <circle cx="80" cy="60" r="30" fill="#c9a227"/>
      <path d="M30 145c8-32 27-48 50-48s42 16 50 48" fill="#c9a227"/>
    </svg>
  `);


  const totalPages = Math.max(
    1,
    Math.ceil(batches.length / PAGE_SIZE),
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedBatches = useMemo(() => {
    const start =
      (currentPage - 1) * PAGE_SIZE;

    return batches.slice(
      start,
      start + PAGE_SIZE,
    );
  }, [batches, currentPage]);

  const getTeacher = (batch: Batch) => {
    if (batch.teacher) {
      return batch.teacher;
    }

    return (
      teachers.find(
        (teacher) =>
          teacher.id === batch.teacherId,
      ) ?? null
    );
  };

  const formatIdentity = (id: number) =>
    `BAT-${String(id).padStart(4, "0")}`;

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString();

  const handleOpenCreate = () => {
    const newForm = createDefaultForm();

    if (teachers.length > 0) {
      newForm.teacherId = String(
        teachers[0].id,
      );
    }

    setFormData(newForm);
    setEditingId(null);
    setModalError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (batch: Batch) => {
    setFormData({
      name: batch.name,
      teacherId: String(batch.teacherId),
      startDate:
        batch.startDate.slice(0, 10),
      endDate: batch.endDate.slice(0, 10),
      status: batch.status
        ? "true"
        : "false",
    });

    setEditingId(batch.id);
    setModalError("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (saving) return;

    setIsModalOpen(false);
    setEditingId(null);
    setModalError("");
    setFormData(createDefaultForm());
  };

  const handleChange = (
    event: ChangeEvent<
      HTMLInputElement |
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

    if (!formData.teacherId) {
      setModalError(
        "Please select a teacher.",
      );
      return;
    }

    const startDate = new Date(
      `${formData.startDate}T00:00:00.000Z`,
    );

    const endDate = new Date(
      `${formData.endDate}T00:00:00.000Z`,
    );

    if (endDate <= startDate) {
      setModalError(
        "End date must be later than start date.",
      );
      return;
    }

    const payload = {
      name: formData.name.trim(),
      teacherId: Number(
        formData.teacherId,
      ),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status: formData.status === "true",
    };

    setSaving(true);

    try {
      if (editingId === null) {
        await apiFetch("/batches", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(
          `/batches/${editingId}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );
      }

      handleCloseModal();
      await fetchData();
    } catch (err) {
      setModalError(
        err instanceof Error
          ? err.message
          : "Failed to save batch.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (
    id: number,
  ) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this batch?",
    );

    if (!confirmed) return;

    setDeletingId(id);
    setError("");

    try {
      await apiFetch(`/batches/${id}`, {
        method: "DELETE",
      });

      setBatches((previous) =>
        previous.filter(
          (batch) => batch.id !== id,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete batch.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    router.replace("/");
  };

  const firstEntry =
    batches.length === 0
      ? 0
      : (currentPage - 1) *
          PAGE_SIZE +
        1;

  const lastEntry = Math.min(
    currentPage * PAGE_SIZE,
    batches.length,
  );

  return (
    <div className={styles.container}>
      <header className={styles.navbar}>
        <div className={styles.navLeft}>
          <div className={styles.logoIcon}>
            A
          </div>

          <span
            className={styles.brandName}
          >
            Dhamma Admin
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
    className={`${styles.sideBtn} ${styles.activeBtn}`}
    onClick={() =>
      router.push("/admin/batches")
    }
    aria-current="page"
  >
    Batches
  </button>

  <button
    type="button"
    className={styles.sideBtn}
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
                Batches
              </h1>

              <p
                className={
                  styles.pageSubtitle
                }
              >
                Manage all registered
                batches.
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
                  styles.btnAdd
                }
                onClick={
                  handleOpenCreate
                }
                disabled={
                  loading ||
                  teachers.length === 0
                }
              >
                Add New
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
            teachers.length === 0 && (
              <div
                style={{
                  color: "#92400e",
                  background: "#fffbeb",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  marginBottom: "16px",
                }}
              >
                Create an active teacher
                before creating a batch.
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
                  <th>Identity</th>
                  <th>Teacher</th>
                  <th>Batch Name</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        textAlign:
                          "center",
                        padding: "30px",
                      }}
                    >
                      Loading batches...
                    </td>
                  </tr>
                )}

                {!loading &&
                  paginatedBatches.map(
                    (batch, index) => {
                      const teacher =
                        getTeacher(batch);

                      return (
                        <tr
                          key={batch.id}
                          className={`${
                            index % 2 === 0
                              ? styles.rowEven
                              : styles.rowOdd
                          } ${styles.clickableRow}`}
                          onClick={() =>
                            handleOpenEdit(batch)
                          }
                          onKeyDown={(event) => {
                            if (
                              event.key === "Enter" ||
                              event.key === " "
                            ) {
                              event.preventDefault();
                              handleOpenEdit(batch);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-label={`Edit ${batch.name}`}
                        >
                          <td
                            className={
                              styles.identityText
                            }
                          >
                            {formatIdentity(
                              batch.id,
                            )}
                          </td>

                          <td>
                            <div>
                              <div
                                className={
                                  styles.teacherName
                                }
                              >
                                {teacher?.name ??
                                  "Unknown Teacher"}
                              </div>

                              <div
                                className={
                                  styles.teacherEmail
                                }
                              >
                                {teacher?.email ??
                                  "-"}
                              </div>
                            </div>
                          </td>

                          <td>
                            <span
                              className={
                                styles.batchBadge
                              }
                            >
                              {batch.name}
                            </span>
                          </td>

                          <td>
                            {formatDate(
                              batch.startDate,
                            )}
                            {" - "}
                            {formatDate(
                              batch.endDate,
                            )}
                          </td>

                          <td>
                            <span
                              className={
                                batch.status
                                  ? styles.statusActive
                                  : styles.statusDone
                              }
                            >
                              <span
                                className={
                                  styles.statusDot
                                }
                              />
                              {batch.status
                                ? "Active"
                                : "Done"}
                            </span>
                          </td>

                          <td>
                            <div
                              className={
                                styles.actionButtonsRow
                              }
                            >
                              <button
                                type="button"
                                className={
                                  styles.deleteBtn
                                }
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleDelete(
                                    batch.id,
                                  );
                                }}
                                onKeyDown={(event) =>
                                  event.stopPropagation()
                                }
                                disabled={
                                  deletingId ===
                                  batch.id
                                }
                                title="Delete"
                                aria-label={`Delete ${batch.name}`}
                              >
                                {deletingId ===
                                batch.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    },
                  )}

                {!loading &&
                  batches.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          textAlign:
                            "center",
                          padding:
                            "30px",
                        }}
                      >
                        No batches found.
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
              {batches.length} entries
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
                  currentPage === 1
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
              >
                &lt;
              </button>

              {Array.from(
                {
                  length: totalPages,
                },
                (_, index) =>
                  index + 1,
              ).map((page) => (
                <button
                  type="button"
                  key={page}
                  className={`${styles.pageBtn} ${
                    page === currentPage
                      ? styles.pageActive
                      : ""
                  }`}
                  onClick={() =>
                    setCurrentPage(page)
                  }
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                className={
                  styles.pageBtn
                }
                disabled={
                  currentPage ===
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
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <h2
              className={
                styles.modalTitle
              }
            >
              {editingId
                ? "Edit Batch"
                : "Add New Batch"}
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
                className={
                  styles.formGroup
                }
              >
                <label>
                  Batch Name
                </label>

                <input
                  type="text"
                  name="name"
                  required
                  minLength={2}
                  value={
                    formData.name
                  }
                  onChange={
                    handleChange
                  }
                  className={
                    styles.inputField
                  }
                  placeholder="Batch 1"
                />
              </div>

              <div
                className={
                  styles.formGroup
                }
              >
                <label>Teacher</label>

                <select
                  name="teacherId"
                  required
                  value={
                    formData.teacherId
                  }
                  onChange={
                    handleChange
                  }
                  className={
                    styles.inputField
                  }
                >
                  <option value="">
                    Select teacher
                  </option>

                  {teachers.map(
                    (teacher) => (
                      <option
                        key={
                          teacher.id
                        }
                        value={
                          teacher.id
                        }
                      >
                        {teacher.name} -{" "}
                        {teacher.email}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div
                className={
                  styles.formGroup
                }
              >
                <label>
                  Start Date
                </label>

                <input
                  type="date"
                  name="startDate"
                  required
                  value={
                    formData.startDate
                  }
                  onChange={
                    handleChange
                  }
                  className={
                    styles.inputField
                  }
                />
              </div>

              <div
                className={
                  styles.formGroup
                }
              >
                <label>End Date</label>

                <input
                  type="date"
                  name="endDate"
                  required
                  min={
                    formData.startDate
                  }
                  value={
                    formData.endDate
                  }
                  onChange={
                    handleChange
                  }
                  className={
                    styles.inputField
                  }
                />
              </div>

              <div
                className={
                  styles.formGroup
                }
              >
                <label>Status</label>

                <select
                  name="status"
                  value={
                    formData.status
                  }
                  onChange={
                    handleChange
                  }
                  className={
                    styles.inputField
                  }
                >
                  <option value="true">
                    Active
                  </option>

                  <option value="false">
                    Done
                  </option>
                </select>
              </div>

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
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={
                    styles.saveBtn
                  }
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Update"
                      : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}