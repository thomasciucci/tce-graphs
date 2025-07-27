import { DataPoint, Dataset, FittedCurve } from '../types';

export interface CSVExportOptions {
  datasets: Dataset[];
  editedDataByDataset: Record<string, DataPoint[]>;
  fittedCurvesByDataset: Record<string, FittedCurve[]>;
  exportType: 'raw_and_edited' | 'with_replicates_mean' | 'with_replicates_individual';
  includeAnalysis: boolean;
}

// Helper function to calculate mean and SEM for replicate groups
function calculateReplicateStats(data: DataPoint[]): { means: DataPoint[], sems: number[][] } {
  if (!data.length || !data[0].replicateGroups) {
    return { means: data, sems: [] };
  }

  const replicateGroups = data[0].replicateGroups;
  
  // Group columns by replicate group
  const groupMap: { [group: string]: number[] } = {};
  replicateGroups.forEach((group, i) => {
    if (!groupMap[group]) groupMap[group] = [];
    groupMap[group].push(i);
  });

  const groupNames = Object.keys(groupMap);
  const means: DataPoint[] = [];
  const sems: number[][] = [];

  data.forEach((row) => {
    const meanRow: DataPoint = {
      concentration: row.concentration,
      responses: [],
      sampleNames: groupNames,
      replicateGroups: groupNames
    };

    const semRow: number[] = [];

    groupNames.forEach(groupName => {
      const colIndices = groupMap[groupName];
      const values = colIndices.map(idx => row.responses[idx]).filter(v => !isNaN(v));
      
      if (values.length > 0) {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        meanRow.responses.push(mean);
        
        if (values.length > 1) {
          const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1);
          const sem = Math.sqrt(variance / values.length);
          semRow.push(sem);
        } else {
          semRow.push(0);
        }
      } else {
        meanRow.responses.push(NaN);
        semRow.push(0);
      }
    });

    means.push(meanRow);
    sems.push(semRow);
  });

  return { means, sems };
}

// Convert data to CSV format
function dataToCSV(data: DataPoint[], includeErrorBars: boolean = false, sems?: number[][]): string {
  if (!data.length) return '';

  const sampleNames = data[0].sampleNames || [];
  let csv = 'Concentration (nM)';
  
  sampleNames.forEach(name => {
    csv += `,${name}`;
    if (includeErrorBars && sems) {
      csv += `,${name} SEM`;
    }
  });
  csv += '\n';

  data.forEach((row, rowIdx) => {
    csv += `${row.concentration}`;
    row.responses.forEach((response, colIdx) => {
      csv += `,${isNaN(response) ? '' : response.toFixed(3)}`;
      if (includeErrorBars && sems) {
        const sem = sems[rowIdx]?.[colIdx] || 0;
        csv += `,${sem.toFixed(3)}`;
      }
    });
    csv += '\n';
  });

  return csv;
}

// Generate curve fitting results as CSV
function curvesToCSV(curves: FittedCurve[]): string {
  if (!curves.length) return '';

  let csv = 'Sample Name,EC50 (nM),Hill Slope,Top (%),Bottom (%),R²\n';
  
  curves.forEach(curve => {
    csv += `${curve.sampleName},${curve.ec50.toExponential(3)},${curve.hillSlope.toFixed(3)},${curve.top.toFixed(1)},${curve.bottom.toFixed(1)},${curve.rSquared.toFixed(4)}\n`;
  });

  return csv;
}

// Generate fitted curve points for graphing
function fittedPointsToCSV(curves: FittedCurve[]): string {
  if (!curves.length) return '';

  // Create concentration range for fitted curves
  const concentrations = curves[0].fittedPoints.map(p => p.x);
  
  let csv = 'Concentration (nM)';
  curves.forEach(curve => {
    csv += `,${curve.sampleName} (Fitted)`;
  });
  csv += '\n';

  concentrations.forEach((conc, idx) => {
    csv += `${conc.toExponential(3)}`;
    curves.forEach(curve => {
      const point = curve.fittedPoints[idx];
      csv += `,${point ? point.y.toFixed(3) : ''}`;
    });
    csv += '\n';
  });

  return csv;
}

// Export Prism-compatible CSV (simple XY format)
async function exportPrismCompatibleCSV(
  options: { datasets: Dataset[], editedDataByDataset: Record<string, DataPoint[]>, exportType: string }, 
  baseFilename: string
): Promise<void> {
  const { datasets, editedDataByDataset, exportType } = options;
  
  let csvContent = '';
  
  datasets.forEach((dataset) => {
    const data = editedDataByDataset[dataset.id] || [];
    if (!data.length) return;

    const hasReplicates = data[0].replicateGroups && 
      new Set(data[0].replicateGroups).size < data[0].replicateGroups.length;

    // Choose appropriate data format for Prism import
    if (exportType === 'with_replicates_mean' && hasReplicates) {
      const { means } = calculateReplicateStats(data);
      csvContent += dataToCSV(means);
    } else {
      csvContent += dataToCSV(data);
    }
  });

  // Download Prism-compatible file
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  const timestamp = new Date().toISOString().split('T')[0];
  link.download = `${baseFilename}-prism-import-${timestamp}.csv`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export analysis results as separate CSV
async function exportAnalysisCSV(
  options: { datasets: Dataset[], editedDataByDataset: Record<string, DataPoint[]>, fittedCurvesByDataset: Record<string, FittedCurve[]>, exportType: string }, 
  baseFilename: string
): Promise<void> {
  const { datasets, fittedCurvesByDataset } = options;
  
  let csvContent = 'DOSE-RESPONSE ANALYSIS RESULTS\n\n';
  
  datasets.forEach((dataset) => {
    const curves = fittedCurvesByDataset[dataset.id] || [];
    if (!curves.length) return;

    if (datasets.length > 1) {
      csvContent += `=== ${dataset.name} ===\n\n`;
    }

    csvContent += 'Curve Fitting Parameters:\n';
    csvContent += curvesToCSV(curves);
    csvContent += '\n';

    csvContent += 'Fitted Curves (for graphing):\n';
    csvContent += fittedPointsToCSV(curves);
    csvContent += '\n';
  });

  // Download analysis file
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  const timestamp = new Date().toISOString().split('T')[0];
  link.download = `${baseFilename}-analysis-${timestamp}.csv`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export Prism instructions as separate text file
async function exportPrismInstructions(
  options: { datasets: Dataset[], fittedCurvesByDataset: Record<string, FittedCurve[]> }, 
  baseFilename: string
): Promise<void> {
  const { datasets, fittedCurvesByDataset } = options;
  
  let content = `GRAPHPAD PRISM ANALYSIS INSTRUCTIONS
=====================================

Generated from nVitro Studio dose-response analysis

STEP-BY-STEP ANALYSIS IN PRISM:
==============================

1. IMPORT DATA:
   - Open GraphPad Prism
   - Create new XY data table
   - Import the "*-prism-import-*.csv" file
   - Set X column to "Log[Concentration]" 
   - Verify data imported correctly

2. RUN NONLINEAR REGRESSION:
   - Select your data table
   - Click "Analyze" → "Nonlinear regression (curve fit)"
   - Choose equation: "log(agonist) vs. response -- Variable slope (four parameters)"
   - Click "OK" to run analysis

3. VIEW RESULTS:
   - Check the "Results" tab for fitted parameters
   - View the "Graph" tab for dose-response curves
   - EC50 values will be in molar units (convert if needed)

EXPECTED PARAMETERS FROM iDOSE STUDIO:
=====================================

`;

  datasets.forEach((dataset) => {
    const curves = fittedCurvesByDataset[dataset.id] || [];
    if (!curves.length) return;

    if (datasets.length > 1) {
      content += `Dataset: ${dataset.name}\n`;
      content += `${'='.repeat(dataset.name.length + 9)}\n\n`;
    }

    curves.forEach(curve => {
      content += `Sample: ${curve.sampleName}\n`;
      content += `  EC50: ${curve.ec50.toExponential(3)} nM (${(curve.ec50 * 1e-9).toExponential(3)} M)\n`;
      content += `  Hill Slope: ${curve.hillSlope.toFixed(3)}\n`;
      content += `  Top: ${curve.top.toFixed(1)}%\n`;
      content += `  Bottom: ${curve.bottom.toFixed(1)}%\n`;
      content += `  R²: ${curve.rSquared.toFixed(4)}\n\n`;
    });
  });

  content += `TROUBLESHOOTING:
===============
- If curves don't fit well, try different initial parameter estimates
- For steep curves, consider "log(agonist) vs. response" (3-parameter) equation
- Check that concentration units are correct (should be in molar for log scale)

Generated on: ${new Date().toLocaleString()}
`;

  // Download instructions file
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  const timestamp = new Date().toISOString().split('T')[0];
  link.download = `${baseFilename}-prism-instructions-${timestamp}.txt`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Main export function
export async function exportToCSV(options: CSVExportOptions): Promise<void> {
  try {
    console.log('=== CSV EXPORT DEBUG ===');
    console.log('Export options:', options);
    console.log('Include analysis:', options.includeAnalysis);
    console.log('Fitted curves by dataset:', options.fittedCurvesByDataset);
    
    const filename = 'dose-response-data';
    const { datasets, editedDataByDataset, fittedCurvesByDataset, exportType, includeAnalysis } = options;

    // Create separate files: one for Prism import, one with analysis, and instructions
    await exportPrismCompatibleCSV({ datasets, editedDataByDataset, exportType }, filename);
    
    if (includeAnalysis) {
      await exportAnalysisCSV({ datasets, editedDataByDataset, fittedCurvesByDataset, exportType }, filename);
      await exportPrismInstructions({ datasets, fittedCurvesByDataset }, filename);
    }
    
    console.log('CSV export completed successfully');
  } catch (error) {
    console.error('CSV export failed:', error);
    throw new Error('Failed to export to CSV format');
  }
}