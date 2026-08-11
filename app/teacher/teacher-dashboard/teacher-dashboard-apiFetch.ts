import { useCallback } from "react";
import { useRouter } from "next/navigation"; // Next.js App Router အတွက်

// API_URL ကို .env ကနေ ယူပါ (သို့မဟုတ် ကိုယ့်ရဲ့ Base URL ကို ထည့်ပါ)
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

export const useApiFetch = () => {
  const router = useRouter(); // router ကို ခေါ်ယူခြင်း

  const apiFetch = useCallback(
    async (endpoint: string) => {
      const token = localStorage.getItem("accessToken");

      if (!token) {
        router.replace("/");
        throw new Error("Access token was not found.");
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token.trim()}`,
        },
        cache: "no-store",
      });

      const result = await response.json().catch(() => null);

      if (response.status === 401) {
        throw new Error(result?.message ?? "Invalid or expired access token.");
      }

      if (response.status === 403) {
        throw new Error(result?.message ?? "Teacher permission is required.");
      }

      if (!response.ok) {
        const message = Array.isArray(result?.message)
          ? result.message.join(", ")
          : (result?.message ?? "Request failed.");

        throw new Error(message);
      }

      return result;
    },
    [router],
  );

  return apiFetch;
};
