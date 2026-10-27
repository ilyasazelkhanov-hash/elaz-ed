"""Reproducible packaging of the blank CORE workbook; Python 3 standard library."""
from pathlib import Path
import argparse
import io
import zipfile

SOURCE = Path(__file__).resolve().parent
FILES = [
    'README.md',
    'M1-basics.md',
    'M2-context.md',
    'M3-choice-cost.md',
    'M4-evidence.md',
    'prompt-template.md',
    'comparison.md',
    'run-log.csv',
    'sources-and-facts.md',
    'data-risk-register.csv',
    'cost-time-quality.md',
    'final-evidence.md',
    'examples/current-public-rules.md',
    'examples/archive-public-rules.md',
    'examples/questions.md',
    'runs/README.md',
    'pack.py',
]


def workbook_bytes():
    """Never include user-created runs, caches, secrets or a previous ZIP."""
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name in sorted(FILES):
            source = SOURCE / name
            if source.is_symlink() or not source.is_file():
                raise ValueError('Expected regular workbook file: ' + name)
            item = zipfile.ZipInfo('core-workbook/' + name, date_time=(2026, 10, 27, 0, 0, 0))
            item.compress_type = zipfile.ZIP_DEFLATED
            item.create_system = 3
            item.external_attr = 0o100644 << 16
            archive.writestr(item, source.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    data = stream.getvalue()
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        if archive.testzip() is not None:
            raise ValueError('Workbook ZIP integrity check failed')
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, help='Destination ZIP; supplied explicitly to avoid writing outside your chosen folder')
    args = parser.parse_args()
    target = Path(args.output).expanduser().resolve()
    if target.suffix.lower() != '.zip':
        parser.error('--output must end with .zip')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(workbook_bytes())
    print(f'Blank CORE workbook: {len(FILES)} files, {target.stat().st_size} bytes; no executed AI runs included.')


if __name__ == '__main__':
    main()
