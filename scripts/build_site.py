"""Generate static pages from shared partials, or verify committed output."""
import argparse
import html
import json
from pathlib import Path
import re
from urllib.parse import urljoin, urlsplit

ROOT = Path(__file__).resolve().parents[1]
PAGES = ROOT / 'site/pages'
PARTIALS = ROOT / 'site/partials'
INCLUDE = re.compile(rb'<!-- @include ([a-z0-9-]+\.html) -->')
ALIASES = {'nemesis-beta.html': 'nemesis.html', 'clog-beta.html': 'collection-log.html', 'xp-records.html': 'time-records.html'}
ORIGIN = 'https://ugimps.com'
HREF = re.compile(rb'href="([^"]*)"')
SCROLL_SECTIONS = {'cumulativeSummary', 'gainCards'}


def routes(pages):
    return {name: '/' if name == 'index.html' else '/' +
            ALIASES.get(name, name).removesuffix('.html') for name in pages}


def public_links(content, name, mapping):
    def clean(match):
        raw = html.unescape(match[1].decode())
        if raw == '#':
            return match[0]
        url = urlsplit(urljoin(ORIGIN + '/docs/' + name, raw))
        if url.netloc not in {'ugimps.com', 'www.ugimps.com'}:
            return match[0]
        target = Path(url.path).name or 'index.html'
        if target not in mapping:
            return match[0]
        section = url.fragment if url.fragment in SCROLL_SECTIONS else ''
        value = mapping[target] + ('?' + url.query if url.query else '')
        if url.fragment and not section:
            value += '#' + url.fragment
        attribute = 'href="' + html.escape(value, quote=True) + '"'
        if section:
            attribute += ' data-ug-section="' + section + '"'
        return attribute.encode()
    return HREF.sub(clean, content)


def page_metadata(content, name, mapping, public):
    canonical = ORIGIN + mapping[name]
    metadata = (f'<link rel="canonical" href="{canonical}">'
                f'<meta property="og:url" content="{canonical}">'
                '<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" type="image/x-icon">'
                '<link rel="icon" href="/favicon.png" sizes="96x96" type="image/png">'
                '<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">'
                '<script src="assets/site-routes.js?v=3"></script>').encode()
    base = b'<base href="/docs/" data-ug-public>' if public else b''
    return content.replace(b'<meta charset="utf-8">',
                           b'<meta charset="utf-8">' + base + metadata, 1)


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
    sources = outputs()
    mapping = routes(sources)
    generated = {name: page_metadata(content.replace(
        b'content="index,follow"', b'content="noindex,follow"'), name, mapping, False)
        for name, content in sources.items()}
    existing = {p.name for p in (ROOT / 'docs').glob('*.html')}
    if args.check:
        assert existing == set(generated), 'Page sources and generated pages differ'
    stale = []
    for name, content in generated.items():
        target = ROOT / 'docs' / name
        if args.check:
            if not target.exists() or target.read_bytes() != content:
                stale.append(name)
        else:
            target.write_bytes(content)
    public = {name: page_metadata(public_links(content, name, mapping),
                                  name, mapping, True)
              for name, content in sources.items()}
    route_script = (ROOT / 'site/route-client.js').read_text().replace(
        '__PUBLIC_ROUTES__', json.dumps(mapping, separators=(',', ':')))
    sitemap = ('<?xml version="1.0" encoding="UTF-8"?>\n'
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
               ''.join(f'  <url><loc>{ORIGIN}{path}</loc></url>\n'
                       for path in sorted(set(mapping.values()))
                       if path != '/developer') + '</urlset>\n')
    additional = {ROOT / name: content for name, content in public.items()}
    additional.update({
        ROOT / 'docs/assets/site-routes.js': route_script.encode(),
        ROOT / 'robots.txt': f'User-agent: *\nAllow: /\nSitemap: {ORIGIN}/sitemap.xml\n'.encode(),
        ROOT / 'sitemap.xml': sitemap.encode(),
        ROOT / '.nojekyll': b'',
    })
    for target, content in additional.items():
        if args.check:
            if not target.exists() or target.read_bytes() != content:
                stale.append(str(target.relative_to(ROOT)))
        else:
            target.write_bytes(content)
    if stale:
        raise SystemExit('Run python scripts/build_site.py: ' + ', '.join(stale))
    print(f'{len(generated)} legacy and {len(public)} public pages {"verified" if args.check else "generated"}; clean feature URLs, canonical metadata, favicon links and sitemap.')


if __name__ == '__main__':
    main()
