import { DataPoint, FittedCurve } from './types';

function mean(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function sem(arr: number[]) {
  if (arr.length <= 1) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance / arr.length);
}

// Four-parameter logistic equation
const fourParameterLogistic = (x: number, top: number, bottom: number, ec50: number, hillSlope: number): number => {
  const denominator = 1 + (Math.pow(2, 1 / hillSlope) - 1) * Math.pow(ec50 / x, hillSlope);
  const numerator = top - bottom;
  return bottom + (numerator / denominator);
};

// Calculate EC10 and EC90 from fitted curve parameters
const calculateEC10 = (top: number, bottom: number, ec50: number, hillSlope: number): number => {
  const response10 = bottom + 0.1 * (top - bottom);
  const ratio = (top - response10) / (response10 - bottom);
  return ec50 * Math.pow(ratio, 1 / hillSlope);
};

const calculateEC90 = (top: number, bottom: number, ec50: number, hillSlope: number): number => {
  const response90 = bottom + 0.9 * (top - bottom);
  const ratio = (top - response90) / (response90 - bottom);
  return ec50 * Math.pow(ratio, 1 / hillSlope);
};

// Calculate R-squared
const calculateRSquared = (actual: number[], predicted: number[]): number => {
  const mean = actual.reduce((sum, val) => sum + val, 0) / actual.length;
  const ssRes = actual.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0);
  const ssTot = actual.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
  return 1 - (ssRes / ssTot);
};

// Calculate Area Under Curve using trapezoidal rule
const calculateAUC = (fittedPoints: { x: number; y: number }[]): number => {
  if (fittedPoints.length < 2) return 0;
  
  // Sort points by x-coordinate (concentration)
  const sortedPoints = [...fittedPoints].sort((a, b) => a.x - b.x);
  
  let auc = 0;
  for (let i = 1; i < sortedPoints.length; i++) {
    const x1 = sortedPoints[i - 1].x;
    const y1 = sortedPoints[i - 1].y;
    const x2 = sortedPoints[i].x;
    const y2 = sortedPoints[i].y;
    
    // Skip invalid points
    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) continue;
    
    // Trapezoidal rule: (x2 - x1) * (y1 + y2) / 2
    // Points are already in linear space
    const width = x2 - x1;
    const avgHeight = (y1 + y2) / 2;
    
    auc += width * avgHeight;
  }
  
  return auc;
};

// Simple curve fitting using grid search
const fitCurve = (concentrations: number[], responses: number[]): FittedCurve => {
  const X = concentrations.map(Number);
  const Y = responses.map(Number);

  let bestTop = Math.max(...Y);
  let bestBottom = Math.min(...Y);
  let bestEc50 = 1;
  let bestHillSlope = 1;
  let bestRSquared = -Infinity;

  const topRange = Array.from({length: 41}, (_, i) => bestTop - 10 + i * 0.5);
  const bottomRange = Array.from({length: 41}, (_, i) => bestBottom - 10 + i * 0.5);
  const ec50Range = Array.from({length: 40}, (_, i) => Math.pow(10, -3 + i * 0.1));
  const hillSlopeRange = Array.from({length: 36}, (_, i) => 0.5 + i * 0.1);

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

  const minConc = Math.max(1e-6, Math.min(...X.filter(c => c > 0)));
  const maxConc = Math.max(...X);
  const fittedPoints = [];
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
  const originalPoints = X.map((x, i) => ({ x, y: Y[i] }));
  
  // Calculate EC10 and EC90
  const ec10 = calculateEC10(bestTop, bestBottom, bestEc50, bestHillSlope);
  const ec90 = calculateEC90(bestTop, bestBottom, bestEc50, bestHillSlope);
  const auc = calculateAUC(fittedPoints);
  
  return {
    sampleName: 'Sample',
    ec50: bestEc50,
    ec10: ec10,
    ec90: ec90,
    hillSlope: bestHillSlope,
    top: bestTop,
    bottom: bestBottom,
    rSquared: bestRSquared,
    auc: auc,
    fittedPoints,
    originalPoints
  };
};

export function fitCurvesForData(data: DataPoint[]): FittedCurve[] {
  const sampleNames = data[0]?.sampleNames || [];
  let replicateGroups = data[0]?.replicateGroups;
  const hasCustomGroups = replicateGroups && 
    replicateGroups.length === sampleNames.length &&
    new Set(replicateGroups).size < replicateGroups.length;
  if (!replicateGroups || replicateGroups.length !== sampleNames.length) {
    replicateGroups = sampleNames.map((_, i) => `Group ${i + 1}`);
  }
  const groupMap: { [group: string]: number[] } = {};
  replicateGroups.forEach((group, i) => {
    if (!groupMap[group]) groupMap[group] = [];
    groupMap[group].push(i);
  });
  const concentrations = data.map(d => d.concentration);
  const curves: FittedCurve[] = [];
  if (Object.keys(groupMap).length === 0) {
    sampleNames.forEach((name, i) => {
      groupMap[name] = [i];
    });
  }
  // Debug: print group names and sampleNames
  console.log('fitCurvesForData: groupNames', Object.keys(groupMap));
  // --- Ensure group curves are always generated and named correctly ---
  if (hasCustomGroups) {
    // Process custom groups (replicates)
    Object.entries(groupMap).forEach(([group, colIndices]) => {
      const meanResponses: number[] = [];
      const sems: number[] = [];
      for (let row = 0; row < data.length; row++) {
        const reps = colIndices.map(col => data[row].responses?.[col]).filter(v => typeof v === 'number' && !isNaN(v));
        if (reps.length === 0) {
          meanResponses.push(NaN);
          sems.push(0);
        } else {
          meanResponses.push(mean(reps));
          sems.push(sem(reps));
        }
      }
      const validMeans = meanResponses.filter(v => typeof v === 'number' && !isNaN(v));
      if (validMeans.length < 3) return;
      const curve = fitCurve(concentrations, meanResponses.map(v => (typeof v === 'number' && !isNaN(v) ? v : 0)));
      curve.sampleName = group; // Ensure sampleName matches group name exactly
      curve.meanPoints = concentrations.map((x, i) => ({ x, y: meanResponses[i], sem: sems[i] }));
      curves.push(curve);
    });
    // Also process individual replicates for display
    sampleNames.forEach((name, i) => {
      const responses = data.map(d => d.responses[i]);
      const validResponses = responses.filter(v => typeof v === 'number' && !isNaN(v));
      if (validResponses.length < 3) return;
      const curve = fitCurve(concentrations, responses.map(v => (typeof v === 'number' && !isNaN(v) ? v : 0)));
      curve.sampleName = name;
      curve.originalPoints = concentrations.map((x, idx) => ({ x, y: responses[idx] }));
      curves.push(curve);
    });
  } else {
    // Process individual samples (no custom groups)
    Object.entries(groupMap).forEach(([, colIndices]) => {
      const responses = data.map(d => d.responses[colIndices[0]]);
      const validResponses = responses.filter(v => typeof v === 'number' && !isNaN(v));
      if (validResponses.length < 3) return;
      const curve = fitCurve(concentrations, responses.map(v => (typeof v === 'number' && !isNaN(v) ? v : 0)));
      // Always use the actual sample/column name for the curve name
      curve.sampleName = sampleNames[colIndices[0]];
      curve.originalPoints = concentrations.map((x, i) => ({ x, y: responses[i] }));
      curves.push(curve);
    });
  }
  // Debug: print all curve sampleNames
  console.log('fitCurvesForData: all curve sampleNames', curves.map(c => c.sampleName));
  return curves;
} 