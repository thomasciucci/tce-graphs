'use client';

import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Scatter } from 'recharts';
import { DataPoint, FittedCurve } from '../types';

interface ResultsDisplayProps {
  data: DataPoint[];
  fittedCurves: FittedCurve[];
}

export default function ResultsDisplay({ data, fittedCurves }: ResultsDisplayProps) {
  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0'];

  // Create chart data combining original and fitted points
  const allConcentrations = new Set<number>();
  
  // Add original data concentrations
  data.forEach(point => {
    if (point.concentration > 0) {
      allConcentrations.add(point.concentration);
    }
  });
  
  // Add fitted curve concentrations
  fittedCurves.forEach(curve => {
    curve.fittedPoints.forEach(fp => {
      if (fp.x > 0) {
        allConcentrations.add(fp.x);
      }
    });
  });

  const sortedConcentrations = Array.from(allConcentrations).sort((a, b) => a - b);
  
  const chartData = sortedConcentrations.map(concentration => {
    const dataPoint: Record<string, number> = {
      concentration,
      logConcentration: Math.log10(concentration)
    };
    
    // Add original data points if they exist for this concentration
    const originalPoint = data.find(d => Math.abs(d.concentration - concentration) < 0.0001);
    if (originalPoint) {
      originalPoint.responses.forEach((response, i) => {
        dataPoint[`${originalPoint.sampleNames[i]}_original`] = response;
      });
    }
    
    // Add fitted curve points
    fittedCurves.forEach(curve => {
      const fittedPoint = curve.fittedPoints.find(fp => Math.abs(fp.x - concentration) < 0.0001);
      if (fittedPoint) {
        dataPoint[`${curve.sampleName}_fitted`] = fittedPoint.y;
      } else {
        // Interpolate fitted value for this concentration
        const sortedFittedPoints = curve.fittedPoints.sort((a, b) => a.x - b.x);
        let interpolatedY = null;
        
        for (let i = 0; i < sortedFittedPoints.length - 1; i++) {
          const p1 = sortedFittedPoints[i];
          const p2 = sortedFittedPoints[i + 1];
          
          if (concentration >= p1.x && concentration <= p2.x) {
            const ratio = (concentration - p1.x) / (p2.x - p1.x);
            interpolatedY = p1.y + ratio * (p2.y - p1.y);
            break;
          }
        }
        
        if (interpolatedY !== null) {
          dataPoint[`${curve.sampleName}_fitted`] = interpolatedY;
        }
      }
    });
    
    return dataPoint;
  });

  // Data is already filtered during creation
  const filteredChartData = chartData;
  const hasZeroOrNegative = data.some(d => d.concentration <= 0);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Results</h2>
      {hasZeroOrNegative && (
        <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          Warning: Concentration values ≤ 0 are not shown on the log-scale chart.
        </div>
      )}
      {filteredChartData.length === 0 ? (
        <div className="text-red-600 font-bold">No data to display. Please check your input data and curve fitting.</div>
      ) : (
      <div className="space-y-6">
        {/* Summary Statistics */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Summary Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fittedCurves.map((curve, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg">
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
              <ComposedChart data={filteredChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="concentration" 
                  type="number"
                  scale="log"
                  domain={['dataMin', 'dataMax']}
                  label={{ value: 'Concentration (nM)', position: 'insideBottom', offset: -10 }}
                />
                <YAxis 
                  label={{ value: 'Response (%)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(2)}%`, 
                    name.replace('_original', ' (Original)').replace('_fitted', ' (Fitted)')
                  ]}
                  labelFormatter={(label) => `Concentration: ${label} nM`}
                />
                <Legend />
                
                {/* Fitted curves - render first so they appear behind points */}
                {fittedCurves.map((curve, index) => (
                  <Line
                    key={`${curve.sampleName}_fitted`}
                    type="monotone"
                    dataKey={`${curve.sampleName}_fitted`}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    name={`${curve.sampleName} (Fitted)`}
                  />
                ))}
                
                {/* Original data points - render on top */}
                {fittedCurves.map((curve, index) => (
                  <Scatter
                    key={`${curve.sampleName}_original`}
                    dataKey={`${curve.sampleName}_original`}
                    fill={colors[index % colors.length]}
                    name={`${curve.sampleName} (Original)`}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Data Table */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Processed Data</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700">
                    Concentration (nM)
                  </th>
                  {fittedCurves.map((curve, index) => (
                    <th key={index} className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700">
                      {curve.sampleName} (%)
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-3 py-2">
                      {row.concentration}
                    </td>
                    {row.responses.map((response, colIndex) => (
                      <td key={colIndex} className="border border-gray-300 px-3 py-2">
                        {response.toFixed(2)}
                      </td>
                    ))}
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