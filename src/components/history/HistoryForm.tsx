"use client";

// The form for adding a medical history record, or changing an existing one.
import { useState, FormEvent } from "react";
import { HISTORY_TYPES, HistoryInput, REGION_CHOICES, STATUS_WORDS, TITLE_HINT, TYPE_LABEL, HistoryRegion } from "@/lib/history";

interface Props {
  initial: HistoryInput;
  editing: boolean;
  busy: boolean;
  onSave: (record: HistoryInput) => void;
  onCancel: () => void;
}

export default function HistoryForm({ initial, editing, busy, onSave, onCancel }: Props) {
  const [record, setRecord] = useState<HistoryInput>(initial);
  const set = (change: Partial<HistoryInput>) => setRecord({ ...record, ...change });
  const words = STATUS_WORDS[record.type];

  function submit(e: FormEvent) {
    e.preventDefault();
    onSave(record);
  }

  return (
    <form onSubmit={submit}>
      <span className="hud-label">Kind of record</span>
      <div className="hud-chips hud-note">
        {HISTORY_TYPES.map((type) => (
          <button key={type} type="button" onClick={() => set({ type })} className={type === record.type ? "hud-chip hud-chip-on" : "hud-chip"}>
            {TYPE_LABEL[type]}
          </button>
        ))}
      </div>

      <label className="hud-field">
        <span className="hud-label">Name</span>
        <input className="hud-input" value={record.title} onChange={(e) => set({ title: e.target.value })} placeholder={TITLE_HINT[record.type]} maxLength={120} required />
      </label>

      {record.type === "medication" && (
        <div className="hud-form-grid">
          <label className="hud-field">
            <span className="hud-label">Dosage</span>
            <input className="hud-input" value={record.dosage} onChange={(e) => set({ dosage: e.target.value })} placeholder="For example: 100 micrograms" maxLength={60} />
          </label>
          <label className="hud-field">
            <span className="hud-label">How often</span>
            <input className="hud-input" value={record.frequency} onChange={(e) => set({ frequency: e.target.value })} placeholder="For example: Twice a day" maxLength={60} />
          </label>
        </div>
      )}

      <div className="hud-form-grid">
        <label className="hud-field">
          <span className="hud-label">{record.type === "surgery" ? "Date" : "Start date"}</span>
          <input className="hud-input" type="date" value={record.startDate} onChange={(e) => set({ startDate: e.target.value })} min="1900-01-01" required />
        </label>
        <label className="hud-field">
          <span className="hud-label">Status</span>
          <select className="hud-input" value={record.ongoing ? "ongoing" : "past"} onChange={(e) => set({ ongoing: e.target.value === "ongoing" })}>
            <option value="ongoing">{words.ongoing}</option>
            <option value="past">{words.past}</option>
          </select>
        </label>
        {!record.ongoing && (
          <label className="hud-field">
            <span className="hud-label">End date (optional)</span>
            <input className="hud-input" type="date" value={record.endDate} onChange={(e) => set({ endDate: e.target.value })} min={record.startDate || "1900-01-01"} />
          </label>
        )}
        <label className="hud-field">
          <span className="hud-label">Related body area</span>
          <select className="hud-input" value={record.region} onChange={(e) => set({ region: e.target.value as HistoryRegion })}>
            {REGION_CHOICES.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="hud-field">
        <span className="hud-label">Notes (optional)</span>
        <textarea className="hud-input hud-textarea" value={record.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={500} rows={3} />
      </label>

      <div className="hud-actions">
        <button type="submit" disabled={busy} className="hud-btn hud-btn-solid hud-btn-large">
          {busy ? "Saving" : editing ? "Save changes" : "Add record"}
        </button>
        {editing && (
          <button type="button" onClick={onCancel} disabled={busy} className="hud-btn hud-btn-large">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
