'use client';

import { useState } from 'react';
import { DataPoint, FittedCurve } from '../types';

interface CurveFitterProps {
  data: DataPoint[];
  onCurveFitting: (curves: FittedCurve[]) => void;
  isProcessing: boolean;
}

export default function CurveFitter({ data, onCurveFitting }: CurveFitterProps) {
  const [fittedCurves, setFittedCurves] = useState<FittedCurve[]>([]);

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
    // Process each sample
    const curves: FittedCurve[] = [];
    const sampleCount = data[0]?.responses.length || 0;
    
    for (let i = 0; i < sampleCount; i++) {
      const concentrations = data.map(d => d.concentration);
      const responses = data.map(d => d.responses[i]);
      
      const curve = fitCurve(concentrations, responses);
      curve.sampleName = data[0].sampleNames[i];
      curves.push(curve);
    }
    
    setFittedCurves(curves);
    onCurveFitting(curves);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Curve Fitting</h2>
      
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h3 className="font-medium text-blue-900 mb-2">Four-Parameter Logistic Equation</h3>
          <p className="text-blue-800 text-sm">
            Y = Bottom + (Top - Bottom) / (1 + (2^(1/HillSlope) - 1) * (EC50/X)^HillSlope)
          </p>
          <p className="text-blue-800 text-sm mt-2">
            Fixed parameters: Top = 100, Bottom = 0
          </p>
        </div>
        
        <button
          onClick={handleFitCurves}
          disabled={data.length === 0}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Fit Curves
        </button>
        
        {fittedCurves.length > 0 && (
          <div className="mt-4">
            <h3 className="font-medium text-gray-900 mb-2">Fitted Parameters</h3>
            <div className="space-y-2">
              {fittedCurves.map((curve, index) => (
                <div key={index} className="bg-gray-50 p-3 rounded">
                  <h4 className="font-medium text-gray-900">{curve.sampleName}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mt-1">
                    <div>EC50: {curve.ec50.toFixed(4)} nM</div>
                    <div>Hill Slope: {curve.hillSlope.toFixed(4)}</div>
                    <div>R²: {curve.rSquared.toFixed(4)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 