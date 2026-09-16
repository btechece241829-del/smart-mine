"""
MineGov AI — Python ML Risk & Anomaly Prediction Server
========================================================
Flask backend: risk scoring, IsolationForest anomaly detection, CSV upload.
Run:  python ml_server.py   (starts on http://localhost:5001)
"""
import os, sys, math, json, datetime
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask import send_from_directory

try:
    from sklearn.ensemble import IsolationForest
    HAS_SKLEARN = True
except Exception:
    HAS_SKLEARN = False

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'public', 'data')
UPLOADS_DIR = os.path.join(BASE_DIR, 'uploads')
os.makedirs(UPLOADS_DIR, exist_ok=True)

app = Flask(__name__)

def load_csv(path):
    if not os.path.exists(path):
        return None
    try:
        return pd.read_csv(path, encoding='utf-8-sig')
    except Exception:
        return pd.read_csv(path)

def _num(s):
    return pd.to_numeric(s, errors='coerce')

def compute_mine_risk(mines, compliances, violations, incidents, env,
                      equipment, contractors, workers, production):
    results = []
    if mines is None or mines.empty:
        return results
    for _, m in mines.iterrows():
        mid = str(m.get('mine_id', ''))
        def sub(df):
            if df is None or df.empty:
                return pd.DataFrame()
            return df[df['mine_id'].astype(str) == mid]
        # Compliance
        comp = sub(compliances)
        applicable = comp[comp['status'] != 'NOT_APPLICABLE'] if not comp.empty else pd.DataFrame()
        wp = {'CRITICAL': 3.0, 'HIGH': 2.0, 'MEDIUM': 1.5, 'LOW': 1.0}
        sp = {'COMPLIANT': 1.0, 'DUE_SOON': 0.7, 'OVERDUE': 0.2}
        ws, pts = 0.0, 0.0
        for _, c in applicable.iterrows():
            w = wp.get(str(c.get('priority', '')).upper(), 1.0)
            s = sp.get(str(c.get('status', '')).upper(), 0.0)
            ws += w; pts += s * w
        comp_score = (pts / ws * 100) if ws > 0 else 100.0
        compliance_risk = round(max(0, min(100, 100 - comp_score)), 1)
        # Safety
        vio = sub(violations)
        open_crit = 0
        if not vio.empty:
            open_crit = int(((vio['status'].astype(str).isin(['OPEN', 'IN_PROGRESS'])) &
                             (vio['severity'].astype(str) == 'CRITICAL')).sum())
        inc = sub(incidents)
        severe = 0
        if not inc.empty:
            severe = int(inc['severity'].astype(str).isin(
                ['FATAL', 'SERIOUS', 'CRITICAL', 'HIGH']).sum())
        safety_risk = round(min(100.0, open_crit * 20 + severe * 25), 1)
        # Environment
        envr = sub(env)
        env_exc = int((envr['compliance_status'].astype(str) == 'EXCEEDED').sum()) \
            if not envr.empty else 0
        env_risk = round(min(100.0, env_exc * 12), 1)
        # Equipment
        eq = sub(equipment)
        bkd = int((eq['status'].astype(str) == 'BREAKDOWN').sum()) if not eq.empty else 0
        hs = _num(eq['health_score']) if not eq.empty and 'health_score' in eq else pd.Series([85.0])
        avg_hs = float(hs.dropna().mean()) if not hs.dropna().empty else 85.0
        equip_risk = round(min(100.0, (100 - avg_hs) + bkd * 15), 1)
        # Contractor / worker
        ctr = sub(contractors)
        cs = _num(ctr['contractor_risk_score']) if not ctr.empty else pd.Series([30.0])
        avg_cs = float(cs.dropna().mean()) if not cs.dropna().empty else 30.0
        wrk = sub(workers)
        exp_fit = int((wrk['fitness_status'].astype(str) == 'EXPIRED').sum()) \
            if not wrk.empty else 0
        ctr_risk = round(min(100.0, avg_cs + exp_fit * 5), 1)
        # Operations
        prod = sub(production)
        ach = _num(prod['achievement_percentage']) \
            if not prod.empty and 'achievement_percentage' in prod else pd.Series([85.0])
        avg_ach = float(ach.dropna().mean()) if not ach.dropna().empty else 85.0
        ops_risk = round(min(100.0, max(0, 100 - avg_ach) + bkd * 10), 1)
        overall = round(safety_risk * 0.25 + compliance_risk * 0.20 + env_risk * 0.15 +
                        equip_risk * 0.15 + ctr_risk * 0.15 + ops_risk * 0.10, 1)
        band = ('Critical' if overall >= 70 else 'High' if overall >= 50
                else 'Moderate' if overall >= 30 else 'Low')
        results.append({
            'mine_id': mid, 'mine_name': str(m.get('mine_name', mid)),
            'overall_risk': overall, 'risk_band': band,
            'compliance_risk': compliance_risk, 'compliance_score': round(comp_score, 1),
            'safety_risk': safety_risk, 'environment_risk': env_risk,
            'equipment_risk': equip_risk, 'contractor_risk': ctr_risk,
            'operations_risk': ops_risk,
            'open_critical_violations': open_crit, 'severe_incidents': severe,
            'env_exceedances': env_exc, 'breakdowns': bkd,
            'avg_equipment_health': round(avg_hs, 1),
            'avg_production_achievement': round(avg_ach, 1),
            'expired_worker_fitness': exp_fit,
        })
    results.sort(key=lambda r: r['overall_risk'], reverse=True)
    return results


def detect_anomalies(df, features, contamination=0.05):
    if df is None or df.empty:
        return []
    cols = [f for f in features if f in df.columns]
    if not cols:
        return []
    X = df[cols].apply(pd.to_numeric, errors='coerce').fillna(0)
    rows = []
    if HAS_SKLEARN:
        iso = IsolationForest(contamination=contamination, random_state=42,
                              n_estimators=100)
        iso.fit(X)
        preds = iso.predict(X)
        scores = iso.score_samples(X)
        for i in range(len(X)):
            rows.append({'index': i, 'is_anomaly': bool(preds[i] == -1),
                         'anomaly_score': round(float(-scores[i]), 4)})
    else:
        for i in range(len(X)):
            zs = []
            for c in cols:
                mu, sd = float(X[c].mean()), float(X[c].std())
                if sd > 0:
                    zs.append(abs((float(X.iloc[i][c]) - mu) / sd))
            mz = max(zs) if zs else 0.0
            rows.append({'index': i, 'is_anomaly': bool(mz > 3.0),
                         'anomaly_score': round(mz, 4)})
    return rows

# ---- CORS helper ----
def _cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    return response

@app.after_request
def after(resp):
    return _cors(resp)

# ---- Routes ----
@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'service': 'minegov-ml',
                    'time': datetime.datetime.now().isoformat(),
                    'sklearn': HAS_SKLEARN})

@app.route('/api/risk')
def risk():
    try:
        mines   = load_csv(os.path.join(DATA_DIR, '01_mines.csv'))
        comp    = load_csv(os.path.join(DATA_DIR, '02_compliances.csv'))
        vio     = load_csv(os.path.join(DATA_DIR, '04_violations.csv'))
        inc     = load_csv(os.path.join(DATA_DIR, '06_incidents_nearmiss.csv'))
        env     = load_csv(os.path.join(DATA_DIR, '07_environment_readings.csv'))
        eq      = load_csv(os.path.join(DATA_DIR, '09_equipment.csv'))
        ctr     = load_csv(os.path.join(DATA_DIR, '10_contractors.csv'))
        wrk     = load_csv(os.path.join(DATA_DIR, '11_workers.csv'))
        prod    = load_csv(os.path.join(DATA_DIR, '12_production.csv'))
        results = compute_mine_risk(mines, comp, vio, inc, env, eq, ctr, wrk, prod)
        return jsonify({'mines': results, 'count': len(results)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/anomalies')
def anomalies():
    try:
        ds  = request.args.get('dataset', 'sensor')
        mid = request.args.get('mine_id', 'ALL')
        if ds == 'environment':
            df       = load_csv(os.path.join(DATA_DIR, '07_environment_readings.csv'))
            features = ['value', 'exceedance_pct']
        else:
            df       = load_csv(os.path.join(DATA_DIR, '08_sensor_readings.csv'))
            features = ['value', 'anomaly_score']
        if mid != 'ALL' and df is not None and not df.empty:
            df = df[df['mine_id'].astype(str) == mid]
        # Subsample large sensor file for speed (keep first 5000 rows)
        if df is not None and len(df) > 5000:
            df = df.head(5000)
        dets = detect_anomalies(df, features)
        return jsonify({
            'dataset': ds,
            'anomaly_count': sum(1 for d in dets if d['is_anomaly']),
            'total': len(dets),
            'detections': dets,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/upload', methods=['POST', 'OPTIONS'])
def upload():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    f = request.files['file']
    if not f.filename.endswith('.csv'):
        return jsonify({'error': 'Only .csv files are supported'}), 400
    path = os.path.join(UPLOADS_DIR, os.path.basename(f.filename))
    f.save(path)
    try:
        df      = pd.read_csv(path, encoding='utf-8-sig')
        numeric = df.select_dtypes(include=[np.number]).columns.tolist()
        dets    = detect_anomalies(df, numeric)
        stats   = {}
        for col in numeric[:10]:  # top 10 numeric cols
            s = df[col].dropna()
            stats[col] = {'mean': round(float(s.mean()), 3),
                          'std':  round(float(s.std()),  3),
                          'min':  round(float(s.min()),  3),
                          'max':  round(float(s.max()),  3)}
        return jsonify({
            'filename':      f.filename,
            'rows':          len(df),
            'columns':       list(df.columns),
            'numeric':       numeric,
            'stats':         stats,
            'anomaly_count': sum(1 for d in dets if d['is_anomaly']),
            'anomalies':     dets,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/predict', methods=['POST', 'OPTIONS'])
def predict():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    body  = request.get_json(silent=True) or {}
    feats = body.get('features', {})
    if not feats:
        return jsonify({'error': 'features object required'}), 400
    scores = []
    for k, v in feats.items():
        try:
            scores.append(max(0.0, min(100.0, float(v))))
        except (TypeError, ValueError):
            pass
    mean_risk = round(float(np.mean(scores)), 1) if scores else 0.0
    band = ('Critical' if mean_risk >= 70 else 'High' if mean_risk >= 50
            else 'Moderate' if mean_risk >= 30 else 'Low')
    return jsonify({'predicted_risk': mean_risk, 'risk_band': band,
                    'contributors': {k: round(float(v), 2)
                                     for k, v in feats.items()
                                     if v is not None}})


# ---------------------------------------------------------------------------
# Combined ML prediction — historical datasets (public/data CSVs) + live data
# Prediction is based on BOTH the static CSV datasets AND the realtime records
# (complaints, inspections, risk alerts) posted by the app.
# ---------------------------------------------------------------------------
LIVE_FEATURE_WEIGHTS = {
    'critical_complaints':   18.0,
    'high_complaints':        9.0,
    'open_complaints':        3.0,
    'overdue_complaints':     8.0,
    'complaints_30d':         2.0,
    'critical_inspections':  12.0,
    'active_risk_alerts':    25.0,
}


def _to_float(value):
    try:
        return max(0.0, float(value))
    except (TypeError, ValueError):
        return 0.0


def _to_int(value):
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0


def compute_live_risk(feats):
    """Live-data risk (0-100) from realtime records submitted by the app."""
    raw = sum(weight * _to_float(feats.get(key))
              for key, weight in LIVE_FEATURE_WEIGHTS.items())
    total = _to_int(feats.get('complaint_count'))
    resolved = _to_int(feats.get('resolved_complaints'))
    if total > 0:
        raw += (1.0 - min(1.0, resolved / float(total))) * 15.0
    return round(max(0.0, min(100.0, raw)), 1)


def risk_band_for(score):
    return ('Critical' if score >= 70 else 'High' if score >= 50
            else 'Moderate' if score >= 30 else 'Low')


@app.route('/api/predict/combined', methods=['POST', 'OPTIONS'])
def predict_combined():
    """Blend historical dataset risk with live runtime records per mine.

    Body: {"live": {"mines": [{"mine_id", "mine_name", "features": {...}}]}}
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    body = request.get_json(silent=True) or {}
    live_mines = (body.get('live') or {}).get('mines') or []
    if not live_mines:
        return jsonify({'error': 'live.mines array required'}), 400

    # Dataset-derived per-mine risk from the static historical CSVs.
    dataset_risk = {}
    try:
        mines = load_csv(os.path.join(DATA_DIR, '01_mines.csv'))
        comp  = load_csv(os.path.join(DATA_DIR, '02_compliances.csv'))
        vio   = load_csv(os.path.join(DATA_DIR, '04_violations.csv'))
        inc   = load_csv(os.path.join(DATA_DIR, '06_incidents_nearmiss.csv'))
        env   = load_csv(os.path.join(DATA_DIR, '07_environment_readings.csv'))
        eq    = load_csv(os.path.join(DATA_DIR, '09_equipment.csv'))
        ctr   = load_csv(os.path.join(DATA_DIR, '10_contractors.csv'))
        wrk   = load_csv(os.path.join(DATA_DIR, '11_workers.csv'))
        prod  = load_csv(os.path.join(DATA_DIR, '12_production.csv'))
        for row in compute_mine_risk(mines, comp, vio, inc, env, eq, ctr, wrk, prod):
            dataset_risk[str(row['mine_id'])] = row
    except Exception:
        dataset_risk = {}

    predictions = []
    for m in live_mines:
        mid  = str(m.get('mine_id') or '')
        name = str(m.get('mine_name') or mid or 'Unknown Mine')
        feats = m.get('features') or {}
        live = compute_live_risk(feats)
        ds = dataset_risk.get(mid)
        if ds is not None:
            ds_risk = round(float(ds['overall_risk']), 1)
            predicted = round(0.5 * ds_risk + 0.5 * live, 1)
            sources = {'dataset': ds_risk, 'live': live}
        else:
            ds_risk = None   # mine not present in historical datasets
            predicted = live
            sources = {'dataset': None, 'live': live}
        contributors = {k: round(_to_float(feats.get(k)), 2)
                        for k in LIVE_FEATURE_WEIGHTS}
        predictions.append({
            'mine_id': mid,
            'mine_name': name,
            'dataset_risk': ds_risk,
            'live_risk': live,
            'predicted_risk': predicted,
            'risk_band': risk_band_for(predicted),
            'sources': sources,
            'contributors': contributors,
        })
    predictions.sort(key=lambda p: p['predicted_risk'], reverse=True)
    return jsonify({
        'predictions': predictions,
        'count': len(predictions),
        'datasets_available': bool(dataset_risk),
        'blend': {'dataset': 0.5, 'live': 0.5},
    })


# ════════════════════════════════════════════════════════════════════
#  PREDICTIVE ANALYTICS — Equipment Fault Prediction & Recurring Issues
# ════════════════════════════════════════════════════════════════════
import uuid
import traceback
from collections import defaultdict

try:
    from ml_models import pipeline as ml_pipeline, load_all_datasets as ml_load_all_datasets
    HAS_ML_PIPELINE = True
except ImportError:
    HAS_ML_PIPELINE = False
    ml_pipeline = None
    ml_load_all_datasets = None

_PREDICTIONS = {}
_RECURRING_ISSUES = {}
_PREVENTIVE_ACTIONS = {}
_PREDICTION_OUTCOMES = []
_ML_CACHE = {'result': None, 'timestamp': 0}
_ML_CACHE_TTL = 300  # 5 minutes


def _load_all_datasets():
    files = {
        'mines': '01_mines.csv', 'compliances': '02_compliances.csv',
        'inspections': '03_inspections.csv', 'violations': '04_violations.csv',
        'corrective_actions': '05_corrective_actions.csv', 'incidents': '06_incidents_nearmiss.csv',
        'environment': '07_environment_readings.csv', 'sensors': '08_sensor_readings.csv',
        'equipment': '09_equipment.csv', 'contractors': '10_contractors.csv',
        'workers': '11_workers.csv', 'production': '12_production.csv',
        'documents': '13_documents.csv',
    }
    ds = {}
    for key, fname in files.items():
        df = load_csv(os.path.join(DATA_DIR, fname))
        if df is not None:
            ds[key] = df
    return ds


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


def _safe_float(val, default=0):
    v = _num(val)
    if hasattr(v, 'item'):
        return float(v.item())
    try:
        return float(v)
    except Exception:
        return default


def _predict_equipment_faults(ds):
    predictions = []
    equipment = ds.get('equipment', pd.DataFrame())
    incidents = ds.get('incidents', pd.DataFrame())
    violations = ds.get('violations', pd.DataFrame())
    sensors = ds.get('sensors', pd.DataFrame())
    corrective = ds.get('corrective_actions', pd.DataFrame())
    if equipment.empty:
        return predictions
    for _, eq in equipment.iterrows():
        eq_id = str(eq.get('equipment_id', ''))
        eq_name = str(eq.get('equipment_name', ''))
        eq_type = str(eq.get('equipment_type', ''))
        mine_id = str(eq.get('mine_id', ''))
        health = _safe_float(eq.get('health_score', 85))
        status = str(eq.get('status', ''))
        maint_status = str(eq.get('maintenance_status', ''))
        op_hours = _safe_float(eq.get('operating_hours_24h', 0))
        bkd_hours = _safe_float(eq.get('breakdown_hours_24h', 0))
        if status == 'BREAKDOWN':
            continue
        health_risk = max(0, (100 - health) / 100 * 30)
        maint_risk = 15 if maint_status == 'DUE_SOON' else 25 if maint_status == 'OVERDUE' else 0
        op_risk = min(15, op_hours / 16 * 15)
        eq_incidents = incidents[incidents['equipment_involved'].astype(str).str.contains(eq_id[:8], na=False)] if not incidents.empty else pd.DataFrame()
        bkd_count = len(eq_incidents) if not eq_incidents.empty else 0
        bkd_risk = min(20, bkd_count * 7)
        equip_violations = violations[violations['violation_type'].astype(str).str.contains(eq_type[:8] if eq_type else '', case=False, na=False)] if not violations.empty else pd.DataFrame()
        vio_risk = min(15, len(equip_violations) * 4)
        sensor_risk = 0
        if not sensors.empty:
            eq_sensors = sensors[sensors['sensor_id'].astype(str).str.contains(eq_id[:10] if eq_id else '', na=False)]
            if not eq_sensors.empty:
                crit_pct = len(eq_sensors[eq_sensors['status'] == 'CRITICAL']) / max(1, len(eq_sensors))
                warn_pct = len(eq_sensors[eq_sensors['status'] == 'WARNING']) / max(1, len(eq_sensors))
                sensor_risk = min(20, crit_pct * 20 + warn_pct * 10)
        capa_risk = 0
        if not corrective.empty:
            eq_capa = corrective[corrective['mine_id'].astype(str) == mine_id]
            overdue_capa = len(eq_capa[eq_capa['status'] == 'OVERDUE']) if not eq_capa.empty else 0
            capa_risk = min(10, overdue_capa * 3)
        total_risk = round(min(100, health_risk + maint_risk + op_risk + bkd_risk + vio_risk + sensor_risk + capa_risk), 1)
        if total_risk < 15:
            continue
        predicted_fault = 'General equipment degradation'
        if health < 40 or bkd_hours > 5:
            predicted_fault = 'Equipment breakdown / failure'
        elif maint_status in ('DUE_SOON', 'OVERDUE') and health < 60:
            predicted_fault = 'Maintenance-related failure'
        elif sensor_risk > 10:
            predicted_fault = 'Sensor-detected anomaly leading to failure'
        elif op_hours > 12:
            predicted_fault = 'Overuse / wear-related failure'
        elif bkd_risk > 10:
            predicted_fault = 'Recurring breakdown pattern'
        factors = []
        if health_risk > 5: factors.append('Low health score (%s%%)' % health)
        if maint_risk > 5: factors.append('Maintenance %s' % maint_status.lower())
        if op_risk > 5: factors.append('High operating hours (%s h)' % op_hours)
        if bkd_risk > 5: factors.append('%s previous incidents' % bkd_count)
        if vio_risk > 5: factors.append('%s related violations' % len(equip_violations))
        if sensor_risk > 5: factors.append('Sensor readings near critical')
        if capa_risk > 5: factors.append('Overdue corrective actions')
        window = 'Next 3 days' if total_risk >= 70 else 'Next 7 days' if total_risk >= 50 else 'Next 14 days' if total_risk >= 30 else 'Next 30 days'
        risk_level = 'LOW' if total_risk < 30 else 'MEDIUM' if total_risk < 50 else 'HIGH' if total_risk < 70 else 'CRITICAL'
        actions_list = []
        if maint_status in ('DUE_SOON', 'OVERDUE'): actions_list.append('Schedule preventive maintenance')
        if health < 50: actions_list.append('Conduct detailed equipment inspection')
        if sensor_risk > 10: actions_list.append('Review sensor data anomalies')
        if bkd_count > 2: actions_list.append('Root cause analysis for recurring issues')
        if not actions_list: actions_list.append('Monitor and schedule routine inspection')
        pid = 'PRED-EQP-%s' % uuid.uuid4().hex[:8].upper()
        predictions.append({
            'prediction_id': pid, 'asset_id': eq_id, 'asset_name': eq_name,
            'asset_type': 'equipment', 'mine_id': mine_id,
            'predicted_fault': predicted_fault, 'probability': round(total_risk),
            'risk_level': risk_level, 'predicted_window': window,
            'contributing_factors': factors,
            'historical_evidence': {'health_score': health, 'breakdown_hours': bkd_hours, 'operating_hours': op_hours, 'related_incidents': bkd_count, 'related_violations': len(equip_violations), 'maintenance_status': maint_status},
            'recommended_actions': actions_list, 'model_version': 'rule_engine_v1',
            'prediction_status': 'ACTIVE', 'created_at': datetime.datetime.now().isoformat(),
        })
    predictions.sort(key=lambda p: p['probability'], reverse=True)
    return predictions


def _predict_mine_section_risks(ds):
    predictions = []
    incidents = ds.get('incidents', pd.DataFrame())
    violations = ds.get('violations', pd.DataFrame())
    sensors = ds.get('sensors', pd.DataFrame())
    env = ds.get('environment', pd.DataFrame())
    if incidents.empty and violations.empty:
        return predictions
    zone_data = defaultdict(lambda: {'incidents': 0, 'violations': 0, 'sensors_critical': 0, 'env_exceeded': 0, 'mine_id': ''})
    if not incidents.empty:
        for _, inc in incidents.iterrows():
            zone = str(inc.get('zone', 'Unknown')).strip()
            sev = str(inc.get('severity', '')).upper()
            weight = 3 if sev in ('FATAL', 'CRITICAL', 'SERIOUS') else 2 if sev == 'HIGH' else 1
            zone_data[zone]['incidents'] += weight
            zone_data[zone]['mine_id'] = str(inc.get('mine_id', ''))
    if not violations.empty:
        for _, vio in violations.iterrows():
            zone = str(vio.get('zone', 'Unknown')).strip()
            sev = str(vio.get('severity', '')).upper()
            weight = 3 if sev == 'CRITICAL' else 2 if sev == 'HIGH' else 1
            zone_data[zone]['violations'] += weight
    if not sensors.empty:
        for _, sen in sensors.iterrows():
            zone = str(sen.get('zone', 'Unknown')).strip()
            if str(sen.get('status', '')) == 'CRITICAL':
                zone_data[zone]['sensors_critical'] += 1
    if not env.empty:
        for _, e in env.iterrows():
            zone = str(e.get('station_id', 'Unknown')).strip()
            if str(e.get('compliance_status', '')) == 'EXCEEDED':
                zone_data[zone]['env_exceeded'] += 1
    for zone, data in zone_data.items():
        score = min(100, data['incidents'] * 8 + data['violations'] * 6 + data['sensors_critical'] * 10 + data['env_exceeded'] * 5)
        if score < 10:
            continue
        risk_level = 'LOW' if score < 30 else 'MEDIUM' if score < 50 else 'HIGH' if score < 70 else 'CRITICAL'
        factors = []
        if data['incidents'] > 0: factors.append('%s weighted incident points' % data['incidents'])
        if data['violations'] > 0: factors.append('%s weighted violation points' % data['violations'])
        if data['sensors_critical'] > 0: factors.append('%s critical sensor alerts' % data['sensors_critical'])
        if data['env_exceeded'] > 0: factors.append('%s environmental exceedances' % data['env_exceeded'])
        pid = 'PRED-SEC-%s' % uuid.uuid4().hex[:8].upper()
        predictions.append({
            'prediction_id': pid, 'asset_id': zone, 'asset_name': zone,
            'asset_type': 'mine_section', 'mine_id': data['mine_id'],
            'predicted_fault': 'Safety incident risk in zone %s' % zone,
            'probability': round(score), 'risk_level': risk_level,
            'predicted_window': 'Next 7 days' if score >= 50 else 'Next 30 days',
            'contributing_factors': factors,
            'historical_evidence': {'incident_score': data['incidents'], 'violation_score': data['violations'], 'critical_sensors': data['sensors_critical'], 'env_exceedances': data['env_exceeded']},
            'recommended_actions': ['Schedule zone safety inspection' if score >= 50 else 'Monitor zone conditions', 'Review and address open violations' if data['violations'] > 0 else 'Maintain current controls'],
            'model_version': 'rule_engine_v1', 'prediction_status': 'ACTIVE',
            'created_at': datetime.datetime.now().isoformat(),
        })
    predictions.sort(key=lambda p: p['probability'], reverse=True)
    return predictions


def _predict_ventilation_risks(ds):
    predictions = []
    sensors = ds.get('sensors', pd.DataFrame())
    incidents = ds.get('incidents', pd.DataFrame())
    env = ds.get('environment', pd.DataFrame())
    violations = ds.get('violations', pd.DataFrame())
    vent_keywords = ['gas', 'methane', 'co_', 'ventil', 'dust', 'pm', 'air']
    vent_sensors = pd.DataFrame()
    if not sensors.empty:
        mask = sensors['sensor_type'].astype(str).str.lower().apply(lambda x: any(kw in str(x) for kw in vent_keywords))
        vent_sensors = sensors[mask] if mask.any() else pd.DataFrame()
    vent_env = pd.DataFrame()
    if not env.empty:
        env_mask = env['parameter'].astype(str).str.lower().apply(lambda x: any(kw in str(x) for kw in vent_keywords))
        vent_env = env[env_mask] if env_mask.any() else pd.DataFrame()
    vent_incidents = 0
    if not incidents.empty:
        inc_mask = incidents['description'].astype(str).str.lower().apply(lambda x: any(kw in str(x) for kw in vent_keywords)) | incidents['incident_type'].astype(str).str.lower().apply(lambda x: any(kw in str(x) for kw in vent_keywords))
        vent_incidents = int(inc_mask.sum()) if inc_mask.any() else 0
    vent_violations = 0
    if not violations.empty:
        vio_mask = violations['violation_type'].astype(str).str.lower().apply(lambda x: any(kw in str(x) for kw in vent_keywords))
        vent_violations = int(vio_mask.sum()) if vio_mask.any() else 0
    score = min(100, vent_incidents * 12 + vent_violations * 10)
    if not vent_sensors.empty:
        crit_vent = len(vent_sensors[vent_sensors['status'] == 'CRITICAL'])
        warn_vent = len(vent_sensors[vent_sensors['status'] == 'WARNING'])
        score += min(30, crit_vent * 5 + warn_vent * 2)
    if not vent_env.empty:
        exc_env = len(vent_env[vent_env['compliance_status'] == 'EXCEEDED'])
        score += min(20, exc_env * 5)
    score = min(100, score)
    if score < 10:
        return predictions
    risk_level = 'LOW' if score < 30 else 'MEDIUM' if score < 50 else 'HIGH' if score < 70 else 'CRITICAL'
    pid = 'PRED-ENV-%s' % uuid.uuid4().hex[:8].upper()
    predictions.append({
        'prediction_id': pid, 'asset_id': 'VENTILATION_SYS',
        'asset_name': 'Ventilation & Gas Monitoring System', 'asset_type': 'system',
        'mine_id': '', 'predicted_fault': 'Ventilation-related safety risk',
        'probability': round(score), 'risk_level': risk_level,
        'predicted_window': 'Next 7 days' if score >= 50 else 'Next 30 days',
        'contributing_factors': [
            '%s ventilation/gas-related incidents' % vent_incidents,
            '%s ventilation/gas-related violations' % vent_violations,
            '%s critical ventilation sensors' % (len(vent_sensors[vent_sensors['status'] == 'CRITICAL']) if not vent_sensors.empty else 0),
        ],
        'historical_evidence': {'vent_incidents': vent_incidents, 'vent_violations': vent_violations},
        'recommended_actions': ['Conduct ventilation system inspection', 'Verify air quality monitoring calibration', 'Review gas drainage system operation'],
        'model_version': 'rule_engine_v1', 'prediction_status': 'ACTIVE',
        'created_at': datetime.datetime.now().isoformat(),
    })
    return predictions


def _detect_recurring_issues(ds):
    issues = []
    incidents = ds.get('incidents', pd.DataFrame())
    violations = ds.get('violations', pd.DataFrame())
    inspections = ds.get('inspections', pd.DataFrame())
    equipment = ds.get('equipment', pd.DataFrame())

    # ── Recurring incidents by zone + type ──
    if not incidents.empty and len(incidents) >= 3:
        grouped = incidents.groupby(['zone', 'incident_type']).size().reset_index(name='count')
        for _, row in grouped.iterrows():
            if row['count'] < 3:
                continue
            zone = str(row['zone'])
            itype = str(row['incident_type'])
            subset = incidents[(incidents['zone'].astype(str) == zone) & (incidents['incident_type'].astype(str) == itype)]
            dates = subset['date'].apply(_parse_date).dropna()
            dates_sorted = sorted(dates)
            frequency = 'STABLE'
            if len(dates_sorted) >= 2:
                gaps = [(dates_sorted[i+1] - dates_sorted[i]).days for i in range(len(dates_sorted)-1)]
                avg_gap = sum(gaps) / len(gaps) if gaps else 365
                recent_gaps = gaps[-3:] if len(gaps) >= 3 else gaps
                if recent_gaps and sum(recent_gaps)/len(recent_gaps) < avg_gap * 0.7:
                    frequency = 'INCREASING'
                elif recent_gaps and sum(recent_gaps)/len(recent_gaps) > avg_gap * 1.3:
                    frequency = 'DECREASING'
            severity_map = {'FATAL': 4, 'CRITICAL': 4, 'SERIOUS': 3, 'HIGH': 2, 'MEDIUM': 1, 'LOW': 1}
            avg_sev = subset['severity'].apply(lambda x: severity_map.get(str(x).upper(), 1)).mean()
            recurrence_risk = min(95, row['count'] * 10 + (15 if frequency == 'INCREASING' else 0) + avg_sev * 8)
            issue_id = 'RI-ZON-%s' % uuid.uuid4().hex[:8].upper()
            issues.append({
                'issue_id': issue_id, 'issue_type': 'RECURRING_INCIDENT',
                'title': '%s in zone %s' % (itype, zone),
                'description': '%s incidents of type "%s" occurred in zone "%s"' % (row['count'], itype, zone),
                'location': zone,
                'mine_ids': subset['mine_id'].astype(str).unique().tolist(),
                'occurrences': int(row['count']),
                'last_occurrence': str(dates_sorted[-1].date()) if dates_sorted else 'Unknown',
                'frequency_trend': frequency,
                'severity': 'HIGH' if avg_sev >= 3 else 'MEDIUM' if avg_sev >= 2 else 'LOW',
                'recurrence_risk': round(recurrence_risk),
                'affected_records': subset['incident_id'].astype(str).tolist(),
                'created_at': datetime.datetime.now().isoformat(),
            })

    # ── Recurring violations by type + zone ──
    if not violations.empty:
        grouped = violations.groupby(['violation_type', 'zone']).size().reset_index(name='count')
        for _, row in grouped.iterrows():
            if row['count'] < 3:
                continue
            vtype = str(row['violation_type'])
            zone = str(row['zone'])
            subset = violations[(violations['violation_type'].astype(str) == vtype) & (violations['zone'].astype(str) == zone)]
            open_count = len(subset[subset['status'].astype(str).isin(['OPEN', 'IN_PROGRESS'])])
            recurrence_risk = min(95, row['count'] * 12 + open_count * 10)
            last_dt = subset['reported_at'].apply(_parse_date).dropna().max()
            issue_id = 'RI-VIO-%s' % uuid.uuid4().hex[:8].upper()
            issues.append({
                'issue_id': issue_id, 'issue_type': 'RECURRING_VIOLATION',
                'title': 'Recurring violation: %s in %s' % (vtype, zone),
                'description': '%s violations of type "%s" in zone "%s" (%s still open)' % (row['count'], vtype, zone, open_count),
                'location': zone,
                'mine_ids': subset['mine_id'].astype(str).unique().tolist(),
                'occurrences': int(row['count']),
                'last_occurrence': str(last_dt.date()) if last_dt is not None else 'Unknown',
                'frequency_trend': 'INCREASING' if open_count > row['count'] / 2 else 'STABLE',
                'severity': 'HIGH' if open_count > 2 else 'MEDIUM' if open_count > 0 else 'LOW',
                'recurrence_risk': round(recurrence_risk),
                'affected_records': subset['violation_id'].astype(str).tolist(),
                'created_at': datetime.datetime.now().isoformat(),
            })
    return issues


def _analyze_root_causes(recurring_issues, ds):
    analyses = []
    incidents = ds.get('incidents', pd.DataFrame())
    for issue in recurring_issues:
        if issue['occurrences'] < 2:
            continue
        record_ids = issue.get('affected_records', [])
        issue_id = issue['issue_id']
        related_records = pd.DataFrame()
        if not incidents.empty and record_ids:
            related_records = incidents[incidents['incident_id'].astype(str).isin(record_ids)]
        factors = []
        if not related_records.empty:
            zones = related_records['zone'].astype(str).value_counts()
            if len(zones) > 0 and zones.iloc[0] > 1:
                factors.append({
                    'factor': 'Zone concentration: %s' % zones.index[0],
                    'evidence': '%s of %s records in this zone' % (zones.iloc[0], len(related_records)),
                    'confidence': 'Likely contributing factor',
                })
            equip_involved = related_records['equipment_involved'].dropna().value_counts()
            if len(equip_involved) > 0 and equip_involved.iloc[0] > 1:
                factors.append({
                    'factor': 'Equipment involvement: %s' % equip_involved.index[0],
                    'evidence': '%s records involve this equipment' % equip_involved.iloc[0],
                    'confidence': 'Possible contributing factor',
                })
            root_causes = related_records['root_cause'].dropna().value_counts()
            if len(root_causes) > 0 and root_causes.iloc[0] > 1:
                factors.append({
                    'factor': 'Common root cause: %s' % root_causes.index[0],
                    'evidence': '%s records share this root cause' % root_causes.iloc[0],
                    'confidence': 'Likely cause',
                })
            shifts = related_records['shift'].dropna().value_counts()
            if len(shifts) > 0 and shifts.iloc[0] > len(related_records) / 2:
                factors.append({
                    'factor': 'Temporal pattern: Shift %s' % shifts.index[0],
                    'evidence': '%s of %s records in shift %s' % (shifts.iloc[0], len(related_records), shifts.index[0]),
                    'confidence': 'Possible contributing factor',
                })
        if not factors:
            factors.append({
                'factor': 'Pattern detected from aggregated data',
                'evidence': '%s occurrences across records' % issue['occurrences'],
                'confidence': 'Possible contributing factor',
            })
        analyses.append({
            'issue_id': issue_id,
            'title': issue['title'],
            'occurrences': issue['occurrences'],
            'contributing_factors': factors,
            'recommended_investigation': 'Investigate %s recurring occurrences of "%s"' % (issue['occurrences'], issue['title']),
            'created_at': datetime.datetime.now().isoformat(),
        })
    return analyses


def _generate_preventive_actions(predictions, recurring_issues):
    actions = []
    for pred in predictions:
        if pred['probability'] < 40:
            continue
        action_id = 'PA-%s' % uuid.uuid4().hex[:8].upper()
        responsible = 'Safety Officer' if pred['risk_level'] in ('HIGH', 'CRITICAL') else 'Maintenance Team'
        deadline_days = 3 if pred['risk_level'] == 'CRITICAL' else 7 if pred['risk_level'] == 'HIGH' else 14
        deadline = (datetime.datetime.now() + datetime.timedelta(days=deadline_days)).isoformat()
        actions.append({
            'action_id': action_id, 'source_type': 'PREDICTION',
            'source_id': pred['prediction_id'],
            'title': 'Preventive action for: %s' % pred['predicted_fault'][:60],
            'description': 'Risk: %s%% (%s) — %s' % (pred['probability'], pred['risk_level'], pred['asset_name']),
            'responsible_role': responsible, 'deadline': deadline,
            'status': 'PENDING', 'priority': pred['risk_level'],
            'created_at': datetime.datetime.now().isoformat(),
        })
    for issue in recurring_issues:
        if issue['recurrence_risk'] < 40:
            continue
        action_id = 'PA-%s' % uuid.uuid4().hex[:8].upper()
        responsible = 'Mine Manager' if issue['severity'] == 'HIGH' else 'Safety Officer'
        deadline_days = 7 if issue['severity'] == 'HIGH' else 14
        deadline = (datetime.datetime.now() + datetime.timedelta(days=deadline_days)).isoformat()
        actions.append({
            'action_id': action_id, 'source_type': 'RECURRING_ISSUE',
            'source_id': issue['issue_id'],
            'title': 'Address recurring: %s' % issue['title'][:60],
            'description': '%s occurrences — recurrence risk %s%%' % (issue['occurrences'], issue['recurrence_risk']),
            'responsible_role': responsible, 'deadline': deadline,
            'status': 'PENDING', 'priority': issue['severity'],
            'created_at': datetime.datetime.now().isoformat(),
        })
    prio = {'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1}
    actions.sort(key=lambda a: prio.get(a['priority'], 0), reverse=True)
    return actions


def _run_ml_or_rule_prediction():
    """Run the ML pipeline if available and models are loaded/cached; otherwise
    fall back to the rule-based engine. Results are cached for _ML_CACHE_TTL
    seconds to avoid recomputing on every dashboard widget request."""
    from datetime import datetime as _dt
    now = _dt.now().timestamp()
    cache = _ML_CACHE
    if cache['result'] and (now - cache['timestamp']) < _ML_CACHE_TTL:
        return cache['result']

    if HAS_ML_PIPELINE and ml_pipeline is not None:
        try:
            ds = ml_load_all_datasets()
            if ml_pipeline.equipment_model is None and ml_pipeline.sensor_model is None:
                ml_pipeline.load_persisted_models()
            result = ml_pipeline.predict(ds)
            if result.get('from_ml') or True:
                # Use ML result regardless; pipeline has its own rule fallback
                result['model_version'] = ml_pipeline.model_version
                result['from_ml'] = ml_pipeline.equipment_model is not None or ml_pipeline.sensor_model is not None
                _ML_CACHE['result'] = result
                _ML_CACHE['timestamp'] = now
                return result
        except Exception as e:
            traceback.print_exc()

    # Rule-based fallback
    ds = _load_all_datasets()
    equip_preds = _predict_equipment_faults(ds)
    section_preds = _predict_mine_section_risks(ds)
    vent_preds = _predict_ventilation_risks(ds)
    all_preds = equip_preds + section_preds + vent_preds
    all_preds.sort(key=lambda p: p.get('probability', 0), reverse=True)
    issues = _detect_recurring_issues(ds)
    analyses = _analyze_root_causes(issues, ds)
    actions = _generate_preventive_actions(all_preds, issues)
    result = {
        'predictions': all_preds,
        'recurring_issues': issues,
        'preventive_actions': actions,
        'root_causes': analyses,
        'from_ml': False,
        'model_version': 'rule_engine_v1',
    }
    _ML_CACHE['result'] = result
    _ML_CACHE['timestamp'] = now
    return result


@app.route('/api/predict/faults', methods=['GET'])
def api_predict_faults():
    try:
        result = _run_ml_or_rule_prediction()
        all_preds = result['predictions']
        for p in all_preds:
            _PREDICTIONS[p['prediction_id']] = p
        return jsonify({'predictions': all_preds, 'count': len(all_preds), 'model_version': result['model_version'], 'data_sufficient': True, 'generated_at': datetime.datetime.now().isoformat(), 'from_ml': result['from_ml']})
    except Exception as e:
        return jsonify({'error': str(e), 'predictions': [], 'count': 0, 'data_sufficient': False}), 500


@app.route('/api/predict/recurring', methods=['GET'])
def api_predict_recurring():
    try:
        result = _run_ml_or_rule_prediction()
        issues = result['recurring_issues']
        if not issues:
            ds = _load_all_datasets()
            issues = _detect_recurring_issues(ds)
        for issue in issues:
            _RECURRING_ISSUES[issue['issue_id']] = issue
        return jsonify({'issues': issues, 'count': len(issues), 'generated_at': datetime.datetime.now().isoformat(), 'from_ml': result['from_ml']})
    except Exception as e:
        return jsonify({'error': str(e), 'issues': [], 'count': 0}), 500


@app.route('/api/predict/root-cause', methods=['GET'])
def api_predict_root_cause():
    try:
        result = _run_ml_or_rule_prediction()
        analyses = result['root_causes']
        if not analyses:
            ds = _load_all_datasets()
            issues = _detect_recurring_issues(ds)
            analyses = _analyze_root_causes(issues, ds)
        return jsonify({'analyses': analyses, 'count': len(analyses), 'generated_at': datetime.datetime.now().isoformat(), 'from_ml': result['from_ml']})
    except Exception as e:
        return jsonify({'error': str(e), 'analyses': [], 'count': 0}), 500


@app.route('/api/predict/preventive', methods=['GET'])
def api_predict_preventive():
    try:
        result = _run_ml_or_rule_prediction()
        actions = result['preventive_actions']
        if not actions:
            ds = _load_all_datasets()
            preds = _predict_equipment_faults(ds) + _predict_mine_section_risks(ds) + _predict_ventilation_risks(ds)
            issues = _detect_recurring_issues(ds)
            actions = _generate_preventive_actions(preds, issues)
        for a in actions:
            _PREVENTIVE_ACTIONS[a['action_id']] = a
        return jsonify({'actions': actions, 'count': len(actions), 'generated_at': datetime.datetime.now().isoformat(), 'from_ml': result['from_ml']})
    except Exception as e:
        return jsonify({'error': str(e), 'actions': [], 'count': 0}), 500


@app.route('/api/predict/dashboard', methods=['GET'])
def api_predict_dashboard():
    try:
        result = _run_ml_or_rule_prediction()
        preds = result['predictions']
        issues = result['recurring_issues']
        actions = result['preventive_actions']
        total_active = len(preds)
        high_risk = len([p for p in preds if p['risk_level'] == 'HIGH'])
        critical = len([p for p in preds if p['risk_level'] == 'CRITICAL'])
        medium = len([p for p in preds if p['risk_level'] == 'MEDIUM'])
        low = len([p for p in preds if p['risk_level'] == 'LOW'])
        next_7d = len([p for p in preds if ('3 days' in p['predicted_window'] or '7 days' in p['predicted_window'])])
        next_30d = len([p for p in preds if ('14 days' in p['predicted_window'] or '30 days' in p['predicted_window'])])
        increasing_risk = len([p for p in preds if p['probability'] >= 60])
        pending_actions = len([a for a in actions if a['status'] == 'PENDING'])
        risk_by_type = defaultdict(int)
        for p in preds:
            risk_by_type[p['asset_type']] += p['probability']
        risk_by_zone = defaultdict(int)
        for p in preds:
            if p['asset_type'] == 'mine_section':
                risk_by_zone[p['asset_name']] = p['probability']
        risk_trend = []
        today = datetime.datetime.now()
        for i in range(7):
            day = today - datetime.timedelta(days=i)
            day_preds = [p for p in preds if p['created_at'][:10] == day.isoformat()[:10]]
            avg_risk = sum(p['probability'] for p in day_preds) / max(1, len(day_preds))
            risk_trend.append({'date': day.isoformat()[:10], 'avg_risk': round(avg_risk, 1), 'prediction_count': len(day_preds)})
        return jsonify({
            'summary': {'total_active_predictions': total_active, 'high_risk_count': high_risk, 'critical_count': critical, 'medium_risk_count': medium, 'low_risk_count': low, 'predicted_next_7d': next_7d, 'predicted_next_30d': next_30d, 'increasing_risk_assets': increasing_risk, 'recurring_issues': len(issues), 'preventive_actions_pending': pending_actions},
            'risk_by_category': dict(risk_by_type),
            'risk_by_zone': dict(risk_by_zone),
            'risk_trend': risk_trend,
            'generated_at': datetime.datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/predict/outcomes', methods=['POST'])
def api_predict_record_outcome():
    try:
        body = request.get_json(silent=True) or {}
        prediction_id = body.get('prediction_id', '')
        actual_occurred = body.get('actual_occurred', False)
        actual_fault_date = body.get('actual_fault_date', '')
        notes = body.get('notes', '')
        outcome = {'outcome_id': 'OUT-%s' % uuid.uuid4().hex[:8].upper(), 'prediction_id': prediction_id, 'actual_occurred': actual_occurred, 'actual_fault_date': actual_fault_date, 'notes': notes, 'recorded_at': datetime.datetime.now().isoformat(), 'prediction_correct': True}
        if prediction_id in _PREDICTIONS:
            _PREDICTIONS[prediction_id]['prediction_status'] = 'EVALUATED'
        _PREDICTION_OUTCOMES.append(outcome)
        return jsonify(outcome)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/predict/performance', methods=['GET'])
def api_predict_performance():
    try:
        total_evaluated = len(_PREDICTION_OUTCOMES)
        if total_evaluated == 0:
            return jsonify({'total_evaluated': 0, 'accuracy': None, 'message': 'No prediction outcomes recorded yet. Outcomes will appear as predictions are evaluated against actual results.', 'predictions_total': len(_PREDICTIONS), 'predictions_active': len([p for p in _PREDICTIONS.values() if p['prediction_status'] == 'ACTIVE']), 'predictions_evaluated': 0})
        correct = len([o for o in _PREDICTION_OUTCOMES if o.get('prediction_correct', True)])
        accuracy = round(correct / total_evaluated * 100, 1) if total_evaluated > 0 else None
        return jsonify({'total_evaluated': total_evaluated, 'correct_predictions': correct, 'accuracy': accuracy, 'predictions_total': len(_PREDICTIONS), 'predictions_active': len([p for p in _PREDICTIONS.values() if p['prediction_status'] == 'ACTIVE']), 'predictions_evaluated': len([p for p in _PREDICTIONS.values() if p['prediction_status'] == 'EVALUATED']), 'outcomes': _PREDICTION_OUTCOMES[-10:]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── ML Pipeline management endpoints ────────────────────────────────
@app.route('/api/predictions', methods=['GET'])
def api_predictions_list():
    try:
        result = _run_ml_or_rule_prediction()
        preds = result['predictions']
        for p in preds:
            _PREDICTIONS[p.get('prediction_id', '')] = p
        return jsonify({'predictions': preds, 'count': len(preds), 'from_ml': result['from_ml'], 'model_version': result['model_version'], 'generated_at': datetime.datetime.now().isoformat()})
    except Exception as e:
        return jsonify({'error': str(e), 'predictions': [], 'count': 0}), 500


@app.route('/api/predictions/latest', methods=['GET'])
def api_predictions_latest():
    try:
        result = _run_ml_or_rule_prediction()
        preds = result['predictions']
        for p in preds:
            _PREDICTIONS[p.get('prediction_id', '')] = p
        active = [p for p in _PREDICTIONS.values() if p.get('prediction_status') == 'ACTIVE']
        active.sort(key=lambda p: p.get('probability', 0), reverse=True)
        return jsonify({'predictions': active, 'count': len(active), 'from_ml': result['from_ml'], 'model_version': result['model_version'], 'generated_at': datetime.datetime.now().isoformat()})
    except Exception as e:
        return jsonify({'error': str(e), 'predictions': [], 'count': 0}), 500


@app.route('/api/predictions/run', methods=['POST', 'GET'])
def api_predictions_run():
    try:
        global _ML_CACHE
        # Force recompute by clearing the cache
        _ML_CACHE = {'result': None, 'timestamp': 0}
        if HAS_ML_PIPELINE and ml_pipeline is not None:
            ds = ml_load_all_datasets()
            if ml_pipeline.equipment_model is None and ml_pipeline.sensor_model is None:
                ml_pipeline.load_persisted_models()
            result = ml_pipeline.predict(ds)
            result['model_version'] = ml_pipeline.model_version
            result['from_ml'] = ml_pipeline.equipment_model is not None or ml_pipeline.sensor_model is not None
            _ML_CACHE['result'] = result
            _ML_CACHE['timestamp'] = datetime.datetime.now().timestamp()
            for p in result['predictions']:
                _PREDICTIONS[p.get('prediction_id', '')] = p
            for iss in result['recurring_issues']:
                _RECURRING_ISSUES[iss.get('issue_id', '')] = iss
            for a in result['preventive_actions']:
                _PREVENTIVE_ACTIONS[a.get('action_id', '')] = a
            return jsonify({'success': True, 'result': result, 'generated_at': datetime.datetime.now().isoformat()})
        # Fallback to rule engine
        result = _run_ml_or_rule_prediction()
        return jsonify({'success': True, 'result': result, 'from_ml': False, 'generated_at': datetime.datetime.now().isoformat()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/predictions/history', methods=['GET'])
def api_predictions_history():
    try:
        history = []
        try:
            from ml_models import _load_run_log
            history = _load_run_log()
        except Exception:
            pass
        return jsonify({'runs': history, 'count': len(history), 'generated_at': datetime.datetime.now().isoformat()})
    except Exception as e:
        return jsonify({'error': str(e), 'runs': [], 'count': 0}), 500


@app.route('/api/predictions/status', methods=['GET'])
def api_predictions_status():
    try:
        if HAS_ML_PIPELINE and ml_pipeline is not None:
            if ml_pipeline.equipment_model is None and ml_pipeline.sensor_model is None:
                ml_pipeline.load_persisted_models()
            status = ml_pipeline.get_status()
            status['from_ml'] = ml_pipeline.equipment_model is not None or ml_pipeline.sensor_model is not None
            return jsonify(status)
        return jsonify({'error': 'ML pipeline not available', 'from_ml': False, 'model_version': 'rule_engine_v1'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/predictions/train', methods=['POST'])
def api_predictions_train():
    try:
        if HAS_ML_PIPELINE and ml_pipeline is not None:
            ds = ml_load_all_datasets()
            result = ml_pipeline.train(ds)
            return jsonify(result)
        return jsonify({'success': False, 'error': 'ML pipeline not available'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/recurring-issues', methods=['GET'])
def api_recurring_issues_list():
    try:
        result = _run_ml_or_rule_prediction()
        issues = result['recurring_issues']
        for issue in issues:
            _RECURRING_ISSUES[issue.get('issue_id', '')] = issue
        return jsonify({'issues': issues, 'count': len(issues), 'from_ml': result['from_ml'], 'generated_at': datetime.datetime.now().isoformat()})
    except Exception as e:
        return jsonify({'error': str(e), 'issues': [], 'count': 0}), 500


@app.route('/api/preventive-actions', methods=['GET'])
def api_preventive_actions_list():
    try:
        result = _run_ml_or_rule_prediction()
        actions = result['preventive_actions']
        for a in actions:
            _PREVENTIVE_ACTIONS[a.get('action_id', '')] = a
        return jsonify({'actions': actions, 'count': len(actions), 'from_ml': result['from_ml'], 'generated_at': datetime.datetime.now().isoformat()})
    except Exception as e:
        return jsonify({'error': str(e), 'actions': [], 'count': 0}), 500


if __name__ == '__main__':
    # Ensure the startup banner cannot crash on consoles without UTF-8
    # support (e.g. Windows cp1252), which would otherwise abort before
    # app.run() binds the port.
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    # Load any persisted ML models at startup
    _ml_loaded = False
    if HAS_ML_PIPELINE and ml_pipeline is not None:
        try:
            ml_pipeline.load_persisted_models()
            _ml_loaded = ml_pipeline.equipment_model is not None or ml_pipeline.sensor_model is not None
        except Exception as e:
            traceback.print_exc()
    port = int(os.environ.get('ML_PORT', 5001))
    print(f'\n  MineGov ML Server  ->  http://localhost:{port}')
    print(f'  sklearn IsolationForest: {"ENABLED" if HAS_SKLEARN else "FALLBACK (z-score)"}')
    print(f'  ML prediction pipeline: {"LOADED (ML-powered)" if _ml_loaded else "AVAILABLE (rule fallback active)" if HAS_ML_PIPELINE else "NOT INSTALLED (rule engine active)"}')
    print(f'  Data dir: {DATA_DIR}')
    print(f'  Prediction engine: ENABLED\n')
    app.run(host='0.0.0.0', port=port, debug=False)


