import json
import sys
from analysis import ROOT,validate_report
try:
    validate_report(json.loads((ROOT/'report.json').read_text(encoding='utf-8')))
    print('Учебный отчёт соответствует текущему контракту и исходным файлам.')
except (ValueError,OSError):
    print('Отчёт отсутствует или устарел: пересобери его из текущих данных.',file=sys.stderr)
    sys.exit(1)
