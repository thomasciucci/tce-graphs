'use client';

import { useState } from 'react';
import { DataPoint, FittedCurve } from '../types';
// Helper to calculate mean and SEM
function mean(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function sem(arr: number[]) {
  if (arr.length <= 1) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance / arr.length);
}

interface CurveFitterProps {
  data: DataPoint[];
  onCurveFitting: (curves: FittedCurve[]) => void;
  isProcessing: boolean;
  curveColors: string[];
  setCurveColors: React.Dispatch<React.SetStateAction<string[]>>;
  onRefresh?: () => void;
  showFitButton?: boolean; // NEW PROP
  onProcessingChange?: (processing: boolean) => void;
}

export default function CurveFitter({ data, onCurveFitting, isProcessing, curveColors, setCurveColors, onRefresh, showFitButton = true, onProcessingChange }: CurveFitterProps) {
  const [fittedCurves, setFittedCurves] = useState<FittedCurve[]>([]);
  const [progress, setProgress] = useState(0);

  // Four-parameter logistic equation
  const fourParameterLogistic = (x: number, top: number, bottom: number, ec50: number, hillSlope: number): number => {
    const denominator = 1 + (Math.pow(2, 1 / hillSlope) - 1) * Math.pow(ec50 / x, hillSlope);
    const numerator = top - bottom;
    return bottom + (numerator / denominator);
  };

  // Calculate R-squared
  const calculateRSquared = (actual: number[], predicted: number[]): number => {
    const mean = actual.reduce((sum, val) => sum + val, 0) / actual.length;
    const ssRes = actual.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0);
    const ssTot = actual.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
    return 1 - (ssRes / ssTot);
  };

  // Simple curve fitting using grid search
  const fitCurve = (concentrations: number[], responses: number[]): FittedCurve => {
    // Ensure all data is used at full precision
    const X = concentrations.map(Number);
    const Y = responses.map(Number);

    let bestTop = Math.max(...Y);
    let bestBottom = Math.min(...Y);
    let bestEc50 = 1;
    let bestHillSlope = 1;
    let bestRSquared = -Infinity;

    // Finer grid search ranges
    const topRange = Array.from({length: 41}, (_, i) => bestTop - 10 + i * 0.5); // 20 points around observed max
    const bottomRange = Array.from({length: 41}, (_, i) => bestBottom - 10 + i * 0.5); // 20 points around observed min
    const ec50Range = Array.from({length: 40}, (_, i) => Math.pow(10, -3 + i * 0.1)); // logspace from 0.001 to 1000
    const hillSlopeRange = Array.from({length: 36}, (_, i) => 0.5 + i * 0.1); // 0.5 to 4.0 in 0.1 steps

    for (const top of topRange) {
      for (const bottom of bottomRange) {
        if (bottom >= top) continue;
        for (const ec50 of ec50Range) {
          for (const hillSlope of hillSlopeRange) {
            const predicted = X.map(x => fourParameterLogistic(x, top, bottom, ec50, hillSlope));
            const rSquared = calculateRSquared(Y, predicted);
            if (rSquared > bestRSquared) {
              bestRSquared = rSquared;
              bestTop = top;
              bestBottom = bottom;
              bestEc50 = ec50;
              bestHillSlope = hillSlope;
            }
          }
        }
      }
    }

    // Generate fitted curve points with better distribution
    const minConc = Math.max(1e-6, Math.min(...X.filter(c => c > 0)));
    const maxConc = Math.max(...X);
    const fittedPoints = [];
    
    // Generate points in log space for better curve representation
    const logMin = Math.log10(minConc * 0.1);
    const logMax = Math.log10(maxConc * 10);
    const numPoints = 100;
    
    for (let i = 0; i <= numPoints; i++) {
      const logX = logMin + (i / numPoints) * (logMax - logMin);
      const x = Math.pow(10, logX);
      fittedPoints.push({
        x,
        y: fourParameterLogistic(x, bestTop, bestBottom, bestEc50, bestHillSlope)
      });
    }

    const originalPoints = X.map((x, i) => ({
      x,
      y: Y[i]
    }));

    return {
      sampleName: 'Sample',
      ec50: bestEc50,
      hillSlope: bestHillSlope,
      top: bestTop,
      bottom: bestBottom,
      rSquared: bestRSquared,
      fittedPoints,
      originalPoints
    };
  };

  const handleFitCurves = async () => {
    try {
      // Set processing state to true at the start
      if (onProcessingChange) {
        onProcessingChange(true);
      }
      
      console.log('Starting curve fitting with data:', data);
      
      // Add a small delay to show the progress bar
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Group columns by replicate group
      const sampleNames = data[0]?.sampleNames || [];
      console.log('Sample names:', sampleNames);
      let replicateGroups = data[0]?.replicateGroups;
      console.log('Replicate groups:', replicateGroups);
      
      // Check if user has defined custom replicate groups (multiple columns assigned to same group)
      const hasCustomGroups = replicateGroups && 
        replicateGroups.length === sampleNames.length &&
        new Set(replicateGroups).size < replicateGroups.length; // If fewer unique groups than columns, we have replicates
      
      if (!replicateGroups || replicateGroups.length !== sampleNames.length) {
        replicateGroups = sampleNames.map((_, i) => `Group ${i + 1}`);
        console.log('Using default replicate groups:', replicateGroups);
      }
      
      const groupMap: { [group: string]: number[] } = {};
      replicateGroups.forEach((group, i) => {
        if (!groupMap[group]) groupMap[group] = [];
        groupMap[group].push(i);
      });
      console.log('Group map:', groupMap);

      const concentrations = data.map(d => d.concentration);
      console.log('Concentrations:', concentrations);
      const curves: FittedCurve[] = [];
      
      // Fallback: if no groups are created, treat each column as its own TCE
      if (Object.keys(groupMap).length === 0) {
        console.log('No groups created, treating each column as its own TCE');
        sampleNames.forEach((name, i) => {
          groupMap[name] = [i];
        });
      }
      
      // Calculate total number of curves to fit for progress tracking
      const totalCurves = hasCustomGroups 
        ? Object.keys(groupMap).length + sampleNames.length 
        : Object.keys(groupMap).length;
      let completedCurves = 0;
      
      // Initialize progress
      setProgress(0);
      
      if (hasCustomGroups) {
        // User has defined custom replicate groups - fit curves for groups AND individual replicates
        for (const [group, colIndices] of Object.entries(groupMap)) {
          try {
            console.log(`Processing group ${group} with columns:`, colIndices);
            // For each concentration, collect all replicate values for this group
            const meanResponses: number[] = [];
            const sems: number[] = [];
            for (let row = 0; row < data.length; row++) {
              const reps = colIndices.map(col => data[row].responses?.[col]).filter(v => typeof v === 'number' && !isNaN(v));
              console.log(`Row ${row}, group ${group}, reps:`, reps);
              if (reps.length === 0) {
                meanResponses.push(NaN);
                sems.push(0);
              } else {
                meanResponses.push(mean(reps));
                sems.push(sem(reps));
              }
            }
            console.log(`Group ${group} mean responses:`, meanResponses);
            // Only fit if we have at least 3 valid points
            const validMeans = meanResponses.filter(v => typeof v === 'number' && !isNaN(v));
            if (validMeans.length < 3) {
              console.warn(`Group ${group} skipped: not enough valid data for fitting.`);
              completedCurves++;
              continue;
            }
            const curve = fitCurve(concentrations, meanResponses.map(v => (typeof v === 'number' && !isNaN(v) ? v : 0)));
            curve.sampleName = group;
            curve.meanPoints = concentrations.map((x, i) => ({ x, y: meanResponses[i], sem: sems[i] }));
            
            console.log(`Created curve for group ${group}:`, {
              sampleName: curve.sampleName,
              ec50: curve.ec50,
              fittedPointsCount: curve.fittedPoints?.length || 0,
              originalPointsCount: curve.originalPoints?.length || 0,
            });
            
            curves.push(curve);
            completedCurves++;
            // Update progress
            setProgress((completedCurves / totalCurves) * 100);
            // Add small delay to show progress
            await new Promise(resolve => setTimeout(resolve, 50));
          } catch (err) {
            console.error(`Error fitting group ${group}:`, err);
            completedCurves++;
          }
        }
        
        // Also fit individual replicates for the table
        for (let i = 0; i < sampleNames.length; i++) {
          const name = sampleNames[i];
          try {
            const responses = data.map(d => d.responses[i]);
            const validResponses = responses.filter(v => typeof v === 'number' && !isNaN(v));
            if (validResponses.length < 3) {
              console.warn(`Individual replicate ${name} skipped: not enough valid data for fitting.`);
              completedCurves++;
              continue;
            }
            const curve = fitCurve(concentrations, responses.map(v => (typeof v === 'number' && !isNaN(v) ? v : 0)));
            curve.sampleName = name;
            curve.originalPoints = concentrations.map((x, idx) => ({ x, y: responses[idx] }));
            
            console.log(`Created individual curve for ${name}:`, {
              sampleName: curve.sampleName,
              ec50: curve.ec50,
            });
            
            curves.push(curve);
            completedCurves++;
            
            // Add small delay to show progress
            await new Promise(resolve => setTimeout(resolve, 50));
          } catch (err) {
            console.error(`Error fitting individual replicate ${name}:`, err);
            completedCurves++;
          }
        }
      } else {
        // No custom groups - treat each column as individual sample
        for (const [group, colIndices] of Object.entries(groupMap)) {
          try {
            console.log(`Processing ${group} with columns:`, colIndices);
            const responses = data.map(d => d.responses[colIndices[0]]);
            const validResponses = responses.filter(v => typeof v === 'number' && !isNaN(v));
            if (validResponses.length < 3) {
              console.warn(`${group} skipped: not enough valid data for fitting.`);
              completedCurves++;
              continue;
            }
            const curve = fitCurve(concentrations, responses.map(v => (typeof v === 'number' && !isNaN(v) ? v : 0)));
            // Use the actual sample name instead of the group name
            curve.sampleName = sampleNames[colIndices[0]];
            curve.originalPoints = concentrations.map((x, i) => ({ x, y: responses[i] }));
            
            console.log(`Created curve for ${sampleNames[colIndices[0]]}:`, {
              sampleName: curve.sampleName,
              ec50: curve.ec50,
              fittedPointsCount: curve.fittedPoints?.length || 0,
              originalPointsCount: curve.originalPoints?.length || 0,
            });
            
            curves.push(curve);
            completedCurves++;
            
            // Add small delay to show progress
            await new Promise(resolve => setTimeout(resolve, 50));
          } catch (err) {
            console.error(`Error fitting ${sampleNames[colIndices[0]]}:`, err);
            completedCurves++;
          }
        }
      }
      
      console.log('Final curves:', curves);
      if (curves.length === 0) {
        alert('No valid curves could be fitted. Please check your data and replicate assignments.');
      }
      setFittedCurves(curves);
      setCurveColors(curves.map((_, idx) => defaultColors[idx % defaultColors.length]));
      onCurveFitting(curves);
    } catch (err) {
      console.error('Curve fitting failed:', err);
      alert('Curve fitting failed. Please check your data.');
      setFittedCurves([]);
      onCurveFitting([]);
    }
  };

  // Default color palette
  const defaultColors = [
    '#1f77b4', '#2ca02c', '#ff7f0e', '#d62728', '#9467bd', '#8c564b', // Blue, Light Green, Orange, Brown, Purple, Dark Green
    '#e377c2', '#7f7f7f', '#bcbd22', '#17becf', '#a6cee3', '#fb9a99',
    '#fdbf6f', '#cab2d6', '#ffff99', '#b15928', '#fdb462', '#b3de69', '#fccde5', '#d9d9d9'
  ];

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Curve Fitting</h2>
      
      <div className="space-y-4">
        <div className="bg-[#8A0051]/10 border border-[#8A0051]/30 rounded-md p-4">
          <h3 className="font-medium text-[#8A0051] mb-2">Four-Parameter Logistic Equation</h3>
          <p className="text-[#8A0051]/80 text-sm">
            Y = Bottom + (Top - Bottom) / (1 + (2^(1/HillSlope) - 1) * (EC50/X)^HillSlope)
          </p>
          <p className="text-[#8A0051]/80 text-sm mt-2">
            All parameters (Top, Bottom, EC50, Hill Slope) are optimized during curve fitting
          </p>
        </div>
        
        {showFitButton && (
          <div>
            <button
              onClick={handleFitCurves}
              disabled={data.length === 0 || isProcessing}
              className="w-full px-4 py-2 bg-[#8A0051] text-white rounded-md hover:bg-[#6A003F] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Calculating Results...' : 'Calculate Results'}
            </button>
            {isProcessing && (
              <div className="mt-3">
                <div className="mb-2 text-[#8A0051] text-sm font-medium">
                  Calculating results... {Math.round(progress)}%
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-[#8A0051] h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <div className="mt-1 text-gray-600 text-xs">
                  Processing data...
                </div>
              </div>
            )}
          </div>
        )}
        
        {fittedCurves.length > 0 && (
          <div className="mt-4">
            <h3 className="font-medium text-gray-900 mb-2">Fitted Parameters</h3>
            <div className="space-y-2">
              {fittedCurves.map((curve, index) => (
                <div key={`${curve.sampleName || 'curve'}_${index}_params`} className="bg-gray-50 p-3 rounded">
                  <h4 className="font-medium text-gray-900">{curve.sampleName}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mt-1">
                    <div>EC50: {curve.ec50.toFixed(4)} nM</div>
                    <div>Hill Slope: {curve.hillSlope.toFixed(4)}</div>
                    <div>R²: {curve.rSquared.toFixed(4)}</div>
                  </div>
                  {/* Color Picker */}
                  <div className="mt-2 flex items-center gap-2">
                    <label htmlFor={`color-picker-${curve.sampleName || 'curve'}_${index}`}>Curve Color:</label>
                    <input
                      id={`color-picker-${curve.sampleName || 'curve'}_${index}`}
                      type="color"
                      value={curveColors[index] || defaultColors[index % defaultColors.length]}
                      onChange={e => {
                        const newColors = [...curveColors];
                        newColors[index] = e.target.value;
                        setCurveColors(newColors);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {/* Refresh Button */}
            <div className="mt-4 flex justify-end">
              <button
                className="px-4 py-2 bg-[#8A0051] text-white rounded-md hover:bg-[#6A003F] transition-colors duration-200 flex items-center gap-2 shadow-sm"
                onClick={onRefresh}
                type="button"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Graph
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 