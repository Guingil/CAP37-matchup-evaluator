import csv
import re
from functools import lru_cache

import requests
import plotly.graph_objects as go


CSV_PATH = "matchup_results.csv"
OUTPUT_HTML = "matchup_buckets.html"

# Give the brackets friendly names in the visualizer
BUCKET_LABELS = {
    "Switch-in": "A: Safe switch-ins",
    "Switch-in BL": "B: Borderline switch-ins",
    "Pressures": "C: Pressure targets",
    "Checks": "D: Checks",
    "Checks BL": "E: Borderline checks",
    "Counters": "F: Counters us",
}

# Force a sensible left-to-right order when present
BUCKET_ORDER = [
    "Switch-in",
    "Switch-in BL",
    "Pressures",
    "Checks",
    "Checks BL",
    "Counters",
]

# Manual sprite slug fixes for names that don't normalize cleanly
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
    """
    Reads the custom CSV format:
    - CONFIG section
    - ALL MATCHUPS section
    - optional BUCKET COUNTS section at the bottom
    """
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
    """
    Example:
      'Landorus-Therian (Defensive Pivot)' -> 'Landorus-Therian'
      'Revenankh (BulkySetup)' -> 'Revenankh'
    """
    return opponent_name.split(" (")[0].strip()


def sprite_slug(name: str) -> str:
    """
    Converts species names into Pokémon Showdown-style slugs.
    This is good enough for most CAP + modern mons, with a manual override dict.
    """
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

    # keep hyphens that are already meaningful, but remove other punctuation
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
    """
    Try modern Showdown sprite folders in order.
    """
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

    # harmless placeholder if missing
    return "https://play.pokemonshowdown.com/sprites/gen5/0.png"


def safe_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def build_hover_text(row: dict) -> str:
    opp = row.get("Opponent", "")
    bucket = row.get("Bucket", "")
    we_switch = row.get("We Switch Into Them", "")
    they_switch = row.get("They Switch Into Us", "")
    our_move = row.get("Our Best Move", "")
    our_min = row.get("Our Damage Min %", "")
    our_max = row.get("Our Damage Max %", "")
    their_move = row.get("Their Best Move", "")
    their_min = row.get("Damage Into Us Min %", "")
    their_max = row.get("Damage Into Us Max %", "")
    our_speed = row.get("Our Speed", "")
    opp_speed = row.get("Opp Speed", "")
    summary = row.get("Summary", "")

    return (
        f"<b>{opp}</b><br>"
        f"Bracket: {BUCKET_LABELS.get(bucket, bucket)}<br>"
        f"We switch into them: {we_switch}<br>"
        f"They switch into us: {they_switch}<br>"
        f"Our best move: {our_move} ({our_min}-{our_max}%)<br>"
        f"Their best move: {their_move} ({their_min}-{their_max}%)<br>"
        f"Speed: {our_speed} vs {opp_speed}<br><br>"
        f"{summary}"
    )


def build_plot(rows):
    present_buckets = []
    for bucket in BUCKET_ORDER:
        if any(r["Bucket"] == bucket for r in rows):
            present_buckets.append(bucket)

    # Include any unexpected buckets at the end
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

        x = x_map[bucket]
        y = -stack_index

        points.append(
            {
                "x": x,
                "y": y,
                "hover": build_hover_text(row),
                "sprite": get_sprite_url(row["Opponent"]),
                "species": extract_species_name(row["Opponent"]),
                "bucket": bucket,
                "our_damage_mid": (
                    safe_float(row.get("Our Damage Min %")) + safe_float(row.get("Our Damage Max %"))
                ) / 2.0,
            }
        )

    fig = go.Figure()

    # Invisible markers provide hover behavior
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

    # Sprites on top of the hover points
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

    max_height = max(counts.values()) if counts else 1

    # Soft bracket backgrounds
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

    # Named bracket headers
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
        tickfont=dict(size=12),
        range=[-0.6, len(x_map) - 0.4],
        showgrid=False,
        zeroline=False,
    )

    fig.update_yaxes(
        visible=False,
        range=[-max_height + 0.5, 1],
        showgrid=False,
        zeroline=False,
    )

    fig.update_layout(
        title="Pokémon matchup buckets",
        height=max(650, 180 + max_height * 56),
        margin=dict(l=40, r=40, t=100, b=80),
        plot_bgcolor="white",
        paper_bgcolor="white",
        hoverlabel=dict(align="left"),
    )

    return fig


def main():
    rows = load_matchups(CSV_PATH)
    fig = build_plot(rows)
    fig.write_html(OUTPUT_HTML, include_plotlyjs="cdn")
    fig.show()
    print(f"Saved interactive chart to {OUTPUT_HTML}")


if __name__ == "__main__":
    main()