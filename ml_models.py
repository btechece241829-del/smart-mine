"""
Smart-Mine ML Prediction Pipeline
===================================
Real ML models for:
  1. Equipment failure risk prediction (GradientBoosting classifier)
  2. Sensor early-fault / threshold-breach prediction (RandomForest classifier)
  3. Recurring fault prediction (statistical inter-arrival analysis)
  4. Mine-section risk prediction (combined model)

Models are trained on historical CSV data, persisted via joblib, and served
through the Flask API in ml_server.py.
"""
import os
import json
import math
import datetime
import logging
import uuid
import traceback
from collections import defaultdict

import numpy as np
import pandas as pd
import joblib

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'public', 'data')
MODELS_DIR = os.path.join(BASE_DIR, 'ml_models_persist')
os.makedirs(MODELS_DIR, exist_ok=True)

PREDICTIONS_FILE = os.path.join(MODELS_DIR, 'predictions.json')
MODEL_META_FILE = os.path.join(MODELS_DIR, 'model_metadata.json')
MODEL_RUNS_FILE = os.path.join(MODELS_DIR, 'prediction_runs.json')


def _num(s):
    return pd.to_numeric(s, errors='coerce')


def _safe_float(val, default=0.0):
    try:
        if hasattr(val, 'item'):
            result = float(val.item())
        else:
            result = float(val)
        if isinstance(result, float) and (math.isnan(result) or math.isinf(result)):
            return default
        return result
    except (TypeError, ValueError):
        return default


def _parse_date(s):
    if not s or (isinstance(s, float) and math.isnan(s)):
        return None
    s = str(s).strip()
    for fmt in ('%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d'):
        try:
            return datetime.datetime.strptime(s, fmt)
        except Exception:
            continue
    return None


def load_csv(path):
    if not os.path.exists(path):
        return None
    try:
        return pd.read_csv(path, encoding='utf-8-sig')
    except Exception:
        try:
            return pd.read_csv(path)
        except Exception:
            return None


def risk_band(score):
    if score >= 70:
        return 'CRITICAL'
    if score >= 50:
        return 'HIGH'
    if score >= 30:
        return 'MEDIUM'
    return 'LOW'


def load_all_datasets():
    files = {
        'mines': '01_mines.csv',
        'compliances': '02_compliances.csv',
        'inspections': '03_inspections.csv',
        'violations': '04_violations.csv',
        'corrective_actions': '05_corrective_actions.csv',
        'incidents': '06_incidents_nearmiss.csv',
        'environment': '07_environment_readings.csv',
        'sensors': '08_sensor_readings.csv',
        'equipment': '09_equipment.csv',
        'contractors': '10_contractors.csv',
        'workers': '11_workers.csv',
        'production': '12_production.csv',
        'documents': '13_documents.csv',
    }
    ds = {}
    for key, fname in files.items():
        df = load_csv(os.path.join(DATA_DIR, fname))
        if df is not None:
            ds[key] = df
    return ds


# ═══════════════════════════════════════════════════════════════════════════
# 1. EQUIPMENT FAILURE RISK MODEL
# ═══════════════════════════════════════════════════════════════════════════

EQ_TYPES = ['Conveyor', 'Continuous Miner', 'Dozer', 'Drill', 'Dumper',
            'Excavator', 'LHD', 'Pump', 'Roof Bolter', 'Shuttle Car',
            'Shovel', 'Surface Miner', 'Underground Conveyor', 'Ventilation Fan']


def _build_equipment_features(ds):
    eq = ds.get('equipment')
    if eq is None or eq.empty:
        return None, None, None
    incidents = ds.get('incidents')
    sensors = ds.get('sensors')
    violations = ds.get('violations')
    capa = ds.get('corrective_actions')
    workers = ds.get('workers')

    equipment_rows = []
    for _, e in eq.iterrows():
        eq_id = str(e.get('equipment_id', ''))
        mine_id = str(e.get('mine_id', ''))
        eq_type = str(e.get('equipment_type', ''))
        status = str(e.get('status', ''))
        health = _safe_float(e.get('health_score', 85), 85)
        op_hours = _safe_float(e.get('operating_hours_24h', 0), 0)
        idle_hours = _safe_float(e.get('idle_hours_24h', 0), 0)
        bkd_hours = _safe_float(e.get('breakdown_hours_24h', 0), 0)
        fuel = _safe_float(e.get('fuel_consumption_l_24h', 0), 0)
        maint = str(e.get('maintenance_status', 'OK'))
        telemetry = str(e.get('telemetry_enabled', 'NO'))
        maint_urgency = 0 if maint == 'OK' else (1 if maint == 'DUE_SOON' else 2)
        type_onehot = [1 if eq_type == t else 0 for t in EQ_TYPES]

        bkd_count = 0
        if incidents is not None and not incidents.empty:
            mask = incidents['equipment_involved'].astype(str).str.contains(
                eq_type[:10] if eq_type else '', case=False, na=False)
            bkd_count = int(mask.sum())

        sensor_warn_pct = 0
        sensor_crit_pct = 0
        sensor_mean_val = 0
        sensor_std_val = 0
        if sensors is not None and not sensors.empty:
            eq_sensors = sensors[sensors['sensor_id'].astype(str).str.contains(
                eq_id[:10] if eq_id else '', na=False)]
            if not eq_sensors.empty:
                n = len(eq_sensors)
                sensor_warn_pct = len(eq_sensors[eq_sensors['status'] == 'WARNING']) / max(1, n)
                sensor_crit_pct = len(eq_sensors[eq_sensors['status'] == 'CRITICAL']) / max(1, n)
                vals = _num(eq_sensors['value']).dropna()
                sensor_mean_val = float(vals.mean()) if len(vals) > 0 else 0
                sensor_std_val = float(vals.std()) if len(vals) > 1 else 0

        vio_count = 0
        if violations is not None and not violations.empty:
            vio_count = len(violations[violations['mine_id'].astype(str) == mine_id])

        overdue_capa = 0
        if capa is not None and not capa.empty:
            mc = capa[capa['mine_id'].astype(str) == mine_id]
            overdue_capa = len(mc[mc['status'] == 'OVERDUE']) if not mc.empty else 0

        worker_count = 0
        if workers is not None and not workers.empty:
            worker_count = len(workers[workers['mine_id'].astype(str) == mine_id])

        features = [
            health, op_hours, idle_hours, bkd_hours, fuel,
            maint_urgency, 1 if telemetry == 'YES' else 0,
            bkd_count, sensor_warn_pct, sensor_crit_pct,
            sensor_mean_val, sensor_std_val, vio_count,
            overdue_capa, worker_count,
        ] + type_onehot

        equipment_rows.append({
            'equipment_id': eq_id, 'mine_id': mine_id,
            'equipment_type': eq_type,
            'equipment_name': str(e.get('equipment_name', '')),
            'features': features, 'status': status, 'health_score': health,
            'label': 1 if (status == 'BREAKDOWN' or health < 40) else 0,
        })

    X = np.array([r['features'] for r in equipment_rows])
    y = np.array([r['label'] for r in equipment_rows])
    return X, y, equipment_rows


def train_equipment_model(ds):
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.model_selection import cross_val_score
    X, y, meta = _build_equipment_features(ds)
    if X is None or len(X) < 10:
        return None, None, meta
    model = GradientBoostingClassifier(
        n_estimators=100, max_depth=4, learning_rate=0.1,
        subsample=0.8, random_state=42
    )
    n_pos = int(np.sum(y))
    n_neg = len(y) - n_pos
    accuracy = None
    # Only run cross-validation if both classes have enough samples
    if n_pos >= 2 and n_neg >= 2 and len(X) >= 4:
        n_folds = min(3, n_pos, n_neg)
        if n_folds >= 2:
            try:
                scores = cross_val_score(model, X, y, cv=n_folds, scoring='accuracy')
                accuracy = round(float(np.mean(scores)) * 100, 1)
            except Exception:
                accuracy = None
    model.fit(X, y)
    return model, accuracy, meta


def _equipment_recommendations(row, prob):
    recs = []
    if row['health_score'] < 50:
        recs.append('Schedule immediate maintenance inspection')
    if row['features'][5] >= 1:
        recs.append('Prioritize overdue maintenance tasks')
    if row['features'][8] > 0.2:
        recs.append('Investigate sensor warning signals')
    if row['features'][3] > 3:
        recs.append('Review breakdown history and root cause analysis')
    if prob >= 70:
        recs.append('Prepare contingency equipment')
        recs.append('Alert safety officer and mine manager')
    elif prob >= 50:
        recs.append('Schedule preventive maintenance within 7 days')
    if not recs:
        recs.append('Continue monitoring equipment health')
    return recs


FEATURE_NAMES_EQ = [
    'Health Score', 'Operating Hours', 'Idle Hours', 'Breakdown Hours',
    'Fuel Consumption', 'Maintenance Status', 'Telemetry Enabled',
    'Related Incidents', 'Sensor Warning %', 'Sensor Critical %',
    'Sensor Mean Value', 'Sensor Std Value', 'Mine Violations',
    'Overdue CAPA', 'Mine Workers',
] + ['Type: ' + t for t in EQ_TYPES]


def predict_equipment_faults(model, ds):
    if model is None:
        return _rule_based_equipment_predictions(ds)
    X, _, equip_meta = _build_equipment_features(ds)
    if X is None:
        return _rule_based_equipment_predictions(ds)
    probabilities = model.predict_proba(X)[:, 1]
    importances = model.feature_importances_
    predictions = []
    for i, row in enumerate(equip_meta):
        prob = round(float(probabilities[i]) * 100, 1)
        if prob < 10:
            continue
        top_indices = np.argsort(importances)[::-1][:5]
        contributing = []
        for idx in top_indices:
            if importances[idx] > 0.02:
                contributing.append(f"{FEATURE_NAMES_EQ[idx]}: {row['features'][idx]}")
        health = row['health_score']
        predicted_fault = 'General equipment degradation'
        if health < 40:
            predicted_fault = 'Critical equipment failure'
        elif health < 60:
            predicted_fault = 'Maintenance-related failure'
        elif row['features'][3] > 5:
            predicted_fault = 'Recurring breakdown pattern'
        elif row['features'][8] > 0.3:
            predicted_fault = 'Sensor-detected anomaly leading to failure'
        elif row['features'][1] > 12:
            predicted_fault = 'Overuse / wear-related failure'
        if prob >= 70:
            window = 'Next 3 days'
        elif prob >= 50:
            window = 'Next 7 days'
        elif prob >= 30:
            window = 'Next 14 days'
        else:
            window = 'Next 30 days'
        predictions.append({
            'prediction_id': 'PRED-EQ-%s' % uuid.uuid4().hex[:8].upper(),
            'asset_id': row['equipment_id'],
            'asset_name': row['equipment_name'],
            'asset_type': 'equipment',
            'mine_id': row['mine_id'],
            'mine_name': None,
            'predicted_fault': predicted_fault,
            'probability': prob,
            'risk_level': risk_band(prob),
            'predicted_window': window,
            'contributing_factors': contributing,
            'historical_evidence': {
                'health_score': health,
                'related_incidents': int(row['features'][7]),
                'sensor_warnings': round(row['features'][8] * 100, 1),
                'maintenance_status': ['OK', 'DUE_SOON', 'OVERDUE'][int(row['features'][5])],
            },
            'recommended_actions': _equipment_recommendations(row, prob),
            'model_version': 'ml_gb_v1',
            'prediction_status': 'ACTIVE',
            'created_at': datetime.datetime.now().isoformat(),
            'model_confidence': round(float(1 - abs(probabilities[i] - round(probabilities[i]))), 3),
        })
    predictions.sort(key=lambda p: p['probability'], reverse=True)
    return predictions


def _rule_based_equipment_predictions(ds):
    equipment = ds.get('equipment')
    if equipment is None or equipment.empty:
        return []
    predictions = []
    for _, e in equipment.iterrows():
        health = _safe_float(e.get('health_score', 85), 85)
        status = str(e.get('status', ''))
        maint = str(e.get('maintenance_status', 'OK'))
        if status == 'BREAKDOWN':
            continue
        risk = max(0, (100 - health)) * 0.3
        if maint == 'DUE_SOON':
            risk += 15
        elif maint == 'OVERDUE':
            risk += 25
        risk = min(100, risk)
        if risk < 15:
            continue
        predictions.append({
            'prediction_id': 'PRED-EQ-%s' % uuid.uuid4().hex[:8].upper(),
            'asset_id': str(e.get('equipment_id', '')),
            'asset_name': str(e.get('equipment_name', '')),
            'asset_type': 'equipment',
            'mine_id': str(e.get('mine_id', '')),
            'mine_name': None,
            'predicted_fault': 'General equipment degradation',
            'probability': round(risk, 1),
            'risk_level': risk_band(risk),
            'predicted_window': 'Next 14 days',
            'contributing_factors': ['Rule-based fallback (ML model not trained)'],
            'historical_evidence': {'health_score': health},
            'recommended_actions': ['Schedule inspection'],
            'model_version': 'rule_fallback_v1',
            'prediction_status': 'ACTIVE',
            'created_at': datetime.datetime.now().isoformat(),
            'model_confidence': 0.5,
        })
    predictions.sort(key=lambda p: p['probability'], reverse=True)
    return predictions



# ═══════════════════════════════════════════════════════════════════════════
# 2. SENSOR EARLY-FAULT / THRESHOLD-BREACH PREDICTION MODEL
# ═══════════════════════════════════════════════════════════════════════════

SENSOR_TYPES = [
    'air_velocity_m_s', 'carbon_monoxide_ppm', 'dust_pm10_ug_m3',
    'equipment_temp_c', 'humidity_pct', 'methane_pct', 'noise_db',
    'oxygen_pct', 'rainfall_mm_hr', 'roof_displacement_mm',
    'slope_displacement_mm', 'temperature_c', 'vehicle_speed_kmph',
    'ventilation_pressure_pa', 'vibration_mm_s', 'water_level_m',
]


def _build_sensor_features(ds):
    sensors = ds.get('sensors')
    if sensors is None or sensors.empty:
        return None, None, None
    sensors = sensors.copy()
    sensors['timestamp_dt'] = sensors['timestamp'].apply(_parse_date)
    sensors = sensors.dropna(subset=['timestamp_dt'])
    sensors = sensors.sort_values(['sensor_id', 'timestamp_dt'])

    feature_rows = []
    for sensor_id, group in sensors.groupby('sensor_id'):
        group = group.sort_values('timestamp_dt')
        if len(group) < 2:
            continue
        values = _num(group['value']).dropna().values
        if len(values) < 2:
            continue

        warn_thresh = _safe_float(group['warning_threshold'].iloc[0], 100)
        crit_thresh = _safe_float(group['critical_threshold'].iloc[0], 200)
        threshold_dir = str(group['threshold_direction'].iloc[0]).upper()
        sensor_type = str(group['sensor_type'].iloc[0])
        zone = str(group['zone'].iloc[0])
        mine_id = str(group['mine_id'].iloc[0])

        latest_val = float(values[-1])
        window = min(10, len(values))
        rolling_series = pd.Series(values).rolling(window, min_periods=1)
        rolling_mean = float(rolling_series.mean().iloc[-1])
        rolling_std = float(rolling_series.std().fillna(0).iloc[-1])
        rolling_min = float(rolling_series.min().iloc[-1])
        rolling_max = float(rolling_series.max().iloc[-1])

        x = np.arange(len(values))
        slope = float(np.polyfit(x, values, 1)[0]) if len(values) >= 3 else 0.0
        n_recent = min(3, len(values))
        rate_of_change = float(values[-1] - values[-n_recent]) / max(1, n_recent)

        if threshold_dir == 'HIGH':
            dist_to_warn = (warn_thresh - latest_val) / max(1, abs(warn_thresh))
            dist_to_crit = (crit_thresh - latest_val) / max(1, abs(crit_thresh))
            exceed_ratio = latest_val / max(1, crit_thresh)
        elif threshold_dir == 'LOW':
            dist_to_warn = (latest_val - warn_thresh) / max(1, abs(warn_thresh))
            dist_to_crit = (latest_val - crit_thresh) / max(1, abs(crit_thresh))
            exceed_ratio = crit_thresh / max(1, latest_val) if latest_val > 0 else 1.0
        else:
            dist_to_warn = abs(warn_thresh - latest_val) / max(1, abs(warn_thresh))
            dist_to_crit = abs(crit_thresh - latest_val) / max(1, abs(crit_thresh))
            exceed_ratio = abs(latest_val - (warn_thresh + crit_thresh) / 2) / max(1, crit_thresh)

        type_onehot = [1 if sensor_type == t else 0 for t in SENSOR_TYPES]

        features = [
            latest_val, rolling_mean, rolling_std, rolling_min, rolling_max,
            slope, rate_of_change, dist_to_warn, dist_to_crit, exceed_ratio,
            warn_thresh, crit_thresh,
            1 if threshold_dir == 'HIGH' else 0,
            1 if threshold_dir == 'LOW' else 0,
        ] + type_onehot

        status_val = str(group['status'].iloc[-1]).upper()
        is_warning = 1 if status_val in ('WARNING', 'CRITICAL') else 0
        if threshold_dir == 'HIGH' and slope > 0 and dist_to_crit < 0.3:
            is_warning = 1
        elif threshold_dir == 'LOW' and slope < 0 and dist_to_crit < 0.3:
            is_warning = 1
        elif status_val == 'CRITICAL':
            is_warning = 1

        feature_rows.append({
            'sensor_id': sensor_id, 'sensor_type': sensor_type,
            'zone': zone, 'mine_id': mine_id, 'features': features,
            'label': is_warning, 'latest_value': latest_val, 'status': status_val,
        })

    if not feature_rows:
        return None, None, None
    X = np.array([r['features'] for r in feature_rows])
    y = np.array([r['label'] for r in feature_rows])
    return X, y, feature_rows


def train_sensor_model(ds):
    from sklearn.ensemble import RandomForestClassifier
    X, y, meta = _build_sensor_features(ds)
    if X is None or len(X) < 10:
        return None, None, meta
    model = RandomForestClassifier(
        n_estimators=100, max_depth=5, random_state=42,
        class_weight='balanced', min_samples_split=3
    )
    n_pos = int(np.sum(y))
    n_neg = len(y) - n_pos
    f1 = None
    if n_pos >= 2 and n_neg >= 2 and len(X) >= 4:
        n_folds = min(3, n_pos, n_neg)
        if n_folds >= 2:
            from sklearn.model_selection import cross_val_score
            try:
                scores = cross_val_score(model, X, y, cv=n_folds, scoring='f1')
                f1 = round(float(np.mean(scores)) * 100, 1)
            except Exception:
                f1 = None
    model.fit(X, y)
    return model, f1, meta


SENSOR_FEATURE_NAMES = [
    'Current Value', 'Rolling Mean', 'Rolling Std', 'Rolling Min', 'Rolling Max',
    'Trend Slope', 'Rate of Change', 'Distance to Warning', 'Distance to Critical',
    'Exceedance Ratio', 'Warning Threshold', 'Critical Threshold',
    'Direction HIGH', 'Direction LOW',
] + ['Type: ' + t for t in SENSOR_TYPES]


def _sensor_recommendations(row, prob):
    recs = []
    status = row['status']
    if status == 'CRITICAL':
        recs.append('URGENT: Investigate critical sensor reading immediately')
        recs.append('Check equipment and environment conditions')
    elif status == 'WARNING':
        recs.append('Monitor sensor readings closely')
        recs.append('Schedule inspection of affected equipment/zone')
    if prob >= 70:
        recs.append('Alert mine manager and safety officer')
        recs.append('Prepare contingency measures')
    if row['features'][5] > 0:
        recs.append('Investigate upward trend cause')
    elif row['features'][5] < 0:
        recs.append('Investigate downward trend cause')
    if not recs:
        recs.append('Continue monitoring sensor readings')
    return recs


def predict_sensor_faults(model, ds):
    if model is None:
        return _rule_based_sensor_predictions(ds)
    X, _, meta = _build_sensor_features(ds)
    if X is None:
        return _rule_based_sensor_predictions(ds)
    probabilities = model.predict_proba(X)[:, 1]
    importances = model.feature_importances_
    predictions = []
    for i, row in enumerate(meta):
        prob = round(float(probabilities[i]) * 100, 1)
        if prob < 15:
            continue
        latest = row['latest_value']
        features = row['features']
        slope = features[5]
        s_type = row['sensor_type']
        if features[8] < 0.1:
            predicted_fault = f'Imminent {s_type} threshold breach'
        elif prob >= 70:
            predicted_fault = f'Critical {s_type} trend detected'
        elif slope > 0 and features[7] < 0.2:
            predicted_fault = f'{s_type} rising toward warning level'
        elif slope < 0 and features[7] < 0.2:
            predicted_fault = f'{s_type} declining toward critical level'
        else:
            predicted_fault = f'Elevated {s_type} anomaly risk'
        if prob >= 70:
            window = 'Next 3 days'
        elif prob >= 50:
            window = 'Next 7 days'
        else:
            window = 'Next 14 days'
        top_idx = np.argsort(importances)[::-1][:5]
        factors = []
        for idx in top_idx:
            if importances[idx] > 0.03 and idx < len(SENSOR_FEATURE_NAMES):
                factors.append(f"{SENSOR_FEATURE_NAMES[idx]}: {round(features[idx], 3)}")
        predictions.append({
            'prediction_id': 'PRED-SEN-%s' % uuid.uuid4().hex[:8].upper(),
            'asset_id': row['sensor_id'],
            'asset_name': f"{row['sensor_type']} ({row['zone']})",
            'asset_type': 'sensor',
            'mine_id': row['mine_id'],
            'mine_name': None,
            'predicted_fault': predicted_fault,
            'probability': prob,
            'risk_level': risk_band(prob),
            'predicted_window': window,
            'contributing_factors': factors,
            'historical_evidence': {
                'current_value': round(latest, 3),
                'trend_slope': round(slope, 4),
                'distance_to_critical': round(features[8], 3),
                'current_status': row['status'],
                'sensor_type': row['sensor_type'],
            },
            'recommended_actions': _sensor_recommendations(row, prob),
            'model_version': 'ml_rf_sensor_v1',
            'prediction_status': 'ACTIVE',
            'created_at': datetime.datetime.now().isoformat(),
            'model_confidence': round(float(1 - abs(probabilities[i] - round(probabilities[i]))), 3),
        })
    predictions.sort(key=lambda p: p['probability'], reverse=True)
    return predictions


def _rule_based_sensor_predictions(ds):
    sensors = ds.get('sensors')
    if sensors is None or sensors.empty:
        return []
    predictions = []
    for s_type, group in sensors.groupby('sensor_type'):
        n = len(group)
        crit = len(group[group['status'] == 'CRITICAL'])
        warn = len(group[group['status'] == 'WARNING'])
        if crit == 0 and warn == 0:
            continue
        score = min(100, crit / max(1, n) * 80 + warn / max(1, n) * 40)
        if score < 15:
            continue
        predictions.append({
            'prediction_id': 'PRED-SEN-%s' % uuid.uuid4().hex[:8].upper(),
            'asset_id': s_type,
            'asset_name': s_type,
            'asset_type': 'sensor',
            'mine_id': None,
            'mine_name': None,
            'predicted_fault': f'Elevated risk in {s_type} sensors',
            'probability': round(score, 1),
            'risk_level': risk_band(score),
            'predicted_window': 'Next 7 days',
            'contributing_factors': [f'Rule-based: {crit} critical, {warn} warning readings'],
            'historical_evidence': {'critical_readings': crit, 'warning_readings': warn, 'total': n},
            'recommended_actions': ['Monitor sensor readings', 'Schedule inspection'],
            'model_version': 'rule_fallback_v1',
            'prediction_status': 'ACTIVE',
            'created_at': datetime.datetime.now().isoformat(),
            'model_confidence': 0.5,
        })
    predictions.sort(key=lambda p: p['probability'], reverse=True)
    return predictions



# ═══════════════════════════════════════════════════════════════════════════
# 3. RECURRING FAULT PREDICTION (Statistical)
# ═══════════════════════════════════════════════════════════════════════════

def predict_recurring_faults(ds):
    incidents = ds.get('incidents')
    violations = ds.get('violations')
    issues = []
    severity_map = {'FATAL': 4, 'CRITICAL': 4, 'SERIOUS': 3, 'HIGH': 2,
                    'MEDIUM': 1, 'LOW': 1}

    if incidents is not None and not incidents.empty:
        grouped = incidents.groupby(['incident_type', 'zone']).size().reset_index(name='count')
        for _, row in grouped.iterrows():
            if row['count'] < 2:
                continue
            itype = str(row['incident_type'])
            zone = str(row['zone'])
            subset = incidents[
                (incidents['incident_type'].astype(str) == itype) &
                (incidents['zone'].astype(str) == zone)
            ]
            dates = subset['date'].apply(_parse_date).dropna()
            dates_sorted = sorted(dates)
            frequency = 'STABLE'
            avg_gap_days = 30
            predicted_next_date = None
            recurrence_prob_7d = 0
            recurrence_prob_30d = 0

            if len(dates_sorted) >= 2:
                gaps = [(dates_sorted[i + 1] - dates_sorted[i]).days
                        for i in range(len(dates_sorted) - 1)]
                avg_gap = sum(gaps) / len(gaps) if gaps else 365
                avg_gap_days = avg_gap
                recent_gaps = gaps[-3:] if len(gaps) >= 3 else gaps
                if recent_gaps:
                    recent_avg = sum(recent_gaps) / len(recent_gaps)
                    if recent_avg < avg_gap * 0.7:
                        frequency = 'INCREASING'
                    elif recent_avg > avg_gap * 1.3:
                        frequency = 'DECREASING'
                if avg_gap > 0:
                    lam = 1.0 / avg_gap
                    days_since = (datetime.datetime.now() - dates_sorted[-1]).days if dates_sorted else 0
                    recurrence_prob_7d = round(min(95, (1 - math.exp(-lam * (days_since + 7))) * 100), 1)
                    recurrence_prob_30d = round(min(95, (1 - math.exp(-lam * (days_since + 30))) * 100), 1)
                    next_days = max(0, avg_gap - days_since)
                    predicted_next_date = (datetime.datetime.now() + datetime.timedelta(days=next_days)).isoformat()

            avg_sev = subset['severity'].apply(
                lambda x: severity_map.get(str(x).upper(), 1)).mean()
            recurrence_risk = min(95, row['count'] * 10 +
                                  (15 if frequency == 'INCREASING' else 0) +
                                  avg_sev * 8 +
                                  recurrence_prob_7d * 0.2)

            issues.append({
                'issue_id': 'RI-ZON-%s' % uuid.uuid4().hex[:8].upper(),
                'issue_type': 'RECURRING_INCIDENT',
                'title': '%s in zone %s' % (itype, zone),
                'description': '%s incidents of type "%s" in zone "%s" — avg interval: %.0f days'
                               % (row['count'], itype, zone, avg_gap_days),
                'location': zone,
                'mine_ids': subset['mine_id'].astype(str).unique().tolist(),
                'occurrences': int(row['count']),
                'last_occurrence': str(dates_sorted[-1].date()) if dates_sorted else 'Unknown',
                'frequency_trend': frequency,
                'severity': 'HIGH' if avg_sev >= 3 else 'MEDIUM' if avg_sev >= 2 else 'LOW',
                'recurrence_risk': round(recurrence_risk),
                'recurrence_probability_7d': recurrence_prob_7d,
                'recurrence_probability_30d': recurrence_prob_30d,
                'predicted_next_date': predicted_next_date,
                'avg_interval_days': round(avg_gap_days, 1),
                'affected_records': subset['incident_id'].astype(str).tolist(),
                'created_at': datetime.datetime.now().isoformat(),
            })


    if violations is not None and not violations.empty:
        grouped = violations.groupby(['violation_type', 'zone']).size().reset_index(name='count')
        for _, row in grouped.iterrows():
            if row['count'] < 3:
                continue
            vtype = str(row['violation_type'])
            zone = str(row['zone'])
            subset = violations[
                (violations['violation_type'].astype(str) == vtype) &
                (violations['zone'].astype(str) == zone)
            ]
            open_count = len(subset[subset['status'].astype(str).isin(['OPEN', 'IN_PROGRESS'])])
            dates = subset['reported_at'].apply(_parse_date).dropna()
            dates_sorted = sorted(dates)
            avg_gap_days = 30
            recurrence_prob_7d = 0
            recurrence_prob_30d = 0
            predicted_next_date = None
            if len(dates_sorted) >= 2:
                gaps = [(dates_sorted[i + 1] - dates_sorted[i]).days
                        for i in range(len(dates_sorted) - 1)]
                avg_gap = sum(gaps) / len(gaps) if gaps else 365
                avg_gap_days = avg_gap
                if avg_gap > 0:
                    lam = 1.0 / avg_gap
                    days_since = (datetime.datetime.now() - dates_sorted[-1]).days if dates_sorted else 0
                    recurrence_prob_7d = round(min(95, (1 - math.exp(-lam * (days_since + 7))) * 100), 1)
                    recurrence_prob_30d = round(min(95, (1 - math.exp(-lam * (days_since + 30))) * 100), 1)
                    next_days = max(0, avg_gap - days_since)
                    predicted_next_date = (datetime.datetime.now() + datetime.timedelta(days=next_days)).isoformat()

            recurrence_risk = min(95, row['count'] * 12 + open_count * 10 + recurrence_prob_7d * 0.2)
            issues.append({
                'issue_id': 'RI-VIO-%s' % uuid.uuid4().hex[:8].upper(),
                'issue_type': 'RECURRING_VIOLATION',
                'title': 'Recurring violation: %s in %s' % (vtype, zone),
                'description': '%s violations of type "%s" in zone "%s" (%s still open)' %
                               (row['count'], vtype, zone, open_count),
                'location': zone,
                'mine_ids': subset['mine_id'].astype(str).unique().tolist(),
                'occurrences': int(row['count']),
                'last_occurrence': str(dates_sorted[-1].date()) if dates_sorted else 'Unknown',
                'frequency_trend': 'INCREASING' if open_count > row['count'] / 2 else 'STABLE',
                'severity': 'HIGH' if open_count > 2 else 'MEDIUM' if open_count > 0 else 'LOW',
                'recurrence_risk': round(recurrence_risk),
                'recurrence_probability_7d': recurrence_prob_7d,
                'recurrence_probability_30d': recurrence_prob_30d,
                'predicted_next_date': predicted_next_date,
                'avg_interval_days': round(avg_gap_days, 1),
                'affected_records': subset['violation_id'].astype(str).tolist(),
                'created_at': datetime.datetime.now().isoformat(),
            })

    issues.sort(key=lambda i: i['recurrence_risk'], reverse=True)
    return issues



# ═══════════════════════════════════════════════════════════════════════════
# 4. ROOT CAUSE ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════

def analyze_root_causes(recurring_issues, ds):
    incidents = ds.get('incidents')
    analyses = []
    for issue in recurring_issues:
        if issue.get('occurrences', 0) < 2:
            continue
        record_ids = issue.get('affected_records', [])
        related = pd.DataFrame()
        if incidents is not None and not incidents.empty and record_ids:
            related = incidents[incidents['incident_id'].astype(str).isin(record_ids)]

        factors = []
        if not related.empty:
            zones = related['zone'].astype(str).value_counts()
            if len(zones) > 0 and zones.iloc[0] > 1:
                factors.append({
                    'factor': 'Zone concentration: %s' % zones.index[0],
                    'evidence': '%s of %s records in this zone' % (zones.iloc[0], len(related)),
                    'confidence': 'Likely contributing factor',
                })
            equip = related['equipment_involved'].dropna().value_counts()
            if len(equip) > 0 and equip.iloc[0] > 1:
                factors.append({
                    'factor': 'Equipment involvement: %s' % equip.index[0],
                    'evidence': '%s records involve this equipment' % equip.iloc[0],
                    'confidence': 'Possible contributing factor',
                })
            root_causes = related['root_cause'].dropna().value_counts()
            if len(root_causes) > 0 and root_causes.iloc[0] > 1:
                factors.append({
                    'factor': 'Common root cause: %s' % root_causes.index[0],
                    'evidence': '%s records share this root cause' % root_causes.iloc[0],
                    'confidence': 'Likely cause',
                })
            shifts = related['shift'].dropna().value_counts()
            if len(shifts) > 0 and shifts.iloc[0] > len(related) / 2:
                factors.append({
                    'factor': 'Temporal pattern: Shift %s' % shifts.index[0],
                    'evidence': '%s of %s records in shift %s' % (
                        shifts.iloc[0], len(related), shifts.index[0]),
                    'confidence': 'Possible contributing factor',
                })
        if not factors:
            factors.append({
                'factor': 'Pattern detected from aggregated data',
                'evidence': '%s occurrences across records' % issue['occurrences'],
                'confidence': 'Possible contributing factor',
            })

        analyses.append({
            'issue_id': issue['issue_id'],
            'title': issue['title'],
            'occurrences': issue['occurrences'],
            'contributing_factors': factors,
            'recommended_investigation': 'Investigate %s recurring occurrences of "%s"' % (
                issue['occurrences'], issue['title']),
            'created_at': datetime.datetime.now().isoformat(),
        })
    return analyses


# ═══════════════════════════════════════════════════════════════════════════
# 5. PREVENTIVE ACTIONS
# ═══════════════════════════════════════════════════════════════════════════

def generate_preventive_actions(predictions, recurring_issues):
    actions = []
    for pred in predictions:
        if pred.get('probability', 0) < 30:
            continue
        action_id = 'PA-%s' % uuid.uuid4().hex[:8].upper()
        rl = pred.get('risk_level', 'MEDIUM')
        responsible = 'Safety Officer' if rl in ('HIGH', 'CRITICAL') else 'Maintenance Team'
        deadline_days = 3 if rl == 'CRITICAL' else 7 if rl == 'HIGH' else 14
        deadline = (datetime.datetime.now() + datetime.timedelta(days=deadline_days)).isoformat()
        actions.append({
            'action_id': action_id,
            'source_type': 'PREDICTION',
            'source_id': pred.get('prediction_id', ''),
            'title': 'Preventive: %s' % pred.get('predicted_fault', '')[:60],
            'description': 'Risk: %s%% (%s) — %s' % (
                pred.get('probability', 0), rl, pred.get('asset_name', '')),
            'responsible_role': responsible,
            'deadline': deadline,
            'status': 'PENDING',
            'priority': rl,
            'created_at': datetime.datetime.now().isoformat(),
        })

    for issue in recurring_issues:
        if issue.get('recurrence_risk', 0) < 40:
            continue
        action_id = 'PA-%s' % uuid.uuid4().hex[:8].upper()
        responsible = 'Mine Manager' if issue.get('severity') == 'HIGH' else 'Safety Officer'
        deadline_days = 7 if issue.get('severity') == 'HIGH' else 14
        deadline = (datetime.datetime.now() + datetime.timedelta(days=deadline_days)).isoformat()
        actions.append({
            'action_id': action_id,
            'source_type': 'RECURRING_ISSUE',
            'source_id': issue.get('issue_id', ''),
            'title': 'Address recurring: %s' % issue.get('title', '')[:60],
            'description': '%s occurrences — recurrence risk %s%%' % (
                issue.get('occurrences', 0), issue.get('recurrence_risk', 0)),
            'responsible_role': responsible,
            'deadline': deadline,
            'status': 'PENDING',
            'priority': issue.get('severity', 'MEDIUM'),
            'created_at': datetime.datetime.now().isoformat(),
        })

    prio = {'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1}
    actions.sort(key=lambda a: prio.get(a.get('priority', 'LOW'), 0), reverse=True)
    return actions



# ═══════════════════════════════════════════════════════════════════════════
# 6. MINE SECTION RISK PREDICTIONS
# ═══════════════════════════════════════════════════════════════════════════

def predict_mine_section_risks(ds):
    predictions = []
    mines = ds.get('mines')
    if mines is None or mines.empty:
        return predictions

    for _, m in mines.iterrows():
        mid = str(m.get('mine_id', ''))
        mname = str(m.get('mine_name', mid))
        env_risk = vio_risk = insp_risk = prod_risk = 0
        factors = []

        env = ds.get('environment')
        if env is not None and not env.empty:
            mine_env = env[env['mine_id'].astype(str) == mid]
            if not mine_env.empty:
                exc = len(mine_env[mine_env['compliance_status'].astype(str) == 'EXCEEDED'])
                env_risk = min(100, exc * 12)
                if exc > 0:
                    factors.append('%d environment exceedances' % exc)

        vio = ds.get('violations')
        if vio is not None and not vio.empty:
            mine_vio = vio[vio['mine_id'].astype(str) == mid]
            if not mine_vio.empty:
                open_crit = len(mine_vio[
                    (mine_vio['status'].astype(str).isin(['OPEN', 'IN_PROGRESS'])) &
                    (mine_vio['severity'].astype(str) == 'CRITICAL')])
                open_high = len(mine_vio[
                    (mine_vio['status'].astype(str).isin(['OPEN', 'IN_PROGRESS'])) &
                    (mine_vio['severity'].astype(str) == 'HIGH')])
                vio_risk = min(100, open_crit * 25 + open_high * 15)
                if open_crit + open_high > 0:
                    factors.append('%d critical, %d high open violations' % (open_crit, open_high))

        insp = ds.get('inspections')
        if insp is not None and not insp.empty:
            mine_insp = insp[insp['mine_id'].astype(str) == mid]
            if not mine_insp.empty:
                high_sev = len(mine_insp[mine_insp['severity'].astype(str).isin(['CRITICAL', 'HIGH'])])
                insp_risk = min(100, high_sev * 20)
                if high_sev > 0:
                    factors.append('%d high-severity inspections' % high_sev)

        prod = ds.get('production')
        if prod is not None and not prod.empty:
            mine_prod = prod[prod['mine_id'].astype(str) == mid]
            if not mine_prod.empty:
                low_achieve = len(mine_prod[_num(mine_prod['achievement_percentage']) < 80])
                prod_risk = min(100, low_achieve * 10)
                if low_achieve > 0:
                    factors.append('%d days below 80%% achievement' % low_achieve)

        total_risk = round(min(100, env_risk * 0.3 + vio_risk * 0.3 + insp_risk * 0.2 + prod_risk * 0.2), 1)
        if total_risk < 15:
            continue

        predictions.append({
            'prediction_id': 'PRED-MINE-%s' % uuid.uuid4().hex[:8].upper(),
            'asset_id': mid,
            'asset_name': mname,
            'asset_type': 'mine_section',
            'mine_id': mid,
            'mine_name': mname,
            'predicted_fault': 'Elevated mine-section risk',
            'probability': total_risk,
            'risk_level': risk_band(total_risk),
            'predicted_window': 'Next 30 days',
            'contributing_factors': factors if factors else ['Combined risk indicators'],
            'historical_evidence': {
                'environment_risk': env_risk,
                'violation_risk': vio_risk,
                'inspection_risk': insp_risk,
                'production_risk': prod_risk,
            },
            'recommended_actions': ['Review all safety protocols', 'Conduct comprehensive inspection'],
            'model_version': 'ml_combined_v1',
            'prediction_status': 'ACTIVE',
            'created_at': datetime.datetime.now().isoformat(),
            'model_confidence': 0.6,
        })

    predictions.sort(key=lambda p: p['probability'], reverse=True)
    return predictions



# ═══════════════════════════════════════════════════════════════════════════
# 7. VENTILATION RISK PREDICTIONS
# ═══════════════════════════════════════════════════════════════════════════

VENT_TYPES = ['methane_pct', 'air_velocity_m_s', 'oxygen_pct',
              'carbon_monoxide_ppm', 'ventilation_pressure_pa']


def predict_ventilation_risks(ds):
    predictions = []
    sensors = ds.get('sensors')
    if sensors is None or sensors.empty:
        return predictions
    for stype in VENT_TYPES:
        subset = sensors[sensors['sensor_type'] == stype]
        if subset.empty:
            continue
        n = len(subset)
        crit = len(subset[subset['status'] == 'CRITICAL'])
        warn = len(subset[subset['status'] == 'WARNING'])
        vals = _num(subset['value']).dropna()
        if vals.empty:
            continue
        score = min(100, crit / max(1, n) * 80 + warn / max(1, n) * 40)
        if score < 15:
            continue
        predictions.append({
            'prediction_id': 'PRED-VEN-%s' % uuid.uuid4().hex[:8].upper(),
            'asset_id': stype,
            'asset_name': 'Ventilation: %s' % stype,
            'asset_type': 'system',
            'mine_id': None,
            'mine_name': None,
            'predicted_fault': 'Ventilation risk: %s' % stype,
            'probability': round(score, 1),
            'risk_level': risk_band(score),
            'predicted_window': 'Next 7 days',
            'contributing_factors': [
                '%d critical, %d warning readings out of %d' % (crit, warn, n),
                'Mean value: %.2f' % float(vals.mean()),
            ],
            'historical_evidence': {
                'critical': crit, 'warning': warn, 'total': n,
                'mean': round(float(vals.mean()), 3),
            },
            'recommended_actions': ['Check ventilation system', 'Monitor gas levels'],
            'model_version': 'ml_ventilation_v1',
            'prediction_status': 'ACTIVE',
            'created_at': datetime.datetime.now().isoformat(),
            'model_confidence': 0.6,
        })
    predictions.sort(key=lambda p: p['probability'], reverse=True)
    return predictions



# ═══════════════════════════════════════════════════════════════════════════
# 8. PERSISTENCE
# ═══════════════════════════════════════════════════════════════════════════

def _save_predictions(predictions):
    try:
        with open(PREDICTIONS_FILE, 'w', encoding='utf-8') as f:
            json.dump(predictions, f, default=str, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning('Failed to save predictions: %s', e)


def _load_predictions():
    if not os.path.exists(PREDICTIONS_FILE):
        return []
    try:
        with open(PREDICTIONS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []


def _save_model_meta(meta):
    try:
        with open(MODEL_META_FILE, 'w', encoding='utf-8') as f:
            json.dump(meta, f, default=str, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning('Failed to save model metadata: %s', e)


def _load_model_meta():
    if not os.path.exists(MODEL_META_FILE):
        return {}
    try:
        with open(MODEL_META_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def _save_run_log(runs):
    try:
        with open(MODEL_RUNS_FILE, 'w', encoding='utf-8') as f:
            json.dump(runs, f, default=str, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning('Failed to save run log: %s', e)


def _load_run_log():
    if not os.path.exists(MODEL_RUNS_FILE):
        return []
    try:
        with open(MODEL_RUNS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []



# ═══════════════════════════════════════════════════════════════════════════
# 9. PREDICTION PIPELINE ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════════════════

class MLPipeline:
    def __init__(self):
        self.equipment_model = None
        self.sensor_model = None
        self.equipment_accuracy = None
        self.sensor_f1 = None
        self.trained_at = None
        self.model_version = 'ml_v1'

    def train(self, ds=None):
        if ds is None:
            ds = load_all_datasets()
        if not ds:
            return {'success': False, 'error': 'No datasets available'}
        results = {}
        try:
            self.equipment_model, self.equipment_accuracy, _ = train_equipment_model(ds)
            results['equipment'] = {
                'trained': self.equipment_model is not None,
                'accuracy': self.equipment_accuracy,
            }
            if self.equipment_model is not None:
                path = os.path.join(MODELS_DIR, 'equipment_model.joblib')
                joblib.dump(self.equipment_model, path)
                results['equipment']['model_path'] = path

            self.sensor_model, self.sensor_f1, _ = train_sensor_model(ds)
            results['sensor'] = {
                'trained': self.sensor_model is not None,
                'f1_score': self.sensor_f1,
            }
            if self.sensor_model is not None:
                path = os.path.join(MODELS_DIR, 'sensor_model.joblib')
                joblib.dump(self.sensor_model, path)
                results['sensor']['model_path'] = path

            self.trained_at = datetime.datetime.now().isoformat()
            meta = {
                'model_version': self.model_version,
                'trained_at': self.trained_at,
                'equipment_accuracy': self.equipment_accuracy,
                'sensor_f1': self.sensor_f1,
                'equipment_model_trained': self.equipment_model is not None,
                'sensor_model_trained': self.sensor_model is not None,
            }
            _save_model_meta(meta)
            runs = _load_run_log()
            runs.append({
                'run_id': 'RUN-%s' % uuid.uuid4().hex[:8].upper(),
                'type': 'training',
                'started_at': self.trained_at,
                'completed_at': datetime.datetime.now().isoformat(),
                'results': results,
                'success': True,
            })
            _save_run_log(runs[-50:])
            return {'success': True, 'results': results}
        except Exception as e:
            tb = traceback.format_exc()
            logger.error('Training failed: %s\n%s', e, tb)
            runs = _load_run_log()
            runs.append({
                'run_id': 'RUN-%s' % uuid.uuid4().hex[:8].upper(),
                'type': 'training',
                'started_at': datetime.datetime.now().isoformat(),
                'completed_at': datetime.datetime.now().isoformat(),
                'error': str(e),
                'traceback': tb,
                'success': False,
            })
            _save_run_log(runs[-50:])
            return {'success': False, 'error': str(e)}


    def predict(self, ds=None):
        if ds is None:
            ds = load_all_datasets()
        if not ds:
            return {'predictions': [], 'recurring_issues': [], 'preventive_actions': [],
                    'root_causes': [], 'from_ml': False, 'error': 'No datasets available'}

        equip_preds = predict_equipment_faults(self.equipment_model, ds)
        sensor_preds = predict_sensor_faults(self.sensor_model, ds)
        section_preds = predict_mine_section_risks(ds)
        vent_preds = predict_ventilation_risks(ds)

        all_preds = equip_preds + sensor_preds + section_preds + vent_preds
        all_preds.sort(key=lambda p: p.get('probability', 0), reverse=True)

        recurring = predict_recurring_faults(ds)
        root_causes = analyze_root_causes(recurring, ds)
        preventive = generate_preventive_actions(all_preds, recurring)

        _save_predictions(all_preds)
        runs = _load_run_log()
        runs.append({
            'run_id': 'RUN-%s' % uuid.uuid4().hex[:8].upper(),
            'type': 'prediction',
            'started_at': datetime.datetime.now().isoformat(),
            'completed_at': datetime.datetime.now().isoformat(),
            'prediction_count': len(all_preds),
            'recurring_count': len(recurring),
            'preventive_count': len(preventive),
            'from_ml': self.equipment_model is not None or self.sensor_model is not None,
            'success': True,
        })
        _save_run_log(runs[-50:])

        return {
            'predictions': all_preds,
            'recurring_issues': recurring,
            'preventive_actions': preventive,
            'root_causes': root_causes,
            'from_ml': self.equipment_model is not None or self.sensor_model is not None,
        }

    def load_persisted_models(self):
        eq_path = os.path.join(MODELS_DIR, 'equipment_model.joblib')
        sen_path = os.path.join(MODELS_DIR, 'sensor_model.joblib')
        if os.path.exists(eq_path):
            try:
                self.equipment_model = joblib.load(eq_path)
                logger.info('Loaded equipment model from %s', eq_path)
            except Exception as e:
                logger.warning('Failed to load equipment model: %s', e)
        if os.path.exists(sen_path):
            try:
                self.sensor_model = joblib.load(sen_path)
                logger.info('Loaded sensor model from %s', sen_path)
            except Exception as e:
                logger.warning('Failed to load sensor model: %s', e)
        meta = _load_model_meta()
        self.trained_at = meta.get('trained_at')
        self.equipment_accuracy = meta.get('equipment_accuracy')
        self.sensor_f1 = meta.get('sensor_f1')
        self.model_version = meta.get('model_version', 'ml_v1')

    def get_status(self):
        meta = _load_model_meta()
        runs = _load_run_log()
        predictions = _load_predictions()
        last_run = runs[-1] if runs else None
        last_training = None
        for r in reversed(runs):
            if r.get('type') == 'training':
                last_training = r
                break
        return {
            'model_version': self.model_version,
            'trained_at': self.trained_at,
            'equipment_model': {
                'loaded': self.equipment_model is not None,
                'accuracy': self.equipment_accuracy,
                'persisted': os.path.exists(os.path.join(MODELS_DIR, 'equipment_model.joblib')),
            },
            'sensor_model': {
                'loaded': self.sensor_model is not None,
                'f1_score': self.sensor_f1,
                'persisted': os.path.exists(os.path.join(MODELS_DIR, 'sensor_model.joblib')),
            },
            'prediction_count': len(predictions),
            'total_runs': len(runs),
            'last_run': last_run,
            'last_training': last_training,
            'using_ml': self.equipment_model is not None or self.sensor_model is not None,
            'status': 'ready' if (self.equipment_model is not None or self.sensor_model is not None) else 'untrained',
        }


# Global pipeline instance
pipeline = MLPipeline()

