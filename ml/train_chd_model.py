"""Trains the heart-risk model used by the "Heart risk simulation" screen.

Data:   Framingham Heart Study teaching subset, the file published on Kaggle as
        framingham.csv (4,240 people, 16 columns, outcome TenYearCHD).
        https://www.kaggle.com/datasets/aasheesh200/framingham-heart-study-dataset
Model:  logistic regression on seven inputs. It estimates the chance that a
        person with these measurements develops coronary heart disease within
        ten years, as seen in that study group.

What it is NOT: the data records no treatment given and no outcome after a
treatment, so this model cannot say what a medicine will do to a patient.

Run:    python ml/train_chd_model.py path/to/framingham.csv
Writes: src/lib/ml/chdModel.json  (the numbers the website's server uses)
"""
import json, sys
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

FEATURES = ["age", "male", "sysBP", "totChol", "BMI", "heartRate", "currentSmoker"]
TARGET = "TenYearCHD"
SEED = 42

data = pd.read_csv(sys.argv[1])
total = len(data)

# Cleaning: keep only the columns used, and drop people missing any of them.
data = data[FEATURES + [TARGET]].dropna()
used = len(data)

X = data[FEATURES].to_numpy(dtype=float)
y = data[TARGET].to_numpy(dtype=int)

# Split BEFORE any scaling, so nothing about the test people leaks into training.
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=SEED)

model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
cv = cross_val_score(model, X_train, y_train, scoring="roc_auc", cv=StratifiedKFold(5, shuffle=True, random_state=SEED))
model.fit(X_train, y_train)

p_test = model.predict_proba(X_test)[:, 1]
scaler, logit = model.named_steps["standardscaler"], model.named_steps["logisticregression"]

out = {
    "name": "Ten-year coronary heart disease risk (logistic regression)",
    "dataset": "Framingham Heart Study teaching subset (Kaggle: framingham.csv)",
    "datasetUrl": "https://www.kaggle.com/datasets/aasheesh200/framingham-heart-study-dataset",
    "target": TARGET,
    "features": FEATURES,
    "mean": [round(float(v), 6) for v in scaler.mean_],
    "scale": [round(float(v), 6) for v in scaler.scale_],
    "coef": [round(float(v), 6) for v in logit.coef_[0]],
    "intercept": round(float(logit.intercept_[0]), 6),
    # The middle 98% of each input among the people the model learned from.
    "range": {f: [round(float(np.percentile(X_train[:, i], 1)), 1), round(float(np.percentile(X_train[:, i], 99)), 1)] for i, f in enumerate(FEATURES)},
    "rows": {"inFile": int(total), "used": int(used), "train": int(len(y_train)), "test": int(len(y_test))},
    "metrics": {
        "testAuc": round(float(roc_auc_score(y_test, p_test)), 3),
        "cvAucMean": round(float(cv.mean()), 3),
        "cvAucSd": round(float(cv.std()), 3),
        "testBrier": round(float(brier_score_loss(y_test, p_test)), 4),
        "testObservedRate": round(float(y_test.mean()), 4),
        "testMeanPredicted": round(float(p_test.mean()), 4),
    },
    "seed": SEED,
}
json.dump(out, open("src/lib/ml/chdModel.json", "w"), indent=2)
print(json.dumps(out, indent=2))

# Fixed examples, used to check that the website's code gives the same answers.
examples = np.array([[45, 0, 120, 200, 24, 72, 0], [60, 1, 160, 260, 30, 85, 1], [35, 1, 110, 180, 22, 65, 0]], dtype=float)
print("CHECK", [round(float(p), 6) for p in model.predict_proba(examples)[:, 1]])
