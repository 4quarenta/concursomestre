/**
 * useQuestionFilters Hook
 * Manages question filtering state and logic
 */

import { useState, useCallback, useMemo } from 'react';
import type { QuestionFilters } from '../types';

const DEFAULT_FILTERS: QuestionFilters = {
    keyword: '',
    subject: 'All',
    difficulty: 'All',
    agency: 'All',
    year: 'All',
    level: 'All',
    topic: 'All',
    role: 'All',
    modality: 'All',
    onlySaved: false,
    hasTeacherComment: false,
    hasDetailedComment: false,
    excludeCanceled: false,
    excludeOutdated: false,
    excludeAnswered: false,
};

export const useQuestionFilters = () => {
    const [filters, setFilters] = useState<QuestionFilters>(DEFAULT_FILTERS);
    const [pendingFilters, setPendingFilters] = useState<QuestionFilters>(DEFAULT_FILTERS);

    // Update a single filter
    const updateFilter = useCallback((key: keyof QuestionFilters, value: any) => {
        setPendingFilters(prev => ({ ...prev, [key]: value }));
    }, []);

    // Apply pending filters
    const applyFilters = useCallback(() => {
        setFilters(pendingFilters);
    }, [pendingFilters]);

    // Clear a specific filter
    const clearFilter = useCallback((key: keyof QuestionFilters) => {
        const defaultValue = DEFAULT_FILTERS[key];
        setFilters(prev => ({ ...prev, [key]: defaultValue }));
        setPendingFilters(prev => ({ ...prev, [key]: defaultValue }));
    }, []);

    // Reset all filters
    const resetFilters = useCallback(() => {
        setFilters(DEFAULT_FILTERS);
        setPendingFilters(DEFAULT_FILTERS);
    }, []);

    // Check if any filters are active
    const hasActiveFilters = useMemo(() => {
        return Object.entries(filters).some(([key, value]) => {
            if (key === 'keyword') return value !== '';
            if (typeof value === 'boolean') return value === true;
            return value !== 'All';
        });
    }, [filters]);

    // Get active filter count
    const activeFilterCount = useMemo(() => {
        return Object.entries(filters).filter(([key, value]) => {
            if (key === 'keyword') return value !== '';
            if (typeof value === 'boolean') return value === true;
            return value !== 'All';
        }).length;
    }, [filters]);

    return {
        filters,
        pendingFilters,
        updateFilter,
        applyFilters,
        clearFilter,
        resetFilters,
        hasActiveFilters,
        activeFilterCount,
    };
};

export default useQuestionFilters;
