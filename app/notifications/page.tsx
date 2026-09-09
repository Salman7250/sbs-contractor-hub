"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/app/components/app-shell";

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

function typeClass(type: string) {
  if (
    type === "success" ||
    type === "expense_created"
  ) {
    return "success";
  }

  if (
    type === "warning" ||
    type === "expense_status"
  ) {
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

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    info: "Information",
    success: "Success",
    warning: "Warning",
    error: "Error",
    expense_created: "Expense",
    expense_status: "Expense Update",
    expense_closing: "Expense Closing",
    automation_failed: "Automation Failed",
    notification_failed: "Notification Failed",
  };

  return labels[type] || "Notification";
}

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const seconds = Math.max(
    0,
    Math.floor(diff / 1000),
  );

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

  return new Date(value).toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  );
}

export default function NotificationsPage() {
  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] =
    useState<NotificationRow[]>([]);
  const [readIds, setReadIds] = useState<
    Set<string>
  >(new Set());

  const [userId, setUserId] = useState<
    string | null
  >(null);

  const [companyId, setCompanyId] = useState<
    string | null
  >(null);

  const [error, setError] = useState<
    string | null
  >(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "all" | "unread" | "read"
  >("all");

  const loadNotifications = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const { data: auth } =
        await supabase.auth.getUser();

      const currentUserId =
        auth.user?.id ?? null;

      if (!currentUserId) {
        setError("You are not signed in.");
        setNotifications([]);
        setReadIds(new Set());

        setLoading(false);
        setRefreshing(false);

        return;
      }

      setUserId(currentUserId);

      const {
        data: membership,
        error: membershipError,
      } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", currentUserId)
        .limit(1)
        .maybeSingle();

      if (
        membershipError ||
        !membership?.company_id
      ) {
        setError(
          membershipError?.message ||
            "No company membership found.",
        );

        setNotifications([]);
        setReadIds(new Set());

        setLoading(false);
        setRefreshing(false);

        return;
      }

      const currentCompanyId =
        membership.company_id as string;

      setCompanyId(currentCompanyId);

      const [
        notificationResult,
        readResult,
      ] = await Promise.all([
        supabase
          .from("notifications")
          .select(
            "id,company_id,user_id,type,title,message,href,entity_type,entity_id,metadata,created_at",
          )
          .eq(
            "company_id",
            currentCompanyId,
          )
          .order("created_at", {
            ascending: false,
          })
          .limit(200),

        supabase
          .from("notification_reads")
          .select("notification_id")
          .eq("user_id", currentUserId)
          .limit(1000),
      ]);

      if (notificationResult.error) {
        setError(
          notificationResult.error.message,
        );
        setNotifications([]);
      } else {
        setNotifications(
          (notificationResult.data ||
            []) as NotificationRow[],
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

      setLoading(false);
      setRefreshing(false);
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
      .channel(
        `notifications-page-${companyId}`,
      )
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

  const unreadCount = notifications.reduce(
    (count, item) =>
      count +
      (readIds.has(item.id) ? 0 : 1),
    0,
  );

  const readCount =
    notifications.length - unreadCount;

  const filteredNotifications =
    notifications.filter((item) => {
      const unread = !readIds.has(item.id);

      if (
        filter === "unread" &&
        !unread
      ) {
        return false;
      }

      if (
        filter === "read" &&
        unread
      ) {
        return false;
      }

      if (!search.trim()) {
        return true;
      }

      const query =
        search.toLowerCase().trim();

      return (
        item.title
          .toLowerCase()
          .includes(query) ||
        item.message
          .toLowerCase()
          .includes(query) ||
        typeLabel(item.type)
          .toLowerCase()
          .includes(query)
      );
    });

  const markRead = async (
    notificationId: string,
  ) => {
    if (
      !userId ||
      readIds.has(notificationId)
    ) {
      return;
    }

    setReadIds((current) => {
      const next = new Set(current);
      next.add(notificationId);
      return next;
    });

    const { error: markError } =
      await supabase
        .from("notification_reads")
        .upsert(
          {
            notification_id:
              notificationId,
            user_id: userId,
            read_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "notification_id,user_id",
          },
        );

    if (markError) {
      setReadIds((current) => {
        const next = new Set(current);
        next.delete(notificationId);
        return next;
      });
    }
  };

  const markAllRead = async () => {
    if (!userId || !unreadCount) {
      return;
    }

    const unread =
      notifications.filter(
        (item) =>
          !readIds.has(item.id),
      );

    const now =
      new Date().toISOString();

    const rows = unread.map(
      (item) => ({
        notification_id:
          item.id,
        user_id: userId,
        read_at: now,
      }),
    );

    const { error: markError } =
      await supabase
        .from("notification_reads")
        .upsert(rows, {
          onConflict:
            "notification_id,user_id",
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
  };

  const handleClick = async (
    item: NotificationRow,
  ) => {
    await markRead(item.id);

    if (item.href) {
      router.push(item.href);
    }
  };

  return (
    <>
      <style>{`
        .sbs-notifications-page {
          width: 100%;
        }

        .sbs-notifications-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .sbs-notifications-title {
          margin: 0;
          color: #0f172a;
          font-size: 24px;
          font-weight: 700;
          line-height: 32px;
          letter-spacing: -0.02em;
        }

        .sbs-notifications-description {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
          line-height: 20px;
        }

        .sbs-notifications-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .sbs-notifications-action {
          height: 38px;
          padding: 0 13px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #ffffff;
          color: #334155;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease;
        }

        .sbs-notifications-action:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .sbs-notifications-action.primary {
          border-color: #2563eb;
          background: #2563eb;
          color: #ffffff;
        }

        .sbs-notifications-action.primary:hover {
          background: #1d4ed8;
          border-color: #1d4ed8;
        }

        .sbs-notifications-action:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .sbs-notifications-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 20px;
        }

        .sbs-notifications-stat {
          min-height: 92px;
          padding: 17px 18px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #ffffff;
          box-shadow:
            0 1px 2px rgba(15, 23, 42, 0.03);
        }

        .sbs-notifications-stat-label {
          color: #64748b;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .sbs-notifications-stat-value {
          margin-top: 7px;
          color: #0f172a;
          font-size: 23px;
          font-weight: 700;
          line-height: 28px;
        }

        .sbs-notifications-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 14px;
          margin-bottom: 14px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #ffffff;
        }

        .sbs-notifications-search {
          position: relative;
          flex: 1;
          max-width: 430px;
        }

        .sbs-notifications-search input {
          width: 100%;
          height: 38px;
          padding: 0 12px 0 37px;
          border: 1px solid #dbe2ea;
          border-radius: 8px;
          background: #ffffff;
          color: #0f172a;
          font-size: 12px;
          outline: none;
          box-sizing: border-box;
        }

        .sbs-notifications-search input:focus {
          border-color: #2563eb;
          box-shadow:
            0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .sbs-notifications-search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }

        .sbs-notifications-filters {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .sbs-notifications-filter {
          height: 34px;
          padding: 0 11px;
          border: 1px solid transparent;
          border-radius: 7px;
          background: transparent;
          color: #64748b;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }

        .sbs-notifications-filter:hover {
          background: #f8fafc;
          color: #334155;
        }

        .sbs-notifications-filter.active {
          border-color: #dbeafe;
          background: #eff6ff;
          color: #2563eb;
        }

        .sbs-notifications-card {
          overflow: hidden;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #ffffff;
          box-shadow:
            0 1px 2px rgba(15, 23, 42, 0.03);
        }

        .sbs-notifications-card-header {
          min-height: 54px;
          padding: 0 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #e5e7eb;
        }

        .sbs-notifications-card-title {
          color: #0f172a;
          font-size: 13px;
          font-weight: 700;
        }

        .sbs-notifications-card-count {
          color: #94a3b8;
          font-size: 11px;
        }

        .sbs-notification-history-item {
          position: relative;
          width: 100%;
          min-height: 92px;
          padding: 16px 18px;
          display: flex;
          align-items: flex-start;
          gap: 13px;
          border: 0;
          border-bottom: 1px solid #f1f5f9;
          background: #ffffff;
          text-align: left;
          cursor: pointer;
          box-sizing: border-box;
          transition: background 0.15s ease;
        }

        .sbs-notification-history-item:last-child {
          border-bottom: 0;
        }

        .sbs-notification-history-item:hover {
          background: #f8fafc;
        }

        .sbs-notification-history-item.unread {
          background: #f8fbff;
        }

        .sbs-notification-history-item.unread:hover {
          background: #f1f7ff;
        }

        .sbs-notification-history-icon {
          width: 38px;
          height: 38px;
          min-width: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 700;
        }

        .sbs-notification-history-icon.info {
          background: #eff6ff;
          color: #2563eb;
        }

        .sbs-notification-history-icon.success {
          background: #ecfdf5;
          color: #059669;
        }

        .sbs-notification-history-icon.warning {
          background: #fffbeb;
          color: #d97706;
        }

        .sbs-notification-history-icon.error {
          background: #fef2f2;
          color: #dc2626;
        }

        .sbs-notification-history-content {
          min-width: 0;
          flex: 1;
        }

        .sbs-notification-history-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
        }

        .sbs-notification-history-title {
          color: #0f172a;
          font-size: 13px;
          font-weight: 700;
          line-height: 19px;
        }

        .sbs-notification-history-time {
          flex-shrink: 0;
          color: #94a3b8;
          font-size: 10px;
          line-height: 19px;
          white-space: nowrap;
        }

        .sbs-notification-history-message {
          margin-top: 3px;
          color: #64748b;
          font-size: 12px;
          line-height: 19px;
        }

        .sbs-notification-history-meta {
          margin-top: 7px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sbs-notification-type {
          display: inline-flex;
          align-items: center;
          height: 21px;
          padding: 0 7px;
          border-radius: 5px;
          background: #f1f5f9;
          color: #64748b;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .sbs-notification-date {
          color: #94a3b8;
          font-size: 10px;
        }

        .sbs-notification-history-unread {
          width: 7px;
          height: 7px;
          min-width: 7px;
          margin-top: 16px;
          border-radius: 50%;
          background: #2563eb;
        }

        .sbs-notifications-empty {
          min-height: 280px;
          padding: 40px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .sbs-notifications-empty-icon {
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
          border-radius: 50%;
          background: #eff6ff;
          color: #2563eb;
          font-size: 22px;
          font-weight: 700;
        }

        .sbs-notifications-empty-title {
          color: #334155;
          font-size: 14px;
          font-weight: 700;
        }

        .sbs-notifications-empty-text {
          max-width: 360px;
          margin-top: 5px;
          color: #94a3b8;
          font-size: 12px;
          line-height: 19px;
        }

        .sbs-notifications-loading {
          min-height: 280px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          font-size: 12px;
        }

        .sbs-notifications-error {
          padding: 30px;
          color: #dc2626;
          font-size: 12px;
          text-align: center;
        }

        .sbs-notifications-spinning {
          animation: sbsNotificationsSpin 0.8s linear infinite;
        }

        @keyframes sbsNotificationsSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1024px) {
          .sbs-notifications-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .sbs-notifications-header {
            flex-direction: column;
          }

          .sbs-notifications-actions {
            width: 100%;
          }

          .sbs-notifications-action {
            flex: 1;
          }

          .sbs-notifications-toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .sbs-notifications-search {
            max-width: none;
          }

          .sbs-notifications-filters {
            width: 100%;
          }

          .sbs-notifications-filter {
            flex: 1;
          }
        }

        @media (max-width: 520px) {
          .sbs-notifications-stats {
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }

          .sbs-notifications-stat {
            min-height: 78px;
            padding: 13px;
          }

          .sbs-notifications-stat-value {
            font-size: 20px;
          }

          .sbs-notification-history-item {
            padding: 13px;
          }

          .sbs-notification-history-icon {
            width: 34px;
            height: 34px;
            min-width: 34px;
          }

          .sbs-notification-history-top {
            display: block;
          }

          .sbs-notification-history-time {
            display: block;
            margin-top: 2px;
          }
        }
      `}</style>

      <AppShell
        title="Notifications"
        description="View and manage all notifications for your workspace."
      >
        <div className="sbs-notifications-page">
          <div className="sbs-notifications-header">
            <div>
              <h1 className="sbs-notifications-title">
                Notifications
              </h1>

              <p className="sbs-notifications-description">
                Stay up to date with important
                activity across your SBS workspace.
              </p>
            </div>

            <div className="sbs-notifications-actions">
              <button
                type="button"
                className="sbs-notifications-action"
                onClick={() =>
                  void loadNotifications(true)
                }
                disabled={
                  refreshing || loading
                }
              >
                <span
                  className={
                    refreshing
                      ? "sbs-notifications-spinning"
                      : ""
                  }
                >
                  ↻
                </span>

                Refresh
              </button>

              <button
                type="button"
                className="sbs-notifications-action primary"
                onClick={() =>
                  void markAllRead()
                }
                disabled={!unreadCount}
              >
                ✓ Mark all read
              </button>
            </div>
          </div>

          <div className="sbs-notifications-stats">
            <div className="sbs-notifications-stat">
              <div className="sbs-notifications-stat-label">
                Total
              </div>

              <div className="sbs-notifications-stat-value">
                {notifications.length}
              </div>
            </div>

            <div className="sbs-notifications-stat">
              <div className="sbs-notifications-stat-label">
                Unread
              </div>

              <div className="sbs-notifications-stat-value">
                {unreadCount}
              </div>
            </div>

            <div className="sbs-notifications-stat">
              <div className="sbs-notifications-stat-label">
                Read
              </div>

              <div className="sbs-notifications-stat-value">
                {readCount}
              </div>
            </div>

            <div className="sbs-notifications-stat">
              <div className="sbs-notifications-stat-label">
                Showing
              </div>

              <div className="sbs-notifications-stat-value">
                {filteredNotifications.length}
              </div>
            </div>
          </div>

          <div className="sbs-notifications-toolbar">
            <div className="sbs-notifications-search">
              <span className="sbs-notifications-search-icon">
                ⌕
              </span>

              <input
                type="text"
                placeholder="Search notifications..."
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="sbs-notifications-filters">
              <button
                type="button"
                className={`sbs-notifications-filter ${
                  filter === "all"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setFilter("all")
                }
              >
                All
              </button>

              <button
                type="button"
                className={`sbs-notifications-filter ${
                  filter === "unread"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setFilter("unread")
                }
              >
                Unread
              </button>

              <button
                type="button"
                className={`sbs-notifications-filter ${
                  filter === "read"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setFilter("read")
                }
              >
                Read
              </button>
            </div>
          </div>

          <div className="sbs-notifications-card">
            <div className="sbs-notifications-card-header">
              <span className="sbs-notifications-card-title">
                Notification History
              </span>

              <span className="sbs-notifications-card-count">
                {filteredNotifications.length}{" "}
                notification
                {filteredNotifications.length ===
                1
                  ? ""
                  : "s"}
              </span>
            </div>

            {loading && (
              <div className="sbs-notifications-loading">
                Loading notifications…
              </div>
            )}

            {!loading && error && (
              <div className="sbs-notifications-error">
                {error}
              </div>
            )}

            {!loading &&
              !error &&
              filteredNotifications.length ===
                0 && (
                <div className="sbs-notifications-empty">
                  <div className="sbs-notifications-empty-icon">
                    ✓
                  </div>

                  <div className="sbs-notifications-empty-title">
                    No notifications found
                  </div>

                  <div className="sbs-notifications-empty-text">
                    {search ||
                    filter !== "all"
                      ? "Try changing your search or filter."
                      : "Important activity from your SBS workspace will appear here."}
                  </div>
                </div>
              )}

            {!loading &&
              !error &&
              filteredNotifications.map(
                (item) => {
                  const unread =
                    !readIds.has(
                      item.id,
                    );

                  const kind =
                    typeClass(
                      item.type,
                    );

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`sbs-notification-history-item ${
                        unread
                          ? "unread"
                          : ""
                      }`}
                      onClick={() =>
                        void handleClick(
                          item,
                        )
                      }
                    >
                      <span
                        className={`sbs-notification-history-icon ${kind}`}
                      >
                        {TYPE_ICONS[
                          item.type
                        ] || "i"}
                      </span>

                      <span className="sbs-notification-history-content">
                        <span className="sbs-notification-history-top">
                          <span className="sbs-notification-history-title">
                            {item.title}
                          </span>

                          <span className="sbs-notification-history-time">
                            {relativeTime(
                              item.created_at,
                            )}
                          </span>
                        </span>

                        <span className="sbs-notification-history-message">
                          {item.message}
                        </span>

                        <span className="sbs-notification-history-meta">
                          <span className="sbs-notification-type">
                            {typeLabel(
                              item.type,
                            )}
                          </span>

                          <span className="sbs-notification-date">
                            {formatDate(
                              item.created_at,
                            )}
                          </span>
                        </span>
                      </span>

                      {unread && (
                        <span className="sbs-notification-history-unread" />
                      )}
                    </button>
                  );
                },
              )}
          </div>
        </div>
      </AppShell>
    </>
  );
}