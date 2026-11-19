"use client";

// The doctor's home screen: the patients who have shared their twin, each with
// its live status. An admin sees every patient here.
import Link from "next/link";
import { useRequireRole } from "@/lib/auth/useRequireRole";
import { useTwinState } from "@/hooks/useTwin";
import { ListedPatient, useVisiblePatients } from "@/hooks/usePatients";
import { HudLoading, HudPanel, HudShell, StatusTag } from "@/components/hud/Hud";
import { profileSummary } from "@/lib/patient";
import { Region } from "@/lib/engine/types";

const SHOWN: { region: Region; label: string }[] = [
  { region: "heart", label: "Heart" },
  { region: "lungs", label: "Lungs" },
  { region: "body", label: "Body" },
];

// One patient in the list. Each row listens to that patient's twin, so the
// statuses change here as soon as a new reading arrives.
function PatientRow({ patient }: { patient: ListedPatient }) {
  const { state, ready } = useTwinState(patient.id);

  return (
    <div className="hud-item">
      <div className="hud-item-main">
        <p className="hud-item-name">{patient.displayName || "Unnamed patient"}</p>
        <span className="hud-label">{profileSummary(patient.profile)}</span>
      </div>
      <div className="hud-item-main">
        {!ready && <span className="hud-label">Loading status</span>}
        {ready && !state && <span className="hud-label">No readings yet</span>}
        {state && (
          <>
            <div className="hud-item-tags">
              {SHOWN.map((s) => (
                <StatusTag key={s.region} status={state.regions[s.region]} label={`${s.label}: ${state.regions[s.region] === "no_data" ? "no data" : state.regions[s.region]}`} />
              ))}
            </div>
            <span className="hud-label">Last reading {new Date(state.updatedAt).toLocaleString()}</span>
          </>
        )}
      </div>
      <Link href={`/doctor/patient?id=${patient.id}`} className="hud-btn">
        Open twin
      </Link>
    </div>
  );
}

export default function DoctorPage() {
  const { user, role, ready } = useRequireRole(["doctor", "admin"]);
  const { patients, ready: listReady } = useVisiblePatients(ready && user ? user.uid : null, role);

  if (!ready || !user) return <HudLoading />;
  const isDoctor = role === "doctor";

  return (
    <HudShell active="patients">
      <div className="hud-stack">
        <HudPanel
          index="01"
          title={isDoctor ? "Doctor dashboard: my patients" : "Administrator view: all patients"}
          sub={isDoctor ? "Only patients who chose to share with you / Live status" : "Administrator view / Read only / Live status"}
          right={<span className="hud-label">{patients.length} shown</span>}
        >
          {!listReady && <p className="hud-empty">Loading patients...</p>}
          {listReady && patients.length === 0 && (
            <p className="hud-empty">{isDoctor ? "No patient is sharing with you yet. A patient shares by opening their Profile page and choosing your name from the doctor list." : "There are no patient records yet."}</p>
          )}
          {patients.map((patient) => (
            <PatientRow key={patient.id} patient={patient} />
          ))}
        </HudPanel>
      </div>
    </HudShell>
  );
}
