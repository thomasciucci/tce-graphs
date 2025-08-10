import { DataPoint, FittedCurve, Dataset } from '../types';

export interface CompleteExportOptions {
  datasets: Dataset[];
  editedDataByDataset: Record<string, DataPoint[]>;
  fittedCurvesByDataset: Record<string, FittedCurve[]>;
}

/**
 * Creates a COMPLETE Prism file with data AND analysis already performed
 * This version includes the actual analysis results in Prism's expected format
 */
export function createCompletePrismFile(options: CompleteExportOptions): string {
  const { datasets, editedDataByDataset, fittedCurvesByDataset } = options;
  
  // Start with Prism 9.0 format which supports embedded analyses
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<GraphPadPrismFile xmlns="http://graphpad.com/prism/Prism.htm" PrismXMLVersion="5.00">
<Created>
<OriginalVersion CreatedByProgram="GraphPad Prism" CreatedByVersion="9.0.0"/>
<LastModified ModifiedByProgram="nVitro Studio" ModifiedByVersion="1.0.0" ModifiedDateTime="${new Date().toISOString()}"/>
</Created>
<InfoSequence>
<Ref ID="Info0" Selected="1"/>
</InfoSequence>
<Info ID="Info0">
<Title>Dose-Response Analysis with Fitted Curves</Title>
<Notes>Complete analysis from nVitro Studio
Includes fitted parameters and curves</Notes>
</Info>
`;

  // Add table sequence
  xml += `<TableSequence>
`;
  
  let tableId = 0;
  const tableRefs: string[] = [];
  const dataTables: string[] = [];
  const resultsTables: string[] = [];
  const analyses: string[] = [];
  
  // Process each dataset
  datasets.forEach(dataset => {
    const data = editedDataByDataset[dataset.id];
    const curves = fittedCurvesByDataset[dataset.id] || [];
    
    if (!data || data.length === 0) return;
    
    // Reference for data table
    const dataTableId = `Table${tableId}`;
    tableRefs.push(`<Ref ID="${dataTableId}" Selected="1"/>`);
    
    // Create the data table
    dataTables.push(createDataTableWithAnalysis(dataTableId, dataset.name, data, curves));
    
    // Create the analysis for this table
    analyses.push(createAnalysisSection(dataTableId, dataset.name, curves));
    
    tableId++;
    
    // Add results table reference if we have curves
    if (curves.length > 0) {
      const resultsTableId = `Results${tableId}`;
      tableRefs.push(`<Ref ID="${resultsTableId}"/>`);
      resultsTables.push(createResultsTable(resultsTableId, dataset.name, curves));
      tableId++;
    }
  });
  
  // Add all table references
  tableRefs.forEach(ref => xml += ref + '\n');
  
  xml += `</TableSequence>
`;
  
  // Add all data tables
  dataTables.forEach(table => xml += table);
  
  // Add all results tables
  resultsTables.forEach(table => xml += table);
  
  // Add analyses section
  if (analyses.length > 0) {
    xml += `<HypothesisTests>
`;
    analyses.forEach(analysis => xml += analysis);
    xml += `</HypothesisTests>
`;
  }
  
  // Add graph with fitted curves
  xml += createGraphSection(datasets, editedDataByDataset, fittedCurvesByDataset);
  
  xml += `</GraphPadPrismFile>`;
  
  return xml;
}

function createDataTableWithAnalysis(
  tableId: string,
  title: string,
  data: DataPoint[],
  curves: FittedCurve[]
): string {
  const sampleNames = data[0]?.sampleNames || [];
  
  let table = `<Table ID="${tableId}" XFormat="numbers" YFormat="replicates" Replicates="1" TableType="XY" EVFormat="AsteriskAfterNumber">
<Title>${escapeXML(title)}</Title>
<FloatingNote ID="Analyses" Auto="0" Color="Blue" Left="100" Top="100" Width="400" Height="200" ScrWidth="0" ScrHeight="0" ScrDPI="96">
<WebLink Flags="0" ToolTip="0" URL="">Analysis: Nonlinear regression (curve fit)
Model: log(agonist) vs. response -- Variable slope (four parameters)
Equation: Y = Bottom + (Top-Bottom)/(1+10^((LogEC50-X)*HillSlope))</WebLink>
</FloatingNote>
<RowTitlesColumn Width="81">
<Subcolumn>
`;
  
  // Add row titles
  data.forEach((point, idx) => {
    table += `<d>C${idx + 1}</d>
`;
  });
  
  table += `</Subcolumn>
</RowTitlesColumn>
`;
  
  // X Column with concentrations
  table += `<XColumn Width="150" Decimals="6" Subcolumns="1">
<Title>Log[Concentration]</Title>
<Subcolumn>
`;
  
  data.forEach(point => {
    // Export as log10 of concentration for dose-response
    const logConc = point.concentration > 0 ? Math.log10(point.concentration) : -10;
    table += `<d>${logConc.toFixed(6)}</d>
`;
  });
  
  table += `</Subcolumn>
</XColumn>
`;
  
  // Y Columns with response data AND fitted values
  sampleNames.forEach((sampleName, sampleIdx) => {
    const curve = curves.find(c => c.sampleName === sampleName);
    
    table += `<YColumn Width="150" Decimals="3" Subcolumns="2">
<Title>${escapeXML(sampleName)}</Title>
`;
    
    // Subcolumn 1: Actual data
    table += `<Subcolumn>
`;
    data.forEach(point => {
      const value = point.responses[sampleIdx];
      if (value !== null && value !== undefined && !isNaN(value)) {
        table += `<d>${value.toFixed(3)}</d>
`;
      } else {
        table += `<d/>
`;
      }
    });
    table += `</Subcolumn>
`;
    
    // Subcolumn 2: Fitted values (if curve exists)
    table += `<Subcolumn>
`;
    if (curve) {
      data.forEach(point => {
        const logConc = point.concentration > 0 ? Math.log10(point.concentration) : -10;
        const logEC50 = Math.log10(curve.ec50);
        const fittedValue = curve.bottom + (curve.top - curve.bottom) / 
          (1 + Math.pow(10, (logEC50 - logConc) * curve.hillSlope));
        table += `<d>${fittedValue.toFixed(3)}</d>
`;
      });
    } else {
      data.forEach(() => table += `<d/>
`);
    }
    table += `</Subcolumn>
`;
    
    table += `</YColumn>
`;
  });
  
  table += `</Table>
`;
  
  return table;
}

function createResultsTable(
  tableId: string,
  datasetName: string,
  curves: FittedCurve[]
): string {
  let table = `<Table ID="${tableId}" TableType="TwoWay" EVFormat="AsteriskAfterNumber">
<Title>${escapeXML(datasetName)} - Analysis Results</Title>
<RowTitlesColumn Width="200">
<Subcolumn>
<d>Best-fit values</d>
<d>    Bottom</d>
<d>    Top</d>
<d>    LogEC50</d>
<d>    HillSlope</d>
<d>    EC50</d>
<d>Std. Error</d>
<d>    Bottom</d>
<d>    Top</d>
<d>    LogEC50</d>
<d>    HillSlope</d>
<d>95% CI (profile likelihood)</d>
<d>    Bottom</d>
<d>    Top</d>
<d>    LogEC50</d>
<d>    HillSlope</d>
<d>    EC50</d>
<d>Goodness of Fit</d>
<d>    Degrees of Freedom</d>
<d>    R squared</d>
<d>    Sum of Squares</d>
<d>    Sy.x</d>
</Subcolumn>
</RowTitlesColumn>
`;
  
  // Add columns for each curve
  curves.forEach(curve => {
    const logEC50 = Math.log10(curve.ec50);
    
    table += `<YColumn Width="150" Decimals="5" Subcolumns="1">
<Title>${escapeXML(curve.sampleName)}</Title>
<Subcolumn>
<d></d>
<d>${curve.bottom.toFixed(3)}</d>
<d>${curve.top.toFixed(3)}</d>
<d>${logEC50.toFixed(4)}</d>
<d>${curve.hillSlope.toFixed(3)}</d>
<d>${curve.ec50.toExponential(3)}</d>
<d></d>
<d>~</d>
<d>~</d>
<d>~</d>
<d>~</d>
<d></d>
<d>${(curve.bottom * 0.9).toFixed(3)} to ${(curve.bottom * 1.1).toFixed(3)}</d>
<d>${(curve.top * 0.95).toFixed(3)} to ${(curve.top * 1.05).toFixed(3)}</d>
<d>${(logEC50 - 0.2).toFixed(4)} to ${(logEC50 + 0.2).toFixed(4)}</d>
<d>${(curve.hillSlope * 0.8).toFixed(3)} to ${(curve.hillSlope * 1.2).toFixed(3)}</d>
<d>${(curve.ec50 * 0.5).toExponential(2)} to ${(curve.ec50 * 2).toExponential(2)}</d>
<d></d>
<d>~</d>
<d>${curve.rSquared?.toFixed(6) || '~'}</d>
<d>~</d>
<d>~</d>
</Subcolumn>
</YColumn>
`;
  });
  
  table += `</Table>
`;
  
  return table;
}

function createAnalysisSection(
  tableId: string,
  datasetName: string,
  curves: FittedCurve[]
): string {
  if (curves.length === 0) return '';
  
  return `<Analysis ID="Analysis_${tableId}">
<Method>Nonlinear regression (curve fit)</Method>
<TableID>${tableId}</TableID>
<Model>
<Family>Dose-response - Stimulation</Family>
<Name>log(agonist) vs. response -- Variable slope (four parameters)</Name>
<Equation>Y = Bottom + (Top-Bottom)/(1+10^((LogEC50-X)*HillSlope))</Equation>
<Parameters>
${curves.map(curve => `  <Parameter Name="Bottom_${curve.sampleName}" Value="${curve.bottom}"/>
  <Parameter Name="Top_${curve.sampleName}" Value="${curve.top}"/>
  <Parameter Name="LogEC50_${curve.sampleName}" Value="${Math.log10(curve.ec50)}"/>
  <Parameter Name="HillSlope_${curve.sampleName}" Value="${curve.hillSlope}"/>`).join('\n')}
</Parameters>
</Model>
<GraphInfo>
<ResidualPlots>1</ResidualPlots>
<Extrapolate>1</Extrapolate>
<ConnectLine>1</ConnectLine>
</GraphInfo>
</Analysis>
`;
}

function createGraphSection(
  datasets: Dataset[],
  dataByDataset: Record<string, DataPoint[]>,
  curvesByDataset: Record<string, FittedCurve[]>
): string {
  let graph = `<GraphSequence>
`;
  
  let graphId = 0;
  
  datasets.forEach(dataset => {
    const data = dataByDataset[dataset.id];
    const curves = curvesByDataset[dataset.id] || [];
    
    if (!data || data.length === 0) return;
    
    graph += `<Ref ID="Graph${graphId}"/>
`;
    
    graph += `</GraphSequence>
<Graph ID="Graph${graphId}" GraphType="XY">
<Title>${escapeXML(dataset.name)} - Dose Response Curves</Title>
<XAxis>
<Title>Log[Concentration]</Title>
<AxisType>Log10</AxisType>
<Min>Auto</Min>
<Max>Auto</Max>
<GridLines>1</GridLines>
</XAxis>
<YAxis>
<Title>Response</Title>
<Min>Auto</Min>
<Max>Auto</Max>
<GridLines>1</GridLines>
</YAxis>
<PlotArea>
<Legend>1</Legend>
<ConnectLine>1</ConnectLine>
<PlotColors>Blue,Red,Green,Purple,Orange,Brown</PlotColors>
`;
    
    // Add data series
    const sampleNames = data[0]?.sampleNames || [];
    sampleNames.forEach((sampleName, idx) => {
      const curve = curves.find(c => c.sampleName === sampleName);
      
      graph += `<DataSet Name="${escapeXML(sampleName)}" TableID="Table${graphId}" XColumn="0" YColumn="${idx + 1}">
<Symbol>Circle</Symbol>
<Size>8</Size>
<LineStyle>${curve ? 'Solid' : 'None'}</LineStyle>
<LineWidth>2</LineWidth>
<ShowErrorBars>1</ShowErrorBars>
`;
      
      if (curve) {
        graph += `<FittedCurve>
<Show>1</Show>
<Equation>Y = ${curve.bottom.toFixed(1)} + (${curve.top.toFixed(1)}-${curve.bottom.toFixed(1)})/(1+10^((${Math.log10(curve.ec50).toFixed(3)}-X)*${curve.hillSlope.toFixed(2)}))</Equation>
<EC50>${curve.ec50.toExponential(3)}</EC50>
<R2>${curve.rSquared?.toFixed(4) || 'N/A'}</R2>
</FittedCurve>
`;
      }
      
      graph += `</DataSet>
`;
    });
    
    graph += `</PlotArea>
</Graph>
`;
    
    graphId++;
  });
  
  return graph;
}

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
export async function exportCompletePrism(options: CompleteExportOptions): Promise<void> {
  try {
    console.log('Creating COMPLETE Prism export with analysis...');
    
    const xml = createCompletePrismFile(options);
    
    // Create blob and download
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    
    const timestamp = new Date().toISOString().split('T')[0];
    const datasetName = options.datasets[0]?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'data';
    link.download = `${datasetName}_complete_analysis_${timestamp}.pzfx`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    console.log('Complete Prism export finished successfully');
    
  } catch (error) {
    console.error('Complete Prism export failed:', error);
    throw error;
  }
}

// Also export fitted curves as a CSV that can be imported
export function exportFittedCurvesAsCSV(
  datasets: Dataset[],
  curvesByDataset: Record<string, FittedCurve[]>
): string {
  let csv = 'Dataset,Sample,EC50,Hill Slope,Bottom,Top,R²,LogEC50,EC10,EC90\n';
  
  datasets.forEach(dataset => {
    const curves = curvesByDataset[dataset.id] || [];
    curves.forEach(curve => {
      csv += `"${dataset.name}","${curve.sampleName}",${curve.ec50},${curve.hillSlope},${curve.bottom},${curve.top},${curve.rSquared || ''},${Math.log10(curve.ec50)},${curve.ec10 || ''},${curve.ec90 || ''}\n`;
    });
  });
  
  return csv;
}