"use client";

// Steps 2 and 3 of the Cardiac advisor: the model's estimate, and the
// rule-based suggestions the doctor accepts or rejects.
import { HudPanel, StatusTag } from "@/components/hud/Hud";
import { CUTOFFS } from "@/lib/cardiac/suggestions";
import { Assessment, BAND_LABEL, CardiacInputs, GROUP_LABEL, ModelCard, Review, RiskBand, Suggestion, SuggestionGroup } from "@/lib/cardiac/types";
import { Status } from "@/lib/engine/types";

const BAND_STATUS: Record<RiskBand, Status> = { low: "within", moderate: "watch", high: "outside" };
const SHOWN_FACTORS = 6;

// A reading next to the textbook cut-offs used by the suggestion rules.
function indicators(x: CardiacInputs): { label: string; value: string; status: Status; note: string }[] {
  const grade = (value: number, raised: number, high: number): Status => (value >= high ? "outside" : value >= raised ? "watch" : "within");
  const bp = grade(x.trestbps, CUTOFFS.sysRaised, CUTOFFS.sysHigh);
  const chol = grade(x.chol, CUTOFFS.cholBorderline, CUTOFFS.cholHigh);
  const bmi = grade(x.bmi, CUTOFFS.bmiOverweight, 30);
  const hrUsual = x.restingHr >= 60 && x.restingHr <= 100;
  return [
    { label: "Resting blood pressure", value: `${x.trestbps} mmHg`, status: bp, note: bp === "outside" ? "140 or above" : bp === "watch" ? "130 to 139" : "Below 130" },
    { label: "Total cholesterol", value: `${x.chol} mg/dL`, status: chol, note: chol === "outside" ? "240 or above" : chol === "watch" ? "200 to 239" : "Below 200" },
    { label: "Resting heart rate", value: `${x.restingHr} bpm`, status: hrUsual ? "within" : "watch", note: hrUsual ? "60 to 100" : "Outside 60 to 100" },
    { label: "BMI", value: x.bmi.toFixed(1), status: bmi, note: bmi === "outside" ? "30 or above" : bmi === "watch" ? "25 to 29.9" : "Below 25" },
    { label: "Fasting blood sugar", value: x.fbs === 1 ? "Above 120 mg/dL" : "120 mg/dL or below", status: x.fbs === 1 ? "watch" : "within", note: x.fbs === 1 ? "Raised" : "Not raised" },
  ];
}

export function ModelRows({ card }: { card: ModelCard | null }) {
  if (!card) return null;
  return (
    <div className="cx-block">
      <p className="hud-label">About the model</p>
      <div className="cx-plain-row">
        <span>Model</span>
        <span>{card.name}</span>
      </div>
      {card.lines.map(([label, value]) => (
        <div key={label} className="cx-plain-row">
          <span>{label}</span>
          <span>{value}</span>
        </div>
      ))}
      <p className="hud-label hud-note">Data: {card.dataset}</p>
    </div>
  );
}

export function PredictionPanel({ inputs, assessment, card }: { inputs: CardiacInputs | null; assessment: Assessment | null; card: ModelCard | null }) {
  const factors = assessment ? assessment.contributions.slice(0, SHOWN_FACTORS) : [];
  const largest = factors.reduce((max, factor) => Math.max(max, Math.abs(factor.effect)), 0) || 1;

  return (
    <HudPanel index="02" title="Heart disease prediction" sub="Model estimate / Not a diagnosis">
      {(!assessment || !inputs) && <p className="hud-empty">Fill in the parameters and run the prediction.</p>}

      {assessment && inputs && (
        <div>
          <div className="cx-headline">
            <p className="hud-big">{Math.round(assessment.probability * 100)}%</p>
            <StatusTag status={BAND_STATUS[assessment.band]} label={`${BAND_LABEL[assessment.band]} band`} />
          </div>
          <div className="cx-gauge" role="img" aria-label={`Estimate ${Math.round(assessment.probability * 100)} per cent, ${BAND_LABEL[assessment.band]} band`}>
            <i className="cx-gauge-low" />
            <i className="cx-gauge-mid" />
            <i className="cx-gauge-high" />
            <b style={{ left: `${assessment.probability * 100}%` }} />
          </div>
          <div className="cx-gauge-scale hud-label">
            <span>Low</span>
            <span>Moderate</span>
            <span>High</span>
          </div>
          <p className="hud-text hud-note">
            The model's estimate that a patient with these findings has heart disease on angiography. The bands split the scale into thirds for display; they are not clinical cut-offs. A doctor makes the diagnosis.
          </p>
          {assessment.warnings.map((warning) => (
            <p key={warning} className="hud-notice hud-note">
              {warning} Treat the estimate as an extrapolation.
            </p>
          ))}

          <div className="cx-block">
            <p className="hud-label">What moved the estimate most</p>
            {factors.map((factor) => {
              const raises = factor.effect > 0;
              const width = `${(Math.abs(factor.effect) / largest) * 50}%`;
              return (
                <div key={factor.key} className="cx-factor">
                  <span className="cx-factor-name">
                    {factor.label}
                    <small>{factor.value}</small>
                  </span>
                  <span className="cx-factor-track">
                    <i className={raises ? "cx-raises" : "cx-lowers"} style={raises ? { left: "50%", width } : { right: "50%", width }} />
                  </span>
                  <span className={raises ? "cx-factor-word cx-raises-text" : "cx-factor-word cx-lowers-text"}>{raises ? "Raises" : "Lowers"}</span>
                </div>
              );
            })}
            <p className="hud-label hud-note">Compared with an average patient in the training data / Shows how the model works, not what causes disease</p>
          </div>

          <div className="cx-block">
            <p className="hud-label">Cardiac indicators</p>
            {indicators(inputs).map((item) => (
              <div key={item.label} className="cx-plain-row">
                <span>
                  {item.label} <b>{item.value}</b>
                </span>
                <StatusTag status={item.status} label={item.note} />
              </div>
            ))}
          </div>

          <ModelRows card={card} />
        </div>
      )}
    </HudPanel>
  );
}

const GROUP_ORDER: SuggestionGroup[] = ["lifestyle", "consultation", "medication", "investigation"];

export function SuggestionsPanel({ suggestions, reviews, onReview }: { suggestions: Suggestion[] | null; reviews: Record<string, Review>; onReview: (id: string, review: Review) => void }) {
  return (
    <HudPanel index="03" title="Suggestions to review" sub="Rule-based decision support / The doctor decides">
      {!suggestions && <p className="hud-empty">Suggestions appear after the prediction.</p>}

      {suggestions &&
        GROUP_ORDER.map((group) => {
          const items = suggestions.filter((suggestion) => suggestion.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="cx-block cx-block-first">
              <p className="hud-label">{GROUP_LABEL[group]}</p>
              {items.map((item) => (
                <div key={item.id} className="cx-suggestion">
                  <div className="cx-suggestion-main">
                    <p className="cx-suggestion-title">{item.title}</p>
                    <p className="hud-text cx-suggestion-reason">{item.reason}</p>
                  </div>
                  <div className="hud-chips">
                    <button type="button" aria-pressed={reviews[item.id] === "accepted"} onClick={() => onReview(item.id, "accepted")} className={reviews[item.id] === "accepted" ? "hud-chip hud-chip-on" : "hud-chip"}>
                      Accept
                    </button>
                    <button type="button" aria-pressed={reviews[item.id] === "rejected"} onClick={() => onReview(item.id, "rejected")} className={reviews[item.id] === "rejected" ? "hud-chip cx-chip-reject" : "hud-chip"}>
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}

      {suggestions && (
        <p className="hud-label hud-note">Produced by fixed rules, shown with each item / Medicine entries name a category to consider, never a drug or dose / Nothing is prescribed</p>
      )}
    </HudPanel>
  );
}
