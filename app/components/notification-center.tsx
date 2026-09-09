"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type NotificationRow = {
  id: string;
  company_id: string;
  user_id: string | null;
  type: string;
  title: string;
  message: string;
  href: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const TYPE_ICONS: Record<string, string> = {
  success: "✓",
  warning: "!",
  error: "×",
  expense_created: "$",
  expense_status: "↕",
  expense_closing: "▣",
  automation_failed: "!",
  notification_failed: "!",
  info: "i",
};

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const seconds = Math.max(0, Math.floor(diff / 1000));

  if (seconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d ago`;
  }

  return new Date(value).toLocaleDateString();
}

function typeClass(type: string) {
  if (type === "success" || type === "expense_created") {
    return "success";
  }

  if (type === "warning" || type === "expense_status") {
    return "warning";
  }

  if (
    type === "error" ||
    type === "automation_failed" ||
    type === "notification_failed"
  ) {
    return "error";
  }

  return "info";
}

export default function NotificationCenter() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>(
    [],
  );
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = notifications.reduce(
    (count, item) => count + (readIds.has(item.id) ? 0 : 1),
    0,
  );

  const loadNotifications = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }

      setError(null);

      const { data: auth } = await supabase.auth.getUser();

      const currentUserId = auth.user?.id ?? null;

      if (!currentUserId) {
        setUserId(null);
        setCompanyId(null);
        setNotifications([]);
        setReadIds(new Set());

        if (!silent) {
          setLoading(false);
        }

        return;
      }

      setUserId(currentUserId);

      const { data: membership, error: membershipError } =
        await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", currentUserId)
          .limit(1)
          .maybeSingle();

      if (membershipError || !membership?.company_id) {
        setCompanyId(null);
        setNotifications([]);
        setReadIds(new Set());

        if (membershipError) {
          setError(membershipError.message);
        }

        if (!silent) {
          setLoading(false);
        }

        return;
      }

      const currentCompanyId = membership.company_id as string;

      setCompanyId(currentCompanyId);

      const [notificationResult, readResult] = await Promise.all([
        supabase
          .from("notifications")
          .select(
            "id,company_id,user_id,type,title,message,href,entity_type,entity_id,metadata,created_at",
          )
          .eq("company_id", currentCompanyId)
          .order("created_at", { ascending: false })
          .limit(30),

        supabase
          .from("notification_reads")
          .select("notification_id")
          .eq("user_id", currentUserId)
          .limit(500),
      ]);

      if (notificationResult.error) {
        setError(notificationResult.error.message);
        setNotifications([]);
      } else {
        setNotifications(
          (notificationResult.data || []) as NotificationRow[],
        );
      }

      if (!readResult.error) {
        setReadIds(
          new Set(
            (readResult.data || []).map(
              (row) => row.notification_id,
            ),
          ),
        );
      }

      if (!silent) {
        setLoading(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!companyId || !userId) {
      return;
    }

    const channel = supabase
      .channel(`notification-center-${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          void loadNotifications(true);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notification_reads",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadNotifications(true);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    companyId,
    userId,
    supabase,
    loadNotifications,
  ]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        !wrapperRef.current?.contains(
          event.target as Node,
        )
      ) {
        setOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handlePointerDown,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      );
    };
  }, []);

  const markRead = useCallback(
    async (notificationId: string) => {
      if (!userId || readIds.has(notificationId)) {
        return;
      }

      setReadIds((current) => {
        const next = new Set(current);
        next.add(notificationId);
        return next;
      });

      const { error: markError } = await supabase
        .from("notification_reads")
        .upsert(
          {
            notification_id: notificationId,
            user_id: userId,
            read_at: new Date().toISOString(),
          },
          {
            onConflict: "notification_id,user_id",
          },
        );

      if (markError) {
        setReadIds((current) => {
          const next = new Set(current);
          next.delete(notificationId);
          return next;
        });
      }
    },
    [readIds, supabase, userId],
  );

  const markAllRead = useCallback(async () => {
    if (!userId) {
      return;
    }

    const unread = notifications.filter(
      (item) => !readIds.has(item.id),
    );

    if (!unread.length) {
      return;
    }

    const now = new Date().toISOString();

    const rows = unread.map((item) => ({
      notification_id: item.id,
      user_id: userId,
      read_at: now,
    }));

    const { error: markError } = await supabase
      .from("notification_reads")
      .upsert(rows, {
        onConflict: "notification_id,user_id",
      });

    if (!markError) {
      setReadIds((current) => {
        const next = new Set(current);

        unread.forEach((item) => {
          next.add(item.id);
        });

        return next;
      });
    }
  }, [
    notifications,
    readIds,
    supabase,
    userId,
  ]);

  const handleNotificationClick = async (
    item: NotificationRow,
  ) => {
    await markRead(item.id);

    setOpen(false);

    if (item.href && item.href !== pathname) {
      router.push(item.href);
    }
  };

  return (
    <>
      <style>{`
        .sbs-notification-center {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          z-index: 9999;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .sbs-notification-button {
          position: relative;
          width: 38px;
          height: 38px;
          min-width: 38px;
          padding: 0;
          margin: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #ffffff;
          color: #475569;
          cursor: pointer;
          outline: none;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .sbs-notification-button:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
        }

        .sbs-notification-button:focus-visible {
          border-color: #2563eb;
          box-shadow:
            0 0 0 3px rgba(37, 99, 235, 0.12);
        }

        .sbs-notification-button svg {
          display: block;
          width: 18px;
          height: 18px;
        }

        .sbs-notification-badge {
          position: absolute;
          top: -5px;
          right: -6px;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #ffffff;
          border-radius: 999px;
          background: #dc2626;
          color: #ffffff;
          font-size: 10px;
          font-weight: 700;
          line-height: 1;
          white-space: nowrap;
          box-sizing: border-box;
        }

        .sbs-notification-menu {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          width: 390px;
          max-width: calc(100vw - 24px);
          overflow: hidden;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow:
            0 20px 45px rgba(15, 23, 42, 0.16),
            0 4px 12px rgba(15, 23, 42, 0.08);
          z-index: 10000;
          animation: sbsNotificationMenuIn 0.14s ease-out;
        }

        @keyframes sbsNotificationMenuIn {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .sbs-notification-menu-header {
          min-height: 68px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-bottom: 1px solid #e5e7eb;
          background: #ffffff;
        }

        .sbs-notification-menu-title {
          color: #0f172a;
          font-size: 15px;
          font-weight: 700;
          line-height: 20px;
        }

        .sbs-notification-menu-subtitle {
          margin-top: 2px;
          color: #64748b;
          font-size: 12px;
          line-height: 18px;
        }

        .sbs-notification-mark-all {
          flex-shrink: 0;
          border: 0;
          background: transparent;
          color: #2563eb;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          padding: 5px 0;
        }

        .sbs-notification-mark-all:hover {
          color: #1d4ed8;
          text-decoration: underline;
        }

        .sbs-notification-mark-all:disabled {
          color: #94a3b8;
          cursor: default;
          text-decoration: none;
        }

        .sbs-notification-list {
          max-height: 430px;
          overflow-y: auto;
          overscroll-behavior: contain;
          background: #ffffff;
        }

        .sbs-notification-list::-webkit-scrollbar {
          width: 7px;
        }

        .sbs-notification-list::-webkit-scrollbar-track {
          background: #f8fafc;
        }

        .sbs-notification-list::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 999px;
        }

        .sbs-notification-item {
          position: relative;
          width: 100%;
          min-height: 76px;
          padding: 13px 14px;
          display: flex;
          align-items: flex-start;
          gap: 11px;
          border: 0;
          border-bottom: 1px solid #f1f5f9;
          background: #ffffff;
          color: #0f172a;
          text-align: left;
          cursor: pointer;
          box-sizing: border-box;
          transition: background 0.15s ease;
        }

        .sbs-notification-item:hover {
          background: #f8fafc;
        }

        .sbs-notification-item.is-unread {
          background: #f8fbff;
        }

        .sbs-notification-item.is-unread:hover {
          background: #f1f7ff;
        }

        .sbs-notification-icon {
          width: 32px;
          height: 32px;
          min-width: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          font-size: 14px;
          font-weight: 700;
          line-height: 1;
        }

        .sbs-notification-icon.info {
          background: #eff6ff;
          color: #2563eb;
        }

        .sbs-notification-icon.success {
          background: #ecfdf5;
          color: #059669;
        }

        .sbs-notification-icon.warning {
          background: #fffbeb;
          color: #d97706;
        }

        .sbs-notification-icon.error {
          background: #fef2f2;
          color: #dc2626;
        }

        .sbs-notification-item-content {
          min-width: 0;
          flex: 1;
          display: block;
        }

        .sbs-notification-item-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .sbs-notification-item-top strong {
          min-width: 0;
          color: #0f172a;
          font-size: 13px;
          font-weight: 700;
          line-height: 18px;
        }

        .sbs-notification-item-top > span {
          flex-shrink: 0;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 500;
          line-height: 18px;
          white-space: nowrap;
        }

        .sbs-notification-item-message {
          display: block;
          margin-top: 2px;
          color: #64748b;
          font-size: 12px;
          font-weight: 400;
          line-height: 18px;
          overflow-wrap: anywhere;
        }

        .sbs-notification-unread-dot {
          width: 7px;
          height: 7px;
          min-width: 7px;
          margin-top: 13px;
          border-radius: 50%;
          background: #2563eb;
        }

        .sbs-notification-state {
          min-height: 170px;
          padding: 30px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          color: #64748b;
          font-size: 12px;
          text-align: center;
        }

        .sbs-notification-state strong {
          color: #334155;
          font-size: 13px;
          font-weight: 700;
        }

        .sbs-notification-error {
          color: #dc2626;
        }

        .sbs-notification-empty-icon {
          width: 38px;
          height: 38px;
          margin-bottom: 5px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #ecfdf5;
          color: #059669;
          font-size: 18px;
          font-weight: 700;
        }

        .sbs-notification-menu-footer {
          min-height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-top: 1px solid #e5e7eb;
          background: #ffffff;
        }

        .sbs-notification-menu-footer button {
          width: 100%;
          height: 48px;
          border: 0;
          background: transparent;
          color: #2563eb;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .sbs-notification-menu-footer button:hover {
          background: #f8fafc;
          color: #1d4ed8;
        }

        @media (max-width: 868px) {
          .sbs-notification-menu {
            position: fixed;
            top: 60px;
            right: 12px;
            width: 390px;
            max-width: calc(100vw - 24px);
          }
        }

        @media (max-width: 640px) {
          .sbs-notification-button {
            width: 36px;
            height: 36px;
            min-width: 36px;
          }

          .sbs-notification-menu {
            top: 58px;
            right: 8px;
            width: calc(100vw - 16px);
            max-width: calc(100vw - 16px);
            border-radius: 10px;
          }

          .sbs-notification-menu-header {
            padding: 13px 14px;
          }

          .sbs-notification-item {
            padding: 12px;
          }
        }
      `}</style>

      <div
        ref={wrapperRef}
        className="sbs-notification-center"
      >
        <button
          type="button"
          className="sbs-notification-button"
          aria-label={
            unreadCount
              ? `${unreadCount} unread notifications`
              : "Notifications"
          }
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>

          {unreadCount > 0 && (
            <span className="sbs-notification-badge">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div
            className="sbs-notification-menu"
            role="dialog"
            aria-label="Notifications"
          >
            <div className="sbs-notification-menu-header">
              <div>
                <div className="sbs-notification-menu-title">
                  Notifications
                </div>

                <div className="sbs-notification-menu-subtitle">
                  {unreadCount
                    ? `${unreadCount} unread`
                    : "You're all caught up"}
                </div>
              </div>

              <button
                type="button"
                className="sbs-notification-mark-all"
                onClick={() => void markAllRead()}
                disabled={!unreadCount}
              >
                Mark all read
              </button>
            </div>

            <div className="sbs-notification-list">
              {loading && (
                <div className="sbs-notification-state">
                  Loading notifications…
                </div>
              )}

              {!loading && error && (
                <div className="sbs-notification-state sbs-notification-error">
                  Unable to load notifications.
                </div>
              )}

              {!loading &&
                !error &&
                notifications.length === 0 && (
                  <div className="sbs-notification-state">
                    <div className="sbs-notification-empty-icon">
                      ✓
                    </div>

                    <strong>No notifications</strong>

                    <span>
                      Important activity will appear here.
                    </span>
                  </div>
                )}

              {!loading &&
                !error &&
                notifications.map((item) => {
                  const unread = !readIds.has(item.id);
                  const kind = typeClass(item.type);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`sbs-notification-item ${
                        unread ? "is-unread" : ""
                      }`}
                      onClick={() =>
                        void handleNotificationClick(item)
                      }
                    >
                      <span
                        className={`sbs-notification-icon ${kind}`}
                      >
                        {TYPE_ICONS[item.type] || "i"}
                      </span>

                      <span className="sbs-notification-item-content">
                        <span className="sbs-notification-item-top">
                          <strong>{item.title}</strong>

                          <span>
                            {relativeTime(item.created_at)}
                          </span>
                        </span>

                        <span className="sbs-notification-item-message">
                          {item.message}
                        </span>
                      </span>

                      {unread && (
                        <span className="sbs-notification-unread-dot" />
                      )}
                    </button>
                  );
                })}
            </div>

            <div className="sbs-notification-menu-footer">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push("/notifications");
                }}
              >
                View all notifications
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}