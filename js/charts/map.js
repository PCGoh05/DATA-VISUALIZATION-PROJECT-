/**
 * map.js — Animated Choropleth World Map
 * 
 * Real D3 choropleth using world.geojson and iso3 matching.
 * Colors countries by undernourishment_pct for the selected year.
 * Features: zoom/pan, hover tooltips, click-to-select, year animation.
 */

const MapChart = (() => {
    'use strict';

    // ── Module state ───────────────────────────────────────────────────────
    let allData = [];
    let geoData = null;
    let svg, g, projection, pathGenerator, colorScale, zoomBehavior;
    let width, height;
    let dataByIso3Year = new Map(); // key: "iso3-year" → row

    const CONTAINER_ID = 'chart-map';
    const GEOJSON_PATH = 'data/world.geojson';

    // ── ISO3 helper ────────────────────────────────────────────────────────
    function getGeoIso3(feature) {
        const p = feature.properties;
        return p.iso3
            || p['ISO_A3']
            || p['ADM0_A3']
            || p['iso_a3']
            || p['adm0_a3']
            || p['ISO3166-1-Alpha-3']
            || null;
    }

    function getGeoName(feature) {
        const p = feature.properties;
        return p.name || p.NAME || p.ADMIN || p.admin || null;
    }

    // ── Init ───────────────────────────────────────────────────────────────
    async function init(data) {
        allData = data;
        colorScale = Utils.getUndernourishmentColorScale([0, 50]);

        // Build lookup: "iso3-year" → row
        for (const row of allData) {
            if (row.iso3 && row.year != null) {
                dataByIso3Year.set(`${row.iso3}-${row.year}`, row);
            }
        }

        const container = document.getElementById(CONTAINER_ID);
        if (!container) return;

        // Clear placeholder
        container.innerHTML = '';

        const rect = container.getBoundingClientRect();
        width = rect.width;
        height = Math.max(400, rect.height);

        // Load GeoJSON
        try {
            geoData = await d3.json(GEOJSON_PATH);
        } catch (err) {
            console.error('Failed to load GeoJSON:', err);
            container.innerHTML = `<div class="map-placeholder">
                <div class="placeholder-text" style="color:var(--text-muted)">
                    Could not load world.geojson
                </div></div>`;
            return;
        }

        // Filter out Antarctica to reduce empty space at the bottom
        geoData.features = geoData.features.filter(f => getGeoName(f) !== 'Antarctica');

        // Create SVG
        svg = d3.select(`#${CONTAINER_ID}`)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('background', 'var(--bg-card)');

        g = svg.append('g');

        // Projection (fit slightly larger to reduce bottom padding)
        projection = d3.geoNaturalEarth1()
            .fitSize([width, height + 40], geoData)
            .translate([width / 2, (height / 2) - 20]);

        pathGenerator = d3.geoPath().projection(projection);

        // Zoom
        zoomBehavior = d3.zoom()
            .scaleExtent([1, 8])
            .translateExtent([[0, 0], [width, height]])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoomBehavior);

        // Draw countries
        g.selectAll('.country')
            .data(geoData.features)
            .enter()
            .append('path')
            .attr('class', 'country')
            .attr('d', pathGenerator)
            .attr('fill', Utils.getNoDataColor())
            .attr('stroke', 'rgba(255,255,255,0.15)')
            .attr('stroke-width', 0.5)
            .attr('cursor', 'pointer')
            .on('mouseenter', onMouseEnter)
            .on('mousemove', onMouseMove)
            .on('mouseleave', onMouseLeave)
            .on('click', onClick);

        // Zoom controls
        addZoomControls();

        // Legend
        drawLegend();
    }

    // ── Zoom Controls ──────────────────────────────────────────────────────
    function addZoomControls() {
        const controlsDiv = d3.select(`#${CONTAINER_ID}`)
            .append('div')
            .attr('class', 'map-zoom-controls');

        controlsDiv.append('button')
            .attr('class', 'zoom-btn')
            .attr('title', 'Zoom in')
            .html('+')
            .on('click', () => svg.transition().duration(300).call(zoomBehavior.scaleBy, 1.5));

        controlsDiv.append('button')
            .attr('class', 'zoom-btn')
            .attr('title', 'Zoom out')
            .html('−')
            .on('click', () => svg.transition().duration(300).call(zoomBehavior.scaleBy, 0.67));

        controlsDiv.append('button')
            .attr('class', 'zoom-btn')
            .attr('title', 'Reset zoom')
            .html('⟲')
            .on('click', () => svg.transition().duration(500).call(zoomBehavior.transform, d3.zoomIdentity));
    }

    // ── Legend ──────────────────────────────────────────────────────────────
    function drawLegend() {
        const legendWidth = 180;
        const legendHeight = 10;

        const legendGroup = svg.append('g')
            .attr('class', 'map-legend')
            .attr('transform', `translate(10, ${height - 35})`);

        // Gradient
        const defs = svg.append('defs');
        const linearGradient = defs.append('linearGradient')
            .attr('id', 'map-gradient');

        const stops = d3.range(0, 1.01, 0.2);
        linearGradient.selectAll('stop')
            .data(stops)
            .enter().append('stop')
            .attr('offset', d => d * 100 + '%')
            .attr('stop-color', d => colorScale(d * 50));

        legendGroup.append('rect')
            .attr('width', legendWidth)
            .attr('height', legendHeight)
            .attr('fill', 'url(#map-gradient)')
            .attr('rx', 2);

        legendGroup.append('text')
            .attr('x', legendWidth / 2).attr('y', -6)
            .attr('text-anchor', 'middle')
            .style('font-size', '0.7rem')
            .style('fill', 'var(--text-primary)')
            .style('font-weight', '500')
            .text('Undernourishment (%)');

        legendGroup.append('text')
            .attr('x', 0).attr('y', 22)
            .style('font-size', '0.6rem')
            .style('fill', 'var(--text-secondary)')
            .text('Low risk');

        legendGroup.append('text')
            .attr('x', legendWidth).attr('y', 22)
            .attr('text-anchor', 'end')
            .style('font-size', '0.6rem')
            .style('fill', 'var(--text-secondary)')
            .text('High risk');

        // No data swatch
        legendGroup.append('rect')
            .attr('x', legendWidth + 20).attr('y', 0)
            .attr('width', legendHeight).attr('height', legendHeight)
            .attr('fill', Utils.getNoDataColor()).attr('rx', 2)
            .attr('stroke', 'rgba(255,255,255,0.1)');

        legendGroup.append('text')
            .attr('x', legendWidth + 34).attr('y', 9)
            .style('font-size', '0.6rem')
            .style('fill', 'var(--text-secondary)')
            .text('No data');
    }

    // ── Color Update ───────────────────────────────────────────────────────
    function updateColors(state, animate = true) {
        if (!g) return;

        const t = animate ? d3.transition().duration(400) : null;

        g.selectAll('.country')
            .each(function (feature) {
                const iso3 = getGeoIso3(feature);
                const row = iso3 ? dataByIso3Year.get(`${iso3}-${state.selectedYear}`) : null;

                const fillColor = (row && row.undernourishment_pct != null)
                    ? colorScale(row.undernourishment_pct)
                    : Utils.getNoDataColor();

                const isSelected = state.selectedCountry && state.selectedCountry === iso3;

                const el = d3.select(this);
                if (animate) {
                    el.transition(t)
                        .attr('fill', fillColor)
                        .attr('stroke', isSelected ? 'var(--accent-gold)' : 'rgba(255,255,255,0.15)')
                        .attr('stroke-width', isSelected ? 2 : 0.5);
                } else {
                    el.attr('fill', fillColor)
                        .attr('stroke', isSelected ? 'var(--accent-gold)' : 'rgba(255,255,255,0.15)')
                        .attr('stroke-width', isSelected ? 2 : 0.5);
                }
            });
    }

    // ── Mouse Events ───────────────────────────────────────────────────────
    function onMouseEnter(event, feature) {
        d3.select(this)
            .attr('stroke', 'var(--text-primary)')
            .attr('stroke-width', 1.5)
            .raise();

        const iso3 = getGeoIso3(feature);
        const state = DashboardState.getState();
        const row = iso3 ? dataByIso3Year.get(`${iso3}-${state.selectedYear}`) : null;

        const countryName = (row && row.country_name) || getGeoName(feature) || 'Unknown';
        const undernourishment = (row && row.undernourishment_pct != null)
            ? Utils.formatValue(row.undernourishment_pct) + '%' : 'No data available';
        const foodProd = (row && row.food_production_index != null)
            ? Utils.formatValue(row.food_production_index) : 'No data available';
        const region = (row && row.region) || 'No data available';

        const html = `
            <strong>${countryName}</strong> (${state.selectedYear})<br>
            <span class="tt-label">Region:</span> <span class="tt-value">${region}</span><br>
            <span class="tt-label">Undernourishment:</span> <span class="tt-value">${undernourishment}</span><br>
            <span class="tt-label">Food Prod. Index:</span> <span class="tt-value">${foodProd}</span>
        `;
        Utils.showTooltip(event, html);
    }

    function onMouseMove(event) {
        Utils.getTooltip()
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 10) + 'px');
    }

    function onMouseLeave(event, feature) {
        const iso3 = getGeoIso3(feature);
        const state = DashboardState.getState();
        const isSelected = state.selectedCountry && state.selectedCountry === iso3;

        d3.select(this)
            .attr('stroke', isSelected ? 'var(--accent-gold)' : 'rgba(255,255,255,0.15)')
            .attr('stroke-width', isSelected ? 2 : 0.5);

        Utils.hideTooltip();
    }

    function onClick(event, feature) {
        const iso3 = getGeoIso3(feature);
        if (!iso3) return;

        const state = DashboardState.getState();
        if (state.selectedCountry === iso3) {
            DashboardState.setState({ selectedCountry: null });
        } else {
            DashboardState.setState({ selectedCountry: iso3 });
        }
    }

    // ── Update ─────────────────────────────────────────────────────────────
    function update(state, changedKeys) {
        if (!svg || !geoData) return;

        const needsColorUpdate = changedKeys.some(k =>
            ['selectedYear', 'selectedCountry', 'selectedRegion', '_resize', '_init'].includes(k)
        );

        if (needsColorUpdate) {
            updateColors(state, true);
        }

        if (changedKeys.includes('selectedCountry') || changedKeys.includes('_init')) {
            if (state.selectedCountry) {
                zoomToCountry(state.selectedCountry);
            } else {
                svg.transition().duration(750).call(zoomBehavior.transform, d3.zoomIdentity);
            }
        }
    }

    function zoomToCountry(iso3) {
        if (!g || !geoData) return;
        const feature = geoData.features.find(f => getGeoIso3(f) === iso3);
        if (!feature) return;

        const bounds = pathGenerator.bounds(feature);
        const dx = bounds[1][0] - bounds[0][0];
        const dy = bounds[1][1] - bounds[0][1];
        const x = (bounds[0][0] + bounds[1][0]) / 2;
        const y = (bounds[0][1] + bounds[1][1]) / 2;

        const scale = Math.max(1, Math.min(8, 0.5 / Math.max(dx / width, dy / height)));
        const translate = [width / 2 - scale * x, height / 2 - scale * y];

        svg.transition().duration(750).call(
            zoomBehavior.transform,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
    }

    return { init, update };
})();

