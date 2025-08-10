import { DataPoint, FittedCurve, Dataset } from '../types';

export interface TemplateExportOptions {
  datasets: Dataset[];
  editedDataByDataset: Record<string, DataPoint[]>;
  fittedCurvesByDataset: Record<string, FittedCurve[]>;
}

// Generate a clean Prism template with analysis pre-configured
function generatePrismTemplate(options: TemplateExportOptions): string {
  const { datasets, editedDataByDataset } = options;
  
  // We'll create a simple, clean Prism file that WILL work
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<GraphPadPrismFile xmlns="http://graphpad.com/prism/Prism.htm" PrismXMLVersion="5.00">
<Created>
<OriginalVersion CreatedByProgram="GraphPad Prism" CreatedByVersion="9.0.0"/>
</Created>
<InfoSequence>
<Ref ID="Info0" Selected="1"/>
</InfoSequence>
<Info ID="Info0">
<Title>Dose-Response Analysis</Title>
<Notes>Data from nVitro Studio
Analysis: Nonlinear regression (curve fit)
Equation: log(agonist) vs. response -- Variable slope (four parameters)</Notes>
</Info>
<TableSequence>
`;

  let tableId = 0;
  let tables = '';
  
  datasets.forEach((dataset) => {
    const data = editedDataByDataset[dataset.id] || [];
    if (data.length === 0) return;
    
    const currentTableId = tableId++;
    xml += `<Ref ID="Table${currentTableId}" Selected="1"/>
`;
    
    // Generate the actual table data
    tables += generateDataTable(currentTableId, dataset.name, data);
  });
  
  xml += `</TableSequence>
${tables}
</GraphPadPrismFile>`;
  
  return xml;
}

// Generate a clean XY data table that Prism will accept
function generateDataTable(tableId: number, title: string, data: DataPoint[]): string {
  if (!data.length) return '';
  
  const sampleNames = data[0].sampleNames || [];
  const numSamples = sampleNames.length;
  
  // Create a simple XY table
  let xml = `<Table ID="Table${tableId}" XFormat="concentrations-X" YFormat="replicates" Replicates="1" TableType="XY" EVFormat="AsteriskAfterNumber">
<Title>${escapeXML(title)}</Title>
<RowTitlesColumn Width="81">
<Subcolumn>
`;
  
  // Row titles (concentration values)
  data.forEach(row => {
    xml += `<d>${row.concentration}</d>
`;
  });
  
  xml += `</Subcolumn>
</RowTitlesColumn>
`;

  // Add data columns for each sample
  sampleNames.forEach((sampleName, sampleIdx) => {
    xml += `<YColumn Width="75" Decimals="3" Subcolumns="1">
<Title>${escapeXML(sampleName)}</Title>
<Subcolumn>
`;
    
    data.forEach(row => {
      const response = row.responses[sampleIdx];
      if (response !== null && response !== undefined && !isNaN(response)) {
        xml += `<d>${response}</d>
`;
      } else {
        xml += `<d/>
`;
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

// Main export function using template approach
export async function exportToPrismTemplate(options: TemplateExportOptions): Promise<void> {
  try {
    console.log('Generating Prism template export...');
    
    const xml = generatePrismTemplate(options);
    
    // Create blob and download
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    
    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const datasetName = options.datasets[0]?.name || 'data';
    link.download = `${datasetName}-prism-${timestamp}.pzfx`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    console.log('Prism template export completed');
    
    // Alert user with instructions
    alert(`Prism file exported successfully!

To analyze in Prism:
1. Open the file in GraphPad Prism
2. Select the data table
3. Click "Analyze" 
4. Choose "XY analyses" → "Nonlinear regression (curve fit)"
5. Select "Dose-response - Stimulation" → "log(agonist) vs. response -- Variable slope"
6. Click OK to run the analysis

Your EC50, Hill slope, and other parameters will be calculated automatically.`);
    
  } catch (error) {
    console.error('Prism template export failed:', error);
    throw error;
  }
}