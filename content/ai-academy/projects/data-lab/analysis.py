"""Reproducible analysis of explicitly synthetic teaching data (standard library)."""
import csv
import datetime as dt
import hashlib
import json
import math
import re
import sqlite3
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def clean_orders(path=ROOT / 'orders_raw.csv'):
    accepted, rejected, seen = [], [], set()
    with Path(path).open(newline='', encoding='utf-8') as handle:
        reader = csv.DictReader(handle)
        columns = ('order_id','date','total_kzt','promised_days','actual_days','channel','service')
        if not set(columns).issubset(reader.fieldnames or []):
            raise ValueError('data_contract_columns')
        for source in reader:
            key = source.get('order_id', '')
            if key in seen:
                rejected.append({'id': key, 'reason': 'duplicate_id'})
                continue
            try:
                if not re.fullmatch(r'O\d{3}', key):
                    raise ValueError('invalid_id')
                dt.date.fromisoformat(source['date'])
                amount = int(source['total_kzt'])
                promised, actual = int(source['promised_days']), int(source['actual_days'])
                if amount < 0 or promised < 0 or actual < 0:
                    raise ValueError('negative_value')
                if source['channel'] not in ['web', 'phone', 'referral']:
                    raise ValueError('unknown_channel')
                row = {name: source[name] for name in columns}
                row.update(total_kzt=amount, promised_days=promised, actual_days=actual, service=source['service'].strip().lower())
            except (ValueError, KeyError, TypeError):
                rejected.append({'id': key, 'reason': 'invalid_or_missing_field'})
                continue
            seen.add(key)
            accepted.append(row)
    return accepted, rejected

def database(rows=None):
    if rows is None:
        rows, _ = clean_orders()
    connection = sqlite3.connect(':memory:')
    connection.row_factory = sqlite3.Row
    connection.executescript('PRAGMA foreign_keys=ON;CREATE TABLE orders(order_id TEXT PRIMARY KEY,date TEXT,total_kzt INTEGER,promised_days INTEGER,actual_days INTEGER,channel TEXT,service TEXT);CREATE TABLE order_items(line_id TEXT PRIMARY KEY,order_id TEXT REFERENCES orders(order_id),amount_kzt INTEGER);CREATE TABLE staff_notes(note TEXT);')
    connection.executemany('INSERT INTO orders VALUES(:order_id,:date,:total_kzt,:promised_days,:actual_days,:channel,:service)', rows)
    with (ROOT / 'order_items.csv').open(newline='') as handle:
        connection.executemany('INSERT INTO order_items VALUES(:line_id,:order_id,:amount_kzt)', list(csv.DictReader(handle)))
    connection.execute('INSERT INTO staff_notes VALUES(?)', ('INTERNAL_ONLY: synthetic protected note',))
    connection.commit()
    return connection

def kpis(rows):
    count = len(rows)
    revenue = sum(row['total_kzt'] for row in rows)
    late = sum(row['actual_days'] > row['promised_days'] for row in rows)
    return {'orders': count, 'revenue_kzt': revenue, 'average_order_kzt': revenue / count if count else None, 'late_orders': late, 'delay_rate': late / count if count else None}

def read_only_sql(connection, query):
    if not isinstance(query, str) or not query.strip() or len(query) > 4000:
        raise ValueError('invalid_query')
    tables = {'orders', 'order_items'}
    def authorize(action, first, second, db, trigger):
        if action == sqlite3.SQLITE_SELECT:
            return sqlite3.SQLITE_OK
        if action == sqlite3.SQLITE_READ and first in tables:
            return sqlite3.SQLITE_OK
        if action == sqlite3.SQLITE_FUNCTION and (second or '').lower() in {'count', 'sum', 'avg', 'min', 'max'}:
            return sqlite3.SQLITE_OK
        return sqlite3.SQLITE_DENY
    previous_query_only = connection.execute('PRAGMA query_only').fetchone()[0]
    connection.execute('PRAGMA query_only=ON')
    connection.set_authorizer(authorize)
    steps = 0
    def progress():
        nonlocal steps
        steps += 1
        return int(steps > 100)
    connection.set_progress_handler(progress, 1000)
    try:
        cursor = connection.execute(query)
        rows = cursor.fetchmany(101)
        if len(rows) > 100:
            raise ValueError('row_limit')
        return [dict(row) for row in rows]
    finally:
        connection.set_progress_handler(None, 0)
        connection.set_authorizer(None)
        connection.execute('PRAGMA query_only=' + ('ON' if previous_query_only else 'OFF'))

def ab_comparison(a_n, a_successes, b_n, b_successes):
    values = [a_n, a_successes, b_n, b_successes]
    if any(type(value) is not int for value in values) or min(a_n, b_n) <= 0:
        raise ValueError('invalid_counts')
    if not 0 <= a_successes <= a_n or not 0 <= b_successes <= b_n:
        raise ValueError('invalid_counts')
    if min(a_successes, a_n-a_successes, b_successes, b_n-b_successes) < 5:
        raise ValueError('normal_approximation_not_supported')
    a, b = a_successes/a_n, b_successes/b_n
    difference = b-a
    se = math.sqrt(a*(1-a)/a_n+b*(1-b)/b_n)
    z = statistics.NormalDist().inv_cdf(0.975)
    pooled = (a_successes+b_successes)/(a_n+b_n)
    null_se = math.sqrt(pooled*(1-pooled)*(1/a_n+1/b_n))
    p_value = 2*(1-statistics.NormalDist().cdf(abs(difference/null_se)))
    return {'difference': difference, 'ci95_low': difference-z*se, 'ci95_high': difference+z*se, 'approximate_p_value': p_value, 'method': 'independent normal approximation; synthetic aggregates'}

def approximate_group_size(baseline=.5, effect=.1, alpha=.05, power=.8):
    if not 0 < baseline < 1 or not 0 < effect < 1 or baseline+effect >= 1 or not 0 < alpha < .5 or not .5 < power < 1:
        raise ValueError('invalid_power_assumptions')
    pooled = baseline+effect/2
    normal = statistics.NormalDist()
    return math.ceil(2*pooled*(1-pooled)*(normal.inv_cdf(1-alpha/2)+normal.inv_cdf(power))**2/effect**2)

def series():
    with (ROOT / 'series.csv').open(newline='') as handle:
        return [(row['date'], int(row['requests'])) for row in csv.DictReader(handle)]

def forecast(history, horizon, method):
    if len(history) < 7 or horizon < 1 or any(not isinstance(value, (int, float)) or not math.isfinite(value) for value in history):
        raise ValueError('invalid_history')
    if method == 'seasonal':
        return [history[-7+i%7] for i in range(horizon)]
    if method == 'mean':
        return [statistics.mean(history[-7:])] * horizon
    if method == 'linear':
        slope, intercept = statistics.linear_regression(range(len(history)), history)
        return [intercept+slope*(len(history)+i) for i in range(horizon)]
    raise ValueError('unknown_method')

def backtest(values, cutoff=42, horizon=7, method='seasonal'):
    if cutoff < 7 or horizon < 1 or cutoff >= len(values):
        raise ValueError('invalid_split')
    predictions, actual = [], []
    for origin in range(cutoff, len(values), horizon):
        size = min(horizon, len(values)-origin)
        predictions.extend(forecast(values[:origin], size, method))
        actual.extend(values[origin:origin+size])
    return {'mae': statistics.mean(abs(a-p) for a,p in zip(actual,predictions)), 'predictions': predictions, 'actual': actual, 'cutoff': cutoff, 'horizon': horizon, 'method': method}

def contract_fingerprint(root=ROOT):
    digest = hashlib.sha256()
    for name in ['orders_raw.csv','order_items.csv','series.csv','experiment.json','metric-dictionary.json','analysis.py']:
        digest.update(name.encode())
        digest.update((Path(root)/name).read_bytes())
    return digest.hexdigest()

def validate_report(value):
    if value.get('contract_sha256') != contract_fingerprint():
        raise ValueError('stale_report')
    return True

def report():
    rows, rejected = clean_orders()
    data = dict(kpis=kpis(rows), rows=rows, rejected=rejected, provenance='Синтетический учебный набор; не реальные наблюдения.', source_sha256=hashlib.sha256((ROOT/'orders_raw.csv').read_bytes()).hexdigest(),contract_sha256=contract_fingerprint())
    data['experiment'] = ab_comparison(50,25,50,30)
    data['backtests'] = {method: backtest([value for _,value in series()], method=method) for method in ['seasonal','mean','linear']}
    return data

if __name__ == '__main__':
    print(json.dumps(report(), ensure_ascii=False, indent=2))
