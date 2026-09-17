"use client";

type UserAvatarProps = {
  name?: string | null;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
};

function getInitials(name?: string | null) {
  const value = (name || "SBS").trim();
  const parts = value.split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "SBS";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function UserAvatar({
  name,
  avatarUrl,
  size = 40,
  className = "",
}: UserAvatarProps) {
  const initials = getInitials(name);

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
      }}
      aria-label={name || "User"}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name || "Profile photo"}
          width={size}
          height={size}
          loading="eager"
          decoding="async"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <span
          aria-hidden="true"
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
