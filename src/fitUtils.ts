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

// Calculate R-squared
const calculateRSquared = (actual: number[], predicted: number[]): number => {
  const mean = actual.reduce((sum, val) => sum + val, 0) / actual.length;
  const ssRes = actual.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0);
  const ssTot = actual.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
  return 1 - (ssRes / ssTot);
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
      curve.sampleName = group;
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
  return curves;
} 