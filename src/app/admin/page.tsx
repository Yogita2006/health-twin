"use client";

// The administrator's screen: every account and its role. Roles are changed
// through the server, which checks that the caller really is an admin.
import { useState } from "react";
import { useRequireRole } from "@/lib/auth/useRequireRole";
import { Account, useAccounts } from "@/hooks/usePatients";
import { HudLoading, HudPanel, HudShell } from "@/components/hud/Hud";
import { apiError, callApi } from "@/lib/api/client";

const ROLES = ["patient", "doctor", "admin"];

export default function AdminPage() {
  const { user, ready } = useRequireRole(["admin"]);
  const { accounts, ready: listReady } = useAccounts(ready);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (!ready || !user) return <HudLoading />;

  const count = (role: string) => accounts.filter((a) => a.role === role).length;

  async function changeRole(account: Account, role: string) {
    if (!user || role === account.role) return;
    const label = account.displayName || account.email;
    if (!window.confirm(`Change ${label} from ${account.role} to ${role}?`)) return;
    setBusyId(account.id);
    setError("");
    setNotice("");
    const result = await callApi(user, "POST", "/api/admin/role", { uid: account.id, role });
    if (result.ok) setNotice(`${label}: ${result.message ?? "role changed."}`);
    else setError(apiError(result));
    setBusyId("");
  }

  return (
    <HudShell active="users">
      <div className="hud-stack">
        <HudPanel index="01" title="Users and roles" sub="Every account / Changes apply immediately" right={<span className="hud-label">{accounts.length} accounts</span>}>
          <div className="hud-counts">
            {ROLES.map((role) => (
              <div key={role} className="hud-stat">
                <p className="hud-label hud-plain">{role}s</p>
                <p className="hud-stat-value">{count(role)}</p>
              </div>
            ))}
          </div>

          {error && <p className="hud-error">{error}</p>}
          {notice && <p className="hud-success">{notice}</p>}

          {!listReady && <p className="hud-empty">Loading accounts...</p>}
          {listReady && (
            <div className="hud-table-wrap hud-note">
              <table className="hud-table hud-table-left">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => {
                    const isMe = account.id === user.uid;
                    return (
                      <tr key={account.id}>
                        <td>
                          {account.displayName || "No name"}
                          {isMe ? " (you)" : ""}
                        </td>
                        <td>{account.email}</td>
                        <td>
                          <select
                            className="hud-input"
                            value={account.role}
                            disabled={isMe || busyId === account.id}
                            onChange={(e) => changeRole(account, e.target.value)}
                            aria-label={`Role for ${account.displayName || account.email}`}
                          >
                            {ROLES.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="hud-label hud-note">You cannot change your own role / New admins register with the admin key</p>
        </HudPanel>
      </div>
    </HudShell>
  );
}
