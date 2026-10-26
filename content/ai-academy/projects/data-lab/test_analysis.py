import unittest
import sqlite3
import tempfile
from pathlib import Path
from analysis import clean_orders, database, kpis, read_only_sql, ab_comparison, series, forecast, backtest, report, validate_report, approximate_group_size

class AnalysisTests(unittest.TestCase):
    def test_breaking_headers_fail_and_unknown_fields_are_not_exported(self):
        with tempfile.TemporaryDirectory() as root:
            file = Path(root)/'example.csv'
            file.write_text('order_id,amount\nO001,1000\n',encoding='utf-8')
            with self.assertRaisesRegex(ValueError,'data_contract_columns'):
                clean_orders(file)
            file.write_text('order_id,date,total_kzt,promised_days,actual_days,channel,service,private_field\nO001,2026-09-01,1000,1,1,web,repair,FICTIONAL_PRIVATE\n',encoding='utf-8')
            accepted, _ = clean_orders(file)
            self.assertNotIn('private_field',accepted[0])
            file.write_text('order_id,date,total_kzt,promised_days,actual_days,channel,service\nO001\n',encoding='utf-8')
            accepted, rejected = clean_orders(file)
            self.assertEqual(accepted, [])
            self.assertEqual(len(rejected), 1)

    def test_dirty_rows_have_explicit_outcomes(self):
        rows, rejected = clean_orders()
        self.assertEqual(len(rows), 8)
        self.assertEqual(len(rejected), 3)
        self.assertEqual(kpis(rows)['revenue_kzt'], 13500)
        self.assertEqual(kpis(rows)['average_order_kzt'], 1687.5)
        self.assertEqual(kpis(rows)['delay_rate'], .5)
        self.assertEqual(rows[5]['service'], 'repair')

    def test_join_can_double_header_revenue(self):
        connection = database()
        try:
            inflated = connection.execute('SELECT sum(o.total_kzt) FROM orders o JOIN order_items i USING(order_id)').fetchone()[0]
            proper = connection.execute('SELECT sum(total_kzt) FROM orders').fetchone()[0]
            self.assertEqual(inflated, 20000)
            self.assertEqual(proper, 13500)
            lines = connection.execute('SELECT sum(amount_kzt) FROM order_items').fetchone()[0]
            self.assertEqual(lines, proper)
            with self.assertRaises(sqlite3.IntegrityError):
                connection.execute("INSERT INTO order_items VALUES('ORPHAN','O999',1)")
        finally:
            connection.close()

    def test_read_only_guard_blocks_writes_private_tables_and_attach(self):
        connection = database()
        try:
            self.assertEqual(read_only_sql(connection, 'SELECT sum(total_kzt) AS revenue FROM orders')[0]['revenue'], 13500)
            for query in ['DROP TABLE orders', 'SELECT * FROM staff_notes', "ATTACH DATABASE ':memory:' AS another", 'PRAGMA table_info(orders)']:
                with self.assertRaises(sqlite3.DatabaseError):
                    read_only_sql(connection, query)
            self.assertEqual(connection.execute('SELECT count(*) FROM orders').fetchone()[0], 8)
            connection.execute('PRAGMA query_only=ON')
            read_only_sql(connection, 'SELECT count(*) AS n FROM orders')
            self.assertEqual(connection.execute('PRAGMA query_only').fetchone()[0], 1)
        finally:
            connection.close()

    def test_read_only_guard_limits_rows(self):
        connection = database()
        try:
            with self.assertRaises((ValueError, sqlite3.OperationalError)):
                read_only_sql(connection, 'SELECT a.order_id FROM orders a CROSS JOIN orders b CROSS JOIN orders c')
            with self.assertRaises(sqlite3.OperationalError):
                read_only_sql(connection, 'SELECT count(*) FROM orders a CROSS JOIN orders b CROSS JOIN orders c CROSS JOIN orders d CROSS JOIN orders e CROSS JOIN orders f')
        finally:
            connection.close()

    def test_uncertainty_and_approximation_conditions(self):
        result = ab_comparison(50,25,50,30)
        self.assertAlmostEqual(result['difference'], .1)
        self.assertLess(result['ci95_low'], 0)
        self.assertGreater(result['ci95_high'], 0)
        self.assertGreater(result['approximate_p_value'], .05)
        with self.assertRaises(ValueError):
            ab_comparison(5,1,5,2)

    def test_forecast_uses_only_given_history(self):
        values = [value for _,value in series()]
        original = backtest(values)
        altered = list(values)
        altered[42:] = [9999]*14
        changed = backtest(altered)
        self.assertEqual(original['predictions'][:7], changed['predictions'][:7])
        self.assertNotEqual(original['actual'][:7], changed['actual'][:7])
        self.assertEqual(len(original['predictions']),14)
        self.assertLess(original['mae'],backtest(values,method='mean')['mae'])
        with self.assertRaises(ValueError):
            forecast([],7,'seasonal')

    def test_smaller_effect_requires_more_participants_under_same_assumptions(self):
        original = approximate_group_size()
        self.assertGreater(original, 50)
        self.assertGreater(approximate_group_size(effect=.05), original)
        self.assertGreater(approximate_group_size(power=.9), original)
        with self.assertRaises(ValueError):
            approximate_group_size(effect=0)

    def test_sql_eval_distinguishes_permission_from_semantic_error(self):
        from evaluate_sql import evaluate
        results = {row['id']: row for row in evaluate()}
        self.assertFalse(results['wrong-join']['denied'])
        self.assertFalse(results['wrong-join']['semantic_match'])
        self.assertTrue(results['private']['denied'])
        self.assertTrue(results['revenue']['semantic_match'])

    def test_stale_report_is_not_accepted_as_current(self):
        current = report()
        self.assertTrue(validate_report(current))
        current['contract_sha256'] = 'old-contract'
        with self.assertRaises(ValueError):
            validate_report(current)

if __name__ == '__main__':
    unittest.main()
