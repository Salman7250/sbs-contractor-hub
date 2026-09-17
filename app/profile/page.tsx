"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import UserAvatar from "@/app/components/user-avatar";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (profileError) {
        setError(profileError.message);
      }

      const metadata = user.user_metadata ?? {};
      const metadataName =
        typeof metadata.full_name === "string"
          ? metadata.full_name
          : typeof metadata.name === "string"
            ? metadata.name
            : "";

      setUserId(user.id);
      setEmail(user.email || "");
      setFullName(profile?.full_name || metadataName);
      setAvatarUrl(profile?.avatar_url || null);
      setLoading(false);
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function saveProfile() {
    if (!userId) return;

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setError("Please enter your full name.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const { error: updateError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        full_name: trimmedName,
        avatar_url: avatarUrl,
      },
      { onConflict: "id" },
    );

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: { full_name: trimmedName },
    });

    if (metadataError) {
      console.warn("Profile saved but auth metadata was not updated:", metadataError);
    }

    setFullName(trimmedName);
    setMessage("Profile updated successfully.");
    setSaving(false);
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !userId) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Please choose a JPG, PNG, WEBP, or GIF image.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("Profile photos must be 5 MB or smaller.");
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");

    const objectPath = `${userId}/avatar`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(objectPath, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(objectPath);

    const nextAvatarUrl = `${data.publicUrl}?v=${Date.now()}`;

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        full_name: fullName.trim() || null,
        avatar_url: nextAvatarUrl,
      },
      { onConflict: "id" },
    );

    if (profileError) {
      setError(profileError.message);
      setUploading(false);
      return;
    }

    setAvatarUrl(nextAvatarUrl);
    window.dispatchEvent(
  new CustomEvent("sbs-profile-updated", {
    detail: {
      full_name: fullName.trim() || null,
      avatar_url: nextAvatarUrl,
    },
  }),
);
    setMessage("Profile photo updated.");
    setUploading(false);
  }

  async function removeAvatar() {
    if (!userId) return;

    setUploading(true);
    setError("");
    setMessage("");

    const { error: removeError } = await supabase.storage
      .from("avatars")
      .remove([`${userId}/avatar`]);

    if (removeError && !removeError.message.toLowerCase().includes("not found")) {
      setError(removeError.message);
      setUploading(false);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        full_name: fullName.trim() || null,
        avatar_url: null,
      },
      { onConflict: "id" },
    );

    if (profileError) {
      setError(profileError.message);
      setUploading(false);
      return;
    }

    setAvatarUrl(null);
    window.dispatchEvent(
  new CustomEvent("sbs-profile-updated", {
    detail: {
      full_name: fullName.trim() || null,
      avatar_url: null,
    },
  }),
);
    setMessage("Profile photo removed.");
    setUploading(false);
  }

  if (loading) {
    return (
      <AppShell title="My Profile" description="Manage your personal SBS account.">
        <div className={styles.loadingCard}>Loading your profile…</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="My Profile" description="Manage your personal SBS account.">
      <div className={styles.page}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.eyebrow}>PERSONAL ACCOUNT</p>
              <h2 className={styles.heading}>Profile information</h2>
              <p className={styles.subheading}>
                Your name and profile photo are used across your SBS workspace.
              </p>
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}
          {message && <div className={styles.success}>{message}</div>}

          <div className={styles.profileGrid}>
            <div className={styles.photoPanel}>
              <UserAvatar
                name={fullName || email || "SBS"}
                avatarUrl={avatarUrl}
                size={112}
                className={styles.largeAvatar}
              />

              <div className={styles.photoActions}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? "Updating…" : avatarUrl ? "Change photo" : "Upload photo"}
                </button>

                {avatarUrl && (
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => void removeAvatar()}
                    disabled={uploading}
                  >
                    Remove
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={uploadAvatar}
                className={styles.hiddenInput}
              />

              <p className={styles.photoHint}>JPG, PNG, WEBP or GIF · Max 5 MB</p>
            </div>

            <div className={styles.formPanel}>
              <label className={styles.label} htmlFor="full-name">
                Full name
              </label>
              <input
                id="full-name"
                className={styles.input}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your full name"
                autoComplete="name"
              />

              <label className={styles.label} htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                className={`${styles.input} ${styles.readonly}`}
                value={email}
                readOnly
              />
              <p className={styles.fieldHint}>
                Your login email is managed by your SBS account authentication.
              </p>

              <div className={styles.actionsRow}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => void saveProfile()}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.infoCard}>
          <div className={styles.infoIcon}>i</div>
          <div>
            <h3>One profile across SBS</h3>
            <p>
              Your profile photo can be reused in the workspace header, user management,
              activity, notifications, and future collaboration features.
            </p>x
          </div>
        </section>
      </div>
    </AppShell>
  );
}
