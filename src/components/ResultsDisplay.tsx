'use client';

import React, { forwardRef, useMemo } from 'react';
import { ComposedChart, Line, Scatter, XAxis, YAxis, ResponsiveContainer, Legend, ErrorBar, BarChart, Bar } from 'recharts';
import { DataPoint, FittedCurve } from '../types';

interface ResultsDisplayProps {
  data: DataPoint[];
  fittedCurves: FittedCurve[];
  curveColors: string[];
  datasetName?: string;
  assayType?: string;
  onColorChange?: (index: number, color: string) => void;
  onCurveVisibilityChange?: (index: number, visible: boolean) => void;
  curveVisibility?: boolean[];
  datasets?: Array<{ id?: string; name: string; assayType?: string }>;
  activeDatasetIndex?: number;
  onDatasetChange?: (index: number) => void;
  hasReplicates?: boolean;
  globalChartSettings?: {
    showGroups: boolean;
    showIndividuals: boolean;
    showCurveChart: boolean;
    showBarChart: boolean;
  };
  onGlobalChartSettingsChange?: (setting: 'showGroups' | 'showIndividuals' | 'showCurveChart' | 'showBarChart', value: boolean) => void;
}

const ResultsDisplay = forwardRef<HTMLDivElement, ResultsDisplayProps>(({ 
  data, 
  fittedCurves, 
  curveColors, 
  datasetName, 
  assayType, 
  onColorChange, 
  onCurveVisibilityChange,
  curveVisibility = [],
  datasets, 
  activeDatasetIndex, 
  onDatasetChange, 
  hasReplicates = true,
  globalChartSettings,
  onGlobalChartSettingsChange
}, ref) => {
  console.log('ResultsDisplay received:', { data, fittedCurves, curveColors, datasetName, assayType });
  
  // Determine Y-axis label based on assay type
  const getYAxisLabel = () => {
    if (assayType) {
      const normalizedType = assayType.toLowerCase();
      if (normalizedType.includes('cytotoxicity') || normalizedType.includes('killing')) {
        return '% Cytotoxicity';
      } else if (normalizedType.includes('cd4') && normalizedType.includes('activation')) {
        return 'CD4 Activation (%)';
      } else if (normalizedType.includes('cd8') && normalizedType.includes('activation')) {
        return 'CD8 Activation (%)';
      } else if (normalizedType.includes('activation')) {
        return 'Activation (%)';
      } else if (normalizedType.includes('degranulation')) {
        return 'Degranulation (%)';
      } else if (normalizedType.includes('proliferation')) {
        return 'Proliferation (%)';
      } else if (normalizedType.includes('target')) {
        return 'Target Cells (%)';
      }
    }
    return 'Response (%)';
  };
  
  const yAxisLabel = getYAxisLabel();
  
  // Check if we have custom groups (multiple columns assigned to same group)
  // const hasCustomGroups = data[0]?.replicateGroups && 
  //   data[0].replicateGroups.length === data[0].sampleNames.length &&
  //   new Set(data[0].replicateGroups).size < data[0].replicateGroups.length;
  
  // Use global chart settings if available, otherwise fall back to local state
  const showGroups = globalChartSettings?.showGroups ?? true;
  const showIndividuals = globalChartSettings?.showIndividuals ?? true;
  const showCurveChart = globalChartSettings?.showCurveChart ?? true;
  const showBarChart = globalChartSettings?.showBarChart ?? false;

  // Identify group curves and individual curves
  const groupNames = Array.from(new Set((data[0]?.replicateGroups || []).filter(Boolean)));
  const groupCurves = fittedCurves.filter(curve => groupNames.includes(curve.sampleName) && curve.meanPoints && curve.meanPoints.length >= 3);
  const individualCurves = fittedCurves.filter(curve => data[0]?.sampleNames.includes(curve.sampleName));

  // Prepare bar chart data - always group by sample (moved before early returns to fix React Hook order)
  const barChartData = useMemo(() => {
    if (!showBarChart || !fittedCurves || fittedCurves.length === 0) return { data: [], allConcs: [] };
    const curvesToShow = (showGroups && groupCurves.length > 0) ? groupCurves : individualCurves;
    if (!curvesToShow || curvesToShow.length === 0) return { data: [], allConcs: [] };

    // Always group by sample: X-axis = samples, bars = concentrations
    const allConcsSet = new Set<number>();
    curvesToShow.forEach((curve, idx) => {
      if (curveVisibility?.[idx] !== false) {
        const points = curve.meanPoints && curve.meanPoints.length > 0 ? curve.meanPoints : curve.originalPoints;
        points?.forEach(pt => allConcsSet.add(pt.x));
      }
    });
    const allConcs = Array.from(allConcsSet).sort((a, b) => a - b);
    
    // Each row is a sample, each bar is a concentration
    const data: Record<string, unknown>[] = curvesToShow.map((curve, idx) => {
      const row: Record<string, unknown> = {
        sampleName: curve.sampleName
      };
      if (curveVisibility?.[idx] !== false) {
        const points = curve.meanPoints && curve.meanPoints.length > 0 ? curve.meanPoints : curve.originalPoints;
        allConcs.forEach((conc: number) => {
          const pt = points?.find(pt => Math.abs(pt.x - conc) < 1e-8);
          // Create separate data keys for each sample-concentration combination
          row[`${curve.sampleName}_${conc}`] = pt ? pt.y : null;
        });
      }
      return row;
    });
    return { data, allConcs };
  }, [showBarChart, showGroups, groupCurves, individualCurves, curveVisibility, fittedCurves]);

  // Debug logs
  console.log('ResultsDisplay: data[0]?.replicateGroups', data[0]?.replicateGroups);
  console.log('ResultsDisplay: data[0]?.sampleNames', data[0]?.sampleNames);
  console.log('ResultsDisplay: fittedCurves sampleNames', fittedCurves.map(c => c.sampleName));
  console.log('ResultsDisplay: groupNames', groupNames);
  console.log('ResultsDisplay: groupCurves', groupCurves.map(c => c.sampleName));
  console.log('ResultsDisplay: individualCurves', individualCurves.map(c => c.sampleName));
  console.log('ResultsDisplay: hasReplicates', hasReplicates);
  
  // Early return if no curves
  if (!fittedCurves || fittedCurves.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Results</h2>
        <div className="text-gray-600">No fitted curves available. Please fit curves first.</div>
      </div>
    );
  }
  
  // Check if we have any meanPoints
  const hasMeanPoints = fittedCurves.some(curve => curve.meanPoints && curve.meanPoints.length > 0);
  console.log('Has meanPoints:', hasMeanPoints);
  
  // Debug the data structure
  fittedCurves.forEach((curve, index) => {
    console.log(`Curve ${index} (${curve.sampleName}):`, {
      fittedPoints: curve.fittedPoints?.slice(0, 3), // First 3 points
      meanPoints: curve.meanPoints?.slice(0, 3), // First 3 points
      fittedPointsLength: curve.fittedPoints?.length,
      meanPointsLength: curve.meanPoints?.length
    });
  });
  
  // Get all concentrations for X axis
  const allConcentrations = new Set<number>();
  fittedCurves.forEach(curve => {
    curve.meanPoints?.forEach(pt => {
      if (pt.x > 0) allConcentrations.add(pt.x);
    });
  });
  const sortedConcentrations = Array.from(allConcentrations).sort((a, b) => a - b);
  console.log('Sorted concentrations:', sortedConcentrations);
  
  // Prepare original dots for each TCE (sample/column)
  const tceNames = data[0]?.sampleNames || [];
  const originalDotsByTCE: Record<string, { x: number; y: number }[]> = {};
  tceNames.forEach((name, colIdx) => {
    originalDotsByTCE[name] = [];
    data.forEach(row => {
      if (typeof row.responses[colIdx] === 'number' && !isNaN(row.responses[colIdx])) {
        originalDotsByTCE[name].push({ x: row.concentration, y: row.responses[colIdx] });
      }
    });
  });

  // Create chart data structure for ComposedChart
  // We need to combine all data points into a single array with proper keys
  const chartData: Record<string, number>[] = [];
  
  // Get all unique concentrations from fitted curves and original points
  const allConcentrationsSet = new Set<number>();
  
  // Add all fitted points for all curves to be displayed
  if (showGroups) {
    groupCurves.forEach((curve, idx) => {
      if (curveVisibility[idx] !== false) { // Only add if curve is visible
        curve.fittedPoints?.forEach(pt => allConcentrationsSet.add(pt.x));
        curve.meanPoints?.forEach(pt => allConcentrationsSet.add(pt.x));
      }
    });
  }
  if (showIndividuals) {
    individualCurves.forEach((curve, idx) => {
      if (curveVisibility[idx] !== false) { // Only add if curve is visible
        curve.fittedPoints?.forEach(pt => allConcentrationsSet.add(pt.x));
        curve.originalPoints?.forEach(pt => allConcentrationsSet.add(pt.x));
      }
    });
  }
  
  const allConcentrationsArray = Array.from(allConcentrationsSet).sort((a, b) => a - b);
  
  // Create chart data rows for each concentration
  allConcentrationsArray.forEach(concentration => {
    const row: Record<string, number> = { concentration };
    
    // Add fitted curve data (for smooth lines)
    if (showGroups) {
      groupCurves.forEach((curve, idx) => {
        if (curveVisibility[idx] !== false) { // Only add if curve is visible
          const fittedPoint = curve.fittedPoints?.find(pt => Math.abs(pt.x - concentration) < 1e-8);
          if (fittedPoint) {
            row[`${curve.sampleName}_fitted`] = fittedPoint.y;
          }
          // Add group mean dots with SEM
          const meanPoint = curve.meanPoints?.find(pt => Math.abs(pt.x - concentration) < 1e-8);
          if (meanPoint) {
            row[`${curve.sampleName}_mean`] = meanPoint.y;
            row[`${curve.sampleName}_sem`] = meanPoint.sem;
          }
        }
      });
    }
    if (showIndividuals) {
      individualCurves.forEach((curve, idx) => {
        if (curveVisibility[idx] !== false) { // Only add if curve is visible
          const fittedPoint = curve.fittedPoints?.find(pt => Math.abs(pt.x - concentration) < 1e-8);
          if (fittedPoint) {
            row[`${curve.sampleName}_fitted`] = fittedPoint.y;
          }
          const originalPoint = curve.originalPoints?.find(pt => Math.abs(pt.x - concentration) < 1e-8);
          if (originalPoint) {
            row[`${curve.sampleName}_original`] = originalPoint.y;
          }
        }
      });
    }
    chartData.push(row);
  });
  
  console.log('Chart data structure:', chartData.slice(0, 3)); // Show first 3 points
  console.log('Chart data length:', chartData.length);
  console.log('First chart data point:', chartData[0]);
  
  const hasZeroOrNegative = allConcentrationsArray.some(c => c <= 0);
  
  // Filter out zero/negative concentrations for log scale
  const validChartData = chartData.filter(row => row.concentration > 0);
  
  
  // Calculate domain for X-axis
  const minConcentration = validChartData.length > 0 ? Math.min(...validChartData.map(row => row.concentration)) : 0.1;
  const maxConcentration = validChartData.length > 0 ? Math.max(...validChartData.map(row => row.concentration)) : 1000;
  
  // Generate appropriate ticks based on concentration range
  const generateTicks = () => {
    const ticks = [];
    const minLog = Math.floor(Math.log10(minConcentration));
    const maxLog = Math.ceil(Math.log10(maxConcentration));
    
    console.log('Generating ticks:', { minLog, maxLog, minConcentration, maxConcentration });
    
    for (let i = minLog; i <= maxLog; i++) {
      const tick = Math.pow(10, i);
      if (tick >= minConcentration * 0.1 && tick <= maxConcentration * 10) {
        ticks.push(tick);
      }
    }
    
    console.log('Generated ticks:', ticks);
    return ticks.length > 0 ? ticks : [0.001, 0.01, 0.1, 1, 10, 100, 1000];
  };
  
  const xAxisTicks = generateTicks();
  
  console.log('Valid chart data for rendering:', validChartData);
  console.log('Concentration range:', { min: minConcentration, max: maxConcentration });

  // After building validChartData, ensure all *_sem values are finite numbers for ErrorBar
  individualCurves.forEach(curve => {
    const semKey = `${curve.sampleName}_sem`;
    validChartData.forEach(row => {
      if (!Number.isFinite(row[semKey])) {
        row[semKey] = 0;
      }
    });
  });

  console.log('data[0].sampleNames:', data[0]?.sampleNames);
  console.log('fittedCurves sampleNames:', fittedCurves.map(c => c.sampleName));
  console.log('individualCurves:', individualCurves);
  console.log('validChartData:', validChartData);

  return (
    <div ref={ref} className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
        <svg className="w-6 h-6 mr-2 text-[#8A0051]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Results
      </h2>
      {hasZeroOrNegative && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center text-sm text-amber-800">
          <svg className="w-5 h-5 mr-2 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span><strong>Warning:</strong> Concentration values ≤ 0 are not shown on the log-scale chart.</span>
        </div>
      )}
      
      {validChartData.length === 0 ? (
        <div className="text-red-600 font-bold">No data to display. Please check your input data and curve fitting.</div>
      ) : (
        <div className="space-y-6">
          {/* Summary Statistics */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Summary Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fittedCurves.map((curve, index) => (
                <div key={`${curve.sampleName || 'curve'}_${index}_summary`} className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center mb-3">
                    <div 
                      className="w-4 h-4 rounded-full mr-3 border-2 border-white shadow-sm"
                      style={{ backgroundColor: curveColors[index] || '#8884d8' }}
                    />
                    <h4 className="font-semibold text-gray-900">{curve.sampleName}{groupNames.includes(curve.sampleName) ? ' (Group)' : ''}</h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">EC10:</span>
                      <span className="font-medium text-gray-900">{curve.ec10 ? curve.ec10.toFixed(4) : 'N/A'} nM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">EC50:</span>
                      <span className="font-medium text-gray-900">{curve.ec50.toFixed(4)} nM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">EC90:</span>
                      <span className="font-medium text-gray-900">{curve.ec90 ? curve.ec90.toFixed(4) : 'N/A'} nM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Hill Slope:</span>
                      <span className="font-medium text-gray-900">{curve.hillSlope.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">R²:</span>
                      <span className={`font-medium ${curve.rSquared >= 0.9 ? 'text-green-600' : curve.rSquared >= 0.8 ? 'text-yellow-600' : 'text-red-600'}`}>{curve.rSquared.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Top:</span>
                      <span className="font-medium text-gray-900">{curve.top.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Bottom:</span>
                      <span className="font-medium text-gray-900">{curve.bottom.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Editor Section */}
          {(onColorChange || onCurveVisibilityChange) && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Editor</h3>
              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                {/* Chart Display Controls */}
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Chart Display Options</h4>
                  <div className="flex flex-wrap gap-6 items-center">
                    {/* Data Display Options */}
                    <div className="flex gap-4 items-center">
                      {hasReplicates && (
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={showGroups} onChange={e => onGlobalChartSettingsChange?.('showGroups', e.target.checked)} className="w-4 h-4" />
                          <span className="text-sm">Show Replicate Groups</span>
                        </label>
                      )}
                      {hasReplicates && (
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={showIndividuals} onChange={e => onGlobalChartSettingsChange?.('showIndividuals', e.target.checked)} className="w-4 h-4" />
                          <span className="text-sm">Show Individual Data</span>
                        </label>
                      )}
                    </div>
                    
                    {/* Chart Type Toggle */}
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium">Chart Types:</span>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            checked={showCurveChart} 
                            onChange={e => onGlobalChartSettingsChange?.('showCurveChart', e.target.checked)} 
                            className="w-4 h-4"
                          />
                          <span className="text-sm">Curve Chart</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            checked={showBarChart} 
                            onChange={e => onGlobalChartSettingsChange?.('showBarChart', e.target.checked)} 
                            className="w-4 h-4"
                          />
                          <span className="text-sm">Bar Chart</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Color and Visibility Controls */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Sample Colors & Visibility</h4>
                  <div className="flex flex-wrap gap-4">
                    {individualCurves.map((curve, idx) => (
                      <div key={`${curve.sampleName || 'curve'}_${idx}`} className="flex items-center gap-3 p-2 border border-gray-200 rounded">
                        {/* Visibility checkbox */}
                        {onCurveVisibilityChange && (
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={curveVisibility[idx] !== false}
                              onChange={e => onCurveVisibilityChange(idx, e.target.checked)}
                              className="w-4 h-4"
                            />
                            <span className="text-xs text-gray-600">Show</span>
                          </label>
                        )}
                        
                        {/* Sample name */}
                        <span className="text-sm font-medium min-w-[80px]">{curve.sampleName}</span>
                        
                        {/* Color picker */}
                        {onColorChange && (
                          <input
                            type="color"
                            value={curveColors[idx] || '#8884d8'}
                            onChange={e => onColorChange(idx, e.target.value)}
                            className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dataset Selection Section */}
          {datasets && datasets.length > 1 && fittedCurves.length > 0 && onDatasetChange && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Select Dataset</h3>
              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex flex-wrap gap-2">
                  {datasets.map((dataset, index) => {
                    // Use the best keyword for the tab label
                    let label = dataset.name;
                    const genericPattern = /^data table/i;
                    if (genericPattern.test(label)) {
                      // Try to find a better keyword in sample names
                      const sampleText = (dataset.name || '').toLowerCase();
                      if (sampleText.includes('cytotoxicity') || sampleText.includes('killing')) {
                        label = 'Cytotoxicity';
                      } else if (sampleText.includes('cd4')) {
                        label = 'CD4 Activation';
                      } else if (sampleText.includes('cd8')) {
                        label = 'CD8 Activation';
                      }
                    }
                    return (
                      <button
                        key={`${dataset.id || ''}_${index}`}
                        onClick={() => onDatasetChange(index)}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                          index === activeDatasetIndex
                            ? 'bg-[#8A0051] text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Concentration-Response Curves */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              {datasetName ? `${datasetName} - Concentration-Response Curves` : 'Concentration-Response Curves'}
            </h3>
            <div className="space-y-6">
              {/* Curve Chart Section */}
              {showCurveChart && (
                <div>
                  <div className="h-[600px] lg:h-[700px] w-full bg-white border border-gray-200 rounded-lg p-4 relative" data-testid="chart-container">
                    {/* Y-axis title positioned simply and consistently */}
                    <div 
                      className="absolute"
                      style={{
                        left: '15px',
                        top: 'calc(50% - 50px)',
                        fontSize: '22px',
                        fontFamily: 'Arial, sans-serif',
                        fontWeight: 'bold',
                        color: '#000000',
                        whiteSpace: 'nowrap',
                        zIndex: 10,
                        transformOrigin: 'center center',
                        transform: 'translateY(-50%) rotate(-90deg)',
                        pointerEvents: 'none'
                      }}
                      data-y-axis-label="true"
                    >
                      {yAxisLabel}
                    </div>
                    
                    <ResponsiveContainer width="100%" height="100%" minWidth={800} data-testid="concentration-response-chart" className="recharts-responsive-container">
                    <ComposedChart data={validChartData}
                      margin={{ top: 60, right: 150, left: 80, bottom: 120 }}
                      data-testid="main-chart-svg"
                    >
                      <XAxis 
                        dataKey="concentration"
                        type="number"
                        scale="log"
                        domain={[minConcentration * 0.1, maxConcentration * 10]}
                        label={{ 
                          value: 'Concentration [nM]', 
                          position: 'bottom', 
                          offset: 15, 
                          fontSize: 24, 
                          fontFamily: 'Arial, sans-serif',
                          fontWeight: 'bold',
                          fill: '#000000'
                        }}
                        tickFormatter={value => {
                          if (value <= 0) return '';
                          const exponent = Math.floor(Math.log10(value));
                          if (exponent < 0) {
                            const absExponent = Math.abs(exponent);
                            if (absExponent === 1) return '10⁻¹';
                            if (absExponent === 2) return '10⁻²';
                            if (absExponent === 3) return '10⁻³';
                            if (absExponent === 4) return '10⁻⁴';
                            if (absExponent === 5) return '10⁻⁵';
                            if (absExponent === 6) return '10⁻⁶';
                            if (absExponent === 7) return '10⁻⁷';
                            if (absExponent === 8) return '10⁻⁸';
                            if (absExponent === 9) return '10⁻⁹';
                            return `10⁻${absExponent}`;
                          } else if (exponent === 0) {
                            return '10⁰';
                          } else if (exponent === 1) {
                            return '10¹';
                          } else if (exponent === 2) {
                            return '10²';
                          } else if (exponent === 3) {
                            return '10³';
                          } else if (exponent === 4) {
                            return '10⁴';
                          } else if (exponent === 5) {
                            return '10⁵';
                          } else if (exponent === 6) {
                            return '10⁶';
                          } else if (exponent === 7) {
                            return '10⁷';
                          } else if (exponent === 8) {
                            return '10⁸';
                          } else if (exponent === 9) {
                            return '10⁹';
                          } else {
                            return `10${exponent}`;
                          }
                        }}
                        ticks={xAxisTicks}
                        tick={{ fontSize: 22, fontFamily: 'Arial, sans-serif', fontWeight: 'bold' }}
                        allowDataOverflow={false}
                        axisLine={{ stroke: '#000000', strokeWidth: 2 }}
                      />
                      <YAxis
                        label={{ 
                          value: '', // Remove to avoid duplicate
                          angle: -90, 
                          position: 'outside',
                          fontSize: 22, 
                          fontFamily: 'Arial, sans-serif', 
                          fontWeight: 'bold',
                          offset: 70,
                          textAnchor: 'middle',
                          fill: '#000000'
                        }}
                        domain={[0, 100]}
                        ticks={[0, 20, 40, 60, 80, 100]}
                        tick={{ fontSize: 22, fontFamily: 'Arial, sans-serif', fontWeight: 'bold' }}
                        axisLine={{ stroke: '#000000', strokeWidth: 2 }}
                      />
                      {/* Enhanced Legend for PDF */}
                      <Legend 
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                        iconType="square"
                        wrapperStyle={{ 
                          right: 0, 
                          fontSize: 16, 
                          fontFamily: 'Arial, sans-serif',
                          fontWeight: 'bold',
                          maxWidth: 120,
                          padding: '8px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #cccccc',
                          borderRadius: '5px'
                        }}
                      />
                      {/* Fitted curves for groups */}
                      {showGroups && groupCurves.map((curve, index) => 
                        curveVisibility[index] !== false ? [
                          <Line
                            key={`${curve.sampleName || 'group'}_${index}_fitted`}
                            type="monotone"
                            dataKey={`${curve.sampleName}_fitted`}
                            stroke={curveColors[index % curveColors.length] || '#000000'}
                            strokeWidth={3}
                            dot={false}
                            connectNulls={true}
                            legendType="line"
                            name={`${curve.sampleName} (Group)`}
                          />,
                          <Scatter
                            key={`${curve.sampleName || 'group'}_${index}_meanDots`}
                            name={`${curve.sampleName} Mean ± SEM`}
                            dataKey={`${curve.sampleName}_mean`}
                            fill={curveColors[index % curveColors.length] || '#000000'}
                            shape="circle"
                            legendType="circle"
                            r={7}
                          >
                            <ErrorBar
                              key={`errorbar-${curve.sampleName || 'group'}-${index}`}
                              dataKey={`${curve.sampleName}_sem`}
                              width={6}
                              stroke={curveColors[index % curveColors.length] || '#000000'}
                              direction="y"
                              strokeWidth={2}
                            />
                          </Scatter>
                        ] : null
                      ).flat().filter(Boolean)}
                      {/* Fitted curves for individuals */}
                      {showIndividuals && individualCurves.map((curve, index) => 
                        curveVisibility[index] !== false ? [
                          <Line
                            key={`${curve.sampleName || 'curve'}_${index}_fitted`}
                            type="monotone"
                            dataKey={`${curve.sampleName}_fitted`}
                            stroke={curveColors[index % curveColors.length] || '#000000'}
                            strokeWidth={3}
                            dot={false}
                            connectNulls={true}
                            legendType="line"
                            name={curve.sampleName}
                          />,
                          <Scatter
                            key={`${curve.sampleName || 'curve'}_${index}_original`}
                            name={curve.sampleName}
                            dataKey={`${curve.sampleName}_original`}
                            fill={curveColors[index % curveColors.length] || '#000000'}
                            shape="square"
                            legendType="none"
                            r={5}
                          />
                        ] : null
                      ).flat().filter(Boolean)}
                    </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              
              {/* Bar Chart - shown when showBarChart is true */}
              {showBarChart && barChartData.data.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Bar Chart View</h4>
                  <div className="h-[600px] lg:h-[700px] w-full bg-white border border-gray-200 rounded-lg p-4 relative" data-testid="bar-chart-container">
                    {/* Y-axis title for bar chart */}
                    <div 
                      className="absolute"
                      style={{
                        left: '15px',
                        top: 'calc(50% - 50px)',
                        fontSize: '22px',
                        fontFamily: 'Arial, sans-serif',
                        fontWeight: 'bold',
                        color: '#000000',
                        whiteSpace: 'nowrap',
                        zIndex: 10,
                        transformOrigin: 'center center',
                        transform: 'translateY(-50%) rotate(-90deg)',
                        pointerEvents: 'none'
                      }}
                      data-y-axis-label="true"
                    >
                      {yAxisLabel}
                    </div>
                    
                    <ResponsiveContainer width="100%" height="100%" minWidth={800} className="recharts-responsive-container">
                      <BarChart data={barChartData.data}
                        margin={{ top: 60, right: 80, left: 80, bottom: 120 }}
                        data-testid="bar-chart-svg"
                        barGap={-10}
                        barCategoryGap={1}
                        maxBarSize={200}
                      >
                        <XAxis
                          dataKey="sampleName"
                          type="category"
                          label={{
                            value: 'Sample',
                            position: 'bottom',
                            offset: 15,
                            fontSize: 24,
                            fontFamily: 'Arial, sans-serif',
                            fontWeight: 'bold',
                            fill: '#000000'
                          }}
                          tick={{ fontSize: 16, fontFamily: 'Arial, sans-serif', fontWeight: 'bold' }}
                          axisLine={{ stroke: '#000000', strokeWidth: 2 }}
                        />
                        <YAxis
                          label={{ 
                            value: '', // Remove to avoid duplicate
                            angle: -90, 
                            position: 'outside',
                            fontSize: 22, 
                            fontFamily: 'Arial, sans-serif', 
                            fontWeight: 'bold',
                            offset: 70,
                            textAnchor: 'middle',
                            fill: '#000000'
                          }}
                          domain={[0, 100]}
                          ticks={[0, 20, 40, 60, 80, 100]}
                          tick={{ fontSize: 22, fontFamily: 'Arial, sans-serif', fontWeight: 'bold' }}
                          axisLine={{ stroke: '#000000', strokeWidth: 2 }}
                        />

                        {/* Show all concentrations with reduced spacing */}
                        {barChartData.allConcs.map((conc: number) => {
                          const curvesToShow = (showGroups && groupCurves.length > 0) ? groupCurves : individualCurves;
                          return curvesToShow.map((curve, sampleIdx) => {
                            if (curveVisibility?.[sampleIdx] !== false) {
                              return (
                                <Bar
                                  key={`${curve.sampleName}_${conc}`}
                                  dataKey={`${curve.sampleName}_${conc}`}
                                  fill={curveColors[sampleIdx % curveColors.length] || '#000000'}
                                  name={curve.sampleName}
                                  radius={[4, 4, 0, 0]}
                                  maxBarSize={200}
                                />
                              );
                            }
                            return null;
                          });
                        }).flat().filter(Boolean)}
                      </BarChart>
                    </ResponsiveContainer>
                    
                    {/* Custom Legend - only one entry per sample */}
                    <div className="absolute top-4 right-4 bg-white border border-gray-300 rounded-lg p-3 shadow-sm">
                      <div className="text-sm font-medium text-gray-700 mb-2">Legend</div>
                      <div className="space-y-1">
                        {(() => {
                          const curvesToShow = (showGroups && groupCurves.length > 0) ? groupCurves : individualCurves;
                          return curvesToShow
                            .filter((curve, idx) => curveVisibility?.[idx] !== false)
                            .map((curve, idx) => (
                              <div key={curve.sampleName} className="flex items-center gap-2">
                                <div 
                                  className="w-4 h-4 rounded-sm"
                                  style={{ backgroundColor: curveColors[idx % curveColors.length] || '#000000' }}
                                />
                                <span className="text-sm font-medium">{curve.sampleName}</span>
                              </div>
                            ));
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {!showCurveChart && !showBarChart && (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  No charts enabled. Please enable &quot;Curve Chart&quot; or &quot;Bar Chart&quot; to view data visualization.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ResultsDisplay.displayName = 'ResultsDisplay';

export default ResultsDisplay;