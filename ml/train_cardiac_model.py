"""Trains the heart-disease prediction model used by the Cardiac advisor.

Data: the Cleveland heart disease data (UCI Machine Learning Repository), the same
data as the Kaggle dataset "Heart Disease Cleveland UCI" by cherngs:
https://www.kaggle.com/datasets/cherngs/heart-disease-cleveland-uci

The script accepts either file:
  * heart_cleveland_upload.csv from Kaggle (297 rows, codes start at 0), or
  * processed.cleveland.data from UCI (303 rows, 6 of them incomplete).
Both end up as the same 297 complete rows with the Kaggle coding.

Run:  python ml/train_cardiac_model.py path/to/file
Writes: src/lib/ml/clevelandModel.json (the weights the website uses).
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, confusion_matrix, roc_auc_score
from sklearn.model_selection import RepeatedStratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

SEED = 42
RAW = ["age", "sex", "cp", "trestbps", "chol", "fbs", "restecg", "thalach", "exang", "oldpeak", "slope", "ca", "thal"]


def load(path: str) -> pd.DataFrame:
    """Returns the 297 complete rows with the Kaggle coding and a 0/1 'condition'."""
    first = open(path, encoding="utf-8-sig").readline()
    if "age" in first:  # Kaggle file, already coded from 0
        data = pd.read_csv(path, encoding="utf-8-sig")
        return data[RAW + ["condition"]].dropna().astype(float)
    data = pd.read_csv(path, header=None, names=RAW + ["num"], na_values="?").dropna()
    data["cp"] = data["cp"] - 1            # 1..4  -> 0..3
    data["slope"] = data["slope"] - 1      # 1..3  -> 0..2
    data["thal"] = data["thal"].map({3.0: 0, 6.0: 1, 7.0: 2})
    data["condition"] = (data["num"] > 0).astype(int)   # any narrowing = disease
    return data[RAW + ["condition"]].astype(float)


def features(data: pd.DataFrame) -> pd.DataFrame:
    """The columns the model sees. Categories become yes/no columns."""
    x = pd.DataFrame(index=data.index)
    for name in ["age", "sex", "trestbps", "chol", "fbs", "thalach", "exang", "oldpeak", "ca"]:
        x[name] = data[name]
    # Only 4 patients have code 1, so the resting ECG is used as normal / not normal.
    x["restecg_abnormal"] = (data["restecg"] > 0).astype(float)
    for code in (1, 2, 3):   # chest pain type; 0 (typical angina) is the reference
        x[f"cp_{code}"] = (data["cp"] == code).astype(float)
    for code in (1, 2):      # ST slope; 0 (upsloping) is the reference
        x[f"slope_{code}"] = (data["slope"] == code).astype(float)
    for code in (1, 2):      # thallium scan; 0 (normal) is the reference
        x[f"thal_{code}"] = (data["thal"] == code).astype(float)
    return x


def main() -> None:
    data = load(sys.argv[1])
    x, y = features(data), data["condition"].astype(int)
    print("rows", len(data), "with disease", int(y.sum()), "without", int((1 - y).sum()))

    # Split first, so the test patients never influence scaling or training.
    x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2, stratify=y, random_state=SEED)

    logistic = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000))
    forest = RandomForestClassifier(n_estimators=300, random_state=SEED)

    # Cross-validation on the training patients only: 5 folds, repeated 10 times.
    folds = RepeatedStratifiedKFold(n_splits=5, n_repeats=10, random_state=SEED)
    cv = {}
    for name, model in (("logistic", logistic), ("forest", forest)):
        scores = cross_val_score(model, x_train, y_train, cv=folds, scoring="roc_auc")
        cv[name] = (float(scores.mean()), float(scores.std()))
        print(f"{name}: cross-validated AUC {scores.mean():.3f} +/- {scores.std():.3f}")

    logistic.fit(x_train, y_train)
    forest.fit(x_train, y_train)
    p_test = logistic.predict_proba(x_test)[:, 1]
    tn, fp, fn, tp = confusion_matrix(y_test, (p_test >= 0.5).astype(int)).ravel()
    forest_auc = roc_auc_score(y_test, forest.predict_proba(x_test)[:, 1])
    print("logistic test AUC", round(roc_auc_score(y_test, p_test), 3), "forest test AUC", round(forest_auc, 3))
    print("test confusion: tp", tp, "fp", fp, "fn", fn, "tn", tn)

    scaler, clf = logistic.named_steps["standardscaler"], logistic.named_steps["logisticregression"]
    numeric = ["age", "trestbps", "chol", "thalach", "oldpeak"]
    model = {
        "name": "Logistic regression, Cleveland heart disease data",
        "dataset": "Heart Disease Cleveland UCI (Kaggle, cherngs); original source UCI Machine Learning Repository",
        "datasetUrl": "https://www.kaggle.com/datasets/cherngs/heart-disease-cleveland-uci",
        "target": "Heart disease found on coronary angiography (at least one major vessel narrowed by more than 50%)",
        "columns": list(x.columns),
        "mean": [round(float(v), 6) for v in scaler.mean_],
        "scale": [round(float(v), 6) for v in scaler.scale_],
        "coef": [round(float(v), 6) for v in clf.coef_[0]],
        "intercept": round(float(clf.intercept_[0]), 6),
        "ranges": {n: [float(data[n].min()), float(data[n].max())] for n in numeric},
        "rows": {"inFile": 303, "used": int(len(data)), "train": int(len(x_train)), "test": int(len(x_test)),
                 "withDisease": int(y.sum())},
        "metrics": {
            "testAuc": round(float(roc_auc_score(y_test, p_test)), 3),
            "cvAucMean": round(cv["logistic"][0], 3),
            "cvAucSd": round(cv["logistic"][1], 3),
            "testBrier": round(float(brier_score_loss(y_test, p_test)), 4),
            "testAccuracy": round(float((tp + tn) / len(y_test)), 3),
            "testSensitivity": round(float(tp / (tp + fn)), 3),
            "testSpecificity": round(float(tn / (tn + fp)), 3),
            "testCounts": {"tp": int(tp), "fp": int(fp), "fn": int(fn), "tn": int(tn)},
            "forestCvAucMean": round(cv["forest"][0], 3),
            "forestCvAucSd": round(cv["forest"][1], 3),
            "forestTestAuc": round(float(forest_auc), 3),
        },
    }
    out = Path(__file__).resolve().parent.parent / "src" / "lib" / "ml" / "clevelandModel.json"
    out.write_text(json.dumps(model, indent=2) + "\n", encoding="utf-8")
    print("wrote", out)

    # Reference predictions, used to check that the website's code gives the same answers.
    sample = x_test.head(5)
    print("check rows:", json.dumps(data.loc[sample.index, RAW].values.tolist()))
    print("check probabilities:", [round(float(p), 6) for p in logistic.predict_proba(sample)[:, 1]])


if __name__ == "__main__":
    main()
