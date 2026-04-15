"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type FarmerType = "new" | "experienced";

export default function FarmerTypePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const saveFarmerType = async (farmerType: FarmerType) => {
    const response = await fetch("/api/onboarding/farmer-type", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ farmerType }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.message || "Failed to save farmer type.");
    }

    return data;
  };

  const handleSelect = async (farmerType: FarmerType) => {
    if (loading) return;

    try {
      setLoading(true);
      setError("");

      console.log("Saving farmer type:", farmerType);

      const result = await saveFarmerType(farmerType);
      console.log("Farmer type saved:", result);

      if (farmerType === "new") {
        router.push("/onboarding/starter-guide");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      console.error("Farmer type save error:", err);
      setError(err?.message || "Something went wrong while saving farmer type.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1720] px-4 py-8 text-white">
      <div className="mx-auto mt-16 max-w-xl rounded-2xl border border-white/10 bg-[#131c26] p-6 shadow-xl">
        <h1 className="mb-2 text-2xl font-semibold">What best describes you?</h1>
        <p className="mb-6 text-sm text-white/70">
          This helps us personalize your farming journey.
        </p>

        <div className="space-y-4">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSelect("new")}
            className="w-full rounded-2xl border border-white/10 bg-[#1a2430] px-5 py-5 text-left transition hover:bg-[#202c39] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="text-lg font-semibold">🌱 New to farming</div>
            <div className="mt-1 text-sm text-white/60">
              I am just starting or have very little farming experience.
            </div>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleSelect("experienced")}
            className="w-full rounded-2xl border border-white/10 bg-[#1a2430] px-5 py-5 text-left transition hover:bg-[#202c39] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="text-lg font-semibold">🌾 Existing farmer</div>
            <div className="mt-1 text-sm text-white/60">
              I already farm and want better planning, tracking, and decisions.
            </div>
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4 text-sm text-emerald-400">Saving...</div>
        ) : null}
      </div>
    </div>
  );
}
