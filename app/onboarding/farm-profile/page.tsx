"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

countries.registerLocale(enLocale);

type FarmUnit = "Hectares" | "Acres";

type FarmProfileForm = {
  farmerName: string;
  farmName: string;
  country: string;
  region: string;
  farmSize: string;
  farmUnit: FarmUnit;
  mainCrop: string;
  farmLocation: string;
};

const countryOptions = Object.values(
  countries.getNames("en", { select: "official" })
).sort((a, b) => a.localeCompare(b));

export default function FarmProfilePage() {
  const router = useRouter();

  const [formData, setFormData] = useState<FarmProfileForm>({
    farmerName: "",
    farmName: "",
    country: "",
    region: "",
    farmSize: "",
    farmUnit: "Hectares",
    mainCrop: "",
    farmLocation: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const requiredValues = useMemo(
    () => [
      formData.farmerName,
      formData.farmName,
      formData.country,
      formData.region,
      formData.farmSize,
      formData.farmUnit,
      formData.mainCrop,
    ],
    [formData]
  );

  const completion = useMemo(() => {
    const completed = requiredValues.filter(
      (value) => String(value).trim() !== ""
    ).length;
    return Math.round((completed / requiredValues.length) * 100);
  }, [requiredValues]);

  const updateField = (key: keyof FarmProfileForm, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
    setError("");
    setSuccessMessage("");
  };

  const validateBeforeSubmit = () => {
    if (!formData.farmerName.trim()) return "Farmer name is required.";
    if (!formData.farmName.trim()) return "Farm name is required.";
    if (!formData.country.trim()) return "Country is required.";
    if (!formData.region.trim()) return "Village / Region is required.";
    if (!formData.farmSize.trim()) return "Farm size is required.";
    if (!formData.mainCrop.trim()) return "Main crop is required.";

    const size = Number(formData.farmSize);
    if (Number.isNaN(size) || size <= 0) {
      return "Farm size must be greater than 0.";
    }

    return null;
  };

  const saveFarmProfile = async (payload: FarmProfileForm) => {
    const response = await fetch("/api/farm-profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.message || "Failed to save farm profile.");
    }

    return data;
  };

  const updateOnboardingStatus = async () => {
    const response = await fetch("/api/onboarding/complete-farm-profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        farmProfileCompleted: true,
        onboardingStep: "dashboard",
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.message || "Failed to update onboarding status.");
    }

    return data;
  };

  const handleUseDetectedLocation = async () => {
    try {
      if (!navigator.geolocation) {
        setError("Geolocation is not supported on this device.");
        return;
      }

      setError("");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          // Only fills optional farmLocation — never overwrites country or region
          setFormData((prev) => ({
            ...prev,
            farmLocation: `${latitude}, ${longitude}`,
          }));
        },
        (geoError) => {
          console.error("Geolocation error:", geoError);
          setError("Unable to detect your location.");
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    } catch (err) {
      console.error("Detected location failure:", err);
      setError("Unable to detect your location.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (saving) return;

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      console.log("Save Farm Profile clicked");
      console.log("Submitting farm profile:", formData);

      const validationError = validateBeforeSubmit();
      if (validationError) {
        console.warn("Validation failed:", validationError);
        setError(validationError);
        return;
      }

      const saveResult = await saveFarmProfile(formData);
      console.log("Farm profile save result:", saveResult);

      const onboardingResult = await updateOnboardingStatus();
      console.log("Onboarding update result:", onboardingResult);

      setSuccessMessage("Farm profile saved successfully.");
      router.push("/onboarding/farmer-type");
    } catch (err: any) {
      console.error("Farm profile submission error:", err);
      setError(err?.message || "Something went wrong while saving.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1720] px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[#131c26] p-6 shadow-xl">
        <h1 className="mb-2 text-2xl font-semibold">Farm Profile</h1>
        <p className="mb-6 text-sm text-white/70">
          Complete your farm profile to continue
        </p>

        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-white/70">Profile Completion</span>
            <span className="font-medium text-emerald-400">{completion}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/10">
            <div
              className="h-2 rounded-full bg-emerald-400 transition-all"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-white/80">
              Farmer Name
            </label>
            <input
              className="w-full rounded-xl border border-white/10 bg-[#1a2430] px-4 py-3 text-white outline-none placeholder:text-white/40"
              placeholder="Enter farmer name"
              value={formData.farmerName}
              onChange={(e) => updateField("farmerName", e.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/80">
              Farm Name
            </label>
            <input
              className="w-full rounded-xl border border-white/10 bg-[#1a2430] px-4 py-3 text-white outline-none placeholder:text-white/40"
              placeholder="Enter farm name"
              value={formData.farmName}
              onChange={(e) => updateField("farmName", e.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/80">Country</label>
            <select
              className="w-full rounded-xl border border-white/10 bg-[#1a2430] px-4 py-3 text-white outline-none"
              value={formData.country}
              onChange={(e) => updateField("country", e.target.value)}
            >
              <option value="">Select country</option>
              {countryOptions.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/80">
              Village / Region
            </label>
            <input
              className="w-full rounded-xl border border-white/10 bg-[#1a2430] px-4 py-3 text-white outline-none placeholder:text-white/40"
              placeholder="Enter village or region"
              value={formData.region}
              onChange={(e) => updateField("region", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-white/80">
                Farm Size
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                className="w-full rounded-xl border border-white/10 bg-[#1a2430] px-4 py-3 text-white outline-none placeholder:text-white/40"
                placeholder="Enter farm size"
                value={formData.farmSize}
                onChange={(e) => updateField("farmSize", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/80">Unit</label>
              <select
                className="w-full rounded-xl border border-white/10 bg-[#1a2430] px-4 py-3 text-white outline-none"
                value={formData.farmUnit}
                onChange={(e) =>
                  updateField("farmUnit", e.target.value as FarmUnit)
                }
              >
                <option value="Hectares">Hectares</option>
                <option value="Acres">Acres</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/80">
              Main Crop
            </label>
            <input
              className="w-full rounded-xl border border-white/10 bg-[#1a2430] px-4 py-3 text-white outline-none placeholder:text-white/40"
              placeholder="Enter main crop"
              value={formData.mainCrop}
              onChange={(e) => updateField("mainCrop", e.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/80">
              Farm Location <span className="text-white/40">(optional)</span>
            </label>
            <input
              className="w-full rounded-xl border border-white/10 bg-[#1a2430] px-4 py-3 text-white outline-none placeholder:text-white/40"
              placeholder="Optional precise location"
              value={formData.farmLocation}
              onChange={(e) => updateField("farmLocation", e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={handleUseDetectedLocation}
            disabled={saving}
            className="w-full rounded-xl border border-white/10 bg-[#1a2430] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#202c39] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Use Detected Location
          </button>

          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {successMessage}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={saving}
              className="rounded-xl border border-white/10 bg-[#1a2430] px-4 py-3 font-medium text-white transition hover:bg-[#202c39] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Back
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-900 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Farm Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
