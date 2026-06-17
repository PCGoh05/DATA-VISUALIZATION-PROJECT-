/**
 * utils.js — Shared Utility Functions
 * 
 * Provides data loading, formatting, tooltip helpers, color scales,
 * and other shared functions used by all chart modules.
 */

const Utils = (() => {
    // ── Data Loading ───────────────────────────────────────────────────────

    /**
     * Load and parse the cleaned CSV. Numeric fields are parsed; missing
     * values are kept as null (NOT filled with 0).
     * @returns {Promise<Array<Object>>} Parsed rows
     */
    async function loadData() {
        const NUMERIC_FIELDS = [
            'year',
            'population_total',
            'undernourishment_pct',
            'food_production_index',
            'cereal_yield_kg_per_ha',
            'agricultural_land_pct',
            'fao_dietary_energy_adequacy_pct',
            'fao_protein_supply_g_per_day',
            'undernourishment_yoy_change_pp',
            'hunger_severity_index',
            'food_crisis_flag'
        ];

        const raw = await d3.csv('data/food_security_clean.csv');

        const data = raw.map(row => {
            const parsed = {};
            for (const [key, value] of Object.entries(row)) {
                if (NUMERIC_FIELDS.includes(key)) {
                    const num = parseFloat(value);
                    parsed[key] = isNaN(num) ? null : num;
                } else {
                    parsed[key] = value && value.trim() !== '' ? value.trim() : null;
                }
            }
            return parsed;
        }).filter(row => row.iso3); // skip rows without iso3

        console.log(`Loaded ${data.length} rows from food_security_clean.csv`);
        return data;
    }

    // ── Data Helpers ───────────────────────────────────────────────────────

    /** Get sorted unique years from data */
    function getUniqueYears(data) {
        return [...new Set(data.map(d => d.year))].filter(y => y != null).sort((a, b) => a - b);
    }

    /** Get sorted unique regions from data */
    function getUniqueRegions(data) {
        return [...new Set(data.map(d => d.region))].filter(r => r != null).sort();
    }

    /** Get sorted unique income groups from data */
    function getIncomeGroups(data) {
        const order = ['Low income', 'Lower middle income', 'Upper middle income', 'High income'];
        const found = [...new Set(data.map(d => d.income_group))].filter(g => g != null);
        return order.filter(g => found.includes(g));
    }

    /** Get unique countries as [{iso3, name}], sorted by name */
    function getCountryList(data) {
        const map = new Map();
        for (const d of data) {
            if (d.iso3 && d.country_name && !map.has(d.iso3)) {
                map.set(d.iso3, d.country_name);
            }
        }
        return [...map.entries()]
            .map(([iso3, name]) => ({ iso3, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Filter data by current state.
     * @param {Array} data  Full dataset
     * @param {Object} state  Current DashboardState
     * @param {Object} opts  Optional overrides: { year, region }
     */
    function filterData(data, state, opts = {}) {
        const year = opts.year ?? state.selectedYear;
        const region = opts.region ?? state.selectedRegion;

        return data.filter(d => {
            if (d.year !== year) return false;
            if (region !== 'All' && d.region !== region) return false;
            return true;
        });
    }

    // ── Formatting ─────────────────────────────────────────────────────────

    /**
     * Format a value for display. Returns "No data" for null/NaN.
     */
    function formatValue(v, decimals = 1) {
        if (v == null || isNaN(v)) return 'No data';
        return Number(v).toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    /** Format population (e.g., 1,234,567 → "1.23M") */
    function formatPopulation(v) {
        if (v == null || isNaN(v)) return 'No data';
        if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
        if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
        if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
        return v.toLocaleString();
    }

    // ── Color Scales ───────────────────────────────────────────────────────

    /**
     * Sequential color scale for undernourishment severity.
     * Yellow → Orange → Red (darker = higher risk).
     * Domain: [0, 50] by default.
     */
    function getUndernourishmentColorScale(domain = [0, 50]) {
        return d3.scaleSequential()
            .domain(domain)
            .interpolator(d3.interpolateYlOrRd);
    }

    /**
     * Categorical color scale for regions.
     */
    function getRegionColorScale() {
        return d3.scaleOrdinal()
            .domain([
                'Sub-Saharan Africa',
                'South Asia',
                'Latin America & Caribbean',
                'East Asia & Pacific',
                'Middle East, North Africa, Afghanistan & Pakistan',
                'Europe & Central Asia',
                'North America'
            ])
            .range([
                '#e74c3c',  // red
                '#f39c12',  // orange
                '#f1c40f',  // yellow
                '#2ecc71',  // green
                '#3498db',  // blue
                '#9b59b6',  // purple
                '#1abc9c'   // teal
            ]);
    }

    // ── Tooltip ────────────────────────────────────────────────────────────

    let tooltipEl = null;

    /** Create or return the shared tooltip element */
    function getTooltip() {
        if (!tooltipEl) {
            tooltipEl = d3.select('body')
                .append('div')
                .attr('class', 'chart-tooltip')
                .style('opacity', 0);
        }
        return tooltipEl;
    }

    /** Show tooltip near the mouse with given HTML content */
    function showTooltip(event, html) {
        const tip = getTooltip();
        tip.html(html)
            .style('opacity', 1)
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 10) + 'px');
    }

    /** Hide the tooltip */
    function hideTooltip() {
        const tip = getTooltip();
        tip.style('opacity', 0);
    }

    // ── Miscellaneous ──────────────────────────────────────────────────────

    /** Debounce a function */
    function debounce(fn, ms = 250) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    /** Get the "No data" fill color for heatmap/map cells */
    function getNoDataColor() {
        return '#2a2a3e';
    }

    // ── Public API ─────────────────────────────────────────────────────────
    return {
        loadData,
        getUniqueYears,
        getUniqueRegions,
        getIncomeGroups,
        getCountryList,
        filterData,
        formatValue,
        formatPopulation,
        getUndernourishmentColorScale,
        getRegionColorScale,
        getTooltip,
        showTooltip,
        hideTooltip,
        debounce,
        getNoDataColor
    };
})();
