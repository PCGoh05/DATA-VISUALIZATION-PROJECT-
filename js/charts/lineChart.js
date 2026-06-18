/**
 * lineChart.js — Regional Trend Line Chart
 * 
 * Shows average undernourishment_pct per region over years 2001–2022.
 * One line per region with distinct colors.
 * Features: animated line drawing, vertical year reference line,
 * hover tooltips, click-to-select region, linked state updates.
 */

const LineChart = (() => {
    'use strict';

    // ── Module state ───────────────────────────────────────────────────────
    let allData = [];
    let regionSeries = [];  // [{region, values: [{year, avg}]}]
    let svg, g, xScale, yScale, colorScale;
    let refLine, refLineLabel;
    let width, height;

    const margin = { top: 20, right: 160, bottom: 40, left: 55 };
    const CONTAINER_ID = 'chart-line';

    // ── Init ───────────────────────────────────────────────────────────────
    function init(data) {
        allData = data;
        colorScale = Utils.getRegionColorScale();

        // Prepare region series data
        buildRegionSeries();

        // Create SVG
        const container = document.getElementById(CONTAINER_ID);
        if (!container) return;

        const rect = container.getBoundingClientRect();
        width = rect.width - margin.left - margin.right;
        height = Math.max(260, rect.height - margin.top - margin.bottom);

        svg = d3.select(`#${CONTAINER_ID}`)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Scales
        const years = Utils.getUniqueYears(allData);
        xScale = d3.scaleLinear()
            .domain(d3.extent(years))
            .range([0, width]);

        const maxVal = d3.max(regionSeries, s => d3.max(s.values, d => d.avg)) || 40;
        yScale = d3.scaleLinear()
            .domain([0, Math.ceil(maxVal / 5) * 5 + 5])
            .range([height, 0]);

        // Axes
        g.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale)
                .tickFormat(d3.format('d'))
                .ticks(11));

        g.append('g')
            .attr('class', 'y-axis')
            .call(d3.axisLeft(yScale)
                .ticks(8)
                .tickFormat(d => d + '%'));

        // Y-axis label
        g.append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('y', -42)
            .attr('x', -height / 2)
            .attr('text-anchor', 'middle')
            .style('fill', 'var(--text-muted)')
            .style('font-size', '0.7rem')
            .text('Undernourishment (%)');

        // Grid lines
        g.append('g')
            .attr('class', 'grid-lines')
            .selectAll('line')
            .data(yScale.ticks(8))
            .join('line')
            .attr('x1', 0)
            .attr('x2', width)
            .attr('y1', d => yScale(d))
            .attr('y2', d => yScale(d))
            .attr('stroke', 'rgba(255,255,255,0.04)')
            .attr('stroke-dasharray', '2,3');

        // Reference line group (vertical line at selected year)
        refLine = g.append('line')
            .attr('class', 'ref-line')
            .attr('y1', 0)
            .attr('y2', height)
            .attr('stroke', 'var(--accent-gold)')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '6,4')
            .attr('opacity', 0.7);

        refLineLabel = g.append('text')
            .attr('class', 'ref-line-label')
            .attr('y', -6)
            .attr('text-anchor', 'middle')
            .style('fill', 'var(--accent-gold)')
            .style('font-size', '0.7rem')
            .style('font-weight', '600');

        // Draw lines
        drawLines();

        // Draw legend
        drawLegend();

        // Hover overlay for precise year detection
        createHoverOverlay();
    }

    // ── Build Region Series ────────────────────────────────────────────────
    function buildRegionSeries() {
        const regions = Utils.getUniqueRegions(allData);
        const years = Utils.getUniqueYears(allData);

        regionSeries = regions.map(region => {
            const values = years.map(year => {
                const rows = allData.filter(d =>
                    d.region === region &&
                    d.year === year &&
                    d.undernourishment_pct != null
                );
                const avg = rows.length > 0
                    ? d3.mean(rows, d => d.undernourishment_pct)
                    : null;
                return { year, avg };
            }).filter(d => d.avg != null); // exclude years with no data

            return { region, values };
        }).filter(s => s.values.length > 0);
    }

    // ── Draw Lines ─────────────────────────────────────────────────────────
    function drawLines() {
        const lineGenerator = d3.line()
            .defined(d => d.avg != null)
            .x(d => xScale(d.year))
            .y(d => yScale(d.avg))
            .curve(d3.curveMonotoneX);

        // Line paths
        const lines = g.selectAll('.region-line')
            .data(regionSeries, d => d.region);

        lines.enter()
            .append('path')
            .attr('class', 'region-line')
            .attr('fill', 'none')
            .attr('stroke', d => colorScale(d.region))
            .attr('stroke-width', 2.5)
            .attr('d', d => lineGenerator(d.values))
            .attr('cursor', 'pointer')
            .style('filter', 'drop-shadow(0 0 2px rgba(0,0,0,0.3))')
            .on('click', (event, d) => {
                const currentRegion = DashboardState.getState().selectedRegion;
                if (currentRegion === d.region) {
                    DashboardState.setState({ selectedRegion: 'All' });
                } else {
                    DashboardState.setState({ selectedRegion: d.region });
                }
            })
            .on('mouseenter', function (event, d) {
                d3.select(this).attr('stroke-width', 4);
            })
            .on('mouseleave', function () {
                const state = DashboardState.getState();
                const isSelected = state.selectedRegion !== 'All' && 
                    d3.select(this).datum().region === state.selectedRegion;
                d3.select(this).attr('stroke-width', isSelected ? 3.5 : 2.5);
            })
            // Animate line drawing on initial load
            .each(function () {
                const totalLength = this.getTotalLength();
                d3.select(this)
                    .attr('stroke-dasharray', totalLength)
                    .attr('stroke-dashoffset', totalLength)
                    .transition()
                    .duration(1500)
                    .ease(d3.easeCubicInOut)
                    .attr('stroke-dashoffset', 0);
            });

        // Data point dots (small, only visible on hover via overlay)
        for (const series of regionSeries) {
            g.selectAll(`.dot-${series.region.replace(/\W/g, '')}`)
                .data(series.values)
                .join('circle')
                .attr('class', `region-dot dot-${series.region.replace(/\W/g, '')}`)
                .attr('cx', d => xScale(d.year))
                .attr('cy', d => yScale(d.avg))
                .attr('r', 0) // hidden by default
                .attr('fill', colorScale(series.region))
                .attr('stroke', 'var(--bg-card)')
                .attr('stroke-width', 2)
                .attr('data-region', series.region);
        }
    }

    // ── Legend ──────────────────────────────────────────────────────────────
    function drawLegend() {
        const legendGroup = g.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${width + 16}, 0)`);

        regionSeries.forEach((s, i) => {
            const item = legendGroup.append('g')
                .attr('transform', `translate(0, ${i * 22})`)
                .attr('cursor', 'pointer')
                .on('click', () => {
                    const currentRegion = DashboardState.getState().selectedRegion;
                    if (currentRegion === s.region) {
                        DashboardState.setState({ selectedRegion: 'All' });
                    } else {
                        DashboardState.setState({ selectedRegion: s.region });
                    }
                });

            // Color dot
            item.append('circle')
                .attr('r', 5)
                .attr('cx', 5)
                .attr('cy', 0)
                .attr('fill', colorScale(s.region));

            // Arrow/line
            item.append('line')
                .attr('x1', 12)
                .attr('x2', 24)
                .attr('y1', 0)
                .attr('y2', 0)
                .attr('stroke', colorScale(s.region))
                .attr('stroke-width', 2);

            // Label (truncate long names)
            const shortName = s.region.length > 22
                ? s.region.substring(0, 20) + '…'
                : s.region;

            item.append('text')
                .attr('x', 30)
                .attr('y', 4)
                .style('fill', 'var(--text-secondary)')
                .style('font-size', '0.65rem')
                .text(shortName);
        });
    }

    // ── Hover Overlay ──────────────────────────────────────────────────────
    function createHoverOverlay() {
        const overlay = g.append('rect')
            .attr('class', 'hover-overlay')
            .attr('width', width)
            .attr('height', height)
            .attr('fill', 'transparent')
            .attr('cursor', 'crosshair');

        const hoverLine = g.append('line')
            .attr('class', 'hover-line')
            .attr('y1', 0)
            .attr('y2', height)
            .attr('stroke', 'rgba(255,255,255,0.2)')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '3,3')
            .style('opacity', 0);

        overlay.on('mousemove', function (event) {
            const [mx] = d3.pointer(event);
            const year = Math.round(xScale.invert(mx));
            const clampedYear = Math.max(xScale.domain()[0], Math.min(xScale.domain()[1], year));
            const x = xScale(clampedYear);

            hoverLine
                .attr('x1', x)
                .attr('x2', x)
                .style('opacity', 1);

            // Show dots at this year
            g.selectAll('.region-dot')
                .attr('r', d => d.year === clampedYear ? 4.5 : 0);

            // Build tooltip
            const tooltipRows = regionSeries
                .map(s => {
                    const point = s.values.find(v => v.year === clampedYear);
                    if (!point) return null;
                    const color = colorScale(s.region);
                    const shortName = s.region.length > 30
                        ? s.region.substring(0, 28) + '…'
                        : s.region;
                    return `<span style="color:${color}">●</span> ${shortName}: <strong>${Utils.formatValue(point.avg)}</strong>%`;
                })
                .filter(Boolean);

            if (tooltipRows.length > 0) {
                const html = `
                    <div><strong>Year: ${clampedYear}</strong></div>
                    <div style="margin-top:4px;">${tooltipRows.join('<br>')}</div>
                `;
                Utils.showTooltip(event, html);
            }
        });

        overlay.on('mouseleave', function () {
            hoverLine.style('opacity', 0);
            g.selectAll('.region-dot').attr('r', 0);
            Utils.hideTooltip();
        });
    }

    // ── Update (state changes) ─────────────────────────────────────────────
    function update(state, changedKeys) {
        if (!svg) return;

        // Update reference line position
        updateRefLine(state.selectedYear);

        // Highlight selected region
        updateHighlight(state.selectedRegion);
    }

    function updateRefLine(year) {
        if (!refLine || !xScale) return;
        const x = xScale(year);

        refLine
            .transition().duration(300)
            .attr('x1', x)
            .attr('x2', x);

        refLineLabel
            .transition().duration(300)
            .attr('x', x)
            .text(year);
    }

    function updateHighlight(selectedRegion) {
        if (!g) return;

        g.selectAll('.region-line')
            .transition().duration(300)
            .attr('stroke-width', d => {
                if (selectedRegion === 'All') return 2.5;
                return d.region === selectedRegion ? 3.5 : 1;
            })
            .attr('opacity', d => {
                if (selectedRegion === 'All') return 1;
                return d.region === selectedRegion ? 1 : 0.2;
            });
    }

    return { init, update };
})();
