/**
 * boxPlot.js — Income Group Distribution Box Plot
 * 
 * Compares the distribution of undernourishment_pct across income groups
 * for the selected year. Shows box-and-whisker plots with jittered
 * country dots overlaid.
 */

const BoxPlotChart = (() => {
    'use strict';

    // ── Module state ───────────────────────────────────────────────────────
    let allData = [];
    let svg, g, xScale, yScale;
    let width, height;

    const margin = { top: 20, right: 30, bottom: 50, left: 55 };
    const CONTAINER_ID = 'chart-boxplot';

    // Ordered income groups (low → high)
    const INCOME_ORDER = [
        'Low income',
        'Lower middle income',
        'Upper middle income',
        'High income'
    ];

    // Distinct colors per income group
    const INCOME_COLORS = {
        'Low income':            '#e74c3c',
        'Lower middle income':   '#f39c12',
        'Upper middle income':   '#3498db',
        'High income':           '#2ecc71'
    };

    // ── Init ───────────────────────────────────────────────────────────────
    function init(data) {
        allData = data;

        const container = document.getElementById(CONTAINER_ID);
        if (!container) return;

        const rect = container.getBoundingClientRect();
        width  = rect.width  - margin.left - margin.right;
        height = Math.max(280, rect.height - margin.top - margin.bottom);

        svg = d3.select(`#${CONTAINER_ID}`)
            .append('svg')
            .attr('width',  width  + margin.left + margin.right)
            .attr('height', height + margin.top  + margin.bottom);

        g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Scales
        xScale = d3.scaleBand()
            .domain(INCOME_ORDER)
            .range([0, width])
            .paddingInner(0.3)
            .paddingOuter(0.15);

        yScale = d3.scaleLinear()
            .range([height, 0]);

        // Axes groups
        g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${height})`);
        g.append('g').attr('class', 'y-axis');

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
    }

    // ── Compute box-plot statistics ────────────────────────────────────────
    function computeStats(values) {
        if (!values.length) return null;
        const sorted = values.slice().sort((a, b) => a - b);
        const q1     = d3.quantile(sorted, 0.25);
        const median = d3.quantile(sorted, 0.50);
        const q3     = d3.quantile(sorted, 0.75);
        const iqr    = q3 - q1;
        const lower  = Math.max(sorted[0], q1 - 1.5 * iqr);
        const upper  = Math.min(sorted[sorted.length - 1], q3 + 1.5 * iqr);
        return {
            min:    sorted[0],
            q1,
            median,
            q3,
            max:    sorted[sorted.length - 1],
            lower,    // whisker low
            upper,    // whisker high
            n:      sorted.length
        };
    }

    // ── Render ──────────────────────────────────────────────────────────────
    function renderBoxPlot(state) {
        if (!g) return;

        // Filter by year + region
        let filtered = allData.filter(d =>
            d.year === state.selectedYear &&
            d.undernourishment_pct != null &&
            d.income_group != null
        );
        if (state.selectedRegion !== 'All') {
            filtered = filtered.filter(d => d.region === state.selectedRegion);
        }

        // Group by income_group
        const grouped = d3.groups(filtered, d => d.income_group);
        const groupMap = new Map(grouped);

        // Build stats array for the 4 ordered groups
        const boxData = INCOME_ORDER.map(group => {
            const rows   = groupMap.get(group) || [];
            const values = rows.map(d => d.undernourishment_pct);
            return {
                group,
                stats: computeStats(values),
                rows
            };
        });

        // Update y-scale domain
        const allValues = filtered.map(d => d.undernourishment_pct);
        const yMax = allValues.length ? d3.max(allValues) : 50;
        yScale.domain([0, Math.ceil(yMax / 5) * 5 + 5]).nice();

        const t = d3.transition().duration(500);

        // ── Axes ──────────────────────────────────────────────────────────
        g.select('.x-axis')
            .transition(t)
            .call(d3.axisBottom(xScale).tickSize(0).tickPadding(10))
            .selectAll('text')
            .style('fill', 'var(--text-secondary)')
            .style('font-size', '0.7rem')
            .style('text-anchor', 'middle');

        g.select('.x-axis .domain').style('stroke', 'rgba(255,255,255,0.1)');

        g.select('.y-axis')
            .transition(t)
            .call(d3.axisLeft(yScale).ticks(6).tickFormat(d => d + '%'));

        g.select('.y-axis .domain').style('stroke', 'rgba(255,255,255,0.1)');
        g.selectAll('.y-axis .tick line').style('stroke', 'rgba(255,255,255,0.1)');
        g.selectAll('.y-axis .tick text').style('fill', 'var(--text-secondary)');

        // ── Grid lines ────────────────────────────────────────────────────
        const gridData = yScale.ticks(6);
        const gridLines = g.selectAll('.grid-line').data(gridData, d => d);
        gridLines.exit().remove();
        gridLines.enter()
            .append('line')
            .attr('class', 'grid-line')
            .merge(gridLines)
            .transition(t)
            .attr('x1', 0)
            .attr('x2', width)
            .attr('y1', d => yScale(d))
            .attr('y2', d => yScale(d))
            .attr('stroke', 'rgba(255,255,255,0.04)')
            .attr('stroke-dasharray', '2,3');

        // ── Box groups ────────────────────────────────────────────────────
        const bw = xScale.bandwidth();

        // --- Whisker vertical lines (min to max range) ---
        const whiskerSel = g.selectAll('.bp-whisker')
            .data(boxData.filter(d => d.stats), d => d.group);

        whiskerSel.exit().transition(t).attr('opacity', 0).remove();

        whiskerSel.enter()
            .append('line')
            .attr('class', 'bp-whisker')
            .attr('opacity', 0)
            .merge(whiskerSel)
            .transition(t)
            .attr('x1', d => xScale(d.group) + bw / 2)
            .attr('x2', d => xScale(d.group) + bw / 2)
            .attr('y1', d => yScale(d.stats.lower))
            .attr('y2', d => yScale(d.stats.upper))
            .attr('stroke', d => INCOME_COLORS[d.group])
            .attr('stroke-width', 1.5)
            .attr('opacity', 0.6);

        // --- Whisker caps (horizontal lines at lower & upper) ---
        const capWidth = bw * 0.3;
        const capData = boxData.filter(d => d.stats).flatMap(d => [
            { group: d.group, y: d.stats.lower, key: d.group + '-lo' },
            { group: d.group, y: d.stats.upper, key: d.group + '-hi' }
        ]);

        const capSel = g.selectAll('.bp-cap')
            .data(capData, d => d.key);

        capSel.exit().transition(t).attr('opacity', 0).remove();

        capSel.enter()
            .append('line')
            .attr('class', 'bp-cap')
            .attr('opacity', 0)
            .merge(capSel)
            .transition(t)
            .attr('x1', d => xScale(d.group) + bw / 2 - capWidth / 2)
            .attr('x2', d => xScale(d.group) + bw / 2 + capWidth / 2)
            .attr('y1', d => yScale(d.y))
            .attr('y2', d => yScale(d.y))
            .attr('stroke', d => INCOME_COLORS[d.group])
            .attr('stroke-width', 1.5)
            .attr('opacity', 0.6);

        // --- IQR Boxes ---
        const boxSel = g.selectAll('.bp-box')
            .data(boxData.filter(d => d.stats), d => d.group);

        boxSel.exit().transition(t).attr('opacity', 0).remove();

        boxSel.enter()
            .append('rect')
            .attr('class', 'bp-box')
            .attr('rx', 4)
            .attr('ry', 4)
            .attr('opacity', 0)
            .merge(boxSel)
            .on('mouseenter', function (event, d) {
                d3.select(this).attr('stroke', 'var(--text-primary)').attr('stroke-width', 2);
                const s = d.stats;
                const html = `
                    <strong>${d.group}</strong><br>
                    <span class="tt-label">Countries:</span> <span class="tt-value">${s.n}</span><br>
                    <span class="tt-label">Median:</span> <span class="tt-value">${Utils.formatValue(s.median)}%</span><br>
                    <span class="tt-label">Q1:</span> <span class="tt-value">${Utils.formatValue(s.q1)}%</span><br>
                    <span class="tt-label">Q3:</span> <span class="tt-value">${Utils.formatValue(s.q3)}%</span><br>
                    <span class="tt-label">Min:</span> <span class="tt-value">${Utils.formatValue(s.min)}%</span><br>
                    <span class="tt-label">Max:</span> <span class="tt-value">${Utils.formatValue(s.max)}%</span>
                `;
                Utils.showTooltip(event, html);
            })
            .on('mousemove', (event) => {
                Utils.getTooltip()
                    .style('left', (event.pageX + 15) + 'px')
                    .style('top',  (event.pageY - 10) + 'px');
            })
            .on('mouseleave', function () {
                d3.select(this)
                    .attr('stroke', d => INCOME_COLORS[d.group])
                    .attr('stroke-width', 1);
                Utils.hideTooltip();
            })
            .transition(t)
            .attr('x',      d => xScale(d.group))
            .attr('y',      d => yScale(d.stats.q3))
            .attr('width',  bw)
            .attr('height', d => Math.max(1, yScale(d.stats.q1) - yScale(d.stats.q3)))
            .attr('fill',   d => INCOME_COLORS[d.group])
            .attr('fill-opacity', 0.25)
            .attr('stroke', d => INCOME_COLORS[d.group])
            .attr('stroke-width', 1)
            .attr('opacity', 1);

        // --- Median line ---
        const medSel = g.selectAll('.bp-median')
            .data(boxData.filter(d => d.stats), d => d.group);

        medSel.exit().transition(t).attr('opacity', 0).remove();

        medSel.enter()
            .append('line')
            .attr('class', 'bp-median')
            .attr('opacity', 0)
            .merge(medSel)
            .transition(t)
            .attr('x1', d => xScale(d.group))
            .attr('x2', d => xScale(d.group) + bw)
            .attr('y1', d => yScale(d.stats.median))
            .attr('y2', d => yScale(d.stats.median))
            .attr('stroke', '#fff')
            .attr('stroke-width', 2.5)
            .attr('opacity', 1);

        // --- Jittered country dots ---
        const dotData = filtered.map(d => ({
            ...d,
            jitter: (Math.random() - 0.5) * bw * 0.6
        }));

        const dotSel = g.selectAll('.bp-dot')
            .data(dotData, d => d.iso3);

        dotSel.exit().transition(t).attr('r', 0).remove();

        const dotEnter = dotSel.enter()
            .append('circle')
            .attr('class', 'bp-dot')
            .attr('r', 0);

        dotEnter.merge(dotSel)
            .on('click', (event, d) => {
                DashboardState.setState({ selectedCountry: d.iso3 });
            })
            .on('mouseenter', function (event, d) {
                d3.select(this)
                    .attr('stroke', 'var(--text-primary)')
                    .attr('stroke-width', 2)
                    .attr('r', 5);

                const html = `
                    <strong>${d.country_name}</strong> (${d.year})<br>
                    <span class="tt-label">Income Group:</span> <span class="tt-value">${d.income_group}</span><br>
                    <span class="tt-label">Undernourishment:</span> <span class="tt-value">${Utils.formatValue(d.undernourishment_pct)}%</span>
                `;
                Utils.showTooltip(event, html);
            })
            .on('mousemove', (event) => {
                Utils.getTooltip()
                    .style('left', (event.pageX + 15) + 'px')
                    .style('top',  (event.pageY - 10) + 'px');
            })
            .on('mouseleave', function (event, d) {
                const isSelected = DashboardState.getState().selectedCountry === d.iso3;
                d3.select(this)
                    .attr('stroke', isSelected ? 'var(--accent-gold)' : INCOME_COLORS[d.income_group])
                    .attr('stroke-width', isSelected ? 2 : 1)
                    .attr('r', isSelected ? 5 : 3.5);
                Utils.hideTooltip();
            })
            .attr('cursor', 'pointer')
            .transition(t)
            .attr('cx', d => xScale(d.income_group) + bw / 2 + d.jitter)
            .attr('cy', d => yScale(d.undernourishment_pct))
            .attr('r',  d => state.selectedCountry === d.iso3 ? 5 : 3.5)
            .attr('fill', d => INCOME_COLORS[d.income_group])
            .attr('fill-opacity', d => {
                if (!state.selectedCountry) return 0.7;
                return state.selectedCountry === d.iso3 ? 1 : 0.25;
            })
            .attr('stroke', d => state.selectedCountry === d.iso3 ? 'var(--accent-gold)' : INCOME_COLORS[d.income_group])
            .attr('stroke-width', d => state.selectedCountry === d.iso3 ? 2 : 1);

        // Sort so selected dot is on top
        if (state.selectedCountry) {
            g.selectAll('.bp-dot').sort((a, b) => {
                if (a.iso3 === state.selectedCountry) return 1;
                if (b.iso3 === state.selectedCountry) return -1;
                return 0;
            });
        }

        // --- Empty state message ---
        g.selectAll('.bp-empty').remove();
        const hasData = boxData.some(d => d.stats);
        if (!hasData) {
            g.append('text')
                .attr('class', 'bp-empty')
                .attr('x', width / 2)
                .attr('y', height / 2)
                .attr('text-anchor', 'middle')
                .style('fill', 'var(--text-muted)')
                .style('font-size', '0.85rem')
                .text('No undernourishment data for this year/region combination.');
        }
    }

    // ── Update ─────────────────────────────────────────────────────────────
    function update(state, changedKeys) {
        if (!svg) return;

        const needsRedraw = changedKeys.some(k =>
            ['selectedYear', 'selectedRegion', '_resize', '_init'].includes(k)
        );

        if (needsRedraw) {
            renderBoxPlot(state);
        } else if (changedKeys.includes('selectedCountry')) {
            // Just update dot highlighting
            g.selectAll('.bp-dot')
                .transition().duration(300)
                .attr('r',  d => state.selectedCountry === d.iso3 ? 5 : 3.5)
                .attr('fill-opacity', d => {
                    if (!state.selectedCountry) return 0.7;
                    return state.selectedCountry === d.iso3 ? 1 : 0.25;
                })
                .attr('stroke', d => state.selectedCountry === d.iso3 ? 'var(--accent-gold)' : INCOME_COLORS[d.income_group])
                .attr('stroke-width', d => state.selectedCountry === d.iso3 ? 2 : 1);

            if (state.selectedCountry) {
                g.selectAll('.bp-dot').sort((a, b) => {
                    if (a.iso3 === state.selectedCountry) return 1;
                    if (b.iso3 === state.selectedCountry) return -1;
                    return 0;
                });
            }
        }
    }

    return { init, update };
})();
