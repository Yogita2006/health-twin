"use client";

// A patient's medical history as a set of timelines, one for each kind of
// record (conditions, medications, surgeries, allergies, treatments), each
// always in date order. Click a record to open it; the patient then gets Edit
// and Delete, while a doctor sees it read only.
import { useState } from "react";
import { HISTORY_TYPES, HistoryRecord, HistoryType, REGION_CHOICES, TYPE_LABEL, TYPE_PLURAL, byNewest, dateRange, statusWord } from "@/lib/history";

interface Props {
  records: HistoryRecord[];
  onEdit?: (record: HistoryRecord) => void;
  onDelete?: (record: HistoryRecord) => void;
  onAdd?: (type: HistoryType) => void; // starts a new record of this kind
  busy?: boolean;
}

export default function HistoryTimeline({ records, onEdit, onDelete, onAdd, busy }: Props) {
  const [newestFirst, setNewestFirst] = useState(true);
  const [openId, setOpenId] = useState("");

  // An empty timeline shows a way to start, not a row of filters with nothing to filter.
  if (records.length === 0) {
    return (
      <div className="hud-blank">
        <p className="hud-blank-title">No records yet</p>
        {onAdd ? (
          <>
            <p className="hud-text hud-plain">Choose what to add first.</p>
            <div className="hud-chips">
              {HISTORY_TYPES.map((type) => (
                <button key={type} onClick={() => onAdd(type)} className="hud-btn">
                  + {TYPE_LABEL[type]}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="hud-text hud-plain">This patient has not added any medical history.</p>
        )}
      </div>
    );
  }

  // Always sorted by date, whatever order the records were added in.
  const sorted = [...records].sort(byNewest);
  if (!newestFirst) sorted.reverse();

  return (
    <div>
      <div className="hud-split" style={{ justifyContent: "flex-end" }}>
        <button onClick={() => setNewestFirst((v) => !v)} className="hud-btn hud-btn-quiet" aria-label="Change the sort order">
          {newestFirst ? "Newest first" : "Oldest first"}
        </button>
      </div>

      {HISTORY_TYPES.map((type) => {
        const items = sorted.filter((record) => record.type === type);
        // A doctor only needs to see the kinds that have records.
        if (items.length === 0 && !onAdd) return null;
        return (
          <section key={type}>
            <h3 className="hud-year">
              <span>{TYPE_PLURAL[type]}</span>
              <i aria-hidden="true" />
              <span className="hud-event-date">{items.length}</span>
              {onAdd && (
                <button onClick={() => onAdd(type)} className="hud-btn hud-btn-quiet">
                  + Add
                </button>
              )}
            </h3>

            {items.length === 0 ? (
              <p className="hud-event-date hud-plain">None recorded.</p>
            ) : (
              <ol className="hud-timeline">
                {items.map((record) => {
                  const open = record.id === openId;
                  const area = REGION_CHOICES.find((c) => c.id === record.region);
                  const details = [record.dosage, record.frequency, area && area.id !== "none" ? area.label : ""].filter(Boolean).join(" / ");
                  return (
                    <li key={record.id} className={`hud-event${record.ongoing ? " hud-event-on" : ""}${open ? " hud-event-open" : ""}`}>
                      <button className="hud-event-head" onClick={() => setOpenId(open ? "" : record.id)} aria-expanded={open}>
                        <span className="hud-event-date">{dateRange(record)}</span>
                        <span className="hud-event-title">{record.title}</span>
                        <span className={record.ongoing ? "hud-event-status hud-watch" : "hud-event-status hud-no_data"}>{statusWord(record)}</span>
                      </button>
                      {open && (
                        <div className="hud-event-body">
                          {details && <p className="hud-event-date hud-plain">{details}</p>}
                          <p className="hud-text hud-plain">{record.notes || "No notes."}</p>
                          {(onEdit || onDelete) && (
                            <div className="hud-chips">
                              {onEdit && (
                                <button onClick={() => onEdit(record)} disabled={busy} className="hud-btn hud-btn-quiet">
                                  Edit
                                </button>
                              )}
                              {onDelete && (
                                <button onClick={() => onDelete(record)} disabled={busy} className="hud-btn hud-btn-danger">
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}
