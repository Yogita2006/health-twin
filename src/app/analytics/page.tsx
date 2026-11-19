"use client";

// The patient's analytics screen.
import { useState } from "react";
import { useRequireRole } from "@/lib/auth/useRequireRole";
import { useTwinState } from "@/hooks/useTwin";
import { HudLoading, HudShell } from "@/components/hud/Hud";
import AnalyticsView from "@/components/analytics/AnalyticsView";
import { apiError, callApi } from "@/lib/api/client";

export default function AnalyticsPage() {
  const { user, ready } = useRequireRole(["patient"]);
  const { state } = useTwinState(ready && user ? user.uid : null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  if (!ready || !user) return <HudLoading />;

  // Works the baseline out again from the most recent resting readings.
  async function recalculate() {
    if (!user) return;
    setBusy(true);
    const result = await callApi(user, "POST", "/api/baseline");
    setNote(result.ok ? (result.message ?? "Baseline recalculated.") : apiError(result));
    setBusy(false);
  }

  return (
    <HudShell active="analytics" state={state}>
      {note && <p className="hud-success" style={{ margin: "0 0 12px" }}>{note}</p>}
      <AnalyticsView
        patientId={user.uid}
        baselineAction={
          <button onClick={recalculate} disabled={busy} className="hud-btn hud-btn-quiet">
            {busy ? "Updating" : "Update range"}
          </button>
        }
      />
    </HudShell>
  );
}
