import { DataPoint, Dataset } from '../types';

export interface ActualTemplateOptions {
  datasets: Dataset[];
  editedDataByDataset: Record<string, DataPoint[]>;
}

/**
 * Load the actual Prism template and replace data while preserving all analysis
 * Uses the Test_template.pzfx file with real analysis configuration
 */
export async function exportWithActualTemplate(options: ActualTemplateOptions): Promise<void> {
  try {
    console.log('Loading actual Prism template...');
    
    // Load the template file from public folder
    const response = await fetch('/templates/Test_template.pzfx');
    if (!response.ok) {
      throw new Error('Failed to load Prism template');
    }
    
    const templateContent = await response.text();
    console.log('Template loaded successfully');
    
    // Replace data in template
    const modifiedTemplate = replaceDataInActualTemplate(options, templateContent);
    
    // Create blob and download
    const blob = new Blob([modifiedTemplate], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    
    const timestamp = new Date().toISOString().split('T')[0];
    const datasetName = options.datasets[0]?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'data';
    link.download = `${datasetName}_real_template_${timestamp}.pzfx`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    console.log('Real template export completed successfully');
    
    alert(`🚀 Real Prism Template Export Complete!

Your data has been inserted into your actual Prism template file!

This means:
✅ All your original analysis configurations are preserved
✅ Graph settings and formatting maintained  
✅ Statistical analysis setup intact
✅ Your data is now in the template structure

The file will work exactly like your original template, 
but with your new data from nVitro Studio!`);
    
  } catch (error) {
    console.error('Real template export failed:', error);
    alert(`Failed to load template: ${error}

Please ensure the template file is accessible or use the alternative export options.`);
    throw error;
  }
}

export function replaceDataInActualTemplate(
  options: ActualTemplateOptions,
  templateContent: string
): string {
  const { datasets, editedDataByDataset } = options;
  
  // Template has 3 tables: Table0, Table19, Table23
  const tableIds = ['Table0', 'Table19', 'Table23'];
  
  // Process up to 3 datasets
  const datasetsToProcess = datasets.slice(0, 3);
  
  let modifiedTemplate = templateContent;
  
  // Update experiment date
  const today = new Date().toISOString().split('T')[0];
  modifiedTemplate = modifiedTemplate.replace(
    /<Value>2022-05-20<\/Value>/g,
    `<Value>${today}</Value>`
  );
  
  // Process each dataset and replace data in corresponding table
  datasetsToProcess.forEach((dataset, datasetIndex) => {
    const data = editedDataByDataset[dataset.id];
    
    if (!data || data.length === 0) {
      console.log(`No data for dataset ${datasetIndex + 1}, skipping...`);
      return;
    }
    
    const tableId = tableIds[datasetIndex];
    console.log(`Processing dataset ${datasetIndex + 1} (${dataset.name}) into ${tableId}`);
    
    // Replace data for this specific table
    modifiedTemplate = replaceTableData(modifiedTemplate, tableId, dataset.name, data);
  });
  
  return modifiedTemplate;
}

function replaceTableData(
  template: string,
  tableId: string,
  datasetName: string,
  data: DataPoint[]
): string {
  console.log(`Replacing data in ${tableId} with ${data.length} data points`);
  
  // Find the specific table section
  const tableStartPattern = new RegExp(`<Table ID="${tableId}"[^>]*>`);
  const tableEndPattern = /<\/Table>/;
  
  const tableStart = template.search(tableStartPattern);
  if (tableStart === -1) {
    console.error(`Table ${tableId} not found in template`);
    return template;
  }
  
  // Find the end of this specific table
  const afterTableStart = template.substring(tableStart);
  const tableEndMatch = afterTableStart.search(tableEndPattern);
  if (tableEndMatch === -1) {
    console.error(`End of table ${tableId} not found`);
    return template;
  }
  
  const tableEnd = tableStart + tableEndMatch + '</Table>'.length;
  let tableContent = template.substring(tableStart, tableEnd);
  const originalTableContent = tableContent;
  
  // Update table title
  tableContent = tableContent.replace(
    /<Title>[^<]*<\/Title>/,
    `<Title>${escapeXML(datasetName)}</Title>`
  );
  
  // Replace concentration data in this table
  const concentrations = data.map(point => point.concentration);
  const concValues = concentrations.map(c => `<d>${c}</d>`).join('\n');
  
  // Replace RowTitlesColumn
  tableContent = tableContent.replace(
    /(<RowTitlesColumn[^>]*>\s*<Subcolumn>\s*)[\s\S]*?(<\/Subcolumn>\s*<\/RowTitlesColumn>)/,
    `$1\n${concValues}\n$2`
  );
  
  // Replace XColumn
  tableContent = tableContent.replace(
    /(<XColumn[^>]*>\s*<Title><\/Title>\s*<Subcolumn>\s*)[\s\S]*?(<\/Subcolumn>\s*<\/XColumn>)/,
    `$1\n${concValues}\n$2`
  );
  
  // Replace XAdvancedColumn if exists
  tableContent = tableContent.replace(
    /(<XAdvancedColumn[^>]*>\s*<Title><\/Title>\s*<Subcolumn>\s*)[\s\S]*?(<\/Subcolumn>\s*<\/XAdvancedColumn>)/,
    `$1\n${concValues}\n$2`
  );
  
  // Replace ALL Y columns in this table (up to 6 columns)
  const sampleNames = data[0]?.sampleNames || [];
  const yColumnRegex = /<YColumn[^>]*>[\s\S]*?<\/YColumn>/g;
  const yColumns = tableContent.match(yColumnRegex) || [];
  
  console.log(`Found ${yColumns.length} Y columns in ${tableId}, have ${sampleNames.length} samples to fill`);
  
  // Replace each Y column with corresponding sample data
  yColumns.forEach((yColumn, columnIndex) => {
    if (columnIndex < sampleNames.length) {
      // We have data for this column
      const sampleName = sampleNames[columnIndex];
      const responses = data.map(point => {
        const value = point.responses[columnIndex];
        if (value !== null && value !== undefined && !isNaN(value)) {
          return `<d>${value.toFixed(3)}</d>`;
        } else {
          return '<d/>';
        }
      }).join('\n');
      
      const updatedColumn = yColumn
        .replace(/<Title>[^<]*<\/Title>/, `<Title>${escapeXML(sampleName)}</Title>`)
        .replace(/(<Subcolumn>\s*)[\s\S]*?(\s*<\/Subcolumn>)/, `$1\n${responses}\n$2`);
      
      tableContent = tableContent.replace(yColumn, updatedColumn);
      console.log(`Replaced column ${columnIndex + 1} with data for ${sampleName}`);
    } else {
      // No data for this column, clear it
      const emptyData = data.map(() => '<d/>').join('\n');
      const clearedColumn = yColumn
        .replace(/<Title>[^<]*<\/Title>/, '<Title></Title>')
        .replace(/(<Subcolumn>\s*)[\s\S]*?(\s*<\/Subcolumn>)/, `$1\n${emptyData}\n$2`);
      
      tableContent = tableContent.replace(yColumn, clearedColumn);
      console.log(`Cleared column ${columnIndex + 1} (no data)`);
    }
  });
  
  // Replace the original table content with the modified content
  template = template.substring(0, tableStart) + tableContent + template.substring(tableEnd);
  
  return template;
}

// This function is no longer needed as we handle all columns in replaceTableData

function escapeXML(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Alternative function that accepts template content directly
export function exportWithTemplateContent(
  options: ActualTemplateOptions,
  templateContent: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const modifiedTemplate = replaceDataInActualTemplate(options, templateContent);
      
      // Create blob and download
      const blob = new Blob([modifiedTemplate], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      const datasetName = options.datasets[0]?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'data';
      link.download = `${datasetName}_from_your_template_${timestamp}.pzfx`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}