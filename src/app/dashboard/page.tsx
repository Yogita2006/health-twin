"use client";

// The patient's home screen: their own digital twin.
import { useRequireRole } from "@/lib/auth/useRequireRole";
import { useTwinState } from "@/hooks/useTwin";
import { usePatientRecord } from "@/hooks/usePatients";
import { HudLoading, HudShell } from "@/components/hud/Hud";
import GettingStarted from "@/components/panels/GettingStarted";
import TwinDashboard from "@/components/twin/TwinDashboard";

export default function DashboardPage() {
  const { user, ready: allowed } = useRequireRole(["patient"]);
  const uid = allowed && user ? user.uid : null;
  const { state, ready } = useTwinState(uid);
  const { record, ready: recordReady } = usePatientRecord(uid);

  if (!allowed || !user) return <HudLoading />;

  return (
    <HudShell active="overview" state={state}>
      <div className="hud-stack">
        {(!ready || !recordReady) && <p className="hud-empty">Loading your twin...</p>}
        {ready && recordReady && <GettingStarted user={user} record={record} hasData={!!state} />}
        {state && <TwinDashboard patientId={user.uid} state={state} />}
      </div>
    </HudShell>
  );
}
