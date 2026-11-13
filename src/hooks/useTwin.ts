"use client";

// Live views of one patient's twin. Each hook opens a Firestore listener, so the
// screen redraws by itself whenever the server writes a new state or alert.
import { useEffect, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Alert, TwinState } from "@/lib/engine/types";

export function useTwinState(uid: string | null) {
  const [state, setState] = useState<TwinState | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, "patients", uid, "twin", "state"),
      (snap) => {
        setState(snap.exists() ? (snap.data() as TwinState) : null);
        setReady(true);
      },
      (err) => {
        console.error("Could not load the twin state:", err);
        setReady(true);
      }
    );
  }, [uid]);

  return { state, ready };
}

export function useAlerts(uid: string | null, max = 5) {
  const [alerts, setAlerts] = useState<(Alert & { id: string })[]>([]);

  useEffect(() => {
    if (!uid) return;
    const recent = query(collection(db, "patients", uid, "alerts"), orderBy("ts", "desc"), limit(max));
    return onSnapshot(
      recent,
      (snap) => setAlerts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Alert) }))),
      (err) => console.error("Could not load alerts:", err)
    );
  }, [uid, max]);

  return alerts;
}
