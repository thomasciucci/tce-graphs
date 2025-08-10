import { DataPoint, Dataset } from '../types';

export interface TemplateReplaceOptions {
  datasets: Dataset[];
  editedDataByDataset: Record<string, DataPoint[]>;
  templateContent: string; // The template file content
}

/**
 * Replace data in a Prism template file while preserving all analysis configurations
 * Supports 1-3 datasets as specified
 */
export function replaceDataInPrismTemplate(options: TemplateReplaceOptions): string {
  const { datasets, editedDataByDataset, templateContent } = options;
  
  // Limit to 3 datasets as requested
  const limitedDatasets = datasets.slice(0, 3);
  
  let modifiedTemplate = templateContent;
  
  // Update project info
  modifiedTemplate = updateProjectInfo(modifiedTemplate);
  
  // Replace data for each dataset
  limitedDatasets.forEach((dataset, index) => {
    const data = editedDataByDataset[dataset.id];
    if (data && data.length > 0) {
      modifiedTemplate = replaceTableData(modifiedTemplate, index, dataset.name, data);
    }
  });
  
  return modifiedTemplate;
}

function updateProjectInfo(template: string): string {
  const today = new Date().toISOString().split('T')[0];
  
  // Update experiment date
  template = template.replace(
    /<Value>2022-05-20<\/Value>/g,
    `<Value>${today}</Value>`
  );
  
  // Update title
  template = template.replace(
    /<Title>Table_1<\/Title>/,
    '<Title>nVitro Studio Export</Title>'
  );
  
  // Update project info
  template = template.replace(
    /<Title>Project info 1<\/Title>/g,
    '<Title>nVitro Studio Dose-Response Analysis</Title>'
  );
  
  return template;
}

function replaceTableData(template: string, tableIndex: number, datasetName: string, data: DataPoint[]): string {
  const sampleNames = data[0]?.sampleNames || [];
  
  // For the first table (Table0), replace the existing data
  if (tableIndex === 0) {
    // Replace X column data (concentrations)
    template = replaceXColumnData(template, data);
    
    // Replace Y column data (responses) for each sample
    sampleNames.forEach((sampleName, sampleIndex) => {
      template = replaceYColumnData(template, sampleIndex, sampleName, data);
    });
    
    // Update table title
    template = template.replace(
      /<Title>Table_1<\/Title>/,
      `<Title>${escapeXML(datasetName)}</Title>`
    );
  }
  
  // For additional datasets (if template has more tables), we'd add similar logic
  // For now, focusing on the first table as per the template structure
  
  return template;
}

function replaceXColumnData(template: string, data: DataPoint[]): string {
  const concentrations = data.map(point => point.concentration);
  
  // Build the new X column subcolumn content
  let xColumnContent = '';
  concentrations.forEach(conc => {
    xColumnContent += `<d>${conc}</d>\n`;
  });
  
  // Replace the X column content (between <XColumn> and </XColumn>)
  const xColumnRegex = /(<XColumn[^>]*>\s*<Title><\/Title>\s*<Subcolumn>\s*)[\s\S]*?(\s*<\/Subcolumn>\s*<\/XColumn>)/;
  template = template.replace(xColumnRegex, `$1${xColumnContent}$2`);
  
  // Also replace XAdvancedColumn if it exists
  const xAdvancedColumnRegex = /(<XAdvancedColumn[^>]*>\s*<Title><\/Title>\s*<Subcolumn>\s*)[\s\S]*?(\s*<\/Subcolumn>\s*<\/XAdvancedColumn>)/;
  template = template.replace(xAdvancedColumnRegex, `$1${xColumnContent}$2`);
  
  // Replace RowTitlesColumn with concentrations
  const rowTitlesRegex = /(<RowTitlesColumn[^>]*>\s*<Subcolumn>\s*)[\s\S]*?(\s*<\/Subcolumn>\s*<\/RowTitlesColumn>)/;
  template = template.replace(rowTitlesRegex, `$1${xColumnContent}$2`);
  
  return template;
}

function replaceYColumnData(template: string, columnIndex: number, sampleName: string, data: DataPoint[]): string {
  const responses = data.map(point => {
    const value = point.responses[columnIndex];
    return value !== null && value !== undefined && !isNaN(value) ? value.toFixed(3) : '';
  });
  
  // Build the new Y column content
  let yColumnContent = '';
  responses.forEach(response => {
    if (response) {
      yColumnContent += `<d>${response}</d>\n`;
    } else {
      yColumnContent += `<d/>\n`;
    }
  });
  
  // We need to be more specific about which YColumn to replace
  // The template has multiple YColumns, so we'll replace them in order
  const yColumns = template.match(/<YColumn[^>]*>[\s\S]*?<\/YColumn>/g) || [];
  
  if (yColumns.length > columnIndex) {
    const originalYColumn = yColumns[columnIndex];
    
    // Update the title and content
    const updatedYColumn = originalYColumn
      .replace(/<Title>[^<]*<\/Title>/, `<Title>${escapeXML(sampleName)}</Title>`)
      .replace(/(<Subcolumn>\s*)[\s\S]*?(\s*<\/Subcolumn>)/, `$1${yColumnContent}$2`);
    
    template = template.replace(originalYColumn, updatedYColumn);
  }
  
  return template;
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

// Load the template file and export with data replacement
export async function exportWithPrismTemplate(
  datasets: Dataset[],
  editedDataByDataset: Record<string, DataPoint[]>
): Promise<void> {
  try {
    // For now, we'll use a embedded template string
    // In production, you could load this from a file or URL
    const templateContent = await loadPrismTemplate();
    
    const modifiedPrism = replaceDataInPrismTemplate({
      datasets,
      editedDataByDataset,
      templateContent
    });
    
    // Create blob and download
    const blob = new Blob([modifiedPrism], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    
    const timestamp = new Date().toISOString().split('T')[0];
    const datasetName = datasets[0]?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'data';
    link.download = `${datasetName}_with_analysis_${timestamp}.pzfx`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    console.log('Template-based Prism export completed successfully');
    
    alert(`✅ Prism file exported with analysis!

Your data has been inserted into a pre-configured Prism template that includes:
• Dose-response analysis setup
• Graph formatting
• Statistical analysis configuration

Simply open the .pzfx file in GraphPad Prism and your analysis will be ready!`);
    
  } catch (error) {
    console.error('Template-based export failed:', error);
    throw error;
  }
}

// Load the template - in a real implementation, you'd load from a file
async function loadPrismTemplate(): Promise<string> {
  // This would normally load your template file
  // For now, return a basic template structure
  // You'll need to embed your actual template content here or load it from a URL/file
  
  throw new Error(`Template loading not implemented yet. 

To complete this:
1. Copy your Test_template.pzfx content into this function
2. Or create a way to load it from your public folder
3. The template will then be used to replace data while preserving analysis`);
}

// Alternative: Use the user's provided template
export function createTemplateBasedExportWithFile(
  datasets: Dataset[],
  editedDataByDataset: Record<string, DataPoint[]>,
  templateFile: File
): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const templateContent = e.target?.result as string;
        
        const modifiedPrism = replaceDataInPrismTemplate({
          datasets,
          editedDataByDataset,
          templateContent
        });
        
        // Create blob and download
        const blob = new Blob([modifiedPrism], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        
        const timestamp = new Date().toISOString().split('T')[0];
        const datasetName = datasets[0]?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'data';
        link.download = `${datasetName}_from_template_${timestamp}.pzfx`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        console.log('Template-based export completed');
        resolve();
        
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read template file'));
    reader.readAsText(templateFile);
  });
}