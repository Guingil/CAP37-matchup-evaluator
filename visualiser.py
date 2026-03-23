import csv
import re
from functools import lru_cache

import requests
import plotly.graph_objects as go


CSV_PATH = "matchup_results.csv"
OUTPUT_HTML = "index.html"

BUCKET_LABELS = {
    "Switch-in": "Safe switch-ins",
    "Switch-in BL": "Borderline switch-ins",
    "Pressures": "Pressure targets",
    "Checks BL": "Borderline checks",
    "Checks": "Checks",
    "Counters": "Counters us",
}

# BL checks goes before checks
BUCKET_ORDER = [
    "Switch-in",
    "Switch-in BL",
    "Pressures",
    "Checks BL",
    "Checks",
    "Counters",
]

SPECIAL_CASES = {
    "Tapu Koko": "tapukoko",
    "Tapu Lele": "tapulele",
    "Tapu Fini": "tapufini",
    "Tapu Bulu": "tapubulu",
    "Great Tusk": "greattusk",
    "Iron Valiant": "ironvaliant",
    "Iron Moth": "ironmoth",
    "Iron Boulder": "ironboulder",
    "Iron Crown": "ironcrown",
    "Iron Hands": "ironhands",
    "Iron Jugulis": "ironjugulis",
    "Iron Leaves": "ironleaves",
    "Iron Thorns": "ironthorns",
    "Iron Treads": "irontreads",
    "Roaring Moon": "roaringmoon",
    "Walking Wake": "walkingwake",
    "Raging Bolt": "ragingbolt",
    "Gouging Fire": "gougingfire",
    "Scream Tail": "screamtail",
    "Flutter Mane": "fluttermane",
    "Slither Wing": "slitherwing",
    "Sandy Shocks": "sandyshocks",
    "Brute Bonnet": "brutebonnet",
    "Wo-Chien": "wochien",
    "Chien-Pao": "chienpao",
    "Ting-Lu": "tinglu",
    "Chi-Yu": "chiyu",
    "Mr. Mime": "mrmime",
    "Mr. Rime": "mrrime",
    "Mime Jr.": "mimejr",
    "Type: Null": "typenull",
    "Jangmo-o": "jangmoo",
    "Hakamo-o": "hakamoo",
    "Kommo-o": "kommoo",
    "Ho-Oh": "ho-oh",
    "Porygon-Z": "porygonz",
    "Farfetch’d": "farfetchd",
    "Sirfetch’d": "sirfetchd",
}


def load_matchups(path: str):
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    start_idx = None
    for i, line in enumerate(lines):
        if line.strip() == "ALL MATCHUPS":
            start_idx = i + 1
            break

    if start_idx is None:
        raise ValueError("Could not find 'ALL MATCHUPS' section")

    table_lines = []
    for line in lines[start_idx:]:
        if line.strip() == "BUCKET COUNTS":
            break
        if not line.strip():
            continue
        table_lines.append(line)

    reader = csv.DictReader(table_lines)
    rows = [row for row in reader if row.get("Opponent")]
    return rows


def extract_species_name(opponent_name: str) -> str:
    return opponent_name.split(" (")[0].strip()


def sprite_slug(name: str) -> str:
    if name in SPECIAL_CASES:
        return SPECIAL_CASES[name]

    slug = name.strip()
    slug = slug.replace("’", "")
    slug = slug.replace("'", "")
    slug = slug.replace(".", "")
    slug = slug.replace(":", "")
    slug = slug.replace("%", "")
    slug = slug.replace("♀", "-f")
    slug = slug.replace("♂", "-m")
    slug = slug.lower()
    slug = re.sub(r"[^a-z0-9\- ]+", "", slug)
    slug = slug.replace(" ", "-")
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


SPRITE_BASES = [
    "https://play.pokemonshowdown.com/sprites/dex/",
    "https://play.pokemonshowdown.com/sprites/home-centered/",
]


@lru_cache(maxsize=None)
def get_sprite_url(opponent_name: str) -> str:
    species = extract_species_name(opponent_name)
    slug = sprite_slug(species)

    for base in SPRITE_BASES:
        url = f"{base}{slug}.png"
        try:
            r = requests.head(url, timeout=3, allow_redirects=True)
            if r.status_code == 200:
                return url
        except requests.RequestException:
            pass

    return "https://play.pokemonshowdown.com/sprites/gen5/0.png"


def build_hover_text(row: dict) -> str:
    opponent_full = row.get("Opponent", "")
    species = extract_species_name(opponent_full)
    evs = row.get("Opp EVs", "N/A")
    nature = row.get("Opp Nature", "N/A")
    bucket = row.get("Bucket", "")

    return (
        f"<b>{species}</b><br>"
        f"Our move: {row.get('Our Best Move', '')} "
        f"({row.get('Our Damage Min %', '')}-{row.get('Our Damage Max %', '')}%)<br>"
        f"Their move: {row.get('Their Best Move', '')} "
        f"({row.get('Damage Into Us Min %', '')}-{row.get('Damage Into Us Max %', '')}%)<br>"
        f"Speed: {row.get('Our Speed', '')} vs {row.get('Opp Speed', '')}<br><br>"
        f"{row.get('Summary', '')}"
    )


def build_plot(rows):
    present_buckets = []
    for bucket in BUCKET_ORDER:
        if any(r["Bucket"] == bucket for r in rows):
            present_buckets.append(bucket)

    for r in rows:
        if r["Bucket"] not in present_buckets:
            present_buckets.append(r["Bucket"])

    x_map = {bucket: i for i, bucket in enumerate(present_buckets)}
    counts = {bucket: 0 for bucket in present_buckets}
    points = []

    for row in rows:
        bucket = row["Bucket"]
        stack_index = counts[bucket]
        counts[bucket] += 1

        points.append(
            {
                "x": x_map[bucket],
                "y": -stack_index,
                "hover": build_hover_text(row),
                "sprite": get_sprite_url(row["Opponent"]),
                "species": extract_species_name(row["Opponent"]),
            }
        )

    fig = go.Figure()

    fig.add_trace(
        go.Scatter(
            x=[p["x"] for p in points],
            y=[p["y"] for p in points],
            mode="markers",
            marker=dict(size=52, opacity=0),
            text=[p["hover"] for p in points],
            hovertemplate="%{text}<extra></extra>",
            showlegend=False,
        )
    )

    for p in points:
        fig.add_layout_image(
            dict(
                source=p["sprite"],
                xref="x",
                yref="y",
                x=p["x"],
                y=p["y"],
                sizex=0.72,
                sizey=0.72,
                xanchor="center",
                yanchor="middle",
                layer="above",
            )
        )

        fig.add_annotation(
            x=p["x"],
            y=p["y"] - 0.48,
            xref="x",
            yref="y",
            text=p["species"],
            showarrow=False,
            font=dict(size=10),
            xanchor="center",
            yanchor="top",
        )

    max_height = max(counts.values()) if counts else 1

    for bucket, x in x_map.items():
        fig.add_shape(
            type="rect",
            x0=x - 0.45,
            x1=x + 0.45,
            y0=0,
            y1=1,
            yref="paper",
            fillcolor="rgba(0,0,0,0.03)",
            line_width=0,
            layer="below",
        )

    for bucket, x in x_map.items():
        fig.add_annotation(
            x=x,
            y=1,
            xref="x",
            yref="paper",
            yshift=24,
            showarrow=False,
            text=f"<b>{BUCKET_LABELS.get(bucket, bucket)}</b>",
            font=dict(size=14),
            align="center",
        )

    fig.update_xaxes(
        tickmode="array",
        tickvals=list(x_map.values()),
        ticktext=[BUCKET_LABELS.get(b, b) for b in x_map.keys()],
        range=[-0.6, len(x_map) - 0.4],
        showgrid=False,
        zeroline=False,
    )

    fig.update_yaxes(
        visible=False,
        range=[-max_height - 0.8, 1],
        showgrid=False,
        zeroline=False,
    )

    fig.update_layout(
        title="Pokémon matchup buckets",
        height=max(750, 220 + max_height * 78),
        margin=dict(l=40, r=40, t=100, b=80),
        plot_bgcolor="white",
        paper_bgcolor="white",
        hoverlabel=dict(align="left"),
    )

    return fig


def save_index_html(fig, output_path: str):
    plot_html = fig.to_html(
        include_plotlyjs=True,
        full_html=False,
        config={"responsive": True},
    )

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>CAP37 matchup buckets - </title>
  <style>
    html, body {{
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-family: Arial, sans-serif;
    }}
    .page {{
      max-width: 1600px;
      margin: 0 auto;
      padding: 16px;
    }}
    h1 {{
      margin: 0 0 12px 0;
      font-size: 24px;
    }}
    p {{
      margin: 0 0 16px 0;
      color: #444;
    }}
  </style>
</head>
<body>
  <div class="page">
    <h1>Pokémon matchup buckets</h1>
    <p> Yveltal - impish, hp: 252, atk: 0, def: 252, spa: 0, spd: 0, spe: 4,  moves: Beak Blast, Knock Off, Taunt, Roost</p>
    <p>Hover over an icon to see the calc summary, and matchup explanation.</p>
    {plot_html}
  </div>
</body>
</html>
"""
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)


def main():
    rows = load_matchups(CSV_PATH)
    fig = build_plot(rows)
    save_index_html(fig, OUTPUT_HTML)
    print(f"Saved to {OUTPUT_HTML}")


if __name__ == "__main__":
    main()