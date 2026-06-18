/**
 * app.js — Main Dashboard Controller
 * 
 * Orchestrates data loading, control wiring, chart initialization,
 * and state subscriptions for the Global Hunger Risk Explorer.
 */

(function () {
    'use strict';

    let dashboardData = [];
    let countryList = [];
    let playInterval = null;

    // ── DOM References ─────────────────────────────────────────────────────
    const els = {
        loading:         document.getElementById('loading'),
        dashboard:       document.getElementById('dashboard'),
        yearSlider:      document.getElementById('yearSlider'),
        yearDisplay:     document.getElementById('yearDisplay'),
        btnPlay:         document.getElementById('btnPlay'),
        regionSelect:    document.getElementById('regionSelect'),

        countrySearch:   document.getElementById('countrySearch'),
        searchSuggestions: document.getElementById('searchSuggestions'),
        btnReset:        document.getElementById('btnReset'),
        countrySummary:  document.getElementById('countrySummary'),
    };

    // ── Initialize ─────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            dashboardData = await Utils.loadData();
            countryList = Utils.getCountryList(dashboardData);

            populateControls();
            wireControls();
            updateSliderProgress();

            // Show dashboard BEFORE chart init so containers have real dimensions
            els.loading.style.display = 'none';
            els.dashboard.style.display = 'block';

            // Now init charts (getBoundingClientRect needs visible containers)
            await initCharts();
            subscribeToState();

            // Trigger initial render (use _init to force notification even if year hasn't changed)
            DashboardState.setState({ _init: true });

        } catch (err) {
            console.error('Failed to initialize dashboard:', err);
            els.loading.querySelector('.loading-text').textContent =
                'Error loading data. Please ensure you are running a local server.';
        }
    });

    // ── Populate Controls from Data ────────────────────────────────────────
    function populateControls() {
        // Region dropdown
        const regions = Utils.getUniqueRegions(dashboardData);
        for (const region of regions) {
            const opt = document.createElement('option');
            opt.value = region;
            opt.textContent = region;
            els.regionSelect.appendChild(opt);
        }

        // Year slider range
        const years = Utils.getUniqueYears(dashboardData);
        if (years.length > 0) {
            els.yearSlider.min = years[0];
            els.yearSlider.max = years[years.length - 1];
        }
    }

    // ── Wire Controls to State ─────────────────────────────────────────────
    function wireControls() {
        // Year slider
        els.yearSlider.addEventListener('input', () => {
            const year = parseInt(els.yearSlider.value, 10);
            els.yearDisplay.textContent = year;
            updateSliderProgress();
            DashboardState.setState({ selectedYear: year });
        });

        // Play/Pause
        els.btnPlay.addEventListener('click', togglePlay);

        // Region
        els.regionSelect.addEventListener('change', () => {
            DashboardState.setState({ selectedRegion: els.regionSelect.value });
        });



        // Country search
        els.countrySearch.addEventListener('input', onSearchInput);
        els.countrySearch.addEventListener('focus', onSearchInput);
        els.countrySearch.addEventListener('keydown', onSearchKeydown);
        document.addEventListener('click', (e) => {
            if (!els.countrySearch.contains(e.target) && !els.searchSuggestions.contains(e.target)) {
                els.searchSuggestions.classList.remove('active');
            }
        });

        // Reset
        els.btnReset.addEventListener('click', () => {
            stopPlay();
            DashboardState.resetState();
            
            els.yearSlider.value = DashboardState.DEFAULTS.selectedYear;
            els.yearDisplay.textContent = DashboardState.DEFAULTS.selectedYear;
            els.regionSelect.value = DashboardState.DEFAULTS.selectedRegion;

            els.countrySearch.value = '';
            els.searchSuggestions.classList.remove('active');
            
            const sortSelect = document.getElementById('barSortMode');
            if (sortSelect) {
                sortSelect.value = 'highest';
                sortSelect.dispatchEvent(new Event('change'));
            }
            
            updateSliderProgress();
        });

        // Window resize
        window.addEventListener('resize', Utils.debounce(() => {
            DashboardState.setState({ _resize: Date.now() }); // trigger re-render
        }, 300));
    }

    // ── Year Slider Progress Track ─────────────────────────────────────────
    function updateSliderProgress() {
        const min = parseInt(els.yearSlider.min);
        const max = parseInt(els.yearSlider.max);
        const val = parseInt(els.yearSlider.value);
        const pct = ((val - min) / (max - min)) * 100;
        els.yearSlider.style.setProperty('--slider-progress', pct + '%');
    }

    // ── Play / Pause ───────────────────────────────────────────────────────
    function togglePlay() {
        const state = DashboardState.getState();
        if (state.isPlaying) {
            stopPlay();
        } else {
            startPlay();
        }
    }

    function startPlay() {
        const maxYear = parseInt(els.yearSlider.max);
        const minYear = parseInt(els.yearSlider.min);
        
        let current = DashboardState.getState().selectedYear;
        // If at the end, restart from the beginning
        if (current >= maxYear) {
            current = minYear;
            els.yearSlider.value = current;
            els.yearDisplay.textContent = current;
            updateSliderProgress();
            DashboardState.setState({ selectedYear: current });
        }

        DashboardState.setState({ isPlaying: true });
        els.btnPlay.textContent = '⏸';
        els.btnPlay.title = 'Pause animation';

        playInterval = setInterval(() => {
            const current = DashboardState.getState().selectedYear;
            const next = current + 1;

            if (next > maxYear) {
                stopPlay();
                return;
            }

            els.yearSlider.value = next;
            els.yearDisplay.textContent = next;
            updateSliderProgress();
            DashboardState.setState({ selectedYear: next });
        }, 1000);
    }

    function stopPlay() {
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
        }
        DashboardState.setState({ isPlaying: false });
        els.btnPlay.textContent = '▶';
        els.btnPlay.title = 'Play animation';
    }

    // ── Country Search ─────────────────────────────────────────────────────
    let highlightedIndex = -1;

    function onSearchInput() {
        const query = els.countrySearch.value.trim().toLowerCase();
        els.searchSuggestions.innerHTML = '';
        highlightedIndex = -1;

        if (!query) {
            els.searchSuggestions.classList.remove('active');
            return;
        }

        const matches = countryList.filter(c =>
            c.name.toLowerCase().includes(query) ||
            c.iso3.toLowerCase().includes(query)
        ).slice(0, 10);

        if (matches.length === 0) {
            els.searchSuggestions.classList.remove('active');
            return;
        }

        for (const match of matches) {
            const div = document.createElement('div');
            div.className = 'search-suggestion-item';
            div.textContent = match.name;
            div.addEventListener('click', () => selectCountry(match.iso3, match.name));
            els.searchSuggestions.appendChild(div);
        }
        els.searchSuggestions.classList.add('active');
    }

    function onSearchKeydown(e) {
        const items = els.searchSuggestions.querySelectorAll('.search-suggestion-item');
        if (!items.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
            updateHighlight(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightedIndex = Math.max(highlightedIndex - 1, 0);
            updateHighlight(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < items.length) {
                items[highlightedIndex].click();
            }
        } else if (e.key === 'Escape') {
            els.searchSuggestions.classList.remove('active');
        }
    }

    function updateHighlight(items) {
        items.forEach((el, i) => {
            el.classList.toggle('highlighted', i === highlightedIndex);
        });
    }

    function selectCountry(iso3, name) {
        els.countrySearch.value = name;
        els.searchSuggestions.classList.remove('active');
        DashboardState.setState({ selectedCountry: iso3 });
    }

    // ── Initialize Charts ──────────────────────────────────────────────────
    async function initCharts() {
        // Each chart module exposes an init(data) and update(state, changedKeys) function.
        if (typeof MapChart !== 'undefined')      await MapChart.init(dashboardData);
        if (typeof LineChart !== 'undefined')      LineChart.init(dashboardData);
        if (typeof BarChart !== 'undefined')       BarChart.init(dashboardData);
        if (typeof HeatmapChart !== 'undefined')   HeatmapChart.init(dashboardData);
        if (typeof ScatterPlot !== 'undefined')    ScatterPlot.init(dashboardData);
        if (typeof BoxPlotChart !== 'undefined')   BoxPlotChart.init(dashboardData);
    }

    // ── Subscribe to State Changes ─────────────────────────────────────────
    function subscribeToState() {
        DashboardState.subscribe((state, changedKeys) => {
            // Update Selected Country Summary
            updateSummaryCard(state);

            // Notify all charts
            if (typeof MapChart !== 'undefined')      MapChart.update(state, changedKeys);
            if (typeof LineChart !== 'undefined')      LineChart.update(state, changedKeys);
            if (typeof BarChart !== 'undefined')       BarChart.update(state, changedKeys);
            if (typeof HeatmapChart !== 'undefined')   HeatmapChart.update(state, changedKeys);
            if (typeof ScatterPlot !== 'undefined')    ScatterPlot.update(state, changedKeys);
            if (typeof BoxPlotChart !== 'undefined')   BoxPlotChart.update(state, changedKeys);
        });
    }

    // ── Selected Country Summary Card ──────────────────────────────────────
    function updateSummaryCard(state) {
        const container = els.countrySummary;
        if (!state.selectedCountry) {
            container.innerHTML = `
                <div class="summary-title">Selected Country</div>
                <div class="summary-empty">Click on a country in any chart to view details</div>
            `;
            return;
        }

        // Find country data for the selected year
        const row = dashboardData.find(d =>
            d.iso3 === state.selectedCountry && d.year === state.selectedYear
        );

        if (!row) {
            container.innerHTML = `
                <div class="summary-title">Selected Country</div>
                <div class="country-name">${state.selectedCountry}</div>
                <div class="summary-empty">No data for year ${state.selectedYear}</div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="summary-title">Selected Country</div>
            <div class="country-name">${row.country_name || state.selectedCountry}</div>
            <div class="summary-item">
                <span class="summary-label">Year</span>
                <span class="summary-value">${state.selectedYear}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Region</span>
                <span class="summary-value">${row.region || 'No data'}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Income Group</span>
                <span class="summary-value">${row.income_group || 'No data'}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Undernourishment (%)</span>
                <span class="summary-value highlight">${Utils.formatValue(row.undernourishment_pct)}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Food Production Index</span>
                <span class="summary-value">${Utils.formatValue(row.food_production_index)}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Population</span>
                <span class="summary-value">${Utils.formatPopulation(row.population_total)}</span>
            </div>
        `;
    }

})();
