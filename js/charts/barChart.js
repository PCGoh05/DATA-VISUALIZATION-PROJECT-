/**
 * barChart.js — Top 10 Risk Countries Bar Chart
 * 
 * Shows horizontal bars for the top 10 countries by selected metric
 * for the current year and region. Supports three ranking modes:
 *   - Highest Undernourishment (undernourishment_pct descending)
 *   - Most Improved (undernourishment_yoy_change_pp, most negative)
 *   - Most Worsened (undernourishment_yoy_change_pp, most positive)
 * 
 * Features: animated bar transitions, gradient fills, hover tooltips,
 * click-to-select country, selected country highlight, linked state.
 */

const BarChart = (() => {
    'use strict';

    // ── Module state ───────────────────────────────────────────────────────
    let allData = [];
    let svg, g, xScale, yScale, colorScale;
    let width, height;
    let currentSortMode = 'highest';

    const margin = { top: 10, right: 60, bottom: 30, left: 130 };
    const CONTAINER_ID = 'chart-bar';
    const BAR_COUNT = 10;

    // ── Init ───────────────────────────────────────────────────────────────
    function init(data) {
        allData = data;
        colorScale = Utils.getUndernourishmentColorScale([0, 50]);

        const container = document.getElementById(CONTAINER_ID);
        if (!container) return;

        const rect = container.getBoundingClientRect();
        width = rect.width - margin.left - margin.right;
        height = Math.max(250, rect.height - margin.top - margin.bottom);

        svg = d3.select(`#${CONTAINER_ID}`)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Scales
        xScale = d3.scaleLinear().range([0, width]);
        yScale = d3.scaleBand().range([0, height]).padding(0.2);

        // Axes groups
        g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${height})`);
        g.append('g').attr('class', 'y-axis');

        // Wire up sort mode dropdown
        const sortSelect = document.getElementById('barSortMode');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                currentSortMode = sortSelect.value;
                const state = DashboardState.getState();
                renderBars(state);
            });
        }

        // Create gradient definition for bars
        const defs = svg.append('defs');
        const gradient = defs.append('linearGradient')
            .attr('id', 'bar-gradient')
            .attr('x1', '0%').attr('y1', '0%')
            .attr('x2', '100%').attr('y2', '0%');
        gradient.append('stop').attr('offset', '0%').attr('stop-color', '#fbbf24');
        gradient.append('stop').attr('offset', '100%').attr('stop-color', '#ef4444');
    }

    // ── Get Top 10 Data ────────────────────────────────────────────────────
    function getTopCountries(state) {
        // Filter by year and region
        let filtered = allData.filter(d => d.year === state.selectedYear);
        if (state.selectedRegion !== 'All') {
            filtered = filtered.filter(d => d.region === state.selectedRegion);
        }

        let ranked;

        if (currentSortMode === 'highest') {
            // Sort by undernourishment_pct descending — exclude missing
            ranked = filtered
                .filter(d => d.undernourishment_pct != null)
                .sort((a, b) => b.undernourishment_pct - a.undernourishment_pct)
                .slice(0, BAR_COUNT)
                .map((d, i) => ({
                    iso3: d.iso3,
                    country_name: d.country_name,
                    region: d.region,
                    value: d.undernourishment_pct,
                    rank: i + 1,
                    label: Utils.formatValue(d.undernourishment_pct) + '%',
                    metricName: 'Undernourishment'
                }));
        } else if (currentSortMode === 'improved') {
            // Most Improved: most negative yoy_change → greatest improvement
            // Filter to only negative values (actual improvements) and use absolute magnitude for bars
            ranked = filtered
                .filter(d => d.undernourishment_yoy_change_pp != null && d.undernourishment_yoy_change_pp < 0)
                .sort((a, b) => a.undernourishment_yoy_change_pp - b.undernourishment_yoy_change_pp)
                .slice(0, BAR_COUNT)
                .map((d, i) => ({
                    iso3: d.iso3,
                    country_name: d.country_name,
                    region: d.region,
                    value: Math.abs(d.undernourishment_yoy_change_pp),  // positive magnitude for bar width
                    rawValue: d.undernourishment_yoy_change_pp,
                    rank: i + 1,
                    label: d.undernourishment_yoy_change_pp.toFixed(1) + ' pp',  // original negative value
                    metricName: 'YoY Change'
                }));
        } else {
            // Most Worsened: most positive yoy_change → greatest worsening
            // Filter to only positive values (actual worsening)
            ranked = filtered
                .filter(d => d.undernourishment_yoy_change_pp != null && d.undernourishment_yoy_change_pp > 0)
                .sort((a, b) => b.undernourishment_yoy_change_pp - a.undernourishment_yoy_change_pp)
                .slice(0, BAR_COUNT)
                .map((d, i) => ({
                    iso3: d.iso3,
                    country_name: d.country_name,
                    region: d.region,
                    value: d.undernourishment_yoy_change_pp,  // already positive
                    rawValue: d.undernourishment_yoy_change_pp,
                    rank: i + 1,
                    label: '+' + d.undernourishment_yoy_change_pp.toFixed(1) + ' pp',
                    metricName: 'YoY Change'
                }));
        }

        return ranked;
    }

    // ── Render Bars ────────────────────────────────────────────────────────
    function renderBars(state) {
        if (!g) return;

        const data = getTopCountries(state);

        // Update scales
        const maxVal = d3.max(data, d => d.value) || 10;
        xScale.domain([0, maxVal * 1.15]);
        yScale.domain(data.map(d => d.country_name));

        // Transition duration
        const t = d3.transition().duration(500).ease(d3.easeCubicOut);

        // ── X Axis ──
        g.select('.x-axis')
            .transition(t)
            .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => {
                if (currentSortMode === 'highest') return d + '%';
                return d.toFixed(1) + ' pp';
            }));

        // ── Y Axis ──
        g.select('.y-axis')
            .transition(t)
            .call(d3.axisLeft(yScale).tickSize(0).tickPadding(8));

        // Style y-axis labels
        g.select('.y-axis').selectAll('.tick text')
            .style('fill', 'var(--text-secondary)')
            .style('font-size', '0.72rem');

        // Remove domain line on y-axis
        g.select('.y-axis .domain').attr('stroke', 'transparent');

        // ── Bars ──
        const bars = g.selectAll('.bar')
            .data(data, d => d.iso3);

        // EXIT
        bars.exit()
            .transition(t)
            .attr('width', 0)
            .attr('opacity', 0)
            .remove();

        // ENTER
        const barsEnter = bars.enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', 0)
            .attr('y', d => yScale(d.country_name))
            .attr('width', 0)
            .attr('height', yScale.bandwidth())
            .attr('rx', 3)
            .attr('ry', 3)
            .attr('cursor', 'pointer');

        // ENTER + UPDATE
        const barsAll = barsEnter.merge(bars);

        barsAll
            .on('click', (event, d) => {
                DashboardState.setState({ selectedCountry: d.iso3 });
            })
            .on('mouseenter', function (event, d) {
                d3.select(this).attr('opacity', 0.85);

                const html = `
                    <strong>${d.country_name}</strong><br>
                    <span class="tt-label">Year:</span> <span class="tt-value">${state.selectedYear}</span><br>
                    <span class="tt-label">Region:</span> <span class="tt-value">${d.region || 'No data'}</span><br>
                    <span class="tt-label">${d.metricName}:</span> <span class="tt-value">${d.label}</span><br>
                    <span class="tt-label">Rank:</span> <span class="tt-value">#${d.rank}</span>
                `;
                Utils.showTooltip(event, html);
            })
            .on('mousemove', (event) => {
                Utils.showTooltip(event, null); // reposition
                const tip = Utils.getTooltip();
                tip.style('left', (event.pageX + 15) + 'px')
                   .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseleave', function () {
                const selectedCountry = DashboardState.getState().selectedCountry;
                const d = d3.select(this).datum();
                d3.select(this).attr('opacity', d.iso3 === selectedCountry ? 1 : 0.9);
                Utils.hideTooltip();
            })
            .transition(t)
            .attr('y', d => yScale(d.country_name))
            .attr('height', yScale.bandwidth())
            .attr('width', d => Math.max(0, xScale(d.value)))
            .attr('fill', d => {
                if (currentSortMode === 'highest') {
                    return colorScale(d.value);
                } else if (currentSortMode === 'improved') {
                    return '#22c55e'; // green for improvement
                } else {
                    return '#ef4444'; // red for worsening
                }
            })
            .attr('opacity', 0.9);

        // ── Value Labels ──
        const labels = g.selectAll('.bar-label')
            .data(data, d => d.iso3);

        labels.exit()
            .transition(t)
            .attr('opacity', 0)
            .remove();

        const labelsEnter = labels.enter()
            .append('text')
            .attr('class', 'bar-label')
            .attr('opacity', 0);

        labelsEnter.merge(labels)
            .transition(t)
            .attr('x', d => xScale(d.value) + 6)
            .attr('y', d => yScale(d.country_name) + yScale.bandwidth() / 2)
            .attr('dy', '0.35em')
            .style('fill', 'var(--text-secondary)')
            .style('font-size', '0.7rem')
            .style('font-weight', '500')
            .text(d => d.label)
            .attr('opacity', 1);

        // Highlight selected country
        highlightSelected(state.selectedCountry);
    }

    // ── Highlight Selected Country ─────────────────────────────────────────
    function highlightSelected(selectedCountry) {
        if (!g) return;

        g.selectAll('.bar')
            .attr('stroke', d => d.iso3 === selectedCountry ? 'var(--accent-gold)' : 'none')
            .attr('stroke-width', d => d.iso3 === selectedCountry ? 2 : 0)
            .attr('opacity', d => {
                if (!selectedCountry) return 0.9;
                return d.iso3 === selectedCountry ? 1 : 0.6;
            });

        g.selectAll('.bar-label')
            .attr('opacity', d => {
                if (!selectedCountry) return 1;
                return d.iso3 === selectedCountry ? 1 : 0.5;
            });
    }

    // ── Update (state changes) ─────────────────────────────────────────────
    function update(state, changedKeys) {
        if (!svg) return;

        const needsRedraw = changedKeys.some(k =>
            ['selectedYear', 'selectedRegion', '_resize', '_init'].includes(k)
        );

        if (needsRedraw) {
            renderBars(state);
        } else if (changedKeys.includes('selectedCountry')) {
            highlightSelected(state.selectedCountry);
        }
    }

    return { init, update };
})();
