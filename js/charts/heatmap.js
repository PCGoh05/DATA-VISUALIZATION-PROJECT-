/**
 * heatmap.js — Country-Year Heatmap
 * 
 * Shows a grid of countries × years colored by undernourishment_pct.
 * Displays the Top 20 countries by average undernourishment in the selected region.
 * Forces the selectedCountry to be included even if it's not in the Top 20.
 */

const HeatmapChart = (() => {
    'use strict';

    let allData = [];
    let svg, g, xScale, yScale, colorScale;
    let width, height;
    let yearHighlightGroup;

    const margin = { top: 30, right: 30, bottom: 40, left: 130 };
    const CONTAINER_ID = 'chart-heatmap';
    const MAX_COUNTRIES = 20;

    function init(data) {
        allData = data;
        colorScale = Utils.getUndernourishmentColorScale([0, 50]);

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

        xScale = d3.scaleBand().range([0, width]).padding(0.05);
        yScale = d3.scaleBand().range([0, height]).padding(0.05);

        // Axes groups
        g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,-5)`);
        g.append('g').attr('class', 'y-axis');
        
        // Year column highlight
        yearHighlightGroup = g.append('g').attr('class', 'year-highlight-group');

        drawLegend();
    }

    function getTopCountries(state) {
        // Filter by region
        let regionData = allData;
        if (state.selectedRegion !== 'All') {
            regionData = allData.filter(d => d.region === state.selectedRegion);
        }

        // Calculate average undernourishment per country
        const avgByCountry = d3.rollups(
            regionData.filter(d => d.undernourishment_pct != null),
            v => d3.mean(v, d => d.undernourishment_pct),
            d => d.iso3
        );

        // Sort descending
        avgByCountry.sort((a, b) => b[1] - a[1]);

        let topIso3 = avgByCountry.slice(0, MAX_COUNTRIES).map(d => d[0]);

        // Ensure selected country is included
        if (state.selectedCountry && !topIso3.includes(state.selectedCountry)) {
            // Check if selected country is in the current region
            const countryRow = allData.find(d => d.iso3 === state.selectedCountry);
            if (countryRow && (state.selectedRegion === 'All' || countryRow.region === state.selectedRegion)) {
                if (topIso3.length >= MAX_COUNTRIES) {
                    topIso3.pop(); // Remove the last one
                }
                topIso3.push(state.selectedCountry);
            }
        }

        // Re-sort the final list alphabetically by country name for better readability, or keep rank order?
        // Rank order is better for highlighting severity.
        const countryMap = new Map();
        for (const d of allData) {
            if (!countryMap.has(d.iso3)) {
                countryMap.set(d.iso3, { iso3: d.iso3, name: d.country_name, avg: 0 });
            }
        }
        
        for (const [iso3, avg] of avgByCountry) {
            if (countryMap.has(iso3)) countryMap.get(iso3).avg = avg;
        }

        const topCountries = topIso3.map(iso3 => countryMap.get(iso3));
        topCountries.sort((a, b) => b.avg - a.avg);

        return topCountries;
    }

    function renderHeatmap(state) {
        if (!g) return;

        const topCountries = getTopCountries(state);
        const iso3List = topCountries.map(c => c.iso3);
        const years = Utils.getUniqueYears(allData);

        // Prepare cell data
        const cells = [];
        for (const country of topCountries) {
            for (const year of years) {
                const row = allData.find(d => d.iso3 === country.iso3 && d.year === year);
                cells.push({
                    iso3: country.iso3,
                    country_name: country.name,
                    year: year,
                    region: row ? row.region : 'No data',
                    value: row ? row.undernourishment_pct : null
                });
            }
        }

        // Update scales
        xScale.domain(years);
        yScale.domain(topCountries.map(c => c.name));

        const t = d3.transition().duration(500);

        // Axes
        g.select('.x-axis')
            .transition(t)
            .call(d3.axisTop(xScale).tickSize(0).tickPadding(5))
            .selectAll('text')
            .style('fill', 'var(--text-secondary)')
            .style('font-size', '0.7rem');
            
        g.select('.x-axis .domain').remove();

        g.select('.y-axis')
            .transition(t)
            .call(d3.axisLeft(yScale).tickSize(0).tickPadding(8))
            .selectAll('text')
            .style('fill', 'var(--text-secondary)')
            .style('font-size', '0.7rem');
            
        g.select('.y-axis .domain').remove();

        // Cells
        const cellSelection = g.selectAll('.heatmap-cell')
            .data(cells, d => d.iso3 + '-' + d.year);

        cellSelection.exit()
            .transition(t)
            .attr('opacity', 0)
            .remove();

        const cellsEnter = cellSelection.enter()
            .append('rect')
            .attr('class', 'heatmap-cell')
            .attr('x', d => xScale(d.year))
            .attr('y', d => yScale(d.country_name))
            .attr('width', xScale.bandwidth())
            .attr('height', yScale.bandwidth())
            .attr('rx', 2)
            .attr('ry', 2)
            .attr('cursor', 'pointer')
            .attr('opacity', 0);

        cellsEnter.merge(cellSelection)
            .on('click', (event, d) => {
                DashboardState.setState({
                    selectedCountry: d.iso3,
                    selectedYear: d.year
                });
            })
            .on('mouseenter', function (event, d) {
                d3.select(this)
                    .attr('stroke', 'var(--text-primary)')
                    .attr('stroke-width', 2);

                const valStr = d.value != null ? Utils.formatValue(d.value) + '%' : 'No data';
                const html = `
                    <strong>${d.country_name}</strong> (${d.year})<br>
                    <span class="tt-label">Region:</span> <span class="tt-value">${d.region}</span><br>
                    <span class="tt-label">Undernourishment:</span> <span class="tt-value">${valStr}</span>
                `;
                Utils.showTooltip(event, html);
            })
            .on('mousemove', (event) => {
                const tip = Utils.getTooltip();
                tip.style('left', (event.pageX + 15) + 'px')
                   .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseleave', function (event, d) {
                const isSelected = DashboardState.getState().selectedCountry === d.iso3 && DashboardState.getState().selectedYear === d.year;
                d3.select(this)
                    .attr('stroke', isSelected ? 'var(--accent-gold)' : 'none')
                    .attr('stroke-width', isSelected ? 2 : 0);
                Utils.hideTooltip();
            })
            .transition(t)
            .attr('x', d => xScale(d.year))
            .attr('y', d => yScale(d.country_name))
            .attr('width', xScale.bandwidth())
            .attr('height', yScale.bandwidth())
            .attr('fill', d => d.value != null ? colorScale(d.value) : Utils.getNoDataColor())
            .attr('stroke', d => {
                return (state.selectedCountry === d.iso3 && state.selectedYear === d.year) ? 'var(--accent-gold)' : 'none';
            })
            .attr('stroke-width', d => {
                return (state.selectedCountry === d.iso3 && state.selectedYear === d.year) ? 2 : 0;
            })
            .attr('opacity', 1);

        highlightYearColumn(state.selectedYear);
    }

    function highlightYearColumn(year) {
        if (!xScale) return;
        
        const selection = yearHighlightGroup.selectAll('.year-highlight')
            .data([year]);

        selection.enter()
            .append('rect')
            .attr('class', 'year-highlight')
            .attr('fill', 'rgba(255, 255, 255, 0.05)')
            .attr('pointer-events', 'none')
            .attr('rx', 4)
            .attr('ry', 4)
            .merge(selection)
            .transition().duration(300)
            .attr('x', xScale(year) - 2)
            .attr('y', -5)
            .attr('width', xScale.bandwidth() + 4)
            .attr('height', height + 10);
            
        g.select('.x-axis').selectAll('text')
            .style('font-weight', d => d === year ? '700' : '400')
            .style('fill', d => d === year ? 'var(--accent-gold)' : 'var(--text-secondary)');
    }

    function drawLegend() {
        const legendWidth = 200;
        const legendHeight = 10;
        
        const legendGroup = svg.append('g')
            .attr('class', 'heatmap-legend')
            .attr('transform', `translate(${width + margin.left - legendWidth}, ${height + margin.top + 25})`);
            
        const defs = svg.append('defs');
        const linearGradient = defs.append('linearGradient')
            .attr('id', 'heatmap-gradient');
            
        // Add stops based on YlOrRd color scale
        const stops = d3.range(0, 1.01, 0.2);
        linearGradient.selectAll('stop')
            .data(stops)
            .enter().append('stop')
            .attr('offset', d => d * 100 + '%')
            .attr('stop-color', d => colorScale(d * 50)); // domain is 0-50

        legendGroup.append('rect')
            .attr('width', legendWidth)
            .attr('height', legendHeight)
            .attr('fill', 'url(#heatmap-gradient)')
            .attr('rx', 2)
            .attr('ry', 2);
            
        legendGroup.append('text')
            .attr('x', 0)
            .attr('y', 22)
            .style('font-size', '0.65rem')
            .style('fill', 'var(--text-secondary)')
            .text('0%');
            
        legendGroup.append('text')
            .attr('x', legendWidth)
            .attr('y', 22)
            .attr('text-anchor', 'end')
            .style('font-size', '0.65rem')
            .style('fill', 'var(--text-secondary)')
            .text('> 50%');
            
        legendGroup.append('text')
            .attr('x', legendWidth / 2)
            .attr('y', 22)
            .attr('text-anchor', 'middle')
            .style('font-size', '0.65rem')
            .style('fill', 'var(--text-secondary)')
            .text('Undernourishment');
            
        // No data legend
        const noDataGroup = legendGroup.append('g')
            .attr('transform', `translate(-70, 0)`);
            
        noDataGroup.append('rect')
            .attr('width', legendHeight)
            .attr('height', legendHeight)
            .attr('fill', Utils.getNoDataColor())
            .attr('rx', 2);
            
        noDataGroup.append('text')
            .attr('x', 15)
            .attr('y', 9)
            .style('font-size', '0.65rem')
            .style('fill', 'var(--text-secondary)')
            .text('No data');
    }

    function update(state, changedKeys) {
        if (!svg) return;

        const needsRedraw = changedKeys.some(k =>
            ['selectedRegion', 'selectedCountry', '_resize', '_init'].includes(k)
        );

        if (needsRedraw) {
            renderHeatmap(state);
        } else if (changedKeys.includes('selectedYear')) {
            highlightYearColumn(state.selectedYear);
            
            // Re-eval stroke for cells to update the selected cell border
            g.selectAll('.heatmap-cell')
                .attr('stroke', d => (state.selectedCountry === d.iso3 && state.selectedYear === d.year) ? 'var(--accent-gold)' : 'none')
                .attr('stroke-width', d => (state.selectedCountry === d.iso3 && state.selectedYear === d.year) ? 2 : 0);
        }
    }

    return { init, update };
})();
