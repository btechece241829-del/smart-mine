"""
MineGov AI — PostgreSQL Persistence Server
==========================================
Flask + SQLAlchemy backend that persists the app's mutable governance state
(CAPA items, statutory documents, rule-derived alerts, audit logs, field
reports, and workflow steps) to PostgreSQL so it survives page refreshes.

Run:
    pip install -r requirements-backend.txt
    python db_server.py                # starts on http://localhost:5004

Configuration (via environment variables):
    DB_URL   - SQLAlchemy connection string.
               Default: postgresql+psycopg2://postgres:postgres@localhost:5432/minegov
    DB_PORT  - Server port (default 5004)

Graceful degradation:
    If SQLAlchemy / a PostgreSQL driver / a reachable database are unavailable,
    the server still starts. Every data endpoint returns HTTP 503 with an
    informative message. The frontend client detects this and falls back to its
    in-memory state (identical to the pre-DB behaviour), so the frontend demo
    still runs even without PostgreSQL.
"""
import os
import datetime as _dt

from flask import Flask, jsonify, request
from flask_cors import CORS

# ---------------------------------------------------------------------------
# Optional imports — allow the server to boot even without the DB stack.
# ---------------------------------------------------------------------------
try:
    from sqlalchemy import (
        create_engine, Column, Integer, String, Float, Boolean, Text,
    )
    from sqlalchemy.orm import declarative_base, sessionmaker
    HAS_SQLA = True
except Exception:  # pragma: no cover
    HAS_SQLA = False

try:
    import psycopg2  # noqa: F401
    HAS_PSYCOPG2 = True
except Exception:
    HAS_PSYCOPG2 = False

try:
    import psycopg  # noqa: F401  (psycopg 3)
    HAS_PSYCOPG = True
except Exception:
    HAS_PSYCOPG = False


BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DEFAULT_DB_URL = os.environ.get(
    'DB_URL',
    'postgresql+psycopg2://postgres:postgres@localhost:5432/minegov',
)

app = Flask(__name__)
CORS(app)

# ---------------------------------------------------------------------------
# SQLAlchemy models (created only when SQLAlchemy is importable).
# ---------------------------------------------------------------------------
if HAS_SQLA:
    Base = declarative_base()

    class CAPAItemModel(Base):
        __tablename__ = 'capa_items'
        id = Column(Integer, primary_key=True)
        action_id = Column(String, unique=True, nullable=False, index=True)
        mine_id = Column(String)
        violation_id = Column(String)
        corrective_action = Column(Text)
        assigned_to_role = Column(String)
        assigned_by_role = Column(String)
        created_at = Column(String)
        due_date = Column(String)
        completed_at = Column(String)
        status = Column(String)
        evidence_before_count = Column(Integer)
        evidence_after_count = Column(Integer)
        verification_required = Column(String)
        verified_by_role = Column(String)
        data_source = Column(String)

    class DocumentModel(Base):
        __tablename__ = 'documents'
        id = Column(Integer, primary_key=True)
        document_id = Column(String, unique=True, nullable=False, index=True)
        mine_id = Column(String)
        document_type = Column(String)
        file_name = Column(String)
        authority = Column(String)
        issue_date = Column(String)
        expiry_date = Column(String)
        uploaded_by_role = Column(String)
        uploaded_at = Column(String)
        file_path = Column(String)
        extracted_text_excerpt = Column(Text)
        ocr_used = Column(String)
        extraction_confidence = Column(Float)
        source_status = Column(String)
        linked_compliance_id = Column(String)
        data_source = Column(String)
        data_note = Column(String)
        document_name = Column(String)
        issuing_authority = Column(String)
        valid_until = Column(String)
        ocr_confidence_pct = Column(Float)
        verification_status = Column(String)
        extracted_key_phrases = Column(Text)
        file_url = Column(String)
        upload_timestamp = Column(String)
        upload_date = Column(String)

    class AlertModel(Base):
        __tablename__ = 'alerts'
        id = Column(Integer, primary_key=True)
        alert_id = Column(String, unique=True, nullable=False, index=True)
        mine_id = Column(String)
        category = Column(String)
        severity = Column(String)
        title = Column(String)
        description = Column(Text)
        action_required = Column(Text)
        source_table = Column(String)
        source_id = Column(String)
        timestamp = Column(String)
        status = Column(String)
        escalation_level = Column(String)
        acknowledged = Column(Boolean)

    class AuditLogModel(Base):
        __tablename__ = 'audit_logs'
        id = Column(Integer, primary_key=True)
        log_id = Column(String, unique=True, nullable=False, index=True)
        timestamp = Column(String)
        user_role = Column(String)
        action = Column(String)
        details = Column(Text)

    class FieldReportModel(Base):
        __tablename__ = 'field_reports'
        id = Column(Integer, primary_key=True)
        report_id = Column(String, unique=True, nullable=False, index=True)
        mine_id = Column(String)
        reporter_name = Column(String)
        reporter_role = Column(String)
        report_type = Column(String)
        title = Column(String)
        description = Column(Text)
        latitude = Column(Float)
        longitude = Column(Float)
        location_label = Column(String)
        timestamp = Column(String)
        status = Column(String)
        photo_count = Column(Integer)
        gps_accuracy_m = Column(Float)
        device_info = Column(String)

    class WorkflowStepModel(Base):
        __tablename__ = 'workflow_steps'
        id = Column(Integer, primary_key=True)
        step_id = Column(String, unique=True, nullable=False, index=True)
        workflow_id = Column(String)
        title = Column(String)
        assigned_to_role = Column(String)
        status = Column(String)
        created_at = Column(String)
        due_at = Column(String)
        completed_at = Column(String)
        sla_remaining_hrs = Column(Integer)
        is_overdue = Column(Boolean)
        category = Column(String)
        mine_id = Column(String)
        source_table = Column(String)
        source_id = Column(String)
        reminder_sent = Column(Boolean)

    MODELS = {
        'capa': CAPAItemModel,
        'documents': DocumentModel,
        'alerts': AlertModel,
        'audit_logs': AuditLogModel,
        'field_reports': FieldReportModel,
        'workflows': WorkflowStepModel,
    }

    def _assign(model, data, columns):
        """Copy the given frontend JSON fields onto a model instance."""
        for col in columns:
            if data.get(col) is not None:
                setattr(model, col, data[col])
        return model


# ---------------------------------------------------------------------------
# Engine / session — created lazily so the server can boot without a DB.
# ---------------------------------------------------------------------------
_engine = None
_Session = None
_db_error = None


def get_session():
    global _engine, _Session, _db_error
    if _Session is not None:
        return _Session
    if not HAS_SQLA:
        _db_error = 'SQLAlchemy is not installed. Run: pip install -r requirements-backend.txt'
        return None

    url = os.environ.get('DB_URL', DEFAULT_DB_URL)
    try:
        from sqlalchemy import text as _text
        _engine = create_engine(url, pool_pre_ping=True)
        Base.metadata.create_all(_engine)
        _Session = sessionmaker(bind=_engine)
        s = _Session()
        s.execute(_text('SELECT 1'))
        s.close()
        _db_error = None
        return _Session
    except Exception as e:  # pragma: no cover - depends on local env
        _Session = None
        _db_error = str(e)
        return None


def _health():
    s = get_session()
    if s is None:
        return {
            'status': 'degraded',
            'database': 'unavailable',
            'driver': 'psycopg2' if HAS_PSYCOPG2 else ('psycopg3' if HAS_PSYCOPG else 'none'),
            'sqlalchemy': HAS_SQLA,
            'error': _db_error,
        }
    return {
        'status': 'ok',
        'database': 'connected',
        'driver': 'psycopg2' if HAS_PSYCOPG2 else ('psycopg3' if HAS_PSYCOPG else 'unknown'),
        'sqlalchemy': HAS_SQLA,
    }


# ---------------------------------------------------------------------------
# Generic row helpers
# ---------------------------------------------------------------------------
def _rows(model):
    s = get_session()
    if s is None:
        return None
    try:
        rows = s.query(model).order_by(model.id.desc()).all()  # newest first
        return [row_to_dict(r) for r in rows]
    except Exception:
        return None
    finally:
        s.close()


def row_to_dict(row):
    d = {}
    for c in row.__table__.columns:
        v = getattr(row, c.name)
        if isinstance(v, (_dt.datetime, _dt.date)):
            v = v.isoformat()
        d[c.name] = v
    d.pop('id', None)
    return d


# ---------------------------------------------------------------------------
# Routes — one CRUD set per entity.
# ---------------------------------------------------------------------------
if HAS_SQLA:
    ENTITY_COLLECTIONS = {
        'capa': (CAPAItemModel, 'action_id'),
        'documents': (DocumentModel, 'document_id'),
        'alerts': (AlertModel, 'alert_id'),
        'audit_logs': (AuditLogModel, 'log_id'),
        'field_reports': (FieldReportModel, 'report_id'),
        'workflows': (WorkflowStepModel, 'step_id'),
    }
else:
    ENTITY_COLLECTIONS = {}


def _require_db():
    s = get_session()
    if s is None:
        return jsonify({'error': _db_error or 'Database unavailable',
                        'mode': 'in-memory fallback'}), 503
    return s


def _is_error_tup(resp):
    return isinstance(resp, tuple)


@app.route('/api/db/health', methods=['GET', 'OPTIONS'])
def db_health():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    return jsonify(_health())


@app.route('/api/db/<entity>', methods=['GET', 'OPTIONS'])
def list_entity(entity):
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    s = _require_db()
    if _is_error_tup(s):
        return s
    entry = ENTITY_COLLECTIONS.get(entity)
    if entry is None:
        return jsonify({'error': 'Unknown entity: %s' % entity}), 404
    model = entry[0]
    rows = _rows(model)
    if rows is None:
        return jsonify({'error': _db_error or 'Failed to query database'}), 500
    return jsonify({'items': rows, 'count': len(rows)})


@app.route('/api/db/<entity>', methods=['POST', 'OPTIONS'])
def upsert_entity(entity):
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    s = _require_db()
    if _is_error_tup(s):
        return s
    entry = ENTITY_COLLECTIONS.get(entity)
    if entry is None:
        return jsonify({'error': 'Unknown entity: %s' % entity}), 404
    model, pk = entry
    body = request.get_json(silent=True) or {}
    if not body:
        return jsonify({'error': 'Empty JSON body'}), 400
    pk_value = body.get(pk)
    if not pk_value:
        return jsonify({'error': 'Missing primary key: %s' % pk}), 400

    columns = [c.name for c in model.__table__.columns]
    row = s.query(model).filter(getattr(model, pk) == pk_value).first()
    if row is None:
        row = model()
        _assign(row, body, columns)
        s.add(row)
    else:
        _assign(row, body, columns)
    try:
        s.commit()
        s.refresh(row)
        return jsonify(row_to_dict(row)), 200
    except Exception as e:
        s.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        s.close()


@app.route('/api/db/<entity>/<pk_value>', methods=['DELETE', 'OPTIONS'])
def delete_entity(entity, pk_value):
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    s = _require_db()
    if _is_error_tup(s):
        return s
    entry = ENTITY_COLLECTIONS.get(entity)
    if entry is None:
        return jsonify({'error': 'Unknown entity: %s' % entity}), 404
    model, pk = entry
    try:
        row = s.query(model).filter(getattr(model, pk) == pk_value).first()
        if row is None:
            return jsonify({'error': 'Not found'}), 404
        s.delete(row)
        s.commit()
        return jsonify({'deleted': pk_value}), 200
    except Exception as e:
        s.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        s.close()


@app.route('/api/db/reset', methods=['DELETE', 'OPTIONS'])
def reset_db():
    """Delete all rows across all entities (used when re-ingesting a dataset)."""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    s = _require_db()
    if _is_error_tup(s):
        return s
    if not HAS_SQLA:
        return jsonify({'error': 'Models not available'}), 500
    try:
        for model in MODELS.values():
            s.query(model).delete()
        s.commit()
        return jsonify({'reset': True}), 200
    except Exception as e:
        s.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        s.close()


if __name__ == '__main__':
    port = int(os.environ.get('DB_PORT', 5004))
    print('\n  MineGov DB Server  ->  http://localhost:%d' % port)
    health = _health()
    print('  Status:', health.get('status'))
    if health.get('status') == 'degraded':
        print('  Warning:', health.get('error'))
        print('  The frontend will fall back to in-memory state until PostgreSQL is available.')
    else:
        print('  Database:', health.get('database'), '| SQLAlchemy:', health.get('sqlalchemy'))
    print()
    app.run(host='0.0.0.0', port=port, debug=False)

