/**
 * map.js — Animated Choropleth World Map
 * 
 * Phase 1: Styled placeholder with globe icon and color legend.
 * Phase 2: Real choropleth using world.geojson and iso3 matching.
 */

const MapChart = (() => {
    'use strict';

    function init(data) {
        const container = document.getElementById('chart-map');
        if (!container) return;

        // Render placeholder
        container.innerHTML = `
            <div class="map-placeholder">
                <div class="globe-icon">🌍</div>
                <div class="placeholder-text">Animated Choropleth Map</div>
                <div class="placeholder-subtext">Coming in Phase 2 — will use real data with iso3 matching</div>
                <div class="color-legend" style="margin-top: 20px;">
                    <span style="font-size: 0.7rem; color: var(--text-muted); margin-right: 8px;">Undernourishment (%):</span>
                    <div class="color-legend-item">
                        <span class="color-legend-swatch" style="background: #ffffb2;"></span> 0–5
                    </div>
                    <div class="color-legend-item">
                        <span class="color-legend-swatch" style="background: #fecc5c;"></span> 5–15
                    </div>
                    <div class="color-legend-item">
                        <span class="color-legend-swatch" style="background: #fd8d3c;"></span> 15–25
                    </div>
                    <div class="color-legend-item">
                        <span class="color-legend-swatch" style="background: #f03b20;"></span> 25–35
                    </div>
                    <div class="color-legend-item">
                        <span class="color-legend-swatch" style="background: #bd0026;"></span> 35–50
                    </div>
                    <div class="color-legend-item">
                        <span class="color-legend-swatch" style="background: #800026;"></span> &gt; 50
                    </div>
                    <div class="color-legend-item">
                        <span class="color-legend-swatch" style="background: var(--no-data);"></span> No data
                    </div>
                </div>
            </div>
        `;
    }

    function update(state, changedKeys) {
        // No-op for Phase 1 placeholder
    }

    return { init, update };
})();
