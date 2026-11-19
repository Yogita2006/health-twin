"use client";

// One patient's twin, as seen by a doctor they share with (or an admin).
// Read only. The address is /doctor/patient?id=<patient id>. The security
// rules decide whether the data loads: changing the id in the address to a
// patient who has not shared access shows nothing.
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRequireRole } from "@/lib/auth/useRequireRole";
import { useTwinState } from "@/hooks/useTwin";
import { usePatientRecord } from "@/hooks/usePatients";
import { useMedicalHistory } from "@/hooks/useMedicalHistory";
import { HudLoading, HudPanel, HudShell } from "@/components/hud/Hud";
import TwinDashboard from "@/components/twin/TwinDashboard";
import AnalyticsView from "@/components/analytics/AnalyticsView";
import HistoryTimeline from "@/components/history/HistoryTimeline";
import { bmiFrom, profileSummary } from "@/lib/patient";

function PatientTwin() {
  const patientId = useSearchParams().get("id");
  const { ready: allowed } = useRequireRole(["doctor", "admin"]);
  const { record, ready: recordReady, denied } = usePatientRecord(allowed ? patientId : null);
  const { state, ready: stateReady } = useTwinState(allowed && record ? patientId : null);
  const { records: history, ready: historyReady } = useMedicalHistory(allowed && record ? patientId : null);
  const [view, setView] = useState<"twin" | "history" | "analytics">("twin");

  if (!allowed) return <HudLoading />;

  const bmi = bmiFrom(record?.profile);

  return (
    <HudShell active="patients" state={record ? state : undefined} viewing={record ? record.displayName : undefined}>
      <div className="hud-stack">
        <HudPanel
          index="00"
          title={record ? record.displayName || "Unnamed patient" : "Patient"}
          sub={record ? `${profileSummary(record.profile)}${bmi ? ` / BMI ${bmi.toFixed(1)}` : ""}` : "Patient record"}
          right={
            <Link href="/doctor" className="hud-btn hud-btn-quiet">
              Back to patients
            </Link>
          }
        >
          {!patientId && <p className="hud-error">No patient was chosen. Go back and open one from the list.</p>}
          {patientId && !recordReady && <p className="hud-empty">Loading patient...</p>}
          {patientId && recordReady && (denied || !record) && (
            <p className="hud-error">You do not have access to this patient. A patient must share their twin with you before you can open it.</p>
          )}
          {record && (
            <div className="hud-chips">
              <button onClick={() => setView("twin")} className={view === "twin" ? "hud-chip hud-chip-on" : "hud-chip"}>
                Twin
              </button>
              <button onClick={() => setView("history")} className={view === "history" ? "hud-chip hud-chip-on" : "hud-chip"}>
                Medical history ({history.length})
              </button>
              <button onClick={() => setView("analytics")} className={view === "analytics" ? "hud-chip hud-chip-on" : "hud-chip"}>
                Analytics
              </button>
            </div>
          )}
          {record && <p className="hud-label hud-note">Read-only view / The patient controls who can see this / Not for diagnosis</p>}
        </HudPanel>

        {record && patientId && view === "twin" && (
          <>
            {!stateReady && <p className="hud-empty">Loading twin...</p>}
            {stateReady && !state && <p className="hud-empty">This patient has not sent any readings yet, so there is no twin to show.</p>}
            {state && <TwinDashboard patientId={patientId} state={state} />}
          </>
        )}

        {record && patientId && view === "history" && (
          <HudPanel index="01" title="Medical history" sub="Entered by the patient / Newest first">
            {historyReady ? <HistoryTimeline records={history} /> : <p className="hud-empty">Loading history...</p>}
          </HudPanel>
        )}

        {record && patientId && view === "analytics" && <AnalyticsView patientId={patientId} />}
      </div>
    </HudShell>
  );
}

export default function DoctorPatientPage() {
  return (
    <Suspense fallback={<HudLoading />}>
      <PatientTwin />
    </Suspense>
  );
}
