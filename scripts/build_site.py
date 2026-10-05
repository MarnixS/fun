"""Generate static pages from shared partials, or verify committed output."""
import argparse
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PAGES = ROOT / 'site/pages'
PARTIALS = ROOT / 'site/partials'
INCLUDE = re.compile(rb'<!-- @include ([a-z0-9-]+\.html) -->')
ALIASES = {'nemesis-beta.html': 'nemesis.html'}


def outputs():
    result = {}
    for source in sorted(PAGES.glob('*.html')):
        def include(match):
            return (PARTIALS / match[1].decode()).read_bytes()
        result[source.name] = INCLUDE.sub(include, source.read_bytes()).replace(
            b'href="index.html"', b'href="../"')
    for alias, original in ALIASES.items():
        result[alias] = result[original]
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    generated = outputs()
    existing = {p.name for p in (ROOT / 'docs').glob('*.html')}
    assert existing == set(generated), 'Page sources and generated pages differ'
    stale = []
    for name, content in generated.items():
        target = ROOT / 'docs' / name
        if args.check:
            if target.read_bytes() != content:
                stale.append(name)
        else:
            target.write_bytes(content)
    # Reuse the overview at the repository root without changing its URL.
    # The base keeps its static assets, data reads and page links under docs/.
    homepage = generated['index.html'].replace(
        b'<meta charset="utf-8">',
        b'<meta charset="utf-8"><base href="./docs/">', 1)
    root_index = ROOT / 'index.html'
    if args.check:
        if root_index.read_bytes() != homepage:
            stale.append('../index.html')
    else:
        root_index.write_bytes(homepage)
    if stale:
        raise SystemExit('Run python scripts/build_site.py: ' + ', '.join(stale))
    print(f'{len(generated)} static pages {"verified" if args.check else "generated"}; shared header, footer and core scripts; compatible Nemesis alias.')


if __name__ == '__main__':
    main()
