import json
import sqlite3
import sys
from analysis import database, read_only_sql
if len(sys.argv) != 2:
    print('Usage: python3 query.py "SELECT ... FROM orders"',file=sys.stderr)
    sys.exit(1)
connection=database()
try:
    print(json.dumps(read_only_sql(connection,sys.argv[1]),ensure_ascii=False,indent=2))
except (ValueError,sqlite3.DatabaseError):
    print('Запрос отклонён: проверь доступные таблицы, операции и лимиты.',file=sys.stderr)
    sys.exit(1)
finally:
    connection.close()
