'use client';

import { ComposedChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Scatter, ErrorBar } from 'recharts';
import { DataPoint, FittedCurve } from '../types';

interface ResultsDisplayProps {
  data: DataPoint[];
  fittedCurves: FittedCurve[];
  curveColors: string[];
}

export default function ResultsDisplay({ data, fittedCurves, curveColors }: ResultsDisplayProps) {
  console.log('ResultsDisplay received:', { data, fittedCurves, curveColors });
  
  // Check if we have custom groups (multiple columns assigned to same group)
  const hasCustomGroups = data[0]?.replicateGroups && 
    data[0].replicateGroups.length === data[0].sampleNames.length &&
    new Set(data[0].replicateGroups).size < data[0].replicateGroups.length;
  
  // Filter curves for legend display - only show group curves if custom groups exist
  const legendCurves = hasCustomGroups ? 
    fittedCurves.filter(curve => !data[0].sampleNames.includes(curve.sampleName)) : 
    fittedCurves;
  
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
  
  // Add all fitted points (these should be the main driver for smooth curves)
  legendCurves.forEach(curve => {
    curve.fittedPoints?.forEach(pt => allConcentrationsSet.add(pt.x));
  });
  
  // Add original points (for scatter dots)
  legendCurves.forEach(curve => {
    curve.originalPoints?.forEach(pt => allConcentrationsSet.add(pt.x));
  });
  
  const allConcentrationsArray = Array.from(allConcentrationsSet).sort((a, b) => a - b);
  
  // Create chart data rows for each concentration
  allConcentrationsArray.forEach(concentration => {
    const row: Record<string, number> = { concentration };
    
    // Add fitted curve data (for smooth lines)
    legendCurves.forEach((curve) => {
      const fittedPoint = curve.fittedPoints?.find(pt => Math.abs(pt.x - concentration) < 1e-8);
      if (fittedPoint) {
        row[`${curve.sampleName}_fitted`] = fittedPoint.y;
      }
    });
    
    // Add original data points (for scatter dots)
    legendCurves.forEach((curve) => {
      const originalPoint = curve.originalPoints?.find(pt => Math.abs(pt.x - concentration) < 1e-8);
      if (originalPoint) {
        row[`${curve.sampleName}_original`] = originalPoint.y;
      }
      
      // Add SEM data if available (for error bars)
      if (hasCustomGroups && curve.meanPoints) {
        const meanPoint = curve.meanPoints.find(pt => Math.abs(pt.x - concentration) < 1e-8);
        row[`${curve.sampleName}_sem`] = meanPoint && typeof meanPoint.sem === 'number' && !isNaN(meanPoint.sem) ? meanPoint.sem : 0;
      }
    });
    
    // Add row even if it only has fitted data (needed for continuous curves)
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
  
  console.log('Valid chart data for rendering:', validChartData);
  console.log('Concentration range:', { min: minConcentration, max: maxConcentration });

  // After building validChartData, ensure all *_sem values are finite numbers for ErrorBar
  legendCurves.forEach(curve => {
    const semKey = `${curve.sampleName}_sem`;
    validChartData.forEach(row => {
      if (!Number.isFinite(row[semKey])) {
        row[semKey] = 0;
      }
    });
  });

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Results</h2>
      {hasZeroOrNegative && (
        <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          Warning: Concentration values ≤ 0 are not shown on the log-scale chart.
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
              <div key={`${curve.sampleName || 'curve'}_${index}_summary`} className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">{curve.sampleName}</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <div>EC50: {curve.ec50.toFixed(4)} nM</div>
                  <div>Hill Slope: {curve.hillSlope.toFixed(4)}</div>
                  <div>R²: {curve.rSquared.toFixed(4)}</div>
                  <div>Top: {curve.top}</div>
                  <div>Bottom: {curve.bottom}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Concentration-Response Curves */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Concentration-Response Curves</h3>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={validChartData}>
                <XAxis 
                  dataKey="concentration"
                  type="number"
                  scale="log"
                  domain={[0.001, 1000]}
                  label={{ value: 'Concentration (nM)', position: 'insideBottom', offset: -10 }}
                  tickFormatter={value => value.toString()}
                  ticks={[0.001, 0.01, 0.1, 1, 10, 100, 1000]}
                  tick={{ fontSize: 14 }}
                />
                <YAxis 
                  label={{ value: 'Response (%)', angle: -90, position: 'insideLeft' }}
                  domain={[0, 100]}
                  ticks={[0, 20, 40, 60, 80, 100]}
                  tick={{ fontSize: 14 }}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(2)}%`, 
                    name.replace('_original', '').replace('_fitted', '').replace('_mean', '').trim()
                  ]}
                  labelFormatter={(label) => `Concentration: ${label} nM`}
                />
                <Legend 
                  layout="vertical"
                  verticalAlign="middle"
                  align="right"
                  iconType="square"
                  wrapperStyle={{ right: 20, top: 40, fontSize: 16 }}
                />
                
                {/* Fitted curves */}
                {legendCurves.map((curve, index) => (
                  <Line
                    key={`${curve.sampleName || 'curve'}_${index}_fitted`}
                    type="monotone"
                    dataKey={`${curve.sampleName}_fitted`}
                    stroke={curveColors[index] || '#8884d8'}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={true}
                    legendType="line"
                    name={curve.sampleName}
                  />
                ))}
                {/* Original data points */}
                {legendCurves.map((curve, index) => (
                  <Scatter
                    key={`${curve.sampleName || 'curve'}_${index}_original`}
                    name={curve.sampleName}
                    dataKey={`${curve.sampleName}_original`}
                    fill={curveColors[index] || '#8884d8'}
                    shape="square"
                    legendType="none"
                  >
                    {/* Add error bars if we have custom groups (replicates) and valid data */}
                    {hasCustomGroups && curve.meanPoints && 
                      validChartData.some(row => Number.isFinite(row[`${curve.sampleName}_sem`])) && 
                      validChartData.every(row => Number.isFinite(row[`${curve.sampleName}_sem`])) && (
                      <ErrorBar
                        dataKey={`${curve.sampleName}_sem`}
                        width={4}
                        stroke={curveColors[index] || '#8884d8'}
                        direction="y"
                        strokeWidth={2}
                      />
                    )}
                  </Scatter>
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Data Table */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Fitted Values</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700">
                    Concentration (nM)
                  </th>
                  {hasCustomGroups ? (
                    // Show both group columns and individual TCE columns
                    <>
                      {/* Group columns */}
                      {Array.from(new Set(data[0].replicateGroups || [])).map((groupName, index) => (
                        <th key={`group-${groupName || 'group'}_${index}`} className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 bg-blue-50">
                          {groupName} (Group Mean ± SEM)
                        </th>
                      ))}
                      {/* Individual TCE columns */}
                      {data[0].sampleNames.map((name, index) => (
                        <th key={`tce-${name || 'tce'}_${index}`} className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700">
                          {name} (%)
                        </th>
                      ))}
                    </>
                  ) : (
                    // Show only individual columns
                    fittedCurves.map((curve, index) => (
                      <th key={`${curve.sampleName || 'curve'}_${index}_header`} className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700">
                        {curve.sampleName} (%)
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {data.map((row, rowIndex) => (
                  <tr key={`row_${rowIndex}`} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-3 py-2">
                      {Number(row.concentration).toPrecision(2)}
                    </td>
                    {hasCustomGroups ? (
                      // Show both group values and individual TCE values
                      <>
                        {/* Group values (means) */}
                        {Array.from(new Set(data[0].replicateGroups || [])).map((groupName, groupIndex) => {
                          const groupCurve = fittedCurves.find(curve => curve.sampleName === groupName);
                          const groupMeanPoint = groupCurve?.meanPoints?.find(pt => Math.abs(pt.x - row.concentration) < 1e-8);
                          return (
                            <td key={`groupval-${groupName || 'group'}_${groupIndex}`} className="border border-gray-300 px-3 py-2 bg-blue-50">
                              {groupMeanPoint ? `${Number(groupMeanPoint.y).toPrecision(2)} ± ${Number(groupMeanPoint.sem).toPrecision(2)}` : '-'}
                            </td>
                          );
                        })}
                        {/* Individual TCE values */}
                        {row.responses.map((response, colIndex) => (
                          <td key={`tceval_individual_${colIndex}`} className="border border-gray-300 px-3 py-2">
                            {Number(response).toPrecision(2)}
                          </td>
                        ))}
                      </>
                    ) : (
                      // Show only individual values
                      row.responses.map((response, colIndex) => (
                        <td key={`tceval_single_${colIndex}`} className="border border-gray-300 px-3 py-2">
                          {Number(response).toPrecision(2)}
                        </td>
                      ))
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}
    </div>
  );
} 