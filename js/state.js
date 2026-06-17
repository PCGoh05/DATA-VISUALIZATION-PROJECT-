/**
 * state.js — Global Dashboard State
 * 
 * Provides a shared reactive state object for the Global Hunger Risk Explorer.
 * All chart modules subscribe to state changes and re-render accordingly.
 */

const DashboardState = (() => {
    // ── Default values ─────────────────────────────────────────────────────
    const DEFAULTS = {
        selectedYear: 2012,
        selectedRegion: 'All',
        selectedCountry: null,      // iso3 code or null
        selectedMetric: 'undernourishment_pct',
        isPlaying: false
    };

    // ── Internal state ─────────────────────────────────────────────────────
    let state = { ...DEFAULTS };
    const listeners = [];

    /**
     * Subscribe a listener function. It will be called with (newState, changedKeys)
     * whenever setState() is called.
     * @param {Function} fn  Callback: fn(state, changedKeys)
     * @returns {Function} Unsubscribe function
     */
    function subscribe(fn) {
        listeners.push(fn);
        return () => {
            const idx = listeners.indexOf(fn);
            if (idx > -1) listeners.splice(idx, 1);
        };
    }

    /**
     * Merge partial new state and notify all listeners.
     * Only notifies if at least one value actually changed.
     * @param {Object} partial  Key-value pairs to merge
     */
    function setState(partial) {
        const changedKeys = [];
        for (const key of Object.keys(partial)) {
            if (state[key] !== partial[key]) {
                changedKeys.push(key);
            }
        }
        if (changedKeys.length === 0) return;

        state = { ...state, ...partial };

        for (const fn of listeners) {
            try {
                fn(state, changedKeys);
            } catch (err) {
                console.error('State listener error:', err);
            }
        }
    }

    /**
     * Get current state (returns a shallow copy).
     */
    function getState() {
        return { ...state };
    }

    /**
     * Reset all state values to defaults and notify listeners.
     */
    function resetState() {
        setState({ ...DEFAULTS });
    }

    return { subscribe, setState, getState, resetState, DEFAULTS };
})();
