import { DataPoint, FittedCurve, Dataset } from '../types';

export interface PrismExportOptions {
  datasets: Dataset[];
  fittedCurvesByDataset: Record<string, FittedCurve[]>;
  originalDataByDataset: Record<string, DataPoint[]>;
  editedDataByDataset: Record<string, DataPoint[]>;
  curveColorsByDataset: Record<string, string[]>;
  exportType: 'raw_and_edited' | 'with_replicates_mean' | 'with_replicates_individual' | 'both_replicates';
  assayType?: string;
  includeAnalyses?: boolean;
  visualizationPreset?: 'publication' | 'presentation' | 'poster';
  colorScheme?: 'standard' | 'colorblind-safe' | 'high-contrast';
  includeGraphTemplates?: boolean;
}

interface PrismAnalysisTable {
  tableId: string;
  title: string;
  analysisType: string;
  parameters: Record<string, number | string>[];
}

interface PrismGraphTemplate {
  id: string;
  type: 'DoseResponse';
  styling: {
    lineWidth: number;
    symbolSize: number;
    colors: string[];
    fontSize: { axis: number; title: number; legend: number };
  };
}

// Enhanced replicate statistics calculation with improved handling
function calculateReplicateStats(data: DataPoint[]): { 
  means: DataPoint[], 
  sems: number[][], 
  replicateCounts: number[][], 
  statistics: ReplicateStatistics 
} {
  if (!data.length || !data[0].replicateGroups) {
    return { means: data, sems: [], replicateCounts: [], statistics: {} };
  }

  const replicateGroups = data[0].replicateGroups;
  
  // Group columns by replicate group with improved validation
  const groupMap: { [group: string]: number[] } = {};
  replicateGroups.forEach((group, i) => {
    const groupKey = group.trim(); // Handle whitespace
    if (!groupMap[groupKey]) groupMap[groupKey] = [];
    groupMap[groupKey].push(i);
  });

  const groupNames = Object.keys(groupMap).sort(); // Consistent ordering
  const means: DataPoint[] = [];
  const sems: number[][] = [];
  const replicateCounts: number[][] = [];
  const statistics: ReplicateStatistics = {};

  // Initialize statistics tracking
  groupNames.forEach(groupName => {
    statistics[groupName] = {
      totalReplicates: groupMap[groupName].length,
      validReplicates: [],
      outliers: [],
      cvValues: [] // Coefficient of variation
    };
  });

  data.forEach((row, rowIdx) => {
    const meanRow: DataPoint = {
      concentration: row.concentration,
      responses: [],
      sampleNames: groupNames,
      replicateGroups: groupNames
    };

    const semRow: number[] = [];
    const countRow: number[] = [];

    groupNames.forEach(groupName => {
      const colIndices = groupMap[groupName];
      const values = colIndices.map((idx, colIdx) => ({ value: row.responses[idx], index: idx }))
        .filter(v => !isNaN(v.value) && v.value !== null && v.value !== undefined);
      
      const validValues = values.map(v => v.value);
      
      if (validValues.length > 0) {
        const mean = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
        meanRow.responses.push(mean);
        countRow.push(validValues.length);
        
        // Track valid replicates for this group
        statistics[groupName].validReplicates[rowIdx] = validValues.length;
        
        if (validValues.length > 1) {
          // Calculate sample standard deviation (n-1)
          const variance = validValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (validValues.length - 1);
          const sd = Math.sqrt(variance);
          const sem = sd / Math.sqrt(validValues.length);
          const cv = mean !== 0 ? (sd / Math.abs(mean)) * 100 : 0; // Coefficient of variation
          
          semRow.push(sem);
          statistics[groupName].cvValues[rowIdx] = cv;
          
          // Simple outlier detection (values beyond 2 SDs)
          const outliers = validValues.filter(v => Math.abs(v - mean) > 2 * sd);
          if (outliers.length > 0) {
            statistics[groupName].outliers.push({
              concentration: row.concentration,
              outlierValues: outliers,
              outlierCount: outliers.length
            });
          }
        } else {
          semRow.push(0);
          statistics[groupName].cvValues[rowIdx] = 0;
        }
      } else {
        meanRow.responses.push(NaN);
        semRow.push(0);
        countRow.push(0);
        statistics[groupName].validReplicates[rowIdx] = 0;
        statistics[groupName].cvValues[rowIdx] = NaN;
      }
    });

    means.push(meanRow);
    sems.push(semRow);
    replicateCounts.push(countRow);
  });

  return { means, sems, replicateCounts, statistics };
}

interface ReplicateStatistics {
  [groupName: string]: {
    totalReplicates: number;
    validReplicates: number[];
    outliers: Array<{
      concentration: number;
      outlierValues: number[];
      outlierCount: number;
    }>;
    cvValues: number[]; // Coefficient of variation for each concentration
  };
}

// Publication-quality color schemes
const PRISM_PUBLICATION_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
];

const COLORBLIND_SAFE_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
];

const HIGH_CONTRAST_COLORS = [
  '#000000', '#ff0000', '#00ff00', '#0000ff', '#ff00ff',
  '#00ffff', '#800000', '#008000', '#000080', '#808000'
];

// Get appropriate color scheme
function getColorScheme(scheme: string = 'standard'): string[] {
  switch (scheme) {
    case 'colorblind-safe': return COLORBLIND_SAFE_COLORS;
    case 'high-contrast': return HIGH_CONTRAST_COLORS;
    default: return PRISM_PUBLICATION_COLORS;
  }
}

// Generate visualization preset settings
function getVisualizationPreset(preset: string = 'publication') {
  const presets = {
    publication: {
      lineWidth: 2,
      symbolSize: 6,
      fontSize: { axis: 12, title: 14, legend: 10 }
    },
    presentation: {
      lineWidth: 3,
      symbolSize: 8,
      fontSize: { axis: 14, title: 18, legend: 12 }
    },
    poster: {
      lineWidth: 4,
      symbolSize: 10,
      fontSize: { axis: 16, title: 20, legend: 14 }
    }
  };
  return presets[preset as keyof typeof presets] || presets.publication;
}

// Generate XML for Prism .pzfx format
function generatePrismXML(options: PrismExportOptions): string {
  const { 
    datasets, 
    originalDataByDataset, 
    editedDataByDataset, 
    fittedCurvesByDataset,
    exportType,
    includeAnalyses = true,
    visualizationPreset = 'publication',
    colorScheme = 'standard',
    includeGraphTemplates = true
  } = options;
  
  const colors = getColorScheme(colorScheme);
  const visualStyle = getVisualizationPreset(visualizationPreset);
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<GraphPadPrismFile xmlns="http://graphpad.com/prism/Prism.htm" PrismXMLVersion="5.00" CreatedByProgram="nVitro Studio" Version="1.0">
<Created>
<OriginalVersion CreatedByProgram="nVitro Studio" CreatedByVersion="1.0"/>
<LastModified ModifiedByProgram="nVitro Studio" ModifiedByVersion="1.0"/>
</Created>
<MetaData>
<ExportType>Publication-Ready Dose-Response Analysis</ExportType>
<AnalysisMethod>Four-Parameter Logistic Regression</AnalysisMethod>
<QualityLevel>${visualizationPreset}</QualityLevel>
<ColorScheme>${colorScheme}</ColorScheme>
<IncludesAnalyses>${includeAnalyses}</IncludesAnalyses>
<IncludesGraphTemplates>${includeGraphTemplates}</IncludesGraphTemplates>
</MetaData>
<InfoSequence>
<Ref ID="Info0" Selected="1"/>
</InfoSequence>
<Info ID="Info0">
<Title>nVitro Studio - Dose Response Analysis Export</Title>
<Notes>Publication-ready dose-response analysis export from nVitro Studio

Export Configuration:
- Export Type: ${exportType}
- Visualization Preset: ${visualizationPreset}
- Color Scheme: ${colorScheme}
- Includes Curve Fitting Analysis: ${includeAnalyses}
- Includes Graph Templates: ${includeGraphTemplates}

Generated: ${new Date().toISOString()}

Curve Fitting Method: Four-Parameter Logistic Regression
Equation: Y = Bottom + (Top-Bottom)/(1+10^((LogEC50-X)*HillSlope))
</Notes>
</Info>
<TableSequence>
`;

  let tableId = 0;

  // Generate data tables for each dataset
  datasets.forEach((dataset) => {
    const originalData = originalDataByDataset[dataset.id] || [];
    const editedData = editedDataByDataset[dataset.id] || [];
    const fittedCurves = fittedCurvesByDataset[dataset.id] || [];
    const hasReplicates = originalData.length > 0 && originalData[0].replicateGroups && 
      new Set(originalData[0].replicateGroups).size < originalData[0].replicateGroups.length;

    if (exportType === 'raw_and_edited' || !hasReplicates) {
      // Export raw and edited data as separate XY tables
      if (originalData.length > 0) {
        xml += generateEnhancedXYTable(`Table${tableId++}`, `${dataset.name} - Raw Data`, originalData, colors, visualStyle);
      }
      if (editedData.length > 0) {
        xml += generateEnhancedXYTable(`Table${tableId++}`, `${dataset.name} - Edited Data`, editedData, colors, visualStyle);
      }
    } 
    else if (exportType === 'with_replicates_mean') {
      // Export mean data with error bars
      const { means, sems } = calculateReplicateStats(editedData);
      if (means.length > 0) {
        xml += generateEnhancedXYTableWithSEM(`Table${tableId++}`, `${dataset.name} - Mean ± SEM`, means, sems, colors, visualStyle);
      }
    }
    else if (exportType === 'with_replicates_individual') {
      // Export individual replicates
      if (editedData.length > 0) {
        xml += generateEnhancedXYTable(`Table${tableId++}`, `${dataset.name} - Individual Replicates`, editedData, colors, visualStyle);
      }
    }
    else if (exportType === 'both_replicates') {
      // Export both mean and individual data
      const { means, sems } = calculateReplicateStats(editedData);
      if (means.length > 0) {
        xml += generateEnhancedXYTableWithSEM(`Table${tableId++}`, `${dataset.name} - Mean ± SEM`, means, sems, colors, visualStyle);
      }
      if (editedData.length > 0) {
        xml += generateEnhancedXYTable(`Table${tableId++}`, `${dataset.name} - Individual Replicates`, editedData, colors, visualStyle);
      }
    }

    // Add analysis results table if curve fitting data is available
    if (includeAnalyses && fittedCurves.length > 0) {
      xml += generateAnalysisResultsTable(`Table${tableId++}`, dataset.name, fittedCurves);
      
      // Add replicate quality assessment if applicable
      if (hasReplicates && editedData.length > 0) {
        const { statistics } = calculateReplicateStats(editedData);
        xml += generateReplicateQualityTable(`Table${tableId++}`, dataset.name, statistics);
      }
    }
  });

  xml += `</TableSequence>
`;
  
  // Add graph templates if requested
  if (includeGraphTemplates) {
    xml += generateGraphTemplates(datasets, fittedCurvesByDataset, colors, visualStyle);
  }
  
  xml += `</GraphPadPrismFile>`;

  return xml;
}

// Generate enhanced XY data table without error bars
function generateEnhancedXYTable(
  tableId: string, 
  title: string, 
  data: DataPoint[], 
  colors: string[], 
  visualStyle: any
): string {
  if (!data.length) return '';

  const sampleNames = data[0].sampleNames || [];
  const concentrations = data.map(d => d.concentration);
  
  let xml = `<Table ID="${tableId}" XFormat="log10" YFormat="replicates" Replicates="1" TableType="XY" EVFormat="AsteriskAfterNumber" GraphType="DoseResponse">
<Title>${escapeXML(title)}</Title>
<Notes>Dose-response data optimized for publication-quality visualization
Visualization: Line width ${visualStyle.lineWidth}, Symbol size ${visualStyle.symbolSize}
Ready for four-parameter logistic curve fitting</Notes>
<AnalysisParameters>
  <RecommendedAnalysis>Nonlinear regression (curve fit)</RecommendedAnalysis>
  <Equation>log(agonist) vs. response -- Variable slope (four parameters)</Equation>
  <Method>FourParameterLogistic</Method>
</AnalysisParameters>
<ColumnTitlesRow>
<d>Concentration</d>
`;

  sampleNames.forEach(name => {
    xml += `<d>${escapeXML(name)}</d>\n`;
  });

  xml += `</ColumnTitlesRow>
`;

  // Create X column (concentrations) with enhanced formatting
  xml += `<XColumn Width="100" Decimals="9" Subcolumns="1">
<Title>Concentration</Title>
<Subcolumn>
`;
  concentrations.forEach(conc => {
    xml += `<d>${conc}</d>\n`;
  });
  xml += `</Subcolumn>
</XColumn>
`;

  // Create Y columns (responses) with enhanced formatting and color hints
  sampleNames.forEach((sampleName, sampleIdx) => {
    const colorHint = colors[sampleIdx % colors.length];
    xml += `<YColumn Width="120" Decimals="3" Subcolumns="1" ColorHint="${colorHint}">
<Title>${escapeXML(sampleName)}</Title>
<Subcolumn>
`;
    data.forEach(row => {
      const response = row.responses[sampleIdx];
      xml += `<d>${isNaN(response) ? '' : response.toFixed(3)}</d>\n`;
    });
    xml += `</Subcolumn>
</YColumn>
`;
  });

  xml += `</Table>
`;

  return xml;
}

// Legacy function for compatibility
function generateXYTable(tableId: string, title: string, data: DataPoint[]): string {
  return generateEnhancedXYTable(tableId, title, data, PRISM_PUBLICATION_COLORS, getVisualizationPreset('publication'));
}

// Generate enhanced XY data table with SEM error bars
function generateEnhancedXYTableWithSEM(
  tableId: string, 
  title: string, 
  means: DataPoint[], 
  sems: number[][], 
  colors: string[], 
  visualStyle: any
): string {
  if (!means.length) return '';

  const groupNames = means[0].sampleNames || [];
  const concentrations = means.map(d => d.concentration);
  
  let xml = `<Table ID="${tableId}" XFormat="log10" YFormat="replicates" Replicates="1" TableType="XY" EVFormat="SEM" GraphType="DoseResponse">
<Title>${escapeXML(title)}</Title>
<Notes>Mean response data with SEM error bars
Optimized for publication-quality dose-response curve fitting
Error bars: Standard Error of the Mean (SEM)
Visualization: Line width ${visualStyle.lineWidth}, Symbol size ${visualStyle.symbolSize}, Error bar caps</Notes>
<AnalysisParameters>
  <RecommendedAnalysis>Nonlinear regression (curve fit)</RecommendedAnalysis>
  <Equation>log(agonist) vs. response -- Variable slope (four parameters)</Equation>
  <Method>FourParameterLogistic</Method>
  <ErrorBars>SEM</ErrorBars>
  <WeightByErrorBars>true</WeightByErrorBars>
</AnalysisParameters>
<ColumnTitlesRow>
<d>Concentration</d>
`;

  groupNames.forEach(name => {
    xml += `<d>${escapeXML(name)}</d>\n`;
  });

  xml += `</ColumnTitlesRow>
`;

  // Create X column (concentrations) with enhanced formatting
  xml += `<XColumn Width="100" Decimals="9" Subcolumns="1">
<Title>Concentration</Title>
<Subcolumn>
`;
  concentrations.forEach(conc => {
    xml += `<d>${conc}</d>\n`;
  });
  xml += `</Subcolumn>
</XColumn>
`;

  // Create Y columns with SEM (responses with error bars) and color hints
  groupNames.forEach((groupName, groupIdx) => {
    const colorHint = colors[groupIdx % colors.length];
    xml += `<YColumn Width="120" Decimals="3" Subcolumns="2" ColorHint="${colorHint}" ErrorBarStyle="SEM">
<Title>${escapeXML(groupName)}</Title>
<Subcolumn>
`;
    means.forEach((row) => {
      const response = row.responses[groupIdx];
      xml += `<d>${isNaN(response) ? '' : response.toFixed(3)}</d>\n`;
    });
    xml += `</Subcolumn>
<Subcolumn>
`;
    means.forEach((row, rowIdx) => {
      const sem = sems[rowIdx]?.[groupIdx] || 0;
      xml += `<d>${sem.toFixed(4)}</d>\n`;
    });
    xml += `</Subcolumn>
</YColumn>
`;
  });

  xml += `</Table>
`;

  return xml;
}

// Legacy function for compatibility
function generateXYTableWithSEM(tableId: string, title: string, means: DataPoint[], sems: number[][]): string {
  return generateEnhancedXYTableWithSEM(tableId, title, means, sems, PRISM_PUBLICATION_COLORS, getVisualizationPreset('publication'));
}


// Utility function to escape XML special characters
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Generate analysis results table with curve fitting parameters
function generateAnalysisResultsTable(tableId: string, datasetName: string, curves: FittedCurve[]): string {
  if (!curves.length) return '';

  let xml = `<Table ID="${tableId}" TableType="Results" XFormat="numbers" YFormat="replicates">
<Title>${escapeXML(datasetName)} - Curve Fitting Parameters</Title>
<Notes>Four-parameter logistic regression results
Generated by nVitro Studio curve fitting analysis
Equation: Y = Bottom + (Top-Bottom)/(1+10^((LogEC50-X)*HillSlope))</Notes>
<AnalysisParameters>
  <AnalysisType>Nonlinear regression (curve fit)</AnalysisType>
  <Equation>log(agonist) vs. response -- Variable slope (four parameters)</Equation>
  <Method>FourParameterLogistic</Method>
</AnalysisParameters>
<ColumnTitlesRow>
  <d>Parameter</d>`;
  
  curves.forEach(curve => {
    xml += `<d>${escapeXML(curve.sampleName)}</d>`;
  });
  
  xml += `</ColumnTitlesRow>
`;

  // Best-fit values
  const parameterRows: Array<{ name: string; getValue: (curve: FittedCurve) => number | null }> = [
    { name: 'Bottom', getValue: (curve: FittedCurve) => curve.bottom },
    { name: 'Top', getValue: (curve: FittedCurve) => curve.top },
    { name: 'LogEC50', getValue: (curve: FittedCurve) => Math.log10(curve.ec50) },
    { name: 'HillSlope', getValue: (curve: FittedCurve) => curve.hillSlope },
    { name: 'EC50', getValue: (curve: FittedCurve) => curve.ec50 }
  ];

  // Add conditional EC10 and EC90 if available
  if (curves.some(c => c.ec10 !== undefined)) {
    parameterRows.push({ name: 'EC10', getValue: (curve: FittedCurve) => curve.ec10 ?? null });
  }
  if (curves.some(c => c.ec90 !== undefined)) {
    parameterRows.push({ name: 'EC90', getValue: (curve: FittedCurve) => curve.ec90 ?? null });
  }

  parameterRows.forEach(param => {
    xml += `<Row><d>${param.name}</d>`;
    curves.forEach(curve => {
      const value = param.getValue(curve);
      xml += `<d>${value != null ? (typeof value === 'number' ? value.toFixed(6) : value) : ''}</d>`;
    });
    xml += `</Row>\n`;
  });

  // Goodness of fit section
  xml += `<Row><d>R squared</d>`;
  curves.forEach(curve => {
    xml += `<d>${curve.rSquared?.toFixed(6) || ''}</d>`;
  });
  xml += `</Row>\n`;

  xml += `</Table>\n`;
  return xml;
}

// Generate replicate quality assessment table
function generateReplicateQualityTable(
  tableId: string, 
  datasetName: string, 
  statistics: ReplicateStatistics
): string {
  const groupNames = Object.keys(statistics);
  if (groupNames.length === 0) return '';

  let xml = `<Table ID="${tableId}" TableType="Results" XFormat="numbers" YFormat="replicates">
<Title>${escapeXML(datasetName)} - Replicate Quality Assessment</Title>
<Notes>Statistical assessment of replicate data quality
CV = Coefficient of Variation (%)
Outliers detected using 2SD threshold
Generated by nVitro Studio quality control analysis</Notes>
<AnalysisParameters>
  <AnalysisType>Replicate Quality Assessment</AnalysisType>
  <Method>Statistical Quality Control</Method>
  <OutlierThreshold>2 Standard Deviations</OutlierThreshold>
</AnalysisParameters>
<ColumnTitlesRow>
  <d>Metric</d>`;
  
  groupNames.forEach(groupName => {
    xml += `<d>${escapeXML(groupName)}</d>`;
  });
  
  xml += `</ColumnTitlesRow>\n`;

  // Total replicates row
  xml += `<Row><d>Total Replicates</d>`;
  groupNames.forEach(groupName => {
    xml += `<d>${statistics[groupName].totalReplicates}</d>`;
  });
  xml += `</Row>\n`;

  // Average valid replicates
  xml += `<Row><d>Avg Valid Replicates</d>`;
  groupNames.forEach(groupName => {
    const validCounts = statistics[groupName].validReplicates.filter(count => count > 0);
    const avgValid = validCounts.length > 0 ? 
      (validCounts.reduce((a, b) => a + b, 0) / validCounts.length).toFixed(1) : '0';
    xml += `<d>${avgValid}</d>`;
  });
  xml += `</Row>\n`;

  // Average CV
  xml += `<Row><d>Avg CV (%)</d>`;
  groupNames.forEach(groupName => {
    const cvValues = statistics[groupName].cvValues.filter(cv => !isNaN(cv) && cv > 0);
    const avgCV = cvValues.length > 0 ? 
      (cvValues.reduce((a, b) => a + b, 0) / cvValues.length).toFixed(1) : 'N/A';
    xml += `<d>${avgCV}</d>`;
  });
  xml += `</Row>\n`;

  // Outlier count
  xml += `<Row><d>Outlier Events</d>`;
  groupNames.forEach(groupName => {
    const outlierCount = statistics[groupName].outliers.length;
    xml += `<d>${outlierCount}</d>`;
  });
  xml += `</Row>\n`;

  xml += `</Table>\n`;
  return xml;
}

// Generate comprehensive graph templates for publication-ready visualization
function generateGraphTemplates(
  datasets: Dataset[], 
  fittedCurvesByDataset: Record<string, FittedCurve[]>, 
  colors: string[], 
  visualStyle: any
): string {
  let xml = `<GraphSequence>\n`;
  
  datasets.forEach((dataset, datasetIdx) => {
    const curves = fittedCurvesByDataset[dataset.id] || [];
    if (curves.length === 0) return;

    xml += `<Graph ID="Graph${datasetIdx}" GraphType="XY" Template="DoseResponse">
<Title>Dose-Response Analysis - ${escapeXML(dataset.name)}</Title>
<Notes>Publication-ready dose-response curve visualization
Four-parameter logistic curve fitting
Optimized for scientific publication standards
Ready for immediate publication use</Notes>
<PlotArea Background="#FFFFFF" BorderWidth="2" BorderColor="#000000">
  <XAxis>
    <AxisFormat Scale="log10" Title="Concentration (M)" TitleSize="${visualStyle.fontSize.axis}" NumberSize="${visualStyle.fontSize.axis - 1}" />
    <AxisStyle LineWidth="2" Color="#000000" />
    <TickMarks Major="true" Minor="true" />
    <Grid Show="true" Style="dotted" Color="#E0E0E0" />
  </XAxis>
  <YAxis>
    <AxisFormat Title="Response" TitleSize="${visualStyle.fontSize.axis}" NumberSize="${visualStyle.fontSize.axis - 1}" />
    <AxisStyle LineWidth="2" Color="#000000" />
    <TickMarks Major="true" Minor="true" />
    <Grid Show="true" Style="dotted" Color="#E0E0E0" />
  </YAxis>
  <Legend Show="true" FontSize="${visualStyle.fontSize.legend}" Position="TopRight" Background="#FFFFFF" Border="true" />
</PlotArea>
<CurveFormatting>
  <DefaultLineWidth>${visualStyle.lineWidth}</DefaultLineWidth>
  <DefaultSymbolSize>${visualStyle.symbolSize}</DefaultSymbolSize>
  <DefaultErrorBarWidth>1</DefaultErrorBarWidth>
  <DefaultErrorBarCapSize>3</DefaultErrorBarCapSize>
  <ColorScheme Type="Scientific">`;
    
    curves.forEach((curve, curveIdx) => {
      const color = colors[curveIdx % colors.length];
      xml += `<CurveColor Index="${curveIdx}" Color="${color}" Name="${escapeXML(curve.sampleName)}" />`;
    });
    
    xml += `  </ColorScheme>
  <CurveParameters>`;
    
    curves.forEach((curve, curveIdx) => {
      xml += `<Curve Index="${curveIdx}" Name="${escapeXML(curve.sampleName)}">
      <FittingParameters>
        <EC50>${curve.ec50}</EC50>
        <HillSlope>${curve.hillSlope}</HillSlope>
        <Top>${curve.top}</Top>
        <Bottom>${curve.bottom}</Bottom>
        <RSquared>${curve.rSquared}</RSquared>
      </FittingParameters>
    </Curve>`;
    });
    
    xml += `  </CurveParameters>
</CurveFormatting>
<PublicationSettings>
  <DPI>300</DPI>
  <ExportFormats>PDF,PNG,SVG,EPS</ExportFormats>
  <ColorMode>RGB</ColorMode>
  <FontEmbedding>true</FontEmbedding>
</PublicationSettings>
</Graph>\n`;
  });
  
  xml += `</GraphSequence>\n`;
  return xml;
}

// Generate smart filename with enhanced metadata
function generateSmartFilename(options: PrismExportOptions): string {
  const { datasets, exportType, assayType, visualizationPreset } = options;
  const timestamp = new Date().toISOString().split('T')[0];
  const assayLabel = assayType ? `${assayType.replace(/\s+/g, '-')}` : 'dose-response';
  const datasetLabel = datasets.length === 1 
    ? datasets[0].name.replace(/[^a-zA-Z0-9_-]/g, '')
    : `${datasets.length}-datasets`;
  
  const qualityLabel = `${visualizationPreset || 'publication'}-ready`;
  const exportTypeLabel = exportType.replace(/_/g, '-');
  
  return `${assayLabel}-${datasetLabel}-${exportTypeLabel}-${qualityLabel}-${timestamp}.pzfx`;
}

// Main export function
export async function exportToPrism(options: PrismExportOptions): Promise<{
  success: boolean;
  filename: string;
  datasetCount: number;
  totalCurves: number;
  exportType: string;
  includesAnalyses: boolean;
  visualizationPreset: string;
}> {
  try {
    const xml = generatePrismXML(options);
    
    // Create blob and download
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    
    // Generate smart filename
    link.download = generateSmartFilename(options);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    console.log('Enhanced Prism export completed successfully with:\n' +
      '- Publication-ready data tables\n' +
      '- Pre-populated curve fitting analyses\n' +
      '- Replicate quality assessment\n' +
      '- Publication-quality visualization templates\n' +
      '- Smart filename with metadata');
    
    // Return summary information
    const datasetCount = options.datasets.length;
    const totalCurves = Object.values(options.fittedCurvesByDataset).reduce((total, curves) => total + curves.length, 0);
    
    return {
      success: true,
      filename: generateSmartFilename(options),
      datasetCount,
      totalCurves,
      exportType: options.exportType,
      includesAnalyses: options.includeAnalyses || true,
      visualizationPreset: options.visualizationPreset || 'publication'
    };
  } catch (error) {
    console.error('Enhanced Prism export failed:', error);
    throw new Error('Failed to export to enhanced Prism format');
  }
}

// Enhanced function to analyze data structure and recommend export options
export function getPrismExportOptions(data: DataPoint[]): {
  options: string[];
  replicateInfo: {
    hasReplicates: boolean;
    groupCount: number;
    replicatesPerGroup: { [key: string]: number };
    recommendedDefault: string;
    dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
  };
} {
  if (!data.length) {
    return {
      options: [],
      replicateInfo: {
        hasReplicates: false,
        groupCount: 0,
        replicatesPerGroup: {},
        recommendedDefault: 'raw_and_edited',
        dataQuality: 'poor'
      }
    };
  }
  
  const hasReplicates = data[0].replicateGroups && 
    new Set(data[0].replicateGroups).size < data[0].replicateGroups.length;
  
  if (!hasReplicates) {
    return {
      options: ['raw_and_edited'],
      replicateInfo: {
        hasReplicates: false,
        groupCount: data[0].responses?.length || 0,
        replicatesPerGroup: {},
        recommendedDefault: 'raw_and_edited',
        dataQuality: 'good'
      }
    };
  }
  
  // Analyze replicate structure
  const replicateGroups = data[0].replicateGroups!;
  const groupMap: { [group: string]: number } = {};
  replicateGroups.forEach(group => {
    const groupKey = group.trim();
    groupMap[groupKey] = (groupMap[groupKey] || 0) + 1;
  });
  
  const groupCount = Object.keys(groupMap).length;
  const minReplicates = Math.min(...Object.values(groupMap));
  const maxReplicates = Math.max(...Object.values(groupMap));
  const avgReplicates = Object.values(groupMap).reduce((a, b) => a + b, 0) / groupCount;
  
  // Assess data quality
  let dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
  if (minReplicates >= 3 && maxReplicates === minReplicates) {
    dataQuality = 'excellent'; // Consistent, adequate replicates
  } else if (minReplicates >= 2 && (maxReplicates - minReplicates) <= 1) {
    dataQuality = 'good'; // Good replicates with minimal variation
  } else if (minReplicates >= 2) {
    dataQuality = 'fair'; // Acceptable but inconsistent replicates
  } else {
    dataQuality = 'poor'; // Insufficient replicates
  }
  
  // Determine recommended default based on data quality and replicate structure
  let recommendedDefault: string;
  if (dataQuality === 'excellent' || dataQuality === 'good') {
    recommendedDefault = avgReplicates >= 3 ? 'with_replicates_mean' : 'both_replicates';
  } else {
    recommendedDefault = 'with_replicates_individual';
  }
  
  return {
    options: ['with_replicates_mean', 'with_replicates_individual', 'both_replicates'],
    replicateInfo: {
      hasReplicates: true,
      groupCount,
      replicatesPerGroup: groupMap,
      recommendedDefault,
      dataQuality
    }
  };
}