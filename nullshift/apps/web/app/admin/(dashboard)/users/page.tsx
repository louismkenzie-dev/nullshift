import type { CSSProperties, ReactNode } from "react";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";

type MembershipTier = "none" | "core" | "grow" | "pro" | "partner";
type MembershipStatus = "active" | "trialing" | "past_due" | "cancelled";

type AdminUserRow = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  app_metadata: Record<string, unknown>;
};

type SubscriptionRow = {
  user_id: string;
  tier: Exclude<MembershipTier, "none">;
  status: MembershipStatus;
  updated_at: string | null;
  created_at: string;
};

const TIER_OPTIONS: Array<{ value: MembershipTier; label: string }> = [
  { value: "none", label: "No access" },
  { value: "core", label: "Core" },
  { value: "grow", label: "Grow" },
  { value: "pro", label: "Pro" },
  { value: "partner", label: "Partner" },
];

const STATUS_OPTIONS: Array<{ value: MembershipStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "trialing", label: "Trialing" },
  { value: "past_due", label: "Past due" },
  { value: "cancelled", label: "Cancelled" },
];

function isTier(value: unknown): value is Exclude<MembershipTier, "none"> {
  return value === "core" || value === "grow" || value === "pro" || value === "partner";
}

function isStatus(value: unknown): value is MembershipStatus {
  return value === "active" || value === "trialing" || value === "past_due" || value === "cancelled";
}

function normalizeMembership(user: AdminUserRow, subscription?: SubscriptionRow | null) {
  const metaTier = user.app_metadata.subscription_tier;
  const metaStatus = user.app_metadata.subscription_status;

  const tier = subscription && isTier(subscription.tier)
    ? subscription.tier
    : isTier(metaTier)
      ? metaTier
      : "none";

  const status = subscription?.status && isStatus(subscription.status)
    ? subscription.status
    : isStatus(metaStatus)
      ? metaStatus
      : tier === "none"
        ? "cancelled"
        : "active";

  return {
    tier,
    status,
    source: subscription ? "subscriptions" : "metadata",
  } as const;
}

async function fetchAllUsers() {
  const admin = createServiceClient();
  const pageSize = 1000;
  let page = 1;
  const users: AdminUserRow[] = [];
  let total = 0;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: pageSize });
    if (error) {
      throw error;
    }

    users.push(
      ...(data.users as AdminUserRow[])
    );
    total = data.total ?? total;
    if (!data.nextPage) break;
    page = data.nextPage;
  }

  const { data: subscriptionRows } = await admin
    .from("subscriptions")
    .select("user_id, tier, status, updated_at, created_at");

  const activeSubscriptionByUser = new Map<string, SubscriptionRow>();
  for (const row of (subscriptionRows ?? []) as SubscriptionRow[]) {
    if (row.status !== "active") continue;
    const current = activeSubscriptionByUser.get(row.user_id);
    const currentStamp = current ? new Date(current.updated_at ?? current.created_at).getTime() : 0;
    const rowStamp = new Date(row.updated_at ?? row.created_at).getTime();
    if (!current || rowStamp >= currentStamp) {
      activeSubscriptionByUser.set(row.user_id, row);
    }
  }

  return { users, total, activeSubscriptionByUser };
}

async function updateMembership(formData: FormData) {
  "use server";

  const admin = createServiceClient();
  const userId = String(formData.get("user_id") ?? "");
  const rawTier = String(formData.get("tier") ?? "none");
  const rawStatus = String(formData.get("status") ?? "cancelled");
  const tier = (TIER_OPTIONS.find((opt) => opt.value === rawTier)?.value ?? "none") as MembershipTier;
  const status = (STATUS_OPTIONS.find((opt) => opt.value === rawStatus)?.value ?? "cancelled") as MembershipStatus;

  if (!userId) return;

  const { data: currentUser, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError || !currentUser.user) {
    return;
  }

  const now = new Date().toISOString();
  const currentMetadata = (currentUser.user.app_metadata ?? {}) as Record<string, unknown>;
  const nextMetadata = { ...currentMetadata };

  if (tier === "none") {
    delete nextMetadata.subscription_tier;
    delete nextMetadata.subscription_status;
    delete nextMetadata.subscription_updated_at;
  } else {
    nextMetadata.subscription_tier = tier;
    nextMetadata.subscription_status = status;
    nextMetadata.subscription_updated_at = now;
  }

  const { error: tableLookupError } = await admin
    .from("subscriptions")
    .select("user_id, tier, status, updated_at, created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!tableLookupError) {
    if (tier === "none") {
      await admin.from("subscriptions").delete().eq("user_id", userId).eq("status", "active");
    } else {
      const payload = {
        user_id: userId,
        tier,
        status,
        updated_at: now,
      };

      const { data: existing } = await admin
        .from("subscriptions")
        .select("user_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (existing) {
        await admin.from("subscriptions").update(payload).eq("user_id", userId).eq("status", "active");
      } else {
        await admin.from("subscriptions").insert({ ...payload, started_at: now });
      }
    }
  }

  await admin.auth.admin.updateUserById(userId, {
    app_metadata: nextMetadata,
  });

  revalidatePath("/admin/users");
  revalidatePath("/learn");
}

async function deleteUser(formData: FormData) {
  "use server";

  const admin = createServiceClient();
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return;

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/users");
}

export default async function UsersPage() {
  const { users, total, activeSubscriptionByUser } = await fetchAllUsers();
  const rows = users.map((user) => ({
    user,
    membership: normalizeMembership(user, activeSubscriptionByUser.get(user.id) ?? null),
  }));

  return (
    <div>
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary, marginBottom: "8px" }}>
            ACCESS CONTROL
          </div>
          <h1 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "2.4rem", letterSpacing: "0.01em", color: T.fg }}>
            USERS
          </h1>
          <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted, marginTop: "8px", maxWidth: "60ch" }}>
            View every signed-up user, inspect their current membership, adjust their access tier, or delete them from Auth.
          </p>
        </div>
        <div className="text-right">
          <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted }}>
            Total users
          </div>
          <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: "2rem", color: T.fg, marginTop: "4px" }}>
            {total || rows.length}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl p-8" style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow.sm }}>
          <p style={{ fontFamily: T.sans, color: T.muted }}>No users found yet.</p>
        </div>
      ) : (
        <div className="rounded-3xl overflow-hidden" style={{ border: `1px solid ${T.border}`, background: T.surface, boxShadow: T.shadow.md }}>
          <div className="grid grid-cols-[1.5fr_1fr_0.9fr_1.3fr] gap-4 px-6 py-4" style={{ borderBottom: `1px solid ${T.border}` }}>
            <HeaderCell>Account</HeaderCell>
            <HeaderCell>Membership</HeaderCell>
            <HeaderCell>Signals</HeaderCell>
            <HeaderCell className="text-right">Actions</HeaderCell>
          </div>

          <div className="divide-y" style={{ borderColor: T.border }}>
            {rows.map(({ user, membership }) => (
              <div key={user.id} className="grid grid-cols-1 gap-4 px-6 py-5 lg:grid-cols-[1.5fr_1fr_0.9fr_1.3fr] lg:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1rem", letterSpacing: "-0.02em", color: T.fg }}>
                      {user.email ?? "No email"}
                    </div>
                    {user.email_confirmed_at && (
                      <Chip tone="primary">Confirmed</Chip>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3" style={{ fontFamily: T.mono, fontSize: "10px", color: T.muted, letterSpacing: "0.08em" }}>
                    <span>{user.id}</span>
                    <span>•</span>
                    <span>Joined {formatDate(user.created_at)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={membership.tier === "none" ? "muted" : "primary"}>{membership.tier.toUpperCase()}</Chip>
                  <Chip tone={membership.status === "active" ? "success" : membership.status === "past_due" ? "warning" : "muted"}>
                    {membership.status}
                  </Chip>
                  <span style={{ fontFamily: T.mono, fontSize: "9px", color: T.muted, letterSpacing: "0.08em" }}>
                    {membership.source}
                  </span>
                </div>

                <div className="space-y-1" style={{ fontFamily: T.mono, fontSize: "10px", color: T.muted, letterSpacing: "0.08em" }}>
                  <div>Last sign in: {user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : "Never"}</div>
                  <div>Email verified: {user.email_confirmed_at ? "Yes" : "No"}</div>
                </div>

                <form action={updateMembership} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] lg:justify-end">
                  <input type="hidden" name="user_id" value={user.id} />
                  <label className="sr-only" htmlFor={`tier-${user.id}`}>Membership tier</label>
                  <select
                    id={`tier-${user.id}`}
                    name="tier"
                    defaultValue={membership.tier}
                    className="h-10 px-3 rounded-lg"
                    style={selectStyle}
                  >
                    {TIER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <label className="sr-only" htmlFor={`status-${user.id}`}>Membership status</label>
                  <select
                    id={`status-${user.id}`}
                    name="status"
                    defaultValue={membership.status}
                    className="h-10 px-3 rounded-lg"
                    style={selectStyle}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <div className="flex gap-2 sm:col-span-2 lg:col-span-1 lg:justify-end">
                    <button
                      type="submit"
                      className="h-10 px-4 rounded-lg transition-opacity hover:opacity-90"
                      style={{
                        fontFamily: T.mono,
                        fontSize: "10px",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        background: T.primary,
                        color: T.primaryFg,
                        boxShadow: `0 0 18px color-mix(in oklab, ${T.primary} 18%, transparent)`,
                      }}
                    >
                      Save
                    </button>

                    <button
                      formAction={deleteUser}
                      type="submit"
                      className="h-10 px-4 rounded-lg transition-opacity hover:opacity-90"
                      style={{
                        fontFamily: T.mono,
                        fontSize: "10px",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        background: "transparent",
                        color: T.danger,
                        border: `1px solid ${T.danger}40`,
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HeaderCell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={className} style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted }}>
      {children}
    </div>
  );
}

function Chip({ children, tone }: { children: ReactNode; tone: "primary" | "success" | "warning" | "muted" }) {
  const bg =
    tone === "primary"
      ? `${T.primary}12`
      : tone === "success"
        ? "rgba(43, 224, 140, 0.12)"
        : tone === "warning"
          ? "rgba(251, 191, 36, 0.12)"
          : T.elevated;
  const color =
    tone === "primary"
      ? T.primary
      : tone === "success"
        ? "#2BE08C"
        : tone === "warning"
          ? "#facc15"
          : T.muted;
  const border = tone === "muted" ? T.border : color + "40";

  return (
    <span
      style={{
        fontFamily: T.mono,
        fontSize: "9px",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: T.r.full,
        padding: "3px 9px",
      }}
    >
      {children}
    </span>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const selectStyle: CSSProperties = {
  background: T.bg,
  border: `1px solid ${T.border}`,
  color: T.fg,
  fontFamily: T.sans,
  fontSize: "0.9rem",
  outline: "none",
  borderRadius: T.r.md,
  minWidth: 0,
};
