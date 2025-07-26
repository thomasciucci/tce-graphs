import { DataPoint, Dataset } from '../types';

export interface SimplePrismExportOptions {
  datasets: Dataset[];
  editedDataByDataset: Record<string, DataPoint[]>;
  exportType: 'raw_and_edited' | 'with_replicates_mean' | 'with_replicates_individual';
}

// Generate enhanced Prism XML with data tables and analysis templates
function generateSimplePrismXML(options: SimplePrismExportOptions): string {
  const { datasets, editedDataByDataset } = options;
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<GraphPadPrismFile xmlns="http://graphpad.com/prism/Prism.htm" PrismXMLVersion="5.00">
<Created>
<OriginalVersion CreatedByProgram="GraphPad Prism" CreatedByVersion="9.00"/>
</Created>
<InfoSequence>
<Ref ID="Info0" Selected="1"/>
</InfoSequence>
<Info ID="Info0">
<Title>Dose Response Analysis from iDose Studio</Title>
<Notes>INSTRUCTIONS FOR ANALYSIS:
1. Select the data table
2. Go to Analyze → Nonlinear regression (curve fit)  
3. Choose "log(agonist) vs. response -- Variable slope (four parameters)"
4. Click OK to fit dose-response curves

Data format: Log₁₀[Concentration in M] vs Response
Recommended equation: Y = Bottom + (Top-Bottom)/(1+10^((LogEC50-X)*HillSlope))

Original data from iDose Studio with fitted curve parameters available.</Notes>
</Info>
<TableSequence>
`;

  // First, generate table references in the sequence
  let tableRefs = '';
  let tables = '';
  let tableId = 0;

  datasets.forEach((dataset) => {
    const data = editedDataByDataset[dataset.id] || [];
    console.log(`Processing dataset ${dataset.id}:`, dataset.name, 'with', data.length, 'data points');
    if (data.length > 0) {
      const currentTableId = `Table${tableId++}`;
      // Add table reference
      tableRefs += `<Ref ID="${currentTableId}" Selected="1"/>\n`;
      
      console.log('Sample data:', data[0]);
      const tableXML = generateSimpleXYTable(currentTableId, dataset.name, data);
      console.log('Generated table XML length:', tableXML.length);
      tables += tableXML;
    }
  });

  xml += tableRefs;
  xml += `</TableSequence>
${tables}
</GraphPadPrismFile>`;

  return xml;
}

// Generate enhanced XY table with nonlinear regression metadata
function generateSimpleXYTable(tableId: string, title: string, data: DataPoint[]): string {
  if (!data.length) return '';

  const sampleNames = data[0].sampleNames || [];
  
  let xml = `<Table ID="${tableId}" XFormat="log" YFormat="replicates" Replicates="1" TableType="XY" EVFormat="AsteriskAfterNumber">
<Title>${escapeXML(title)} - Dose Response Data</Title>
<RowTitlesColumn Width="81">
<Title/>
</RowTitlesColumn>
<ColumnTitlesRow>
<d>Log[Concentration] (M)</d>
`;

  sampleNames.forEach(name => {
    xml += `<d>${escapeXML(name)}</d>\n`;
  });

  xml += `</ColumnTitlesRow>
`;

  // X Column (log concentrations for dose-response)
  xml += `<XColumn Width="81" Decimals="3" Subcolumns="1">
<Title>Log[Concentration] (M)</Title>
<Subcolumn>
`;
  data.forEach(row => {
    // Convert concentration from nM to M and take log10
    const concentrationM = row.concentration * 1e-9; // nM to M
    const logConcentration = Math.log10(concentrationM);
    xml += `<d>${logConcentration.toFixed(3)}</d>\n`;
  });
  xml += `</Subcolumn>
</XColumn>
`;

  // Y Columns (responses)
  sampleNames.forEach((sampleName, sampleIdx) => {
    xml += `<YColumn Width="81" Decimals="3" Subcolumns="1">
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
export async function exportToSimplePrism(options: SimplePrismExportOptions): Promise<void> {
  try {
    console.log('Starting PZFX export with options:', options);
    const xml = generateSimplePrismXML(options);
    console.log('Generated XML length:', xml.length);
    console.log('XML preview:', xml.substring(0, 500));
    
    // Create blob and download
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    
    // Generate filename
    const datasetNames = options.datasets.map(ds => ds.name).join('_').replace(/[^a-zA-Z0-9_-]/g, '');
    const timestamp = new Date().toISOString().split('T')[0];
    
    link.download = `dose-response-simple-${datasetNames}-${timestamp}.pzfx`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    console.log('Simple Prism export completed successfully');
  } catch (error) {
    console.error('Simple Prism export failed:', error);
    throw new Error('Failed to export to Prism format');
  }
}