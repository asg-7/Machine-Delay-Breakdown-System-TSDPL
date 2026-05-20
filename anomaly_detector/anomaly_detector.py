"""
anomaly_detector.py
--------------------
Isolation Forest wrapper for TSDPL shift-level anomaly detection.

Fits on all available shifts, scores every shift, and returns
a ranked list of anomalous shifts with per-feature explanations
(via a SHAP-lite approximation using mean absolute deviation from
the training centroid — no extra dependencies).

Usage
-----
    from anomaly_detector import ShiftAnomalyDetector
    from feature_engineering import engineer_features

    df_features, feature_cols = engineer_features(raw_df)
    detector = ShiftAnomalyDetector()
    detector.fit(df_features, feature_cols)

    results = detector.predict(df_features, feature_cols)
    # results is a DataFrame sorted by anomaly_score descending
    # with columns: shift_date, shift, line, incharge,
    #               anomaly_score, is_anomaly, top_drivers
"""

import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from typing import Optional, List, Tuple
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import RobustScaler


class ShiftAnomalyDetector:
    """
    Encapsulates the full pipeline:
        RobustScaler  →  IsolationForest  →  anomaly scoring  →  driver explanation
    
    Why RobustScaler?
        Shift data often has outliers in delay_minutes on maintenance days.
        RobustScaler uses median + IQR so those extremes don't crush the
        feature space for normal shifts.
    
    Why IsolationForest?
        - Works well on tabular industrial data with ~30 features
        - No labeled anomalies needed (unsupervised)
        - contamination parameter = expected fraction of bad shifts,
          start with 0.05 (5%) and tune from operational knowledge
    """

    # Model artefacts saved here so FastAPI can reload without retraining
    _MODULE_DIR = Path(__file__).resolve().parent
    MODEL_PATH  = _MODULE_DIR / "models" / "isolation_forest.joblib"
    SCALER_PATH = _MODULE_DIR / "models" / "robust_scaler.joblib"
    META_PATH   = _MODULE_DIR / "models" / "feature_cols.joblib"

    def __init__(
        self,
        contamination: float = 0.05,
        n_estimators: int = 200,
        max_samples: str = "auto",
        random_state: int = 42,
    ):
        self.contamination = contamination
        self.scaler = RobustScaler()
        self.model  = IsolationForest(
            n_estimators=n_estimators,
            max_samples=max_samples,
            contamination=contamination,
            random_state=random_state,
            n_jobs=-1,
        )
        self.feature_cols: List[str] = []
        self._training_median: Optional[np.ndarray] = None
        self._training_iqr: Optional[np.ndarray] = None
        self.is_fitted = False

    # ── public API ────────────────────────────────────────────────────────────

    def fit(self, df: pd.DataFrame, feature_cols: List[str]) -> "ShiftAnomalyDetector":
        """Fit scaler + Isolation Forest on df[feature_cols]."""
        self.feature_cols = feature_cols
        X = self._extract(df)

        X_scaled = self.scaler.fit_transform(X)

        # Store training distribution for driver explanation
        self._training_median = np.median(X_scaled, axis=0)
        q75, q25 = np.percentile(X_scaled, [75, 25], axis=0)
        self._training_iqr = np.where((q75 - q25) == 0, 1.0, q75 - q25)

        self.model.fit(X_scaled)
        self.is_fitted = True
        return self

    def predict(self, df: pd.DataFrame, feature_cols: List[str]) -> pd.DataFrame:
        """
        Score every shift in df.

        Returns
        -------
        pd.DataFrame with columns:
            shift_date, shift, line, incharge,
            anomaly_score  : float in [0,1], higher = more anomalous
            is_anomaly     : bool, True if in the flagged contamination fraction
            top_drivers    : list[str], top 3 features driving the anomaly
        """
        if not self.is_fitted:
            raise RuntimeError("Call fit() before predict().")

        X = self._extract(df)
        X_scaled = self.scaler.transform(X)

        # IsolationForest.decision_function: lower = more anomalous
        raw_scores = self.model.decision_function(X_scaled)   # negative
        labels     = self.model.predict(X_scaled)              # -1 = anomaly

        # Invert and normalise to [0, 1] so higher = more anomalous
        anomaly_score = self._normalise(raw_scores)

        top_drivers = self._explain(X_scaled)

        meta_cols = ["shift_date", "shift", "line", "incharge"]
        result = df[meta_cols].copy().reset_index(drop=True)
        result["anomaly_score"] = anomaly_score
        result["is_anomaly"]    = labels == -1
        result["top_drivers"]   = top_drivers

        return result.sort_values("anomaly_score", ascending=False).reset_index(drop=True)

    def retrain(self, df: pd.DataFrame, feature_cols: List[str]) -> dict:
        """Convenience wrapper that fits and returns CV-style metrics."""
        self.fit(df, feature_cols)
        scores = self.model.decision_function(
            self.scaler.transform(self._extract(df))
        )
        return {
            "n_samples":       len(df),
            "n_features":      len(feature_cols),
            "contamination":   self.contamination,
            "anomaly_fraction": float((self.model.predict(
                self.scaler.transform(self._extract(df))) == -1).mean()),
            "mean_score":      float(np.mean(scores)),
            "score_std":       float(np.std(scores)),
        }

    def save(self):
        """Persist fitted artefacts to disk (for FastAPI reload)."""
        self.MODEL_PATH.parent.mkdir(exist_ok=True)
        joblib.dump(self.model,        self.MODEL_PATH)
        joblib.dump(self.scaler,       self.SCALER_PATH)
        joblib.dump(self.feature_cols, self.META_PATH)

    @classmethod
    def load(cls) -> "ShiftAnomalyDetector":
        """Reload a saved detector without retraining."""
        instance = cls.__new__(cls)
        instance.model        = joblib.load(cls.MODEL_PATH)
        instance.scaler       = joblib.load(cls.SCALER_PATH)
        instance.feature_cols = joblib.load(cls.META_PATH)
        instance.is_fitted    = True
        # Rebuild median/iqr approximation (not saved, but only used for explain)
        instance._training_median = None
        instance._training_iqr    = None
        return instance

    # ── private helpers ───────────────────────────────────────────────────────

    def _extract(self, df: pd.DataFrame) -> np.ndarray:
        return df[self.feature_cols].fillna(0).values.astype(float)

    @staticmethod
    def _normalise(scores: np.ndarray) -> np.ndarray:
        """Map decision_function output to [0,1], higher = more anomalous."""
        inverted = -scores
        mn, mx = inverted.min(), inverted.max()
        if mx == mn:
            return np.zeros_like(inverted)
        return (inverted - mn) / (mx - mn)

    def _explain(self, X_scaled: np.ndarray) -> List[List[str]]:
        """
        Lightweight driver explanation:
        For each sample, compute |deviation from training median| / IQR
        and return the top-3 feature names.

        This is a mean-shift attribution, not SHAP — good enough for
        the dashboard tooltip. Phase 9 adds real SHAP values.
        """
        if self._training_median is None:
            return [[] for _ in range(len(X_scaled))]

        deviations = np.abs(X_scaled - self._training_median) / self._training_iqr
        top_drivers = []
        for row in deviations:
            top_idx = np.argsort(row)[::-1][:3]
            top_drivers.append([self.feature_cols[i] for i in top_idx])
        return top_drivers
