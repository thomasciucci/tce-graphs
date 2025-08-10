import { DataPoint, FittedCurve, Dataset } from '../types';

export interface ZipExportOptions {
  datasets: Dataset[];
  editedDataByDataset: Record<string, DataPoint[]>;
  fittedCurvesByDataset: Record<string, FittedCurve[]>;
}

/**
 * Creates a ZIP file containing:
 * 1. Clean Prism data file (.pzfx)
 * 2. Analysis parameters file (.txt)
 * 3. Fitted curve data as CSV
 * 4. Prism script for automated analysis
 */
export async function exportPrismAnalysisZip(options: ZipExportOptions): Promise<void> {
  try {
    // Dynamically import JSZip
    const JSZip = (await import('jszip')).default;
    
    const zip = new JSZip();
    const timestamp = new Date().toISOString().split('T')[0];
    
    // 1. Create clean Prism data file
    const prismData = createCleanPrismData(options);
    zip.file('dose_response_data.pzfx', prismData);
    
    // 2. Create analysis parameters file
    const analysisParams = createAnalysisParameters(options);
    zip.file('analysis_parameters.txt', analysisParams);
    
    // 3. Create fitted curves CSV
    const curvesCSV = createFittedCurvesCSV(options);
    zip.file('fitted_curves.csv', curvesCSV);
    
    // 4. Create Prism script for automation
    const prismScript = createPrismScript(options);
    zip.file('prism_analysis_script.txt', prismScript);
    
    // 5. Create README with instructions
    const readme = createReadmeInstructions(options);
    zip.file('README.txt', readme);
    
    // Generate ZIP file
    const content = await zip.generateAsync({ type: 'blob' });
    
    // Download ZIP
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dose_response_analysis_${timestamp}.zip`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    // Show success message
    alert(`✅ Complete Analysis Package Exported!

Your ZIP file contains:
📊 dose_response_data.pzfx - Clean data for Prism
📋 analysis_parameters.txt - Your fitted parameters
📈 fitted_curves.csv - Curve data for plotting
🤖 prism_analysis_script.txt - Automated analysis script
📖 README.txt - Step-by-step instructions

Open README.txt first for detailed instructions!`);
    
  } catch (error) {
    console.error('ZIP export failed:', error);
    
    // Fallback to simple export if JSZip fails
    console.log('Falling back to simple data export...');
    await fallbackSimpleExport(options);
  }
}

function createCleanPrismData(options: ZipExportOptions): string {
  const { datasets, editedDataByDataset } = options;
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<GraphPadPrismFile xmlns="http://graphpad.com/prism/Prism.htm" PrismXMLVersion="5.00">
<Created>
<OriginalVersion CreatedByProgram="nVitro Studio" CreatedByVersion="1.0"/>
</Created>
<InfoSequence>
<Ref ID="Info0" Selected="1"/>
</InfoSequence>
<Info ID="Info0">
<Title>Dose-Response Data from nVitro Studio</Title>
<Notes>Data ready for dose-response curve fitting
Use the included analysis script or follow manual instructions in README.txt</Notes>
</Info>
<TableSequence>
`;

  let tableId = 0;
  let tables = '';
  
  datasets.forEach(dataset => {
    const data = editedDataByDataset[dataset.id];
    if (!data || data.length === 0) return;
    
    xml += `<Ref ID="Table${tableId}" Selected="1"/>
`;
    
    tables += createCleanDataTable(tableId, dataset.name, data);
    tableId++;
  });
  
  xml += `</TableSequence>
${tables}
</GraphPadPrismFile>`;
  
  return xml;
}

function createCleanDataTable(tableId: number, title: string, data: DataPoint[]): string {
  const sampleNames = data[0]?.sampleNames || [];
  
  let table = `<Table ID="Table${tableId}" XFormat="numbers" YFormat="replicates" Replicates="1" TableType="XY" EVFormat="AsteriskAfterNumber">
<Title>${escapeXML(title)}</Title>
<RowTitlesColumn Width="81">
<Subcolumn>
`;
  
  data.forEach((_, idx) => {
    table += `<d>Point ${idx + 1}</d>
`;
  });
  
  table += `</Subcolumn>
</RowTitlesColumn>
<XColumn Width="120" Decimals="6" Subcolumns="1">
<Title>Concentration</Title>
<Subcolumn>
`;
  
  data.forEach(point => {
    table += `<d>${point.concentration}</d>
`;
  });
  
  table += `</Subcolumn>
</XColumn>
`;
  
  sampleNames.forEach((sampleName, sampleIdx) => {
    table += `<YColumn Width="120" Decimals="3" Subcolumns="1">
<Title>${escapeXML(sampleName)}</Title>
<Subcolumn>
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
</YColumn>
`;
  });
  
  table += `</Table>
`;
  
  return table;
}

function createAnalysisParameters(options: ZipExportOptions): string {
  const { datasets, fittedCurvesByDataset } = options;
  
  let params = `DOSE-RESPONSE ANALYSIS PARAMETERS
Generated by nVitro Studio on ${new Date().toLocaleString()}

==================================================
FITTED CURVE PARAMETERS (from nVitro Studio)
==================================================

`;

  datasets.forEach(dataset => {
    const curves = fittedCurvesByDataset[dataset.id] || [];
    if (curves.length === 0) return;
    
    params += `Dataset: ${dataset.name}
${'='.repeat(dataset.name.length + 9)}

`;
    
    curves.forEach(curve => {
      params += `Sample: ${curve.sampleName}
  Bottom:      ${curve.bottom.toFixed(4)} 
  Top:         ${curve.top.toFixed(4)}
  EC50:        ${curve.ec50.toExponential(4)}
  LogEC50:     ${Math.log10(curve.ec50).toFixed(4)}
  Hill Slope:  ${curve.hillSlope.toFixed(4)}
  R²:          ${curve.rSquared?.toFixed(6) || 'N/A'}`;
      
      if (curve.ec10) params += `\n  EC10:        ${curve.ec10.toExponential(4)}`;
      if (curve.ec90) params += `\n  EC90:        ${curve.ec90.toExponential(4)}`;
      
      params += `\n\n`;
    });
  });
  
  params += `
==================================================
EQUATION USED
==================================================
Four-Parameter Logistic:
Y = Bottom + (Top - Bottom) / (1 + 10^((LogEC50 - X) * HillSlope))

Where:
- X = Log10(concentration)
- Y = Response value
- Bottom = Lower asymptote (minimum response)
- Top = Upper asymptote (maximum response)
- LogEC50 = Log10 of half-maximal effective concentration
- HillSlope = Slope factor (curve steepness)
`;
  
  return params;
}

function createFittedCurvesCSV(options: ZipExportOptions): string {
  const { datasets, fittedCurvesByDataset, editedDataByDataset } = options;
  
  let csv = 'Dataset,Sample,Concentration,Observed_Response,Fitted_Response\n';
  
  datasets.forEach(dataset => {
    const data = editedDataByDataset[dataset.id];
    const curves = fittedCurvesByDataset[dataset.id] || [];
    
    if (!data || data.length === 0) return;
    
    const sampleNames = data[0]?.sampleNames || [];
    
    sampleNames.forEach((sampleName, sampleIdx) => {
      const curve = curves.find(c => c.sampleName === sampleName);
      
      data.forEach(point => {
        const observed = point.responses[sampleIdx];
        let fitted = '';
        
        if (curve && observed !== null && observed !== undefined && !isNaN(observed)) {
          const logConc = point.concentration > 0 ? Math.log10(point.concentration) : -10;
          const logEC50 = Math.log10(curve.ec50);
          const fittedValue = curve.bottom + (curve.top - curve.bottom) / 
            (1 + Math.pow(10, (logEC50 - logConc) * curve.hillSlope));
          fitted = fittedValue.toFixed(6);
        }
        
        csv += `"${dataset.name}","${sampleName}",${point.concentration},${observed || ''},${fitted}\n`;
      });
    });
  });
  
  return csv;
}

function createPrismScript(options: ZipExportOptions): string {
  const { datasets } = options;
  
  return `GRAPHPAD PRISM ANALYSIS SCRIPT
Generated by nVitro Studio

==================================================
AUTOMATED ANALYSIS INSTRUCTIONS
==================================================

1. Open dose_response_data.pzfx in GraphPad Prism

2. For EACH data table, perform the following:
   
   a) Select the data table
   b) Click "Analyze"
   c) Choose "XY analyses" → "Nonlinear regression (curve fit)"
   d) In the "Dose-response - Stimulation" section:
      - Select "log(agonist) vs. response -- Variable slope (four parameters)"
   e) Click "OK"

3. Prism will automatically:
   - Calculate EC50, Hill slope, Top, Bottom values
   - Generate fitted curves
   - Provide confidence intervals
   - Create publication-ready graphs

==================================================
MANUAL VERIFICATION
==================================================

You can verify the analysis against the parameters in:
- analysis_parameters.txt (your nVitro Studio results)
- fitted_curves.csv (theoretical curve data)

The results should match closely!

==================================================
GRAPH CUSTOMIZATION
==================================================

To create publication-ready graphs:
1. After analysis, go to the Results section
2. Select "New Graph of Existing Data"
3. Choose your fitted curves
4. Customize axes:
   - X-axis: Log scale
   - Y-axis: Linear scale
   - Add appropriate titles and units

==================================================
DATASETS INCLUDED
==================================================

${datasets.map((ds, idx) => `${idx + 1}. ${ds.name}`).join('\n')}

Total datasets: ${datasets.length}

Generated: ${new Date().toLocaleString()}
Source: nVitro Studio (Professional Dose-Response Analysis)
`;
}

function createReadmeInstructions(options: ZipExportOptions): string {
  const { datasets, fittedCurvesByDataset } = options;
  const totalCurves = Object.values(fittedCurvesByDataset).reduce((sum, curves) => sum + curves.length, 0);
  
  return `🧪 NVITRO STUDIO - COMPLETE DOSE-RESPONSE ANALYSIS PACKAGE
==========================================================

Welcome! This package contains everything you need to continue your 
dose-response analysis in GraphPad Prism.

📦 PACKAGE CONTENTS:
-------------------
✅ dose_response_data.pzfx     - Your data in Prism format
✅ analysis_parameters.txt     - Fitted parameters from nVitro Studio
✅ fitted_curves.csv          - Theoretical curve data
✅ prism_analysis_script.txt  - Step-by-step analysis guide
✅ README.txt                 - This instruction file

📊 YOUR DATA SUMMARY:
--------------------
Datasets: ${datasets.length}
Total curves: ${totalCurves}
Analysis: Four-parameter logistic regression
Export date: ${new Date().toLocaleString()}

🚀 QUICK START GUIDE:
--------------------
1. Open "dose_response_data.pzfx" in GraphPad Prism
2. Follow the instructions in "prism_analysis_script.txt"
3. Compare results with "analysis_parameters.txt"
4. Use "fitted_curves.csv" for additional plotting if needed

🎯 DETAILED WORKFLOW:
--------------------

STEP 1: Open Data File
• Double-click "dose_response_data.pzfx" 
• It should open directly in GraphPad Prism
• You'll see your data organized in clean XY tables

STEP 2: Run Analysis
For each data table:
• Select the data table
• Click "Analyze" button
• Choose "XY analyses" → "Nonlinear regression (curve fit)"
• Select "Dose-response - Stimulation"
• Choose "log(agonist) vs. response -- Variable slope (four parameters)"
• Click "OK" to run analysis

STEP 3: View Results
• Prism will calculate EC50, Hill slope, etc.
• Results should match those in "analysis_parameters.txt"
• Graphs are automatically generated

STEP 4: Publication
• Customize graphs as needed
• Export high-resolution figures
• Copy parameters for your publication

💡 TROUBLESHOOTING:
------------------
• If Prism won't open the .pzfx file, ensure you have Prism 8.0 or newer
• If analysis fails, check that all data points are numerical
• For questions about the original analysis, refer to nVitro Studio

🆘 NEED HELP?
------------
• Check "prism_analysis_script.txt" for detailed instructions
• Compare your Prism results with "analysis_parameters.txt"
• The fitted_curves.csv contains the theoretical curves for verification

This package was generated by nVitro Studio Professional
Visit: https://nvitrostudio.com for more information

Happy analyzing! 🔬
`;
}

// Fallback export if ZIP fails
async function fallbackSimpleExport(options: ZipExportOptions): Promise<void> {
  // Create simple combined text file
  const combined = `${createAnalysisParameters(options)}

${createPrismScript(options)}

FITTED CURVES DATA (CSV FORMAT):
${createFittedCurvesCSV(options)}
`;
  
  const blob = new Blob([combined], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `dose_response_analysis_${new Date().toISOString().split('T')[0]}.txt`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
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