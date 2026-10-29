"""Cache Riot Data Dragon assets from a public Git mirror; no API key required."""
import concurrent.futures
import html
import json
import pathlib
import re
import ssl
import os
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
REF = 'd09a61205149f7e3488928e6b286676fb41065c4'
BASE = f'https://raw.githubusercontent.com/InFinity54/LoL_DDragon/{REF}'
CONTEXT = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE'))

def fetch(path):
    with urllib.request.urlopen(f'{BASE}/{path}', context=CONTEXT, timeout=45) as response:
        return response.read()

def clean(text):
    return html.unescape(re.sub(r'<[^>]+>', ' ', text)).strip()

roles = {
    'TOP': 'Aatrox Ambessa Aurora Camille Chogath Darius DrMundo Fiora Gangplank Garen Gnar Gragas Gwen Heimerdinger Illaoi Irelia Jax Jayce Kayle Kennen Kled KSante Malphite Mordekaiser Nasus Olaf Ornn Pantheon Poppy Quinn Renekton Riven Rumble Sett Shen Singed Sion TahmKench Teemo Trundle Tryndamere Urgot Vayne Vladimir Volibear Warwick Yasuo Yone Yorick Zaahen',
    'JUNGLE': 'Amumu Belveth Brand Briar Diana Ekko Elise Evelynn Fiddlesticks Gragas Graves Gwen Hecarim Ivern JarvanIV Jax Karthus Kayn Khazix Kindred LeeSin Lillia Maokai MasterYi MonkeyKing Morgana Naafiri Nidalee Nocturne Nunu Pantheon Poppy Rammus RekSai Rengar Sejuani Shaco Shyvana Skarner Taliyah Talon Trundle Udyr Vi Viego Volibear Warwick XinZhao Zac Zaahen',
    'MID': 'Ahri Akali Akshan Anivia Annie AurelionSol Aurora Azir Brand Cassiopeia Corki Diana Ekko Fizz Galio Heimerdinger Hwei Irelia Jayce Kassadin Katarina Kennen Leblanc Lissandra Locke Lux Malzahar Mel Naafiri Neeko Orianna Pantheon Qiyana Ryze Smolder Swain Sylas Syndra Taliyah Talon Tristana TwistedFate Veigar Velkoz Vex Viktor Vladimir Xerath Yasuo Yone Zed Ziggs Zilean Zoe',
    'ADC': 'Aphelios Ashe Caitlyn Corki Draven Ezreal Jhin Jinx Kaisa Kalista KogMaw Lucian MissFortune Nilah Samira Senna Sivir Smolder Tristana Twitch Varus Vayne Xayah Yasuo Yunara Zeri Ziggs',
    'SUPPORT': 'Alistar Bard Blitzcrank Brand Braum Galio Heimerdinger Janna Karma Leona Lulu Lux Maokai Milio Morgana Nami Nautilus Neeko Pantheon Poppy Pyke Rakan Rell Renata Senna Seraphine Shaco Sona Soraka Swain TahmKench Taric Thresh Velkoz Xerath Yuumi Zilean Zyra'
}

def main():
    data = json.loads(fetch('latest/data/ko_KR/championFull.json'))
    champs = []
    for c in data['data'].values():
        positions = [role for role, ids in roles.items() if c['id'] in ids.split()]
        if not positions:
            raise ValueError(f'Missing position: {c["id"]}')
        primary = {'Yasuo': 'MID', 'Akali': 'MID', 'Aurora': 'MID', 'Yone': 'MID', 'Vayne': 'ADC', 'Senna': 'SUPPORT', 'Brand': 'SUPPORT', 'Swain': 'MID', 'Gragas': 'JUNGLE', 'Diana': 'JUNGLE', 'Ekko': 'JUNGLE', 'Gwen': 'TOP', 'Corki': 'ADC', 'Smolder': 'ADC', 'Ziggs': 'MID'}
        if c['id'] in primary:
            positions.sort(key=lambda role: role != primary[c['id']])
        champs.append({
            'id': c['id'], 'key': c['key'], 'name': c['name'], 'title': c['title'],
            'tags': c['tags'], 'roles': positions,
            'blurb': clean(c['blurb']),
            'spells': [{'name': s['name'], 'description': clean(s['description'])} for s in c['spells']],
            'passive': {'name': c['passive']['name'], 'description': clean(c['passive']['description'])}
        })
    target = ROOT / 'public/champions'
    target.mkdir(parents=True, exist_ok=True)
    def image(c):
        file = target / f'{c["id"]}.png'
        if not file.exists():
            content = fetch(f'latest/img/champion/{c["id"]}.png')
            if not content.startswith(b'\x89PNG\r\n\x1a\n'):
                raise ValueError(f'Invalid PNG: {c["id"]}')
            file.write_bytes(content)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(image, champs))
    hero = ROOT / 'public/draft-cover.jpg'
    if not hero.exists():
        hero.write_bytes(fetch('img/champion/splash/Ahri_0.jpg'))
    output = {'version': data['version'], 'source': 'Riot Games Data Dragon',
              'mirror': 'https://github.com/InFinity54/LoL_DDragon', 'ref': REF,
              'champions': sorted(champs, key=lambda c: c['name'])}
    (ROOT / 'src/data/champions.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print(f'Cached {len(champs)} champions, Korean skills and portraits (Data Dragon {data["version"]}).')

if __name__ == '__main__':
    main()
