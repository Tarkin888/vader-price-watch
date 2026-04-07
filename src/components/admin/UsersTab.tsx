import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  last_sign_in_at: string | null;
  rejection_reason: string | null;
}

const UsersTab = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setUsers(data as UserProfile[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
    // Realtime subscription
    const channel = supabase
      .channel("user_profiles_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_profiles" }, () => {
        loadUsers();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadUsers]);

  const handleApprove = async (u: UserProfile) => {
    const { error } = await supabase
      .from("user_profiles")
      .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: user?.id })
      .eq("id", u.id);
    if (error) { toast.error("Failed to approve user"); return; }
    // Notify
    await supabase.functions.invoke("notify-user-status", {
      body: { email: u.email, displayName: u.display_name || u.email, status: "approved" },
    });
    // Audit log
    await supabase.from("page_views").insert({ page: `AUDIT:USER_APPROVED:${u.email}`, user_agent: user?.email || "" });
    toast.success(`User approved — ${u.display_name || u.email}`);
    loadUsers();
  };

  const handleReject = async (u: UserProfile) => {
    const { error } = await supabase
      .from("user_profiles")
      .update({
        status: "rejected",
        rejected_at: new Date().toISOString(),
        rejection_reason: rejectReason || null,
      })
      .eq("id", u.id);
    if (error) { toast.error("Failed to reject user"); return; }
    await supabase.functions.invoke("notify-user-status", {
      body: { email: u.email, displayName: u.display_name || u.email, status: "rejected", rejectionReason: rejectReason },
    });
    await supabase.from("page_views").insert({ page: `AUDIT:USER_REJECTED:${u.email}`, user_agent: user?.email || "" });
    toast.success(`User rejected — ${u.display_name || u.email}`);
    setRejectingId(null);
    setRejectReason("");
    loadUsers();
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setDeleteLoading(true);
    const { error } = await supabase.functions.invoke("delete-user", {
      body: { userId: deletingUser.id, userEmail: deletingUser.email },
    });
    setDeleteLoading(false);
    if (error) { toast.error(`Failed to delete user: ${error.message}`); return; }
    toast.success(`User deleted — ${deletingUser.display_name || deletingUser.email}`);
    setDeletingUser(null);
    loadUsers();
  };

  const handleRevoke = async (u: UserProfile) => {
    const { error } = await supabase
      .from("user_profiles")
      .update({ status: "rejected", rejected_at: new Date().toISOString(), rejection_reason: "Access revoked by admin" })
      .eq("id", u.id);
    if (error) { toast.error("Failed to revoke user"); return; }
    await supabase.from("page_views").insert({ page: `AUDIT:USER_REVOKED:${u.email}`, user_agent: user?.email || "" });
    toast.success(`Access revoked — ${u.display_name || u.email}`);
    loadUsers();
  };

  const pending = users.filter((u) => u.status === "pending");
  const approved = users.filter((u) => u.status === "approved");
  const rejected = users.filter((u) => u.status === "rejected");
  const filtered = filter === "all" ? users : users.filter((u) => u.status === filter);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      approved: "#2D5A27",
      pending: "#C9A84C",
      rejected: "#5A2727",
    };
    return (
      <span
        className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded"
        style={{ background: colors[status] || "#333", color: "#fff" }}
      >
        {status.toUpperCase()}
      </span>
    );
  };

  if (loading) return <p className="text-center py-8" style={{ color: "#e0d8c0", opacity: 0.5 }}>Loading users…</p>;

  return (
    <div>
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
          <div className="rounded p-6 w-full max-w-sm mx-4" style={{ background: "#111110", border: "1px solid rgba(201,168,76,0.3)" }}>
            <h3 className="text-sm font-bold tracking-widest mb-2" style={{ color: "#C9A84C" }}>DELETE USER</h3>
            <p className="text-[12px] mb-4" style={{ color: "#e0d8c0", opacity: 0.8 }}>
              Are you sure you want to delete <span className="font-bold" style={{ color: "#C9A84C" }}>{deletingUser.email}</span>?<br/>
              <span className="text-[11px]" style={{ opacity: 0.6 }}>This action cannot be undone.</span>
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeletingUser(null)} disabled={deleteLoading} className="px-4 py-2 rounded text-[10px] font-bold tracking-wider" style={{ background: "#333", color: "#e0d8c0", minHeight: 38 }}>CANCEL</button>
              <button onClick={handleDelete} disabled={deleteLoading} className="px-4 py-2 rounded text-[10px] font-bold tracking-wider" style={{ background: "#7A1F1F", color: "#fff", minHeight: 38 }}>{deleteLoading ? "DELETING…" : "CONFIRM DELETE"}</button>
            </div>
          </div>
        </div>
      )}
      {/* Stats */}
      <div className="flex flex-wrap gap-3 mb-6">
        {[
          { label: "Total", count: users.length, key: "all" },
          { label: "Approved", count: approved.length, key: "approved" },
          { label: "Pending", count: pending.length, key: "pending" },
          { label: "Rejected", count: rejected.length, key: "rejected" },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className="px-4 py-2 rounded text-center transition-colors"
            style={{
              border: filter === s.key ? "1px solid #C9A84C" : "1px solid rgba(201,168,76,0.2)",
              background: filter === s.key ? "rgba(201,168,76,0.1)" : "transparent",
              minHeight: 44,
              minWidth: 80,
            }}
          >
            <span className="block text-lg font-bold" style={{ color: "#C9A84C" }}>{s.count}</span>
            <span className="text-[10px] tracking-wider" style={{ color: "#e0d8c0", opacity: 0.6 }}>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Pending Approvals */}
      {pending.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-bold tracking-widest mb-3 flex items-center gap-2" style={{ color: "#C9A84C" }}>
            PENDING APPROVALS
            <span className="text-[9px] px-2 py-0.5 rounded" style={{ background: "rgba(201,168,76,0.2)" }}>
              {pending.length}
            </span>
          </h3>
          <div className="space-y-2">
            {pending.map((u) => (
              <div
                key={u.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded"
                style={{ background: "#111110", border: "1px solid rgba(201,168,76,0.15)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center rounded-full overflow-hidden flex-shrink-0"
                    style={{ width: 36, height: 36, background: u.avatar_url ? "transparent" : "rgba(201,168,76,0.2)" }}
                  >
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold" style={{ color: "#C9A84C" }}>
                        {(u.display_name || u.email)[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#C9A84C" }}>{u.display_name || "—"}</p>
                    <p className="text-[11px]" style={{ color: "#e0d8c0", opacity: 0.6 }}>{u.email}</p>
                    <p className="text-[10px]" style={{ color: "#e0d8c0", opacity: 0.4 }}>
                      Signed up: {new Date(u.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {rejectingId === u.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Reason (optional)"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="px-3 py-2 rounded text-xs"
                        style={{ background: "#0D0D0B", border: "1px solid rgba(201,168,76,0.3)", color: "#e0d8c0", minHeight: 44 }}
                      />
                      <button
                        onClick={() => handleReject(u)}
                        className="px-3 py-2 rounded text-[10px] font-bold tracking-wider"
                        style={{ background: "#5A2727", color: "#fff", minHeight: 44 }}
                      >
                        CONFIRM
                      </button>
                      <button
                        onClick={() => { setRejectingId(null); setRejectReason(""); }}
                        className="px-3 py-2 rounded text-[10px] font-bold tracking-wider"
                        style={{ background: "#333", color: "#e0d8c0", minHeight: 44 }}
                      >
                        CANCEL
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleApprove(u)}
                        className="px-4 py-2 rounded text-[10px] font-bold tracking-wider"
                        style={{ background: "#2D5A27", color: "#fff", minHeight: 44 }}
                      >
                        APPROVE
                      </button>
                      <button
                        onClick={() => setRejectingId(u.id)}
                        className="px-4 py-2 rounded text-[10px] font-bold tracking-wider"
                        style={{ background: "#5A2727", color: "#fff", minHeight: 44 }}
                      >
                        REJECT
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Users Table */}
      <h3 className="text-xs font-bold tracking-widest mb-3" style={{ color: "#C9A84C" }}>ALL USERS</h3>
      {filtered.length === 0 ? (
        <p className="text-center py-8 italic" style={{ color: "#e0d8c0", opacity: 0.5 }}>No users registered yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]" style={{ color: "#e0d8c0" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(201,168,76,0.2)" }}>
                <th className="text-left py-2 px-2 font-bold tracking-wider" style={{ color: "#C9A84C" }}>Name</th>
                <th className="text-left py-2 px-2 font-bold tracking-wider" style={{ color: "#C9A84C" }}>Email</th>
                <th className="text-left py-2 px-2 font-bold tracking-wider" style={{ color: "#C9A84C" }}>Role</th>
                <th className="text-left py-2 px-2 font-bold tracking-wider" style={{ color: "#C9A84C" }}>Status</th>
                <th className="text-left py-2 px-2 font-bold tracking-wider" style={{ color: "#C9A84C" }}>Signed Up</th>
                <th className="text-left py-2 px-2 font-bold tracking-wider" style={{ color: "#C9A84C" }}>Last Sign-In</th>
                <th className="text-left py-2 px-2 font-bold tracking-wider" style={{ color: "#C9A84C" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr
                  key={u.id}
                  style={{
                    background: i % 2 === 0 ? "#0D0D0B" : "#111110",
                    borderBottom: "1px solid rgba(201,168,76,0.08)",
                  }}
                >
                  <td className="py-2 px-2">{u.display_name || "—"}</td>
                  <td className="py-2 px-2">{u.email}</td>
                  <td className="py-2 px-2">
                    <span
                      className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded"
                      style={{
                        color: u.role === "admin" ? "#C9A84C" : "#e0d8c0",
                        background: u.role === "admin" ? "rgba(201,168,76,0.15)" : "rgba(224,216,192,0.08)",
                      }}
                    >
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2 px-2">{statusBadge(u.status)}</td>
                  <td className="py-2 px-2">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="py-2 px-2">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "—"}</td>
                  <td className="py-2 px-2">
                    {u.id === user?.id ? (
                      <span className="text-[9px] italic" style={{ opacity: 0.4 }}>You</span>
                    ) : u.status === "pending" ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleApprove(u)}
                          className="px-2 py-1 rounded text-[9px] font-bold"
                          style={{ background: "#2D5A27", color: "#fff", minHeight: 30 }}
                        >
                          APPROVE
                        </button>
                        <button
                          onClick={() => setRejectingId(u.id)}
                          className="px-2 py-1 rounded text-[9px] font-bold"
                          style={{ background: "#5A2727", color: "#fff", minHeight: 30 }}
                        >
                          REJECT
                        </button>
                      </div>
                    ) : u.status === "approved" && u.role !== "admin" ? (
                      <button
                        onClick={() => handleRevoke(u)}
                        className="px-2 py-1 rounded text-[9px] font-bold"
                        style={{ background: "#5A2727", color: "#fff", minHeight: 30 }}
                      >
                        REVOKE
                      </button>
                    ) : u.status === "rejected" ? (
                      <button
                        onClick={() => handleApprove(u)}
                        className="px-2 py-1 rounded text-[9px] font-bold"
                        style={{ background: "#2D5A27", color: "#fff", minHeight: 30 }}
                      >
                        APPROVE
                      </button>
                    ) : null}
                    {u.role !== "admin" && (
                      <button onClick={() => setDeletingUser(u)} title="Delete user permanently" className="px-2 py-1 rounded text-[9px] font-bold ml-1" style={{ background: "#7A1F1F", color: "#fff", minHeight: 30 }}>🗑</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UsersTab;
