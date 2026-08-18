# -*- coding: utf-8 -*-
"""Генерирует обновлённые PDF-документы Григория (только таблетки — без сиропа и
ингаляций) в стиле оригиналов. Пишет два HTML в tools/_pdfbuild/, фото вшиты как
base64. Рендер в PDF — отдельным шагом: cd e2e && node render_pdfs.js (Playwright)."""
import base64, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', '_pdfbuild'); os.makedirs(OUT, exist_ok=True)

def img(mid):
    p = os.path.join(ROOT, 'img', mid + '.jpg')
    b = base64.b64encode(open(p, 'rb').read()).decode()
    return 'data:image/jpeg;base64,' + b

# 6 таблеток (сироп AVILAC и ингаляции AEROVENT/FLIXOTIDE убраны)
TABS = [
 dict(id='esomeprazole', en='ESOMEPRAZOLE INOVAMED', ru='ЭЗОМЕПРАЗОЛ ИНОВАМЕД',
      sub='Esomeprazole 40 мг · защита желудка', warn='⚠ Внимание! Натощак, за 30–60 мин до завтрака — принять первым', red=True),
 dict(id='fusid', en='FUSID', ru='ФУСИД', sub='Furosemide 40 мг · мочегонное'),
 dict(id='forxiga', en='FORXIGA', ru='ФОРКСИГА', sub='Dapagliflozin 10 мг · для сердца / сахар'),
 dict(id='amiodacore', en='AMIODACORE', ru='АМИОДАКОР', sub='Amiodarone 200 мг · от аритмии · = AMIOCARD / PROCOR'),
 dict(id='eliquis', en='ELIQUIS', ru='ЭЛИКВИС', sub='Apixaban 5 мг · разжижает кровь',
      warn='АНТИКОАГУЛЯНТ · глотать целиком, не дробить, не пропускать', red=True),
 dict(id='lipitor', en='LIPITOR или LITORVA 40', ru='ЛИПИТОР / ЛИТОРВА', sub='Atorvastatin 40 мг · холестерин'),
]
IMGS = {m['id']: img(m['id']) for m in TABS}

CSS = """
:root{--ink:#1C2630;--muted:#697682;--line:#E2E6E9;--tab:#4F46E5;--tabbg:#ECECFD;
 --teal:#0F7C8A;--red:#CF4040;--redbg:#FBE7E7;--redink:#B42222}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:A4;margin:14mm 12mm}
body{margin:0;font-family:'Inter',system-ui,Arial,sans-serif;color:var(--ink);font-size:13px;line-height:1.4}
.h1{font-weight:900;font-size:20px;letter-spacing:.01em;display:flex;align-items:center;gap:9px}
.h1 .ic{width:30px;height:30px;border-radius:9px;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px}
.sub{font-size:12.5px;font-weight:800;color:var(--teal);margin:3px 0 0 39px;letter-spacing:.02em}
.tline{border-top:3px solid var(--ink);margin:10px 0 14px}
/* ——— Список: бейдж секции + карточки ——— */
.badge{display:inline-flex;align-items:center;gap:7px;font-weight:900;font-size:13px;border-radius:999px;padding:6px 14px;letter-spacing:.05em;margin:8px 0 10px}
.tabbadge{background:var(--tabbg);color:var(--tab)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.card{border:1.5px solid var(--line);border-radius:14px;padding:11px 12px;display:flex;gap:10px;align-items:flex-start;background:#fff;break-inside:avoid}
.card.red{border-color:#e3b1b1;background:var(--redbg)}
.card .txt{flex:1;min-width:0}
.card .en{font-weight:900;font-size:14px;line-height:1.12}
.card .ru{font-weight:800;font-size:12px;color:var(--muted);margin-top:1px}
.card .form{font-weight:800;font-size:11px;color:var(--tab);margin-top:3px;letter-spacing:.02em}
.card .ssub{font-size:11px;color:var(--muted);margin-top:2px}
.card img{width:78px;height:60px;object-fit:contain;border-radius:8px;border:1px solid var(--line);background:#fafafa;flex:0 0 auto}
/* ——— Расписание ——— */
.legend{font-size:12px;color:var(--muted);font-weight:800;margin:0 0 12px}
.legend .ti{color:var(--tab)}
.tblock{margin:0 0 14px;break-inside:avoid}
.thead{display:flex;align-items:center;gap:12px;background:#F1F4F6;border-radius:12px;padding:9px 14px}
.thead .tm{font-weight:900;font-size:26px;font-variant-numeric:tabular-nums}
.thead .per{font-weight:800;font-size:12px;color:var(--muted);letter-spacing:.12em}
.thead .cnt{margin-left:auto;font-weight:800;font-size:12px;color:var(--muted);background:#fff;border:1px solid var(--line);border-radius:999px;padding:4px 11px}
.row{display:flex;gap:11px;align-items:flex-start;border:1.5px solid var(--line);border-radius:14px;padding:11px 12px;margin-top:9px;background:#fff;break-inside:avoid}
.row.red{border-color:#e3b1b1}
.row .tic{width:30px;height:30px;border-radius:9px;background:var(--tabbg);color:var(--tab);display:flex;align-items:center;justify-content:center;flex:0 0 auto;font-weight:900}
.row .mid{flex:1;min-width:0}
.row .en{font-weight:900;font-size:16px;line-height:1.1}
.row .ru{font-weight:800;font-size:12.5px;color:var(--muted)}
.row .form{font-size:11.5px;color:var(--muted);font-weight:700;margin-top:2px}
.row .form b{color:var(--tab)}
.warnbox{margin-top:6px;border-radius:9px;padding:7px 10px;font-size:12px;font-weight:800;background:var(--redbg);color:var(--redink);line-height:1.3}
.qty{flex:0 0 auto;font-weight:900;font-size:13px;color:var(--tab);border:2.5px solid var(--tab);border-radius:11px;padding:7px 11px;white-space:nowrap;align-self:center}
.row img{width:84px;height:62px;object-fit:contain;border-radius:9px;border:1px solid var(--line);background:#fafafa;flex:0 0 auto}
"""

PILL_SVG = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="11" height="8" rx="4" transform="rotate(-45 8.5 12)"/><path d="M10.5 13.5l3-3"/></svg>'

def head_html():
    return ('<!doctype html><html lang="ru"><head><meta charset="utf-8">'
            '<link rel="preconnect" href="https://fonts.googleapis.com">'
            '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800;900&display=swap" rel="stylesheet">'
            '<style>'+CSS+'</style></head><body>')

# ---------- Список ----------
def build_spisok():
    cards = ''
    for m in TABS:
        # В оригинальном «Списке» под лекарством только вещество (предупреждения —
        # только в «Расписании»). Красную подсветку важных лекарств сохраняем.
        cards += ('<div class="card %s"><div class="txt">'
                  '<div class="en">%s</div><div class="ru">%s</div>'
                  '<div class="form">ТАБЛЕТКИ</div><div class="ssub">%s</div>'
                  '</div><img src="%s"></div>') % (
            'red' if m.get('red') else '', m['en'], m['ru'], m['sub'], IMGS[m['id']])
    html = (head_html() +
        '<div class="h1"><span class="ic">💊</span>СПИСОК ЛЕКАРСТВ — ЧТО ЭТО И КАК ВЫГЛЯДИТ</div>'
        '<div class="sub">Давать с 15 июня 2026</div><div class="tline"></div>'
        '<div class="badge tabbadge">'+PILL_SVG+' ТАБЛЕТКИ</div>'
        '<div class="grid">'+cards+'</div></body></html>')
    open(os.path.join(OUT,'spisok.html'),'w',encoding='utf-8').write(html)

# ---------- Расписание ----------
SCHEDULE = [
 dict(tm='08:00', per='УТРО', meds=[
   dict(id='esomeprazole', en='ESOMEPRAZOLE INOVAMED', ru='ЭЗОМЕПРАЗОЛ ИНОВАМЕД', form='защита желудка',
        warn='⚠ Внимание! Натощак, за 30–60 мин до завтрака — принять первым', qty='1 таблетка', red=True),
   dict(id='fusid', en='FUSID', ru='ФУСИД', form='мочегонное', qty='0.5 таблетки'),
   dict(id='forxiga', en='FORXIGA', ru='ФОРКСИГА', form='для сердца / сахар', qty='1 таблетка'),
   dict(id='amiodacore', en='AMIODACORE', ru='АМИОДАКОР', form='от аритмии · = AMIOCARD / PROCOR',
        qty='1 таблетка'),
   dict(id='eliquis', en='ELIQUIS', ru='ЭЛИКВИС', form='разжижает кровь',
        warn='АНТИКОАГУЛЯНТ · глотать целиком, не дробить, не пропускать', qty='1 таблетка', red=True),
 ]),
 dict(tm='20:00', per='ВЕЧЕР', meds=[
   dict(id='eliquis', en='ELIQUIS', ru='ЭЛИКВИС', form='разжижает кровь',
        warn='АНТИКОАГУЛЯНТ · глотать целиком, не дробить', qty='1 таблетка', red=True),
   dict(id='lipitor', en='LIPITOR или LITORVA 40', ru='ЛИПИТОР / ЛИТОРВА', form='холестерин', qty='1 таблетка'),
 ]),
]
def build_rasp():
    blocks = ''
    for b in SCHEDULE:
        rows = ''
        for m in b['meds']:
            rows += ('<div class="row %s"><span class="tic">%s</span><div class="mid">'
                     '<div class="en">%s</div><div class="ru">%s</div>'
                     '<div class="form"><b>ТАБЛЕТКИ</b> · %s</div>%s</div>'
                     '<span class="qty">%s</span><img src="%s"></div>') % (
                'red' if m.get('red') else '', PILL_SVG, m['en'], m['ru'], m['form'],
                ('<div class="warnbox">'+m['warn']+'</div>') if m.get('warn') else '',
                m['qty'], IMGS[m['id']])
        blocks += ('<div class="tblock"><div class="thead"><span class="tm">%s</span>'
                   '<span class="per">%s</span><span class="cnt">%d преп.</span></div>%s</div>') % (
            b['tm'], b['per'], len(b['meds']), rows)
    html = (head_html() +
        '<div class="h1"><span class="ic">🕐</span>ЛЕКАРСТВА — РАСПИСАНИЕ ПО ВРЕМЕНИ</div>'
        '<div class="sub">ГРИГОРИЙ РАЗУМОВСКИЙ · С 15 ИЮНЯ 2026</div><div class="tline"></div>'
        '<div class="legend">Тип: <span class="ti">'+PILL_SVG+' таблетки</span></div>'
        + blocks + '</body></html>')
    open(os.path.join(OUT,'rasp.html'),'w',encoding='utf-8').write(html)

build_spisok(); build_rasp()
print('HTML готов:', os.listdir(OUT))
