/* eslint-disable @typescript-eslint/no-explicit-any */

import { DataPoint, FittedCurve, Dataset } from '../types';

interface PPTExportOptions {
  datasets: Dataset[];
  fittedCurvesByDataset: Record<string, FittedCurve[]>;
  originalDataByDataset: Record<string, DataPoint[]>;
  editedDataByDataset: Record<string, DataPoint[]>;
  curveColorsByDataset: Record<string, string[]>;
  curveVisibilityByDataset?: Record<string, boolean[]>;
  assayType?: string;
  globalChartSettings?: {
    showGroups: boolean;
    showIndividuals: boolean;
    showCurveChart: boolean;
    showBarChart: boolean;
  };
  onDatasetSwitch?: (datasetIndex: number) => Promise<void>;
  onCurveVisibilityChange?: (datasetId: string, curveIndex: number, visible: boolean) => Promise<void>;
}

// Declare global PptxGenJS for CDN usage
declare global {
  interface Window {
    PptxGenJS: any;
  }
}

export async function exportToPowerPoint(options: PPTExportOptions): Promise<void> {
  const {
    datasets,
    fittedCurvesByDataset,
    originalDataByDataset,
    editedDataByDataset,
    assayType,
    globalChartSettings,
    onDatasetSwitch
  } = options;

  try {
    // Load PptxGenJS from CDN if not already loaded
    if (!window.PptxGenJS) {
      console.log('Loading PptxGenJS from CDN...');
      await loadPptxGenJS();
    }

    const pres = new window.PptxGenJS();
    
    // Set presentation properties
    pres.defineLayout({ name: 'LAYOUT_16x9', width: 10, height: 5.625 });
    pres.layout = 'LAYOUT_16x9';
    
    // Add title slide
    addTitleSlide(pres, datasets, assayType);
    
    // Add summary slide
    addSummarySlide(pres, datasets);
    
    // Add slides for each dataset
    for (let i = 0; i < datasets.length; i++) {
      const dataset = datasets[i];
      const originalData = originalDataByDataset[dataset.id] || [];
      const editedData = editedDataByDataset[dataset.id] || [];
      const fittedCurves = fittedCurvesByDataset[dataset.id] || [];

      console.log(`Processing PowerPoint slides for dataset ${i + 1}/${datasets.length}: ${dataset.name}`);

      // Capture charts if callbacks provided
      let datasetChartImage = '';
      let barChartImage = '';
      
      if (onDatasetSwitch) {
        console.log(`Switching to dataset ${i}: ${dataset.name}`);
        await onDatasetSwitch(i);
        
        // Wait for UI to update
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Try to capture charts (import dynamically to avoid build issues)
        try {
          const { captureChartImage } = await import('./pdfExport');
          
          // Capture bar chart if enabled
          if (globalChartSettings?.showBarChart) {
            const barCapturedImage = await captureChartImage('bar');
            if (barCapturedImage) {
              barChartImage = barCapturedImage;
            }
          }
          
          // Capture curve chart
          const capturedImage = await captureChartImage();
          if (capturedImage) {
            datasetChartImage = capturedImage;
          }
        } catch (captureError) {
          console.warn('Chart capture failed:', captureError);
        }
      }

      // Add dataset overview slide
      addDatasetOverviewSlide(pres, dataset, originalData, editedData, fittedCurves, i + 1, datasetChartImage);
      
      // Add raw data slide
      addRawDataSlide(pres, dataset, originalData, i + 1);
      
      // Add edited data slide (if different from raw)
      const hasEdits = originalData.some((originalRow, rowIndex) => {
        const editedRow = editedData[rowIndex];
        if (!editedRow) return false;
        
        return originalRow.concentration !== editedRow.concentration ||
               originalRow.responses.some((val, respIndex) => 
                 Math.abs(val - editedRow.responses[respIndex]) > 1e-6
               );
      });
      
      if (hasEdits) {
        addEditedDataSlide(pres, dataset, originalData, editedData, i + 1);
      }
      
      // Add curve fitting results slide
      if (fittedCurves.length > 0) {
        addCurveFittingResultsSlide(pres, dataset, fittedCurves, i + 1);
      }
      
      // Add chart visualization slide
      if (datasetChartImage) {
        addChartVisualizationSlide(pres, dataset, datasetChartImage, i + 1);
      }
      
      // Add bar chart slide if available
      if (barChartImage) {
        addBarChartSlide(pres, dataset, barChartImage, i + 1);
      }
    }
    
    // Save the presentation
    const filename = `dose-response-analysis-${new Date().toISOString().split('T')[0]}.pptx`;
    await pres.writeFile(filename);
    
    console.log(`PowerPoint presentation saved as: ${filename}`);
  } catch (error) {
    console.error('PowerPoint export failed:', error);
    
    // Fallback message
    const datasetCount = datasets.length;
    const curveCount = Object.values(fittedCurvesByDataset).reduce((total, curves) => total + curves.length, 0);
    
    const message = `PowerPoint Export Notice

Unable to generate PowerPoint file due to browser limitations.

Your analysis includes:
• ${datasetCount} dataset${datasetCount !== 1 ? 's' : ''}
• ${curveCount} fitted curve${curveCount !== 1 ? 's' : ''}
• Assay type: ${assayType || 'Not specified'}

Please use the PDF export for comprehensive reports, or try the PowerPoint export in a different browser.`;
    
    alert(message);
  }
}

// Function to load PptxGenJS from CDN
function loadPptxGenJS(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PptxGenJS) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js';
    script.onload = () => {
      console.log('PptxGenJS loaded successfully');
      resolve();
    };
    script.onerror = () => {
      console.error('Failed to load PptxGenJS from CDN');
      reject(new Error('Failed to load PptxGenJS'));
    };
    document.head.appendChild(script);
  });
}

// Helper functions for slide creation
function addTitleSlide(pres: any, datasets: Dataset[], assayType?: string): void {
  const slide = pres.addSlide();
  
  slide.addText('Dose-Response Analysis Report', {
    x: 1, y: 1.5, w: 8, h: 1.2,
    fontSize: 44,
    bold: true,
    color: '8A0051',
    align: 'center'
  });
  
  slide.addText('nVitro Studio', {
    x: 1, y: 2.8, w: 8, h: 0.6,
    fontSize: 24,
    color: '666666',
    align: 'center'
  });
  
  const exportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  slide.addText([
    { text: `Generated: ${exportDate}\n`, options: { fontSize: 16, color: '333333' } },
    { text: `Datasets: ${datasets.length}\n`, options: { fontSize: 16, color: '333333' } },
    { text: `Assay Type: ${assayType || 'Not specified'}`, options: { fontSize: 16, color: '333333' } }
  ], {
    x: 1, y: 4, w: 8, h: 1,
    align: 'center'
  });
}


function addSummarySlide(pres: any, datasets: Dataset[]): void {
  const slide = pres.addSlide();
  
  slide.addText('Analysis Summary', {
    x: 0.5, y: 0.3, w: 9, h: 0.6,
    fontSize: 28,
    bold: true,
    color: '8A0051'
  });
  
  const tableData = [
    ['Dataset', 'Name', 'Assay Type', 'Data Points', 'Samples']
  ];
  
  datasets.forEach((ds, index) => {
    tableData.push([
      `${index + 1}`,
      ds.name,
      ds.assayType || 'Not specified',
      ds.data.length.toString(),
      (ds.data[0]?.sampleNames?.length || 0).toString()
    ]);
  });
  
  slide.addTable(tableData, {
    x: 0.5, y: 1.2, w: 9, h: 3.5,
    fontSize: 12,
    border: { pt: 1, color: 'DDDDDD' },
    fill: { color: 'F8F9FA' },
    color: '333333'
  });
}


function addDatasetOverviewSlide(
  pres: any, 
  dataset: Dataset, 
  originalData: DataPoint[], 
  editedData: DataPoint[], 
  fittedCurves: FittedCurve[], 
  datasetNumber: number,
  chartImage?: string
): void {
  const slide = pres.addSlide();
  
  slide.addText(`Dataset ${datasetNumber}: ${dataset.name}`, {
    x: 0.5, y: 0.3, w: 9, h: 0.6,
    fontSize: 24,
    bold: true,
    color: '8A0051'
  });
  
  slide.addText([
    { text: 'Dataset Overview\n', options: { fontSize: 16, bold: true, color: '8A0051' } },
    { text: `Assay Type: ${dataset.assayType || 'Not specified'}\n`, options: { fontSize: 12, color: '333333' } },
    { text: `Data Points: ${originalData.length}\n`, options: { fontSize: 12, color: '333333' } },
    { text: `Samples: ${originalData[0]?.sampleNames?.length || 0}\n`, options: { fontSize: 12, color: '333333' } },
    { text: `Fitted Curves: ${fittedCurves.length}`, options: { fontSize: 12, color: '333333' } }
  ], {
    x: 0.5, y: 1.2, w: 4.5, h: 2
  });
  
  if (chartImage) {
    const base64Data = chartImage.replace(/^data:image\/[a-z]+;base64,/, '');
    slide.addImage({
      data: base64Data,
      x: 5.2, y: 1.2, w: 4.3, h: 3.2
    });
  }
}


function addRawDataSlide(pres: any, dataset: Dataset, originalData: DataPoint[], datasetNumber: number): void {
  const slide = pres.addSlide();
  
  slide.addText(`Dataset ${datasetNumber}: Raw Data`, {
    x: 0.5, y: 0.3, w: 9, h: 0.6,
    fontSize: 24,
    bold: true,
    color: '8A0051'
  });
  
  if (originalData.length > 0) {
    const headers = ['Concentration [nM]', ...(originalData[0]?.sampleNames || [])];
    const tableData = [headers];
    
    originalData.forEach(row => {
      tableData.push([
        row.concentration.toString(),
        ...row.responses.map(val => val.toString())
      ]);
    });
    
    slide.addTable(tableData, {
      x: 0.5, y: 1.2, w: 9, h: 3.8,
      fontSize: 10,
      border: { pt: 1, color: 'DDDDDD' },
      fill: { color: 'F8F9FA' },
      color: '333333'
    });
  }
}


function addEditedDataSlide(
  pres: any, 
  dataset: Dataset, 
  originalData: DataPoint[], 
  editedData: DataPoint[], 
  datasetNumber: number
): void {
  const slide = pres.addSlide();
  
  slide.addText(`Dataset ${datasetNumber}: Edited Data`, {
    x: 0.5, y: 0.3, w: 9, h: 0.6,
    fontSize: 24,
    bold: true,
    color: '8A0051'
  });
  
  slide.addText('(Changes from original data)', {
    x: 0.5, y: 0.9, w: 9, h: 0.3,
    fontSize: 12,
    color: '666666'
  });
  
  if (editedData.length > 0) {
    const headers = ['Concentration [nM]', ...(editedData[0]?.sampleNames || [])];
    const tableData = [headers];
    
    editedData.forEach(row => {
      tableData.push([
        row.concentration.toString(),
        ...row.responses.map(val => val.toString())
      ]);
    });
    
    slide.addTable(tableData, {
      x: 0.5, y: 1.4, w: 9, h: 3.6,
      fontSize: 10,
      border: { pt: 1, color: 'DDDDDD' },
      fill: { color: 'F8F9FA' },
      color: '333333'
    });
  }
}


function addCurveFittingResultsSlide(pres: any, dataset: Dataset, fittedCurves: FittedCurve[], datasetNumber: number): void {
  const slide = pres.addSlide();
  
  slide.addText(`Dataset ${datasetNumber}: Curve Fitting Results`, {
    x: 0.5, y: 0.3, w: 9, h: 0.6,
    fontSize: 24,
    bold: true,
    color: '8A0051'
  });
  
  const tableData = [
    ['Sample', 'EC10 [nM]', 'EC50 [nM]', 'EC90 [nM]', 'Top (%)', 'Bottom (%)', 'R²']
  ];
  
  fittedCurves.forEach(curve => {
    tableData.push([
      curve.sampleName,
      curve.ec10 ? curve.ec10.toExponential(2) : 'N/A',
      curve.ec50.toExponential(2),
      curve.ec90 ? curve.ec90.toExponential(2) : 'N/A',
      curve.top.toFixed(1),
      curve.bottom.toFixed(1),
      curve.rSquared.toFixed(3)
    ]);
  });
  
  slide.addTable(tableData, {
    x: 0.5, y: 1.2, w: 9, h: 3.8,
    fontSize: 10,
    border: { pt: 1, color: 'DDDDDD' },
    fill: { color: 'F8F9FA' },
    color: '333333'
  });
}


function addChartVisualizationSlide(pres: any, dataset: Dataset, chartImage: string, datasetNumber: number): void {
  const slide = pres.addSlide();
  
  slide.addText(`Dataset ${datasetNumber}: Dose-Response Curves`, {
    x: 0.5, y: 0.3, w: 9, h: 0.6,
    fontSize: 24,
    bold: true,
    color: '8A0051'
  });
  
  const base64Data = chartImage.replace(/^data:image\/[a-z]+;base64,/, '');
  slide.addImage({
    data: base64Data,
    x: 2.5, y: 1.2, w: 5, h: 3.5
  });
}


function addBarChartSlide(pres: any, dataset: Dataset, barChartImage: string, datasetNumber: number): void {
  const slide = pres.addSlide();
  
  slide.addText(`Dataset ${datasetNumber}: Bar Chart View`, {
    x: 0.5, y: 0.3, w: 9, h: 0.6,
    fontSize: 24,
    bold: true,
    color: '8A0051'
  });
  
  slide.addText('Response Data by Sample', {
    x: 0.5, y: 0.9, w: 9, h: 0.3,
    fontSize: 14,
    color: '666666'
  });
  
  const base64Data = barChartImage.replace(/^data:image\/[a-z]+;base64,/, '');
  slide.addImage({
    data: base64Data,
    x: 1.5, y: 1.4, w: 7, h: 3.8
  });
}