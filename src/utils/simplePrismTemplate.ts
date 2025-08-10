import { DataPoint, Dataset } from '../types';

// Create the simplest possible Prism file that will work
export function createSimplePrismFile(datasets: Dataset[], dataByDataset: Record<string, DataPoint[]>): string {
  
  // Start with minimal Prism XML structure
  let output = `<?xml version="1.0" encoding="UTF-8"?>
<GraphPadPrismFile PrismXMLVersion="1.00">
<TableSequence>
`;

  let tableCount = 0;
  
  // Process each dataset
  datasets.forEach(dataset => {
    const data = dataByDataset[dataset.id];
    if (!data || data.length === 0) return;
    
    const sampleNames = data[0].sampleNames || [];
    
    // Add table reference
    output += `<Ref ID="Table${tableCount}"/>
`;
    
    tableCount++;
  });
  
  output += `</TableSequence>
`;

  // Reset counter for actual tables
  tableCount = 0;
  
  // Add the actual data tables
  datasets.forEach(dataset => {
    const data = dataByDataset[dataset.id];
    if (!data || data.length === 0) return;
    
    const sampleNames = data[0].sampleNames || [];
    
    // Create XY table with proper format for dose-response
    output += `<Table ID="Table${tableCount}" XFormat="numbers" TableType="XY" Title="${dataset.name}">
`;
    
    // Add X column (concentrations)
    output += `<XColumn Width="75" Subcolumns="1" Title="Concentration">
<Subcolumn>
`;
    
    data.forEach(point => {
      output += `<d>${point.concentration}</d>
`;
    });
    
    output += `</Subcolumn>
</XColumn>
`;
    
    // Add Y columns (responses for each sample)
    sampleNames.forEach((sampleName, idx) => {
      output += `<YColumn Width="75" Subcolumns="1" Title="${sampleName}">
<Subcolumn>
`;
      
      data.forEach(point => {
        const value = point.responses[idx];
        if (value !== null && value !== undefined && !isNaN(value)) {
          output += `<d>${value}</d>
`;
        } else {
          output += `<d></d>
`;
        }
      });
      
      output += `</Subcolumn>
</YColumn>
`;
    });
    
    output += `</Table>
`;
    
    tableCount++;
  });
  
  output += `</GraphPadPrismFile>`;
  
  return output;
}

// Export function
export async function exportSimplePrism(
  datasets: Dataset[], 
  dataByDataset: Record<string, DataPoint[]>
): Promise<void> {
  try {
    const xml = createSimplePrismFile(datasets, dataByDataset);
    
    const blob = new Blob([xml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `dose-response-${new Date().toISOString().split('T')[0]}.pzfx`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    
    console.log('Simple Prism export completed');
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
}