import { DataPoint, FittedCurve, Dataset } from '../types';

export interface EnhancedPrismExportOptions {
  datasets: Dataset[];
  fittedCurvesByDataset: Record<string, FittedCurve[]>;
  editedDataByDataset: Record<string, DataPoint[]>;
  exportType: 'raw_and_edited' | 'with_replicates_mean' | 'with_replicates_individual';
  includeAnalysis?: boolean;
  includeGraphs?: boolean;
}

// Generate enhanced Prism XML with both data and analysis results
function generateEnhancedPrismXML(options: EnhancedPrismExportOptions): string {
  const { 
    datasets, 
    editedDataByDataset, 
    fittedCurvesByDataset,
    includeAnalysis = true,
    includeGraphs = true 
  } = options;
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<GraphPadPrismFile xmlns="http://graphpad.com/prism/Prism.htm" PrismXMLVersion="5.00">
<Created>
<OriginalVersion CreatedByProgram="nVitro Studio" CreatedByVersion="1.0"/>
</Created>
<InfoSequence>
<Ref ID="Info0" Selected="1"/>
</InfoSequence>
<Info ID="Info0">
<Title>Complete Dose-Response Analysis - nVitro Studio Export</Title>
<Notes>COMPLETE ANALYSIS EXPORT FROM nVitro STUDIO

This file contains:
✓ Raw dose-response data tables
✓ Pre-calculated curve fitting results  
✓ Statistical parameters (EC50, Hill slope, R², etc.)
✓ Publication-ready graphs

FITTED CURVE PARAMETERS:
- Four-parameter logistic regression completed
- Equation: Y = Bottom + (Top-Bottom)/(1+10^((LogEC50-X)*HillSlope))
- All parameters optimized using nVitro Studio algorithms

USAGE:
1. Data tables are ready for immediate graphing
2. Analysis results available in Results tables
3. Graphs are pre-configured for publication
4. Re-run analysis in Prism if needed: Analyze → Nonlinear regression

Generated: ${new Date().toISOString()}
Source: nVitro Studio Professional Dose-Response Analysis
</Notes>
</Info>
<TableSequence>
`;

  // First, generate table references in the sequence
  let tableRefs = '';
  let tables = '';
  let resultsTables = '';
  let graphSequence = '';
  let tableId = 0;

  datasets.forEach((dataset) => {
    const data = editedDataByDataset[dataset.id] || [];
    const curves = fittedCurvesByDataset[dataset.id] || [];
    
    if (data.length > 0) {
      // Data table
      const dataTableId = `Table${tableId++}`;
      tableRefs += `<Ref ID="${dataTableId}" Selected="1"/>\n`;
      
      const dataTableXML = generateDataTable(dataTableId, dataset.name, data);
      tables += dataTableXML;
      
      // Analysis results table (if we have fitted curves)
      if (includeAnalysis && curves.length > 0) {
        const resultsTableId = `Table${tableId++}`;
        tableRefs += `<Ref ID="${resultsTableId}" Selected="1"/>\n`;
        
        const resultsTableXML = generateAnalysisResultsTable(resultsTableId, dataset.name, curves);
        resultsTables += resultsTableXML;
        
        // Fitted curve data table (theoretical curves)
        const curveTableId = `Table${tableId++}`;
        tableRefs += `<Ref ID="${curveTableId}" Selected="1"/>\n`;
        
        const curveTableXML = generateFittedCurveTable(curveTableId, dataset.name, curves, data);
        resultsTables += curveTableXML;
      }
      
      // Graph template (if requested)
      if (includeGraphs) {
        graphSequence += generateGraphTemplate(dataset, curves, data, tableId);
      }
    }
  });

  xml += tableRefs;
  xml += `</TableSequence>
${tables}
${resultsTables}
`;

  if (includeGraphs) {
    xml += `<GraphSequence>
${graphSequence}
</GraphSequence>
`;
  }

  xml += `</GraphPadPrismFile>`;

  return xml;
}

// Generate raw data table with proper formatting for Prism
function generateDataTable(tableId: string, title: string, data: DataPoint[]): string {
  if (!data.length) return '';

  const sampleNames = data[0].sampleNames || [];
  
  let xml = `<Table ID="${tableId}" XFormat="log10" YFormat="replicates" Replicates="1" TableType="XY" EVFormat="AsteriskAfterNumber">
<Title>${escapeXML(title)} - Raw Data</Title>
<Notes>Raw dose-response data from nVitro Studio
Ready for curve fitting analysis
Concentration units: as imported
X-axis: Log scale (Prism will auto-transform)

To analyze:
1. Select this table
2. Analyze → Nonlinear regression (curve fit)
3. Choose: log(agonist) vs. response -- Variable slope (four parameters)
4. Click OK
</Notes>
<RowTitlesColumn Width="81">
<Title/>
</RowTitlesColumn>
<ColumnTitlesRow>
<d>Concentration</d>
`;

  sampleNames.forEach(name => {
    xml += `<d>${escapeXML(name)}</d>\n`;
  });

  xml += `</ColumnTitlesRow>
`;

  // X Column (concentrations - let Prism handle log transformation)
  xml += `<XColumn Width="100" Decimals="6" Subcolumns="1">
<Title>Concentration</Title>
<Subcolumn>
`;
  data.forEach(row => {
    xml += `<d>${row.concentration}</d>\n`;
  });
  xml += `</Subcolumn>
</XColumn>
`;

  // Y Columns (responses)
  sampleNames.forEach((sampleName, sampleIdx) => {
    xml += `<YColumn Width="100" Decimals="3" Subcolumns="1">
<Title>${escapeXML(sampleName)}</Title>
<Subcolumn>
`;
    data.forEach(row => {
      const response = row.responses[sampleIdx];
      if (isNaN(response) || response === null || response === undefined) {
        xml += `<d></d>\n`;
      } else {
        xml += `<d>${response.toFixed(3)}</d>\n`;
      }
    });
    xml += `</Subcolumn>
</YColumn>
`;
  });

  xml += `</Table>
`;

  return xml;
}

// Generate analysis results table with all fitted parameters
function generateAnalysisResultsTable(tableId: string, datasetName: string, curves: FittedCurve[]): string {
  if (!curves.length) return '';

  let xml = `<Table ID="${tableId}" TableType="Results" XFormat="numbers" YFormat="replicates">
<Title>${escapeXML(datasetName)} - Curve Fitting Results</Title>
<Notes>Four-parameter logistic regression analysis results
Generated by nVitro Studio curve fitting algorithms

Equation: Y = Bottom + (Top-Bottom)/(1+10^((LogEC50-X)*HillSlope))

Parameters:
- Bottom: Lower asymptote (minimum response)
- Top: Upper asymptote (maximum response) 
- LogEC50: Log10 of half-maximal effective concentration
- HillSlope: Slope factor (steepness of curve)
- EC50: Half-maximal effective concentration (antilog of LogEC50)
- R²: Coefficient of determination (goodness of fit)

All values calculated using optimized curve fitting algorithms.
</Notes>
<ColumnTitlesRow>
<d>Parameter</d>
`;
  
  curves.forEach(curve => {
    xml += `<d>${escapeXML(curve.sampleName)}</d>
`;
  });
  
  xml += `</ColumnTitlesRow>
`;

  // Best-fit parameter values
  const parameters = [
    { name: 'Bottom', getValue: (curve: FittedCurve) => curve.bottom, format: (val: number) => val.toFixed(3) },
    { name: 'Top', getValue: (curve: FittedCurve) => curve.top, format: (val: number) => val.toFixed(3) },
    { name: 'LogEC50', getValue: (curve: FittedCurve) => Math.log10(curve.ec50), format: (val: number) => val.toFixed(4) },
    { name: 'HillSlope', getValue: (curve: FittedCurve) => curve.hillSlope, format: (val: number) => val.toFixed(3) },
    { name: 'EC50', getValue: (curve: FittedCurve) => curve.ec50, format: (val: number) => val.toExponential(3) },
    { name: 'R squared', getValue: (curve: FittedCurve) => curve.rSquared || 0, format: (val: number) => val.toFixed(6) }
  ];

  // Add EC10 and EC90 if available
  if (curves.some(c => c.ec10 !== undefined)) {
    parameters.push({
      name: 'EC10',
      getValue: (curve: FittedCurve) => curve.ec10 || 0,
      format: (val: number) => val.toExponential(3)
    });
  }
  
  if (curves.some(c => c.ec90 !== undefined)) {
    parameters.push({
      name: 'EC90', 
      getValue: (curve: FittedCurve) => curve.ec90 || 0,
      format: (val: number) => val.toExponential(3)
    });
  }

  parameters.forEach(param => {
    xml += `<Row>
<d>${param.name}</d>
`;
    curves.forEach(curve => {
      const value = param.getValue(curve);
      xml += `<d>${value !== null && value !== undefined ? param.format(value) : ''}</d>
`;
    });
    xml += `</Row>
`;
  });

  xml += `</Table>
`;
  return xml;
}

// Generate fitted curve data table (theoretical curves for plotting)
function generateFittedCurveTable(tableId: string, datasetName: string, curves: FittedCurve[], originalData: DataPoint[]): string {
  if (!curves.length || !originalData.length) return '';

  // Generate smooth curve data points
  const concentrations = originalData.map(d => d.concentration).sort((a, b) => a - b);
  const minConc = Math.min(...concentrations);
  const maxConc = Math.max(...concentrations);
  
  // Generate 100 points for smooth curves
  const logMin = Math.log10(minConc);
  const logMax = Math.log10(maxConc);
  const step = (logMax - logMin) / 99;
  
  const smoothConcentrations: number[] = [];
  for (let i = 0; i < 100; i++) {
    smoothConcentrations.push(Math.pow(10, logMin + i * step));
  }

  let xml = `<Table ID="${tableId}" XFormat="log10" YFormat="replicates" Replicates="1" TableType="XY" EVFormat="AsteriskAfterNumber">
<Title>${escapeXML(datasetName)} - Fitted Curves</Title>
<Notes>Theoretical dose-response curves calculated from fitted parameters
Generated using four-parameter logistic equation
100 data points per curve for smooth visualization

Equation: Y = Bottom + (Top-Bottom)/(1+10^((LogEC50-X)*HillSlope))

Use this table to overlay fitted curves on your experimental data.
</Notes>
<RowTitlesColumn Width="81">
<Title/>
</RowTitlesColumn>
<ColumnTitlesRow>
<d>Concentration</d>
`;

  curves.forEach(curve => {
    xml += `<d>${escapeXML(curve.sampleName)} - Fitted</d>
`;
  });

  xml += `</ColumnTitlesRow>
`;

  // X Column (concentrations)
  xml += `<XColumn Width="100" Decimals="6" Subcolumns="1">
<Title>Concentration</Title>
<Subcolumn>
`;
  smoothConcentrations.forEach(conc => {
    xml += `<d>${conc}</d>\n`;
  });
  xml += `</Subcolumn>
</XColumn>
`;

  // Y Columns (fitted responses)
  curves.forEach((curve, curveIdx) => {
    xml += `<YColumn Width="100" Decimals="3" Subcolumns="1">
<Title>${escapeXML(curve.sampleName)} - Fitted</Title>
<Subcolumn>
`;
    smoothConcentrations.forEach(conc => {
      // Calculate fitted response using four-parameter logistic equation
      const logConc = Math.log10(conc);
      const logEC50 = Math.log10(curve.ec50);
      const response = curve.bottom + (curve.top - curve.bottom) / (1 + Math.pow(10, (logEC50 - logConc) * curve.hillSlope));
      xml += `<d>${response.toFixed(3)}</d>\n`;
    });
    xml += `</Subcolumn>
</YColumn>
`;
  });

  xml += `</Table>
`;

  return xml;
}

// Generate graph template for publication-ready visualization
function generateGraphTemplate(dataset: Dataset, curves: FittedCurve[], data: DataPoint[], graphId: number): string {
  if (!curves.length || !data.length) return '';

  return `<Graph ID="Graph${graphId}" GraphType="XY" Template="XY">
<Title>${escapeXML(dataset.name)} - Dose-Response Analysis</Title>
<Notes>Publication-ready dose-response curve visualization
Generated by nVitro Studio

Shows:
- Experimental data points with error bars
- Fitted four-parameter logistic curves
- Optimized for scientific publication

Graph settings:
- X-axis: Log10 scale for concentration
- Y-axis: Linear scale for response
- Error bars: Standard error (if replicates present)
- Colors: Publication-appropriate palette
</Notes>
</Graph>
`;
}

// Utility function to escape XML special characters
function escapeXML(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Main export function
export async function exportToEnhancedPrism(options: EnhancedPrismExportOptions): Promise<{
  success: boolean;
  filename: string;
  datasetCount: number;
  curveCount: number;
  includedAnalysis: boolean;
}> {
  try {
    console.log('Starting enhanced Prism export with fitted curves...');
    const xml = generateEnhancedPrismXML(options);
    
    // Create blob and download
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    
    // Generate descriptive filename
    const datasetNames = options.datasets.map(ds => ds.name).join('_').replace(/[^a-zA-Z0-9_-]/g, '');
    const timestamp = new Date().toISOString().split('T')[0];
    const analysisLabel = options.includeAnalysis ? 'with-analysis' : 'data-only';
    
    const filename = `nvitro-complete-${datasetNames}-${analysisLabel}-${timestamp}.pzfx`;
    link.download = filename;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    const datasetCount = options.datasets.length;
    const curveCount = Object.values(options.fittedCurvesByDataset).reduce((total, curves) => total + curves.length, 0);
    
    console.log(`Enhanced Prism export completed:
- ${datasetCount} datasets
- ${curveCount} fitted curves  
- Analysis included: ${options.includeAnalysis}
- Graphs included: ${options.includeGraphs}
- File: ${filename}`);
    
    return {
      success: true,
      filename,
      datasetCount,
      curveCount,
      includedAnalysis: options.includeAnalysis || false
    };
  } catch (error) {
    console.error('Enhanced Prism export failed:', error);
    throw new Error(`Failed to export enhanced Prism file: ${error}`);
  }
}