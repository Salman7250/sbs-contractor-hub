"use client";

import {
  Activity,
  AlertCircle,
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Info,
  ShieldAlert,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PlatformNotification = {
  id: string;
  activity_log_id: string | null;
  type: string;
  title: string;
  message: string;
  href: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

type ReadRow = {
  notification_id: string;
};

export default function PlatformNotifications({
  userId,
}: {
  userId: string;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [open, setOpen] = useState(false);

  const [notifications, setNotifications] = useState<
    PlatformNotification[]
  >([]);

  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const unreadCount = notifications.filter(
    (notification) => !readIds.has(notification.id)
  ).length;

  async function loadNotifications() {
    const [notificationsResult, readsResult] = await Promise.all([
      supabase
        .from("platform_admin_notifications")
        .select(
          `
            id,
            activity_log_id,
            type,
            title,
            message,
            href,
            entity_type,
            entity_id,
            created_at
          `
        )
        .eq("recipient_user_id", userId)
        .order("created_at", {
          ascending: false,
        })
        .limit(30),

      supabase
        .from("platform_admin_notification_reads")
        .select("notification_id")
        .eq("user_id", userId),
    ]);

    if (notificationsResult.error) {
      console.error(notificationsResult.error);
      return;
    }

    if (readsResult.error) {
      console.error(readsResult.error);
      return;
    }

    setNotifications(
      (notificationsResult.data ?? []) as PlatformNotification[]
    );

    setReadIds(
      new Set(
        ((readsResult.data ?? []) as ReadRow[]).map(
          (row) => row.notification_id
        )
      )
    );
  }

  useEffect(() => {
    void loadNotifications();

    const channel = supabase
      .channel("platform-admin-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "platform_admin_notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          const notification = payload.new as PlatformNotification;

          setNotifications((current) =>
            [notification, ...current].slice(0, 30)
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  async function markAsRead(notificationId: string) {
    const alreadyRead = readIds.has(notificationId);

    if (alreadyRead) {
      return;
    }

    const { error } = await supabase
      .from("platform_admin_notification_reads")
      .insert({
        notification_id: notificationId,
        user_id: userId,
      });

    if (error) {
      console.error(error);
      return;
    }

    setReadIds(
      (current) =>
        new Set([...current, notificationId])
    );
  }

  async function markAllAsRead() {
    const unread = notifications.filter(
      (notification) => !readIds.has(notification.id)
    );

    if (!unread.length) {
      return;
    }

    const rows = unread.map((notification) => ({
      notification_id: notification.id,
      user_id: userId,
    }));

    const { error } = await supabase
      .from("platform_admin_notification_reads")
      .insert(rows);

    if (error) {
      console.error(error);
      return;
    }

    setReadIds(
      new Set(
        notifications.map(
          (notification) => notification.id
        )
      )
    );
  }

  return (
    <div className="relative">
      {/* Notification trigger */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Platform notifications"
        aria-expanded={open}
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200 ${
          open
            ? "border-slate-300 bg-slate-100 text-slate-900 shadow-sm"
            : "border-slate-200 bg-white text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
        }`}
      >
        <Bell
          className={`h-[18px] w-[18px] transition-transform duration-200 ${
            open ? "scale-95" : ""
          }`}
        />

        {unreadCount > 0 && (
          <>
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />

            <span className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-emerald-600 px-1 text-[9px] font-bold leading-none text-white shadow-sm">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          </>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/5"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Notification panel */}
      {open && (
        <div className="absolute right-0 z-50 mt-3 w-[min(420px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.15)] ring-1 ring-slate-950/[0.03]">
          {/* Header */}
          <div className="border-b border-slate-100 bg-white px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <Bell className="h-4 w-4" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold tracking-[-0.01em] text-slate-950">
                      Notifications
                    </h3>

                    {unreadCount > 0 && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        {unreadCount} new
                      </span>
                    )}
                  </div>

                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Platform activity and system events
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[460px] overflow-y-auto overscroll-contain">
            {notifications.length > 0 ? (
              notifications.map((notification) => {
                const isRead = readIds.has(notification.id);

                return (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    isRead={isRead}
                    onMarkRead={markAsRead}
                  />
                );
              })
            ) : (
              <EmptyState />
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400">
                  Showing the latest 30 notifications
                </span>

                <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Live updates
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationItem({
  notification,
  isRead,
  onMarkRead,
}: {
  notification: PlatformNotification;
  isRead: boolean;
  onMarkRead: (notificationId: string) => Promise<void>;
}) {
  const icon = getNotificationIcon(notification.type);

  return (
    <div
      className={`group relative border-b border-slate-100 transition-colors ${
        isRead
          ? "bg-white hover:bg-slate-50/80"
          : "bg-emerald-50/[0.38] hover:bg-emerald-50/60"
      }`}
    >
      {!isRead && (
        <span className="absolute bottom-0 left-0 top-0 w-[3px] bg-emerald-500" />
      )}

      <div className="px-5 py-4">
        <div className="flex gap-3">
          {/* Notification icon */}
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              isRead
                ? "bg-slate-100 text-slate-500"
                : "bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-100"
            }`}
          >
            {icon}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div
                  className={`truncate text-xs ${
                    isRead
                      ? "font-medium text-slate-800"
                      : "font-semibold text-slate-950"
                  }`}
                >
                  {notification.title}
                </div>

                <div className="mt-1 text-xs leading-[1.55] text-slate-500">
                  {notification.message}
                </div>
              </div>

              {!isRead && (
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                  title="Unread"
                />
              )}
            </div>

            {/* Actions */}
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[10px] font-medium text-slate-400">
                {formatRelativeTime(notification.created_at)}
              </span>

              {!isRead && (
                <button
                  type="button"
                  onClick={() =>
                    void onMarkRead(notification.id)
                  }
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 transition hover:text-emerald-600"
                >
                  <Check className="h-3 w-3" />
                  Mark read
                </button>
              )}

              {notification.href && (
                <a
                  href={notification.href}
                  onClick={() =>
                    void onMarkRead(notification.id)
                  }
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 transition hover:text-slate-950"
                >
                  Open
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Bell className="h-5 w-5" />
      </div>

      <div className="mt-4 text-sm font-semibold text-slate-800">
        You&apos;re all caught up
      </div>

      <div className="mx-auto mt-1.5 max-w-[230px] text-xs leading-5 text-slate-400">
        Important platform activity and system events will appear here.
      </div>
    </div>
  );
}

function getNotificationIcon(type: string) {
  const normalized = type.toLowerCase();

  if (
    normalized.includes("security") ||
    normalized.includes("lockdown") ||
    normalized.includes("suspend")
  ) {
    return <ShieldAlert className="h-4 w-4" />;
  }

  if (
    normalized.includes("user") ||
    normalized.includes("register") ||
    normalized.includes("member")
  ) {
    return <UserPlus className="h-4 w-4" />;
  }

  if (
    normalized.includes("error") ||
    normalized.includes("failed") ||
    normalized.includes("alert")
  ) {
    return <AlertCircle className="h-4 w-4" />;
  }

  if (
    normalized.includes("activity") ||
    normalized.includes("updated") ||
    normalized.includes("created")
  ) {
    return <Activity className="h-4 w-4" />;
  }

  return <Info className="h-4 w-4" />;
}

function formatRelativeTime(value: string) {
  const seconds = Math.max(
    0,
    (Date.now() - new Date(value).getTime()) / 1000
  );

  if (seconds < 60) {
    return "Just now";
  }

  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`;
  }

  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h ago`;
  }

  if (seconds < 604800) {
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}