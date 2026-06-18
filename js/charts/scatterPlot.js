/**
 * scatterPlot.js — Exploratory Associations Scatter Plot
 * 
 * Shows association between selected food security factor (X) and undernourishment (Y).
 * Bubble size represents population, colored by region.
 */

const ScatterPlot = (() => {
    'use strict';

    let allData = [];
    let svg, g, xScale, yScale, rScale, colorScale;
    let width, height;
    let xAxisGroup, yAxisGroup, xAxisLabel;
    
    let currentXMetric = 'food_production_index';

    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const CONTAINER_ID = 'chart-scatter';

    const X_METRIC_LABELS = {
        'food_production_index': 'Food Production Index',
        'cereal_yield_kg_per_ha': 'Cereal Yield (kg/ha)',
        'fao_dietary_energy_adequacy_pct': 'Dietary Energy Adequacy (%)',
        'fao_protein_supply_g_per_day': 'Protein Supply (g/day)'
    };

    function init(data) {
        allData = data;
        colorScale = Utils.getRegionColorScale();

        const container = document.getElementById(CONTAINER_ID);
        if (!container) return;

        const rect = container.getBoundingClientRect();
        width = rect.width - margin.left - margin.right;
        height = Math.max(300, rect.height - margin.top - margin.bottom);

        svg = d3.select(`#${CONTAINER_ID}`)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        xScale = d3.scaleLinear().range([0, width]);
        yScale = d3.scaleLinear().range([height, 0]);
        rScale = d3.scaleSqrt().range([3, 25]); // Sqrt scale for area

        xAxisGroup = g.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height})`);

        yAxisGroup = g.append('g')
            .attr('class', 'y-axis');

        // Y-axis label
        g.append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('y', -45)
            .attr('x', -height / 2)
            .attr('text-anchor', 'middle')
            .style('fill', 'var(--text-secondary)')
            .style('font-size', '0.75rem')
            .text('Undernourishment (%)');

        // X-axis label
        xAxisLabel = g.append('text')
            .attr('class', 'axis-label')
            .attr('y', height + 40)
            .attr('x', width / 2)
            .attr('text-anchor', 'middle')
            .style('fill', 'var(--text-secondary)')
            .style('font-size', '0.75rem');

        // Handle dropdown
        const selectEl = document.getElementById('scatterXAxis');
        if (selectEl) {
            selectEl.addEventListener('change', (e) => {
                currentXMetric = e.target.value;
                renderScatter(DashboardState.getState(), true);
            });
            // Handle reset
            document.getElementById('btnReset')?.addEventListener('click', () => {
                selectEl.value = 'food_production_index';
                currentXMetric = 'food_production_index';
                // Render will be triggered by state change
            });
        }
    }

    function renderScatter(state, animateAxes = false) {
        if (!g) return;

        // Filter data by year and region
        let filtered = allData.filter(d => 
            d.year === state.selectedYear &&
            d.undernourishment_pct != null &&
            d[currentXMetric] != null
        );

        if (state.selectedRegion !== 'All') {
            filtered = filtered.filter(d => d.region === state.selectedRegion);
        }

        // Update scales
        const xExt = d3.extent(filtered, d => d[currentXMetric]);
        const yExt = d3.extent(filtered, d => d.undernourishment_pct);
        const rExt = d3.extent(filtered, d => d.population_total || 0);

        // Add padding to scales
        const xPad = (xExt[1] - xExt[0]) * 0.05 || 1;
        const yPad = (yExt[1] - yExt[0]) * 0.05 || 1;

        xScale.domain([Math.max(0, xExt[0] - xPad), xExt[1] + xPad]).nice();
        yScale.domain([Math.max(0, yExt[0] - yPad), yExt[1] + yPad]).nice();
        rScale.domain([0, rExt[1] || 1]);

        const t = d3.transition().duration(750);

        // Update axes
        const xAxisCall = d3.axisBottom(xScale).ticks(8);
        const yAxisCall = d3.axisLeft(yScale).ticks(6);

        if (animateAxes) {
            xAxisGroup.transition(t).call(xAxisCall);
            yAxisGroup.transition(t).call(yAxisCall);
        } else {
            xAxisGroup.call(xAxisCall);
            yAxisGroup.call(yAxisCall);
        }

        // Style axes
        g.selectAll('.domain').style('stroke', 'rgba(255,255,255,0.1)');
        g.selectAll('.tick line').style('stroke', 'rgba(255,255,255,0.1)');
        g.selectAll('.tick text').style('fill', 'var(--text-secondary)');

        xAxisLabel.text(X_METRIC_LABELS[currentXMetric]);

        // Draw points
        const points = g.selectAll('.scatter-point')
            .data(filtered, d => d.iso3);

        points.exit()
            .transition(t)
            .attr('r', 0)
            .remove();

        const pointsEnter = points.enter()
            .append('circle')
            .attr('class', 'scatter-point')
            .attr('cx', d => xScale(d[currentXMetric]))
            .attr('cy', d => yScale(d.undernourishment_pct))
            .attr('r', 0)
            .attr('fill', d => colorScale(d.region))
            .attr('stroke', 'var(--bg-card)')
            .attr('stroke-width', 1)
            .attr('opacity', 0.8)
            .attr('cursor', 'pointer');

        pointsEnter.merge(points)
            .on('click', (event, d) => {
                DashboardState.setState({ selectedCountry: d.iso3 });
            })
            .on('mouseenter', function (event, d) {
                d3.select(this)
                    .attr('stroke', 'var(--text-primary)')
                    .attr('stroke-width', 2)
                    .attr('opacity', 1);

                const popFormat = d3.format('.3s');
                const xVal = Utils.formatValue(d[currentXMetric]);
                const yVal = Utils.formatValue(d.undernourishment_pct);
                const popVal = d.population_total ? popFormat(d.population_total) : 'Unknown';

                const html = `
                    <strong>${d.country_name}</strong> (${d.year})<br>
                    <span class="tt-label">Region:</span> <span class="tt-value">${d.region}</span><br>
                    <span class="tt-label">${X_METRIC_LABELS[currentXMetric]}:</span> <span class="tt-value">${xVal}</span><br>
                    <span class="tt-label">Undernourishment:</span> <span class="tt-value">${yVal}%</span><br>
                    <span class="tt-label">Population:</span> <span class="tt-value">${popVal}</span>
                `;
                Utils.showTooltip(event, html);
            })
            .on('mousemove', (event) => {
                const tip = Utils.getTooltip();
                tip.style('left', (event.pageX + 15) + 'px')
                   .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseleave', function (event, d) {
                const isSelected = DashboardState.getState().selectedCountry === d.iso3;
                d3.select(this)
                    .attr('stroke', isSelected ? 'var(--accent-gold)' : 'var(--bg-card)')
                    .attr('stroke-width', isSelected ? 2 : 1)
                    .attr('opacity', isSelected ? 1 : 0.8);
                Utils.hideTooltip();
            })
            .transition(t)
            .attr('cx', d => xScale(d[currentXMetric]))
            .attr('cy', d => yScale(d.undernourishment_pct))
            .attr('r', d => Math.max(3, rScale(d.population_total || 0)))
            .attr('fill', d => colorScale(d.region))
            .attr('stroke', d => state.selectedCountry === d.iso3 ? 'var(--accent-gold)' : 'var(--bg-card)')
            .attr('stroke-width', d => state.selectedCountry === d.iso3 ? 2 : 1)
            .attr('opacity', d => {
                if (!state.selectedCountry) return 0.8;
                return state.selectedCountry === d.iso3 ? 1 : 0.3;
            });
            
        // Sort points so selected country is drawn on top
        if (state.selectedCountry) {
            g.selectAll('.scatter-point').sort((a, b) => {
                if (a.iso3 === state.selectedCountry) return 1;
                if (b.iso3 === state.selectedCountry) return -1;
                // Otherwise sort by population descending (smaller bubbles on top)
                return (b.population_total || 0) - (a.population_total || 0);
            });
        } else {
            g.selectAll('.scatter-point').sort((a, b) => {
                return (b.population_total || 0) - (a.population_total || 0);
            });
        }
    }

    function update(state, changedKeys) {
        if (!svg) return;

        const needsRedraw = changedKeys.some(k =>
            ['selectedYear', 'selectedRegion', '_resize', '_init'].includes(k)
        );

        if (needsRedraw) {
            renderScatter(state, false);
        } else if (changedKeys.includes('selectedCountry')) {
            // Just highlight the selected point
            g.selectAll('.scatter-point')
                .transition().duration(300)
                .attr('stroke', d => state.selectedCountry === d.iso3 ? 'var(--accent-gold)' : 'var(--bg-card)')
                .attr('stroke-width', d => state.selectedCountry === d.iso3 ? 2 : 1)
                .attr('opacity', d => {
                    if (!state.selectedCountry) return 0.8;
                    return state.selectedCountry === d.iso3 ? 1 : 0.3;
                });
                
            if (state.selectedCountry) {
                g.selectAll('.scatter-point').sort((a, b) => {
                    if (a.iso3 === state.selectedCountry) return 1;
                    if (b.iso3 === state.selectedCountry) return -1;
                    return (b.population_total || 0) - (a.population_total || 0);
                });
            }
        }
    }

    return { init, update };
})();
