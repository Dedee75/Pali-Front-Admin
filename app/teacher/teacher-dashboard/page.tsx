"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import styles from "./teacher-dashboard.module.css";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000";

type LoginUser = {
  id: number;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "TEACHER";
  isActive: boolean;
};

type HomeworkSummary = {
  homeworkId: number;
  title: string;
  createdAt: string;
  dueDate: string;
  batch: {
    id: number;
    name: string;
  };
  assignedCount: number;
  checkedCount: number;
  pendingCount: number;
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

export default function TeacherDashboardPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] =
    useState<LoginUser | null>(null);
  const [assignments, setAssignments] =
    useState<HomeworkSummary[]>([]);
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
        router.replace("/");
        throw new Error(
          "Teacher account required.",
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

  const loadDashboard =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const result = await apiFetch(
          "/homework-submissions/teacher/dashboard",
        );

        setAssignments(
          getArray<HomeworkSummary>(
            result,
          ),
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load dashboard.",
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

      if (user.role !== "TEACHER") {
        router.replace("/");
        return;
      }

      setCurrentUser(user);
      void loadDashboard();
    } catch {
      localStorage.removeItem(
        "accessToken",
      );
      localStorage.removeItem("user");
      router.replace("/");
    }
  }, [loadDashboard, router]);

  const groupedAssignments =
    useMemo(() => {
      const groups = new Map<
        string,
        HomeworkSummary[]
      >();

      for (const assignment of assignments) {
        const batchName =
          assignment.batch.name;

        const current =
          groups.get(batchName) ?? [];

        current.push(assignment);
        groups.set(batchName, current);
      }

      return Array.from(
        groups.entries(),
      ).map(([batchName, items]) => ({
        batchName,
        items: [...items].sort(
          (a, b) =>
            b.pendingCount -
            a.pendingCount,
        ),
      }));
    }, [assignments]);

  const openHomework = (
    assignment: HomeworkSummary,
  ) => {
    const status =
      assignment.pendingCount > 0
        ? "pending"
        : "completed";

    router.push(
      `/teacher/homework-list?homeworkId=${assignment.homeworkId}&status=${status}`,
    );
  };

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString();

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
              styles.contentHeader
            }
          >
            <div>
              <h1
                className={
                  styles.pageTitle
                }
              >
                Dashboard
              </h1>
              <p
                className={
                  styles.pageSubtitle
                }
              >
                Only homework assigned
                to your account is shown.
              </p>
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
              styles.scrollContainer
            }
          >
            {loading && (
              <div
                style={{
                  padding: "40px",
                  textAlign: "center",
                }}
              >
                Loading assigned
                homework...
              </div>
            )}

            {!loading &&
              groupedAssignments.map(
                (group) => (
                  <section
                    key={
                      group.batchName
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
                      {group.batchName}
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
                        {group.items.map(
                          (task) => {
                            const isPending =
                              task.pendingCount >
                              0;

                            return (
                              <div
                                key={
                                  task.homeworkId
                                }
                                className={`${styles.card} ${
                                  isPending
                                    ? styles.cardPending
                                    : styles.cardCompleted
                                }`}
                              >
                                <h3
                                  className={
                                    styles.cardTitle
                                  }
                                >
                                  {task.title}
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
                                        task.createdAt,
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
                                        task.dueDate,
                                      )}
                                    </span>
                                  </div>

                                  <div
                                    className={
                                      styles.detailRow
                                    }
                                  >
                                    <span>
                                      Assigned
                                    </span>
                                    <span>
                                      {
                                        task.assignedCount
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
                                        task.checkedCount
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
                                    <div
                                      className={
                                        styles.avatarMore
                                      }
                                    >
                                      +
                                      {
                                        task.assignedCount
                                      }
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    className={
                                      isPending
                                        ? styles.btnCheck
                                        : styles.btnView
                                    }
                                    onClick={() =>
                                      openHomework(
                                        task,
                                      )
                                    }
                                  >
                                    {isPending
                                      ? `Check (${task.pendingCount})`
                                      : "View"}
                                  </button>
                                </div>
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>
                  </section>
                ),
              )}

            {!loading &&
              assignments.length ===
                0 && (
                <div
                  style={{
                    padding: "50px",
                    textAlign:
                      "center",
                    color: "#777",
                  }}
                >
                  No homework has been
                  assigned to your
                  account.
                </div>
              )}
          </div>

          <footer
            className={styles.footer}
          >
            O-Technique-Myanmar-2026@
          </footer>
        </main>
      </div>
    </div>
  );
}
