"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import type {
  ChangeEvent,
  FormEvent,
} from "react";

import { useRouter } from "next/navigation";
import styles from "./admin.module.css";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000";

type UserRole = "SUPER_ADMIN" | "TEACHER";

type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type LoginUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

type UserForm = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  isActive: "true" | "false";
};

const defaultForm: UserForm = {
  name: "",
  email: "",
  password: "",
  role: "TEACHER",
  isActive: "true",
};

export default function AdminPage() {
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] =
    useState<LoginUser | null>(null);

  const [formData, setFormData] =
    useState<UserForm>(defaultForm);

  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [isModalOpen, setIsModalOpen] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  // =========================================
  // Authenticated API Request
  // =========================================
  const apiFetch = useCallback(
    async (
      endpoint: string,
      options: RequestInit = {},
    ) => {
      const token =
        localStorage.getItem("accessToken");

      if (!token) {
        router.replace("/");
        throw new Error("Please login first");
      }

      const response = await fetch(
        `${API_URL}${endpoint}`,
        {
          ...options,

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...options.headers,
          },
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
          "Your login session has expired",
        );
      }

      if (!response.ok) {
        const message = Array.isArray(
          result?.message,
        )
          ? result.message.join(", ")
          : result?.message ??
            "Request failed";

        throw new Error(message);
      }

      return result;
    },
    [router],
  );

  // =========================================
  // Fetch Users
  // =========================================
  const fetchUsers = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        const result =
          await apiFetch("/users");

        const userList = Array.isArray(result)
          ? result
          : result?.data ?? [];

        setUsers(userList);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load users",
        );
      } finally {
        setLoading(false);
      }
    },
    [apiFetch],
  );

  // =========================================
  // Initial Load
  // =========================================
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
      void fetchUsers();
    } catch {
      localStorage.removeItem(
        "accessToken",
      );
      localStorage.removeItem("user");
      router.replace("/");
    }
  }, [fetchUsers, router]);

  // =========================================
  // Open Create Modal
  // =========================================
  const handleOpenCreate = () => {
    setFormData(defaultForm);
    setEditingId(null);
    setError("");
    setIsModalOpen(true);
  };

  // =========================================
  // Open Edit Modal
  // =========================================
  const handleOpenEdit = (
    user: User,
  ) => {
    setFormData({
      name: user.name,
      email: user.email,

      // Password ကို backend က မပို့ပါ
      password: "",

      role: user.role,

      isActive: user.isActive
        ? "true"
        : "false",
    });

    setEditingId(user.id);
    setError("");
    setIsModalOpen(true);
  };

  // =========================================
  // Form Change
  // =========================================
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

  // =========================================
  // Create / Update User
  // =========================================
  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (
      editingId === null &&
      !formData.password
    ) {
      setError(
        "Password is required",
      );
      return;
    }

    setSaving(true);
    setError("");

    const payload: {
      name: string;
      email: string;
      role: UserRole;
      isActive: boolean;
      password?: string;
    } = {
      name: formData.name.trim(),

      email: formData.email
        .trim()
        .toLowerCase(),

      role: formData.role,

      isActive:
        formData.isActive === "true",
    };

    // Editing မှာ password blank ဖြစ်ရင်
    // password အဟောင်းကို မပြောင်းပါ
    if (formData.password.trim()) {
      payload.password =
        formData.password;
    }

    try {
      if (editingId === null) {
        // Create
        await apiFetch("/users", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } else {
        // Update
        await apiFetch(
          `/users/${editingId}`,
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
      setFormData(defaultForm);

      await fetchUsers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save user",
      );
    } finally {
      setSaving(false);
    }
  };

  // =========================================
  // Delete User
  // =========================================
  const handleDelete = async (
    id: number,
  ) => {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this user?",
      );

    if (!confirmed) return;

    setError("");

    try {
      await apiFetch(`/users/${id}`, {
        method: "DELETE",
      });

      setUsers((previous) =>
        previous.filter(
          (user) => user.id !== id,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete user",
      );
    }
  };

  // =========================================
  // Logout
  // =========================================
  const handleLogout = () => {
    localStorage.removeItem(
      "accessToken",
    );
    localStorage.removeItem("user");

    router.replace("/");
  };

  // =========================================
  // Initials
  // =========================================
  const getInitials = (
    name: string,
  ) => {
    return name
      .split(" ")
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className={styles.container}>
      {/* Navbar */}
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
        {/* Sidebar */}
        <aside className={styles.sidebar}>
  <button
    type="button"
    className={`${styles.sideBtn} ${styles.activeBtn}`}
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

        {/* Main */}
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
                Users
              </h1>

              <p
                className={
                  styles.pageSubtitle
                }
              >
                Manage all admins and
                teachers.
              </p>
            </div>

            <div
              className={
                styles.headerActions
              }
            >
              <button
                className={
                  styles.btnAddUser
                }
                onClick={
                  handleOpenCreate
                }
              >
                Add New User
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                color: "#dc2626",
                marginBottom: "16px",
                padding: "10px",
                background: "#fef2f2",
                borderRadius: "6px",
              }}
            >
              {error}
            </div>
          )}

          {/* Table */}
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
                  <th>User Name</th>
                  <th>Role</th>
                  <th>Password</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        textAlign:
                          "center",
                        padding: "30px",
                      }}
                    >
                      Loading users...
                    </td>
                  </tr>
                )}

                {!loading &&
                  users.map(
                    (user, index) => (
                      <tr
                        key={user.id}
                        className={
                          index % 2 ===
                          0
                            ? styles.rowEven
                            : styles.rowOdd
                        }
                      >
                        <td>
                          <div
                            className={
                              styles.userCell
                            }
                          >
                            <div
                              className={
                                styles.userInitials
                              }
                            >
                              {getInitials(
                                user.name,
                              )}
                            </div>

                            <div>
                              <div
                                className={
                                  styles.userName
                                }
                              >
                                {user.name}
                              </div>

                              <div
                                className={
                                  styles.userEmail
                                }
                              >
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span
                            className={
                              user.role ===
                              "SUPER_ADMIN"
                                ? styles.roleAdmin
                                : styles.roleTeacher
                            }
                          >
                            {user.role ===
                            "SUPER_ADMIN"
                              ? "Admin"
                              : "Teacher"}
                          </span>
                        </td>

                        <td
                          className={
                            styles.passwordText
                          }
                        >
                          ••••••••
                        </td>

                        <td>
                          <span
                            className={
                              user.isActive
                                ? styles.statusActive
                                : styles.statusLeave
                            }
                          >
                            <span
                              className={
                                styles.statusDot
                              }
                            />

                            {user.isActive
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </td>

                        <td>
                          <div
                            className={
                              styles.actionButtonsRow
                            }
                          >
                            <button
                              className={
                                styles.editBtn
                              }
                              onClick={() =>
                                handleOpenEdit(
                                  user,
                                )
                              }
                              title="Edit User"
                            >
                              Edit
                            </button>

                            <button
                              className={
                                styles.deleteBtn
                              }
                              onClick={() =>
                                void handleDelete(
                                  user.id,
                                )
                              }
                              title="Delete User"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}

                {!loading &&
                  users.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          textAlign:
                            "center",
                          padding:
                            "30px",
                        }}
                      >
                        No users found.
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
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

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div
          className={
            styles.modalOverlay
          }
          onClick={() =>
            setIsModalOpen(false)
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
                ? "Edit User"
                : "Add New User"}
            </h2>

            <form
              onSubmit={handleSubmit}
            >
              <div
                className={
                  styles.formGroup
                }
              >
                <label>Name</label>

                <input
                  type="text"
                  name="name"
                  required
                  value={
                    formData.name
                  }
                  onChange={
                    handleChange
                  }
                  className={
                    styles.inputField
                  }
                  placeholder="John Doe"
                />
              </div>

              <div
                className={
                  styles.formGroup
                }
              >
                <label>Email</label>

                <input
                  type="email"
                  name="email"
                  required
                  value={
                    formData.email
                  }
                  onChange={
                    handleChange
                  }
                  className={
                    styles.inputField
                  }
                  placeholder="john@example.com"
                />
              </div>

              <div
                className={
                  styles.formGroup
                }
              >
                <label>Role</label>

                <select
                  name="role"
                  value={
                    formData.role
                  }
                  onChange={
                    handleChange
                  }
                  className={
                    styles.inputField
                  }
                >
                  <option value="SUPER_ADMIN">
                    Admin
                  </option>

                  <option value="TEACHER">
                    Teacher
                  </option>
                </select>
              </div>

              <div
                className={
                  styles.formGroup
                }
              >
                <label>
                  Password
                </label>

                <input
                  type="password"
                  name="password"
                  required={
                    editingId === null
                  }
                  value={
                    formData.password
                  }
                  onChange={
                    handleChange
                  }
                  className={
                    styles.inputField
                  }
                  placeholder={
                    editingId
                      ? "Leave empty to keep old password"
                      : "Set password"
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
                  name="isActive"
                  value={
                    formData.isActive
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
                    Inactive
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
                  onClick={() =>
                    setIsModalOpen(
                      false,
                    )
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