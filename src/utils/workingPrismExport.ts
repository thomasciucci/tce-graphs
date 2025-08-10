import { DataPoint, FittedCurve, Dataset } from '../types';

export interface WorkingPrismExportOptions {
  datasets: Dataset[];
  editedDataByDataset: Record<string, DataPoint[]>;
  fittedCurvesByDataset?: Record<string, FittedCurve[]>;
}

/**
 * Creates a Prism file that ACTUALLY WORKS with GraphPad Prism
 * Based on reverse-engineering actual working Prism files
 */
export function createWorkingPrismFile(options: WorkingPrismExportOptions): string {
  const { datasets, editedDataByDataset } = options;
  
  // This format is based on actual working Prism files
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<GraphPadPrismFile xmlns="http://graphpad.com/prism/Prism.htm" PrismXMLVersion="5.00">
<Created>
<OriginalVersion CreatedByProgram="GraphPad Prism" CreatedByVersion="8.0.0"/>
</Created>
<InfoSequence>
<Ref ID="Info0" Selected="1"/>
</InfoSequence>
<Info ID="Info0">
<Title>Dose-Response Data</Title>
<Notes>Imported from nVitro Studio

To analyze:
1. Select data table below
2. Click Analyze button
3. Choose "XY analyses" → "Nonlinear regression (curve fit)"  
4. Select "Dose-response - Stimulation" section
5. Choose "log(agonist) vs. response -- Variable slope (four parameters)"
6. Click OK

The analysis will calculate:
- EC50 (half maximal effective concentration)
- Hill Slope (steepness of the curve)
- Top and Bottom plateaus
- R squared (goodness of fit)</Notes>
<Constant><Name>Experiment Date</Name><Value>${new Date().toISOString().split('T')[0]}</Value></Constant>
</Info>
<TableSequence>
`;

  let tableId = 0;
  let tableContent = '';
  
  // Add table references and content
  datasets.forEach(dataset => {
    const data = editedDataByDataset[dataset.id];
    if (!data || data.length === 0) return;
    
    xml += `<Ref ID="Table${tableId}" Selected="1"/>
`;
    
    tableContent += createWorkingTable(tableId, dataset.name, data);
    tableId++;
  });
  
  xml += `</TableSequence>
${tableContent}
</GraphPadPrismFile>`;
  
  return xml;
}

function createWorkingTable(tableId: number, title: string, data: DataPoint[]): string {
  const sampleNames = data[0]?.sampleNames || [];
  
  // CRITICAL: This exact format works in Prism
  let table = `<Table ID="Table${tableId}" XFormat="numbers" YFormat="replicates" Replicates="1" TableType="XY" EVFormat="AsteriskAfterNumber">
<Title>${escapeXML(title)}</Title>
<RowTitlesColumn Width="81">
<Subcolumn>
`;

  // Add row titles (can be blank or concentration values)
  data.forEach((_, idx) => {
    table += `<d>Row ${idx + 1}</d>
`;
  });
  
  table += `</Subcolumn>
</RowTitlesColumn>
`;

  // X Column - Concentrations (CRITICAL: proper format)
  table += `<XColumn Width="90" Decimals="4" Subcolumns="1">
<Title>Concentration</Title>
<Subcolumn>
`;
  
  data.forEach(point => {
    // Output concentration as-is (no transformation)
    table += `<d>${point.concentration}</d>
`;
  });
  
  table += `</Subcolumn>
</XColumn>
`;

  // Y Columns - Response data
  sampleNames.forEach((sampleName, sampleIdx) => {
    table += `<YColumn Width="90" Decimals="3" Subcolumns="1">
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
export async function exportWorkingPrism(options: WorkingPrismExportOptions): Promise<void> {
  try {
    console.log('Creating working Prism export...');
    
    const xml = createWorkingPrismFile(options);
    
    // Debug: Log first 500 chars
    console.log('Generated XML preview:', xml.substring(0, 500));
    
    // Create and download file
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    
    const timestamp = new Date().toISOString().split('T')[0];
    const datasetName = options.datasets[0]?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'data';
    link.download = `${datasetName}_prism_${timestamp}.pzfx`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    console.log('Working Prism export completed successfully');
    
  } catch (error) {
    console.error('Working Prism export failed:', error);
    throw error;
  }
}