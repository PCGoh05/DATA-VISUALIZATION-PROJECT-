# Global Hunger Risk Explorer

D3.js Data Visualization dashboard for CDS6324, focused on SDG 2 Zero Hunger.

## Data

The dashboard uses:

- `data/food_security_clean.csv`
- `data/world.geojson`

Main indicator: `undernourishment_pct`

Dashboard period: 2001-2022

Missing undernourishment values are shown as "No data available" and are not converted to 0.

## Visualizations

- Animated Choropleth World Map
- Regional Trend Line Chart
- Top 10 Risk Countries Bar Chart
- Country-Year Heatmap
- Food Security Factors vs Undernourishment Scatter Plot
- Income Group Distribution / Box Plot

The scatter plot shows association, not causation.

## Run Locally

From the project folder:

```bash
python -m http.server 8000
```

Open:

```text
http://127.0.0.1:8000/
```

## GitHub Pages

The project uses relative paths for scripts, styles, CSV data, and GeoJSON, so it can run from a GitHub Pages project URL.
