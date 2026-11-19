"use client";

// Medical history: the patient's own record of conditions, medications,
// surgeries, allergies and other medical events, shown as a timeline.
import { useState } from "react";
import { useRequireRole } from "@/lib/auth/useRequireRole";
import { useMedicalHistory } from "@/hooks/useMedicalHistory";
import { HudLoading, HudPanel, HudShell } from "@/components/hud/Hud";
import HistoryForm from "@/components/history/HistoryForm";
import HistoryTimeline from "@/components/history/HistoryTimeline";
import { apiError, callApi } from "@/lib/api/client";
import { EMPTY_INPUT, HistoryInput, HistoryRecord, HistoryType, TYPE_LABEL } from "@/lib/history";

export default function HistoryPage() {
  const { user, ready } = useRequireRole(["patient"]);
  const { records, ready: listReady } = useMedicalHistory(ready && user ? user.uid : null);
  const [editing, setEditing] = useState<HistoryRecord | null>(null);
  const [formKey, setFormKey] = useState(0); // changing it gives a fresh, empty form
  const [startType, setStartType] = useState<HistoryType>("condition");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (!ready || !user) return <HudLoading />;

  const ongoing = records.filter((r) => r.ongoing);

  async function save(record: HistoryInput) {
    if (!user) return;
    setBusy(true);
    setError("");
    setNotice("");
    const result = editing ? await callApi(user, "PUT", "/api/history", { id: editing.id, record }) : await callApi(user, "POST", "/api/history", { record });
    if (result.ok) {
      setNotice(result.message ?? "Saved.");
      setEditing(null);
      setFormKey((k) => k + 1);
    } else setError(apiError(result));
    setBusy(false);
  }

  async function remove(record: HistoryRecord) {
    if (!user || !window.confirm(`Delete "${record.title}" from your history? This cannot be undone.`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    const result = await callApi(user, "DELETE", "/api/history", { id: record.id });
    if (result.ok) {
      setNotice(result.message ?? "Deleted.");
      if (editing?.id === record.id) {
        setEditing(null);
        setFormKey((k) => k + 1);
      }
    } else setError(apiError(result));
    setBusy(false);
  }

  // Opens an empty form for the chosen kind of record.
  function startAdd(type: HistoryType) {
    setEditing(null);
    setStartType(type);
    setFormKey((k) => k + 1);
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(record: HistoryRecord) {
    setEditing(record);
    setFormKey((k) => k + 1);
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <HudShell active="history">
      <div className="hud-side">
        <div className="hud-stack">
          <HudPanel index="01" title={editing ? "Edit record" : "Add a record"} sub={editing ? `Changing: ${editing.title}` : "Educational prototype / Enter made-up details only"}>
            <HistoryForm
              key={formKey}
              initial={editing ?? { ...EMPTY_INPUT, type: startType }}
              editing={!!editing}
              busy={busy}
              onSave={save}
              onCancel={() => {
                setEditing(null);
                setFormKey((k) => k + 1);
              }}
            />
            {error && <p className="hud-error">{error}</p>}
            {notice && <p className="hud-success">{notice}</p>}
          </HudPanel>

          <HudPanel index="02" title="Ongoing now" sub="Current conditions, medications and care" right={<span className="hud-label">{ongoing.length}</span>}>
            {ongoing.length === 0 ? (
              <p className="hud-text hud-plain">Nothing is marked as ongoing.</p>
            ) : (
              ongoing.map((r) => (
                <div key={r.id} className="hud-row" style={{ textTransform: "none" }}>
                  <span>{r.title}</span>
                  <span className="hud-label">{TYPE_LABEL[r.type]}</span>
                </div>
              ))
            )}
          </HudPanel>
        </div>

        <HudPanel index="03" title="Timeline" sub="One timeline per kind / Click a record to open it" right={records.length > 0 ? <span className="hud-label">{records.length} records</span> : undefined} grow>
          {listReady ? <HistoryTimeline records={records} onEdit={startEdit} onDelete={remove} onAdd={startAdd} busy={busy} /> : <p className="hud-empty">Loading history...</p>}
        </HudPanel>
      </div>
    </HudShell>
  );
}
