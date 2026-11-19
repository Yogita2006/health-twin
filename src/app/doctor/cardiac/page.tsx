"use client";

// The Cardiac advisor for one patient, for doctors only.
// The address is /doctor/cardiac?id=<patient id>. The patient record loads
// only if the patient shares with this doctor, and the server checks the same
// thing again on every calculation and save.
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRequireRole } from "@/lib/auth/useRequireRole";
import { useTwinState } from "@/hooks/useTwin";
import { usePatientRecord } from "@/hooks/usePatients";
import { HudLoading, HudPanel, HudShell } from "@/components/hud/Hud";
import CardiacAdvisor from "@/components/cardiac/CardiacAdvisor";
import { profileSummary } from "@/lib/patient";

function Advisor() {
  const patientId = useSearchParams().get("id");
  const { user, ready: allowed } = useRequireRole(["doctor"]);
  const { record, ready: recordReady, denied } = usePatientRecord(allowed ? patientId : null);
  const { state, ready: stateReady } = useTwinState(allowed && record ? patientId : null);

  if (!allowed || !user) return <HudLoading />;

  return (
    <HudShell active="patients" state={record ? state : undefined} viewing={record ? record.displayName : undefined}>
      <div className="hud-stack">
        <HudPanel
          index="00"
          title="Cardiac advisor"
          sub={record ? `${record.displayName || "Unnamed patient"} / ${profileSummary(record.profile)}` : "Patient record"}
          right={
            <Link href={patientId ? `/doctor/patient?id=${encodeURIComponent(patientId)}` : "/doctor"} className="hud-btn hud-btn-quiet">
              Back to patient
            </Link>
          }
        >
          {!patientId && <p className="hud-error">No patient was chosen. Go back and open one from the list.</p>}
          {patientId && !recordReady && <p className="hud-empty">Loading patient...</p>}
          {patientId && recordReady && (denied || !record) && (
            <p className="hud-error">You do not have access to this patient. A patient must share their twin with you before you can open it.</p>
          )}
          {record && (
            <p className="hud-text" style={{ margin: 0 }}>
              An experimental decision-support and educational tool. A model estimates heart disease from the values you enter, fixed rules list options to review, and a what-if simulation compares risk under changes you assume. It gives
              estimates, not diagnoses, and it does not prescribe.
            </p>
          )}
        </HudPanel>

        {record && patientId && !stateReady && <p className="hud-empty">Loading latest reading...</p>}
        {record && patientId && stateReady && <CardiacAdvisor key={patientId} user={user} patientId={patientId} record={record} state={state} />}
      </div>
    </HudShell>
  );
}

export default function CardiacAdvisorPage() {
  return (
    <Suspense fallback={<HudLoading />}>
      <Advisor />
    </Suspense>
  );
}
