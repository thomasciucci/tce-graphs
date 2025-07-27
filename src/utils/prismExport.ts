import { DataPoint, FittedCurve, Dataset } from '../types';

export interface PrismExportOptions {
  datasets: Dataset[];
  fittedCurvesByDataset: Record<string, FittedCurve[]>;
  originalDataByDataset: Record<string, DataPoint[]>;
  editedDataByDataset: Record<string, DataPoint[]>;
  curveColorsByDataset: Record<string, string[]>;
  exportType: 'raw_and_edited' | 'with_replicates_mean' | 'with_replicates_individual' | 'both_replicates';
  assayType?: string;
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

// Generate XML for Prism .pzfx format
function generatePrismXML(options: PrismExportOptions): string {
  const { datasets, originalDataByDataset, editedDataByDataset, exportType } = options;
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<GraphPadPrismFile xmlns="http://graphpad.com/prism/Prism.htm" PrismXMLVersion="5.00">
<Created>
<OriginalVersion CreatedByProgram="GraphPad Prism" CreatedByVersion="5.00"/>
</Created>
<InfoSequence>
<Ref ID="Info0" Selected="1"/>
</InfoSequence>
<Info ID="Info0">
<Title>Dose Response Analysis Export</Title>
<Notes>Exported from nVitro Studio
Export Type: ${exportType}
Date: ${new Date().toISOString()}
</Notes>
</Info>
<TableSequence>
`;

  let tableId = 0;

  datasets.forEach((dataset) => {
    const originalData = originalDataByDataset[dataset.id] || [];
    const editedData = editedDataByDataset[dataset.id] || [];
    const hasReplicates = originalData.length > 0 && originalData[0].replicateGroups && 
      new Set(originalData[0].replicateGroups).size < originalData[0].replicateGroups.length;

    if (exportType === 'raw_and_edited' || !hasReplicates) {
      // Export raw and edited data as separate XY tables
      if (originalData.length > 0) {
        xml += generateXYTable(`Table${tableId++}`, `${dataset.name} - Raw Data`, originalData);
      }
      if (editedData.length > 0) {
        xml += generateXYTable(`Table${tableId++}`, `${dataset.name} - Edited Data`, editedData);
      }
    } 
    else if (exportType === 'with_replicates_mean') {
      // Export mean data with error bars
      const { means, sems } = calculateReplicateStats(editedData);
      if (means.length > 0) {
        xml += generateXYTableWithSEM(`Table${tableId++}`, `${dataset.name} - Mean Data`, means, sems);
      }
    }
    else if (exportType === 'with_replicates_individual') {
      // Export individual replicates
      if (editedData.length > 0) {
        xml += generateXYTable(`Table${tableId++}`, `${dataset.name} - Individual Replicates`, editedData);
      }
    }
    else if (exportType === 'both_replicates') {
      // Export both mean and individual data
      const { means, sems } = calculateReplicateStats(editedData);
      if (means.length > 0) {
        xml += generateXYTableWithSEM(`Table${tableId++}`, `${dataset.name} - Mean Data`, means, sems);
      }
      if (editedData.length > 0) {
        xml += generateXYTable(`Table${tableId++}`, `${dataset.name} - Individual Replicates`, editedData);
      }
    }
  });

  xml += `</TableSequence>
</GraphPadPrismFile>`;

  return xml;
}

// Generate XY data table without error bars
function generateXYTable(tableId: string, title: string, data: DataPoint[]): string {
  if (!data.length) return '';

  const sampleNames = data[0].sampleNames || [];
  const concentrations = data.map(d => d.concentration);
  
  let xml = `<Table ID="${tableId}" XFormat="log10" YFormat="replicates" Replicates="1" TableType="XY" EVFormat="AsteriskAfterNumber">
<Title>${escapeXML(title)}</Title>
<ColumnTitlesRow>
<d>X</d>
`;

  sampleNames.forEach(name => {
    xml += `<d>${escapeXML(name)}</d>\n`;
  });

  xml += `</ColumnTitlesRow>
`;

  // Create X column (concentrations)
  xml += `<XColumn Width="81" Decimals="6" Subcolumns="1">
<Title>X</Title>
<Subcolumn>
`;
  concentrations.forEach(conc => {
    xml += `<d>${conc}</d>\n`;
  });
  xml += `</Subcolumn>
</XColumn>
`;

  // Create Y columns (responses)
  sampleNames.forEach((sampleName, sampleIdx) => {
    xml += `<YColumn Width="81" Decimals="3" Subcolumns="1">
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

// Generate XY data table with SEM error bars
function generateXYTableWithSEM(tableId: string, title: string, means: DataPoint[], sems: number[][]): string {
  if (!means.length) return '';

  const groupNames = means[0].sampleNames || [];
  const concentrations = means.map(d => d.concentration);
  
  let xml = `<Table ID="${tableId}" XFormat="log10" YFormat="replicates" Replicates="1" TableType="XY" EVFormat="SEM">
<Title>${escapeXML(title)}</Title>
<ColumnTitlesRow>
<d>X</d>
`;

  groupNames.forEach(name => {
    xml += `<d>${escapeXML(name)}</d>\n`;
  });

  xml += `</ColumnTitlesRow>
`;

  // Create X column (concentrations)
  xml += `<XColumn Width="81" Decimals="6" Subcolumns="1">
<Title>X</Title>
<Subcolumn>
`;
  concentrations.forEach(conc => {
    xml += `<d>${conc}</d>\n`;
  });
  xml += `</Subcolumn>
</XColumn>
`;

  // Create Y columns with SEM (responses with error bars)
  groupNames.forEach((groupName, groupIdx) => {
    xml += `<YColumn Width="81" Decimals="3" Subcolumns="2">
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
      xml += `<d>${sem.toFixed(3)}</d>\n`;
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
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Main export function
export async function exportToPrism(options: PrismExportOptions): Promise<void> {
  try {
    const xml = generatePrismXML(options);
    
    // Create blob and download
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    
    // Generate filename based on export type and dataset names
    const datasetNames = options.datasets.map(ds => ds.name).join('_').replace(/[^a-zA-Z0-9_-]/g, '');
    const exportTypeLabel = options.exportType.replace(/_/g, '-');
    const timestamp = new Date().toISOString().split('T')[0];
    
    link.download = `dose-response-${exportTypeLabel}-${datasetNames}-${timestamp}.pzfx`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    console.log('Prism export completed successfully');
  } catch (error) {
    console.error('Prism export failed:', error);
    throw new Error('Failed to export to Prism format');
  }
}

// Helper function to determine appropriate export options based on data
export function getPrismExportOptions(data: DataPoint[]): string[] {
  if (!data.length) return [];
  
  const hasReplicates = data[0].replicateGroups && 
    new Set(data[0].replicateGroups).size < data[0].replicateGroups.length;
  
  if (!hasReplicates) {
    return ['raw_and_edited'];
  }
  
  return ['with_replicates_mean', 'with_replicates_individual', 'both_replicates'];
}