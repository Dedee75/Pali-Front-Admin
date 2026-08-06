"use client";

import {
  FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000";

type LoginResponse = {
  accessToken: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: "SUPER_ADMIN" | "TEACHER";
    isActive: boolean;
  };
};

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] = useState("");

  const handleLogin = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/auth/login`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ??
            "Invalid email or password",
        );
      }

      const data = result as LoginResponse;

      // Save login information
      localStorage.setItem(
        "accessToken",
        data.accessToken,
      );

      localStorage.setItem(
        "user",
        JSON.stringify(data.user),
      );

      // Redirect with role
      if (data.user.role === "SUPER_ADMIN") {
        router.push("/admin/admin");
        return;
      }

      if (data.user.role === "TEACHER") {
        router.push(
          "/teacher/teacher-dashboard",
        );
        return;
      }

      throw new Error("Invalid user role");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Login failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logoWrapper}>
          <svg
            width="60"
            height="60"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />

            <text
              x="12"
              y="14"
              fill="white"
              fontSize="10"
              stroke="none"
              textAnchor="middle"
              fontWeight="bold"
            >
              A
            </text>
          </svg>
        </div>

        <h1 className={styles.title}>
          Dhamma Education
        </h1>

        <p className={styles.subtitle}>
          Homework Management System
        </p>
      </header>

      <main className={styles.main}>
        <form
          className={styles.form}
          onSubmit={handleLogin}
        >
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Email
            </label>

            <div className={styles.inputWrapper}>
              <svg
                className={styles.icon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#888"
                strokeWidth="2"
                width="18"
                height="18"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>

              <input
                type="email"
                className={styles.input}
                placeholder="admin@gmail.com"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Password
            </label>

            <div className={styles.inputWrapper}>
              <svg
                className={styles.icon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#888"
                strokeWidth="2"
                width="18"
                height="18"
              >
                <rect
                  x="3"
                  y="11"
                  width="18"
                  height="11"
                  rx="2"
                />

                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>

              <input
                type="password"
                className={styles.input}
                placeholder="Enter password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                disabled={loading}
                required
              />
            </div>
          </div>

          {error && (
            <p
              style={{
                color: "#dc2626",
                fontSize: "14px",
                marginBottom: "12px",
                textAlign: "center",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </main>

      <footer className={styles.footer}>
        O-Technique-Myanmar-2026@
      </footer>
    </div>
  );
}