import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { DataPoint, FittedCurve, Dataset } from '../types';

// Add domtoimage as a fallback option
// npm install dom-to-image-more
// import domtoimage from 'dom-to-image-more';

interface PDFExportOptions {
  datasets: Dataset[];
  fittedCurvesByDataset: Record<string, FittedCurve[]>;
  originalDataByDataset: Record<string, DataPoint[]>;
  editedDataByDataset: Record<string, DataPoint[]>;
  curveColorsByDataset: Record<string, string[]>;
  curveVisibilityByDataset?: Record<string, boolean[]>;
  assayType?: string;
  chartImage?: string;
}

// Add interface for dataset switching callback
interface PDFExportOptionsWithCallback extends PDFExportOptions {
  onDatasetSwitch?: (datasetIndex: number) => Promise<void>;
  onCurveVisibilityChange?: (datasetId: string, curveIndex: number, visible: boolean) => Promise<void>;
}

export async function exportToPDF(options: PDFExportOptionsWithCallback): Promise<void> {
  try {
    const {
      datasets,
      fittedCurvesByDataset,
      originalDataByDataset,
      editedDataByDataset,
      curveColorsByDataset,
      curveVisibilityByDataset,
      assayType,
      onDatasetSwitch,
      onCurveVisibilityChange
    } = options;

    const pdf = new jsPDF();
    let currentPage = 1;

  // Page 1: Summary and Assay Parameters
  addSummaryPage(pdf, datasets, assayType);
  currentPage++;

  // For each dataset, add one page with raw data, edited data, and results
  for (let i = 0; i < datasets.length; i++) {
    const dataset = datasets[i];
    const originalData = originalDataByDataset[dataset.id] || [];
    const editedData = editedDataByDataset[dataset.id] || [];
    const fittedCurves = fittedCurvesByDataset[dataset.id] || [];
    const curveColors = curveColorsByDataset[dataset.id] || [];

    console.log(`Processing dataset ${i + 1}/${datasets.length}: ${dataset.name}`);

    // Switch to this dataset if callback provided
    let datasetChartImage = '';
    let selectedCurvesChartImage = '';
    let barChartImage = '';
    if (onDatasetSwitch) {
      console.log(`Switching to dataset ${i}: ${dataset.name}`);
      await onDatasetSwitch(i);
      
      // Wait for UI to update
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // First, ensure all curves are visible for the "All Curves" capture
      const curveVisibility = curveVisibilityByDataset?.[dataset.id];
      const hasHiddenCurves = curveVisibility && curveVisibility.some(visible => !visible);
      
      if (hasHiddenCurves && onCurveVisibilityChange) {
        console.log(`Preparing to capture both chart states for dataset: ${dataset.name}`);
        
        // Temporarily show all curves for "All Curves" capture
        const curves = fittedCurvesByDataset[dataset.id] || [];
        for (let i = 0; i < curves.length; i++) {
          await onCurveVisibilityChange(dataset.id, i, true);
        }
        
        // Wait for UI to update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Capture chart with all curves visible
        console.log(`Capturing "All Curves" chart for dataset: ${dataset.name}`);
        const allCurvesImage = await captureChartImage();
        if (allCurvesImage) {
          datasetChartImage = allCurvesImage;
          console.log(`"All Curves" chart captured for ${dataset.name}`);
        } else {
          console.log(`Failed to capture "All Curves" chart for ${dataset.name}`);
        }
        
        // Now hide curves that should be hidden for "Selected Curves" capture
        for (let i = 0; i < curves.length; i++) {
          await onCurveVisibilityChange(dataset.id, i, curveVisibility[i]);
        }
        
        // Wait for UI to update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Capture the filtered chart
        console.log(`Capturing "Selected Curves" chart for dataset: ${dataset.name}`);
        const filteredImage = await captureChartImage();
        if (filteredImage) {
          selectedCurvesChartImage = filteredImage;
          console.log(`"Selected Curves" chart captured for ${dataset.name}`);
        } else {
          selectedCurvesChartImage = '';
        }
      } else {
        // No hidden curves, just capture the current state
        console.log(`Capturing chart for dataset: ${dataset.name}`);
        const capturedImage = await captureChartImage();
        if (capturedImage) {
          datasetChartImage = capturedImage;
          console.log(`Chart captured for ${dataset.name}, length: ${capturedImage.length}`);
        } else {
          console.log(`Failed to capture chart for ${dataset.name}`);
        }
        selectedCurvesChartImage = capturedImage || '';
      }
      
      // Capture bar chart if available and visible
      console.log('Attempting to capture bar chart...');
      const barChartContainer = document.querySelector('[data-testid="bar-chart-container"]');
      if (barChartContainer) {
        // Check if bar chart is actually visible (not hidden)
        const containerRect = barChartContainer.getBoundingClientRect();
        const isVisible = containerRect.width > 0 && containerRect.height > 0 && 
                         window.getComputedStyle(barChartContainer).display !== 'none' &&
                         window.getComputedStyle(barChartContainer).visibility !== 'hidden';
        
        if (isVisible) {
          console.log('Bar chart container found and visible, capturing...');
          const barCapturedImage = await captureChartImage('bar');
          if (barCapturedImage) {
            barChartImage = barCapturedImage;
            console.log('Bar chart captured successfully');
          } else {
            console.log('Bar chart capture failed');
          }
        } else {
          console.log('Bar chart container found but not visible, skipping capture');
        }
      } else {
        console.log('No bar chart container found');
      }
    }

    // Single page with all data for this dataset
    await addDatasetPage(pdf, dataset, originalData, editedData, fittedCurves, curveColors, currentPage, datasetChartImage, selectedCurvesChartImage, curveVisibilityByDataset, barChartImage);
    currentPage++;
  }

    // Save the PDF
    pdf.save(`dose-response-analysis-${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('PDF export failed:', error);
    throw error;
  }
}

function addSummaryPage(pdf: jsPDF, datasets: Dataset[], assayType?: string): void {
  pdf.setFontSize(20);
  pdf.setTextColor(138, 0, 81); // #8A0051
  pdf.text('Dose-Response Analysis Report', 20, 30);

  pdf.setFontSize(12);
  pdf.setTextColor(0, 0, 0);
  
  const exportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const summaryData = [
    ['Export Date:', exportDate],
    ['Number of Datasets:', datasets.length.toString()],
    ['Assay Type:', assayType || 'Not specified'],
    ['Total Curves Fitted:', datasets.reduce((total, ds) => {
      return total + (ds.data[0]?.sampleNames?.length || 0);
    }, 0).toString()]
  ];

  autoTable(pdf, {
    startY: 50,
    head: [['Parameter', 'Value']],
    body: summaryData,
    theme: 'grid',
    headStyles: {
      fillColor: [138, 0, 81],
      textColor: 255,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 10
    }
  });

  // Add dataset summary table
  const datasetSummary = datasets.map((ds, index) => [
    `Dataset ${index + 1}`,
    ds.name,
    ds.assayType || 'Not specified',
    ds.data.length.toString(),
    ds.data[0]?.sampleNames?.length || '0'
  ]);

  autoTable(pdf, {
    startY: 120,
    head: [['#', 'Dataset Name', 'Assay Type', 'Data Points', 'Samples']],
    body: datasetSummary,
    theme: 'grid',
    headStyles: {
      fillColor: [138, 0, 81],
      textColor: 255,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 9
    }
  });
}

async function addDatasetPage(
  pdf: jsPDF, 
  dataset: Dataset, 
  originalData: DataPoint[], 
  editedData: DataPoint[], 
  fittedCurves: FittedCurve[], 
  curveColors: string[], 
  pageNumber: number, 
  chartImage?: string,
  selectedCurvesChartImage?: string,
  curveVisibilityByDataset?: Record<string, boolean[]>,
  barChartImage?: string
): Promise<void> {
  pdf.addPage();
  
  // Debug info for dataset processing (can be removed in production)
  // console.log(`=== ADDING DATASET PAGE FOR: ${dataset.name} (ID: ${dataset.id}) ===`);
  
  // Set margins
  const margin = 15;
  const pageWidth = pdf.internal.pageSize.width;
  const contentWidth = pageWidth - (2 * margin);
  
  // Header
  pdf.setFontSize(14);
  pdf.setTextColor(138, 0, 81);
  pdf.text(`${dataset.name}`, margin, 20);

  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);
  pdf.text(`Assay Type: ${dataset.assayType || 'Not specified'}`, margin, 30);

  let currentY = 35;

  // Section 1: Raw Data (very compact)
  pdf.setFontSize(10);
  pdf.setTextColor(138, 0, 81);
  pdf.text('Raw Data', margin, currentY);
  currentY += 8;

  if (originalData.length > 0) {
    const headers = ['Conc [nM]', ...(originalData[0]?.sampleNames || [])];
    const tableData = originalData.map(row => [
      row.concentration.toString(),
      ...row.responses.map(val => val.toString())
    ]);

    autoTable(pdf, {
      startY: currentY,
      head: [headers],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [138, 0, 81],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 5
      },
      styles: {
        fontSize: 4,
        cellPadding: 1
      },
      columnStyles: {
        0: { cellWidth: 20 }
      },
      margin: { top: 0, right: margin, bottom: 0, left: margin },
      tableWidth: contentWidth
    });

    currentY = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Section 2: Edited Data (very compact)
  pdf.setFontSize(10);
  pdf.setTextColor(138, 0, 81);
  pdf.text('Edited Data (changes highlighted in red)', margin, currentY);
  currentY += 8;

  if (editedData.length > 0) {
    const headers = ['Conc [nM]', ...(editedData[0]?.sampleNames || [])];
    const tableData = editedData.map((row) => {
      const rowData = [row.concentration.toString()];
      
      row.responses.forEach((val) => {
        rowData.push(val.toString());
      });
      
      return rowData;
    });

    autoTable(pdf, {
      startY: currentY,
      head: [headers],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [138, 0, 81],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 5
      },
      styles: {
        fontSize: 4,
        cellPadding: 1
      },
      columnStyles: {
        0: { cellWidth: 20 }
      },
      margin: { top: 0, right: margin, bottom: 0, left: margin },
      tableWidth: contentWidth,
      didParseCell: function(data) {
        // Highlight changed values in red
        if (data.row.index >= 0 && data.column.index >= 0) {
          const rowIndex = data.row.index;
          const colIndex = data.column.index;
          
          // Skip header row
          if (rowIndex === 0) return;
          
          const dataRowIndex = rowIndex - 1; // Adjust for header
          
          // Debug data structure (can be removed in production)
          // if (dataRowIndex === 0 && colIndex <= 2) {
          //   console.log(`📊 PDF Debug - Dataset: ${dataset.name}, Row ${dataRowIndex}, Col ${colIndex}:`);
          // }
          
          // Get original and edited values
          const originalRow = originalData[dataRowIndex];
          const editedRow = editedData[dataRowIndex];
          
          if (originalRow && editedRow) {
            let originalVal: number | undefined;
            let currentVal: number | undefined;
            
            if (colIndex === 0) {
              // Concentration column
              originalVal = originalRow.concentration;
              currentVal = editedRow.concentration;
            } else {
              // Response columns (colIndex - 1 because concentration is first column)
              const responseIndex = colIndex - 1;
              if (responseIndex < originalRow.responses.length && responseIndex < editedRow.responses.length) {
                originalVal = originalRow.responses[responseIndex];
                currentVal = editedRow.responses[responseIndex];
              }
            }
            
            // Compare values and highlight if different
            if (originalVal !== undefined && currentVal !== undefined && 
                Math.abs(currentVal - originalVal) > 1e-6) {
              // Useful for debugging red highlighting issues
              console.log(`🔴 [${dataset.name}] Highlighting row ${dataRowIndex}, col ${colIndex}: ${originalVal} → ${currentVal}`);
              data.cell.styles.textColor = [255, 0, 0]; // Red text
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [255, 230, 230]; // Light red background
            }
          }
        }
      }
    });

    currentY = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Section 3: Summary Statistics (compact)
  if (fittedCurves.length > 0) {
    pdf.setFontSize(10);
    pdf.setTextColor(138, 0, 81);
    pdf.text('Summary Statistics', margin, currentY);
    currentY += 8;

    const summaryData = fittedCurves.map((curve) => [
      curve.sampleName,
      curve.ec10 ? curve.ec10.toExponential(2) : 'N/A',
      curve.ec50.toExponential(2),
      curve.ec90 ? curve.ec90.toExponential(2) : 'N/A',
      curve.top.toFixed(1),
      curve.bottom.toFixed(1),
      curve.rSquared.toFixed(3)
    ]);

    autoTable(pdf, {
      startY: currentY,
      head: [['Sample', 'EC10 [nM]', 'EC50 [nM]', 'EC90 [nM]', 'Top (%)', 'Bottom (%)', 'R²']],
      body: summaryData,
      theme: 'grid',
      headStyles: {
        fillColor: [138, 0, 81],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 6
      },
      styles: {
        fontSize: 5,
        cellPadding: 2
      },
      margin: { top: 0, right: margin, bottom: 0, left: margin },
      tableWidth: contentWidth
    });

    currentY = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Section 4: Fitted Values Table removed as requested

  // Section 5: Chart images (if available)
  if (chartImage && chartImage.trim() !== '') {
    try {
      console.log('Attempting to add chart images to PDF, currentY:', currentY);
      
      // Check if there's enough space on the page
      if (currentY + 200 < 250) {
        // Add to current page
        const imgWidth = Math.min(180, contentWidth);
        const imgHeight = (imgWidth * 0.6); // Better aspect ratio for charts
        
        // Add title for chart
        pdf.setFontSize(12);
        pdf.setTextColor(138, 0, 81);
        pdf.text('All Curves', margin, currentY);
        currentY += 8;
        
        pdf.addImage(chartImage, 'PNG', margin, currentY, imgWidth, imgHeight);
        
                   // Add Y-axis title directly as text overlay
           const yAxisLabel = getYAxisLabel(dataset);
           if (yAxisLabel) {
             pdf.setFontSize(10);
             pdf.setFont('helvetica', 'bold');
             pdf.setTextColor(0, 0, 0);
          
          // Position Y-axis title closer to the chart
          const yAxisTitleX = margin + 8;
          const yAxisTitleY = currentY + (imgHeight / 2);
          
          // Rotate text -90 degrees and position it
          pdf.text(yAxisLabel, yAxisTitleX, yAxisTitleY, { angle: 90 });
        }
        
        currentY += imgHeight + 10;
        console.log('Chart image added to current page at Y:', currentY);
        
        // Add selected curves chart if there are hidden curves
        const curveVisibility = curveVisibilityByDataset?.[dataset.id];
        const hasHiddenCurves = curveVisibility && curveVisibility.some(visible => !visible);
        
        if (selectedCurvesChartImage && selectedCurvesChartImage.trim() !== '' && hasHiddenCurves) {
          pdf.setFontSize(12);
          pdf.setTextColor(138, 0, 81);
          pdf.text('Selected Curves Only', margin, currentY);
          currentY += 8;
          
          pdf.addImage(selectedCurvesChartImage, 'PNG', margin, currentY, imgWidth, imgHeight);
          console.log('Selected curves chart added to current page');
        }
      } else {
        // Add to next page with proper formatting
        pdf.addPage();
        
        // Add title to the new page
        pdf.setFontSize(16);
        pdf.setTextColor(138, 0, 81);
        pdf.text('Chart Visualization', margin, 25);
        
        // Add subtitle
        pdf.setFontSize(12);
        pdf.setTextColor(100, 100, 100);
        pdf.text('Concentration-Response Curves', margin, 35);
        
        // Add all curves chart image
        const imgWidth = Math.min(180, contentWidth);
        const imgHeight = (imgWidth * 0.6); // Better aspect ratio for charts
        
        pdf.setFontSize(12);
        pdf.setTextColor(138, 0, 81);
        pdf.text('All Curves', margin, 45);
        
        pdf.addImage(chartImage, 'PNG', margin, 55, imgWidth, imgHeight);
        
                 // Add Y-axis title directly as text overlay for new page
         const yAxisLabel = getYAxisLabel(dataset);
         if (yAxisLabel) {
           pdf.setFontSize(10);
           pdf.setFont('helvetica', 'bold');
           pdf.setTextColor(0, 0, 0);
          
          // Position Y-axis title closer to the chart
          const yAxisTitleX = margin + 8;
          const yAxisTitleY = 55 + (imgHeight / 2);
          
          // Rotate text -90 degrees and position it
          pdf.text(yAxisLabel, yAxisTitleX, yAxisTitleY, { angle: 90 });
        }
        
        console.log('Chart image added to new page in PDF');
        
        // Add selected curves chart if there are hidden curves
        const curveVisibility = curveVisibilityByDataset?.[dataset.id];
        const hasHiddenCurves = curveVisibility && curveVisibility.some(visible => !visible);
        
        if (selectedCurvesChartImage && selectedCurvesChartImage.trim() !== '' && hasHiddenCurves) {
          pdf.setFontSize(12);
          pdf.setTextColor(138, 0, 81);
          pdf.text('Selected Curves Only', margin, 55 + imgHeight + 10);
          
          pdf.addImage(selectedCurvesChartImage, 'PNG', margin, 65 + imgHeight + 10, imgWidth, imgHeight);
          console.log('Selected curves chart added to new page in PDF');
        }
      }
    } catch (error) {
      console.error('Failed to add chart image to PDF:', error);
    }
  } else {
    console.log('No chart image available for PDF');
  }

  // Add bar chart if available
  if (barChartImage && barChartImage.trim() !== '') {
    try {
      console.log('Adding bar chart to PDF...');
      
      // Add to new page for bar chart
      pdf.addPage();
      
      // Add title to the new page
      pdf.setFontSize(16);
      pdf.setTextColor(138, 0, 81);
      pdf.text('Bar Chart Visualization', margin, 25);
      
      // Add subtitle
      pdf.setFontSize(12);
      pdf.setTextColor(100, 100, 100);
      pdf.text('Response Data by Sample', margin, 35);
      
      // Add bar chart image
      const imgWidth = Math.min(180, contentWidth);
      const imgHeight = (imgWidth * 0.6); // Better aspect ratio for charts
      
      pdf.setFontSize(12);
      pdf.setTextColor(138, 0, 81);
      pdf.text('Bar Chart View', margin, 45);
      
      pdf.addImage(barChartImage, 'PNG', margin, 55, imgWidth, imgHeight);
      
      // Add Y-axis title directly as text overlay for bar chart
      const yAxisLabel = getYAxisLabel(dataset);
      if (yAxisLabel) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
       
        // Position Y-axis title closer to the chart
        const yAxisTitleX = margin + 8;
        const yAxisTitleY = 55 + (imgHeight / 2);
        
        // Rotate text -90 degrees and position it
        pdf.text(yAxisLabel, yAxisTitleX, yAxisTitleY, { angle: 90 });
      }
      
      console.log('Bar chart image added to PDF');
    } catch (error) {
      console.error('Failed to add bar chart to PDF:', error);
    }
  } else {
    console.log('No bar chart image available for PDF');
  }

  // Add page number
  pdf.setFontSize(8);
  pdf.setTextColor(128, 128, 128);
  pdf.text(`Page ${pageNumber}`, margin, pdf.internal.pageSize.height - 10);
}

// Helper function to get Y-axis label based on dataset
function getYAxisLabel(dataset: Dataset): string {
  const assayType = dataset.assayType?.toLowerCase() || '';
  if (assayType.includes('cytotoxicity') || assayType.includes('killing')) {
    return '% Cytotoxicity';
  } else if (assayType.includes('cd4') && assayType.includes('activation')) {
    return 'CD4 Activation (%)';
  } else if (assayType.includes('cd8') && assayType.includes('activation')) {
    return 'CD8 Activation (%)';
  } else if (assayType.includes('activation')) {
    return 'Activation (%)';
  } else if (assayType.includes('degranulation')) {
    return 'Degranulation (%)';
  } else if (assayType.includes('proliferation')) {
    return 'Proliferation (%)';
  } else if (assayType.includes('target')) {
    return 'Target Cells (%)';
  }
  return 'Response (%)';
}

// Helper function to capture chart as image (requires DOM element)
export async function captureChartImage(chartType: 'curve' | 'bar' = 'curve'): Promise<string | null> {
  try {
    console.log('Starting chart capture...');
    
    // Wait for chart to be fully rendered
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Debug: Log all available elements
    console.log('=== DEBUGGING CHART ELEMENTS ===');
    const chartContainer = document.querySelector('[data-testid="chart-container"]');
    console.log('Chart container found:', !!chartContainer);
    if (chartContainer) {
      console.log('Chart container children:', chartContainer.children.length);
      Array.from(chartContainer.children).forEach((child, i) => {
        console.log(`Child ${i}:`, child.tagName, child.className);
      });
    }
    
    const allSvgs = document.querySelectorAll('svg');
    console.log('Total SVGs found:', allSvgs.length);
    allSvgs.forEach((svg, i) => {
      console.log(`SVG ${i}:`, svg.getAttribute('class'), svg.children.length, 'children');
      console.log(`SVG ${i} viewBox:`, svg.getAttribute('viewBox'));
      console.log(`SVG ${i} dimensions:`, svg.getAttribute('width'), 'x', svg.getAttribute('height'));
    });
    
    // Try to capture the appropriate chart container based on chart type
    const chartSelector = chartType === 'bar' ? '[data-testid="bar-chart-container"]' : '[data-testid="chart-container"]';
    const fullChartContainer = document.querySelector(chartSelector) as HTMLElement;
    
    if (fullChartContainer) {
      console.log('Found chart container, attempting to capture entire container (with legend and Y-axis label)');
      const containerRect = fullChartContainer.getBoundingClientRect();
      console.log('Container dimensions:', containerRect.width, 'x', containerRect.height);
      
      // Ensure the Y-axis label is visible before capture
      const yAxisLabel = fullChartContainer.querySelector('div[style*="transform"][style*="rotate"]') as HTMLElement;
      if (yAxisLabel) {
        console.log('Found Y-axis label in container, ensuring visibility');
        yAxisLabel.style.visibility = 'visible';
        yAxisLabel.style.display = 'block';
        yAxisLabel.style.opacity = '1';
        yAxisLabel.style.zIndex = '999';
      }
      
      // Debug legend elements more thoroughly
      const allLegendSelectors = [
        '.recharts-legend-wrapper',
        '.recharts-legend-item',
        '.recharts-legend-item-text',
        '.recharts-default-legend',
        '[class*="legend"]',
        '[class*="Legend"]'
      ];
      
      console.log('=== LEGEND DEBUGGING ===');
      allLegendSelectors.forEach(selector => {
        const elements = fullChartContainer.querySelectorAll(selector);
        console.log(`${selector}: ${elements.length} elements found`);
        elements.forEach((el, i) => {
          const rect = el.getBoundingClientRect();
          const styles = window.getComputedStyle(el);
          console.log(`  ${selector}[${i}]:`, {
            width: rect.width,
            height: rect.height,
            visibility: styles.visibility,
            display: styles.display,
            opacity: styles.opacity,
            className: el.className,
            text: el.textContent?.substring(0, 50)
          });
        });
      });
      
      // Check all elements with "legend" in class name
      const allElements = fullChartContainer.querySelectorAll('*');
      const legendRelated = Array.from(allElements).filter(el => 
        el.className && el.className.toString().toLowerCase().includes('legend')
      );
      console.log('All legend-related elements:', legendRelated.length);
      legendRelated.forEach((el, i) => {
        console.log(`Legend-related[${i}]:`, el.className, el.tagName);
      });
      
      // Simplified html2canvas settings that work reliably
      try {
        const containerCanvas = await html2canvas(fullChartContainer, {
          backgroundColor: '#ffffff',
          scale: 2, // Higher scale for better quality
          useCORS: true,
          allowTaint: true,
          logging: false,
          removeContainer: false,
          width: 1200, // Fixed width for consistent aspect ratio
          height: 800, // Fixed height for consistent aspect ratio
          ignoreElements: (element) => {
            // Only ignore tooltip elements, keep legends
            return element.classList.contains('recharts-tooltip-wrapper');
          },
          onclone: (clonedDoc) => {
            console.log('Processing cloned document for legend and Y-axis label visibility...');
            
            // First, let's see the entire structure
            console.log('=== CLONED DOCUMENT STRUCTURE ===');
            const chartContainer = clonedDoc.querySelector('[data-testid="chart-container"]');
            if (chartContainer) {
              console.log('Chart container HTML structure:', chartContainer.innerHTML.substring(0, 1000));
            }
            
            // Target all possible legend selectors
            const legendSelectors = [
              '.recharts-legend-wrapper',
              '.recharts-legend-item', 
              '.recharts-legend-item-text',
              '.recharts-default-legend',
              '[class*="legend"]',
              '[class*="Legend"]'
            ];
            
            legendSelectors.forEach(selector => {
              const clonedLegends = clonedDoc.querySelectorAll(selector);
              console.log(`Cloned ${selector}: ${clonedLegends.length} elements`);
              clonedLegends.forEach((el) => {
                const htmlEl = el as HTMLElement;
                htmlEl.style.visibility = 'visible';
                htmlEl.style.display = 'flex';
                htmlEl.style.alignItems = 'center';
                htmlEl.style.opacity = '1';
                htmlEl.style.color = '#000000';
                htmlEl.style.fontSize = '14px';
                htmlEl.style.fontFamily = 'Arial, sans-serif';
                htmlEl.style.lineHeight = '1.2';
                htmlEl.style.marginBottom = '4px';
                
                // Fix alignment for legend items specifically
                if (el.classList.contains('recharts-legend-item')) {
                  htmlEl.style.display = 'flex';
                  htmlEl.style.alignItems = 'center';
                  htmlEl.style.gap = '8px';
                }
              });
            });
            
            // Also ensure SVG text is visible
            const textElements = clonedDoc.querySelectorAll('text');
            textElements.forEach((text) => {
              if (text instanceof SVGTextElement) {
                text.style.fill = text.style.fill || '#000000';
                text.style.fontSize = text.style.fontSize || '14px';
              }
            });
            
            // Ensure custom Y-axis label is captured - look for the data attribute first
            const customYAxisLabels = clonedDoc.querySelectorAll('div[data-y-axis-label="true"]');
            console.log(`Found ${customYAxisLabels.length} custom Y-axis labels with data attribute`);
            customYAxisLabels.forEach((label) => {
              const htmlEl = label as HTMLElement;
              htmlEl.style.visibility = 'visible';
              htmlEl.style.display = 'block';
              htmlEl.style.opacity = '1';
              htmlEl.style.color = '#000000';
              htmlEl.style.zIndex = '999';
              htmlEl.style.position = 'absolute';
              htmlEl.style.pointerEvents = 'none';
              console.log('Y-axis label styles applied:', htmlEl.style.cssText);
            });
            
            // Also look for rotated divs as fallback - broader search
            const rotatedSelectors = [
              'div[style*="transform"][style*="rotate"]',
              'div[style*="rotate(-90deg)"]',
              'div[style*="rotate(270deg)"]',
              '*[style*="rotate(-90deg)"]'
            ];
            
            rotatedSelectors.forEach(selector => {
              const rotatedDivs = clonedDoc.querySelectorAll(selector);
              console.log(`Found ${rotatedDivs.length} elements with ${selector}`);
              rotatedDivs.forEach((label) => {
                const htmlEl = label as HTMLElement;
                htmlEl.style.visibility = 'visible !important';
                htmlEl.style.display = 'block !important';
                htmlEl.style.opacity = '1 !important';
                htmlEl.style.color = '#000000 !important';
                htmlEl.style.zIndex = '999';
                htmlEl.style.position = 'absolute';
                htmlEl.style.fontSize = '18px !important';
                htmlEl.style.fontWeight = 'bold !important';
                console.log(`${selector} styles applied:`, htmlEl.textContent?.substring(0, 20));
              });
            });
            
            // Search for Y-axis labels by common text content
            const yAxisLabelTexts = ['% Cytotoxicity', 'Cytotoxicity', 'Response (%)', 'CD4 Activation', 'CD8 Activation', 'Activation'];
            yAxisLabelTexts.forEach(labelText => {
              const textElements = clonedDoc.querySelectorAll('*');
              Array.from(textElements).forEach((el) => {
                if (el.textContent && el.textContent.includes(labelText)) {
                  const htmlEl = el as HTMLElement;
                  htmlEl.style.visibility = 'visible !important';
                  htmlEl.style.display = 'block !important';
                  htmlEl.style.opacity = '1 !important';
                  htmlEl.style.color = '#000000 !important';
                  htmlEl.style.fontSize = '18px !important';
                  htmlEl.style.fontWeight = 'bold !important';
                  console.log(`Found Y-axis label by text "${labelText}":`, el.tagName);
                }
              });
            });
            
            // Also look for any div with Y-axis label text
            const allDivs = clonedDoc.querySelectorAll('div');
            allDivs.forEach((div) => {
              const htmlEl = div as HTMLElement;
              const text = htmlEl.textContent || '';
              if (text.includes('%') && (text.includes('Cytotoxicity') || text.includes('Activation') || text.includes('Response'))) {
                console.log('Found Y-axis label div:', text);
                htmlEl.style.visibility = 'visible';
                htmlEl.style.display = 'block';
                htmlEl.style.opacity = '1';
                htmlEl.style.color = '#000000';
                htmlEl.style.zIndex = '999';
                htmlEl.style.position = 'absolute';
              }
            });
            
            // Ensure any span elements (legends might use spans) are visible
            const spanElements = clonedDoc.querySelectorAll('span, div');
            spanElements.forEach((span) => {
              const htmlEl = span as HTMLElement;
              if (htmlEl.className && htmlEl.className.toLowerCase().includes('legend')) {
                htmlEl.style.visibility = 'visible';
                htmlEl.style.display = 'block';
                htmlEl.style.opacity = '1';
                htmlEl.style.color = '#000000';
              }
            });
          }
        });
        
        // Check if the container capture worked
        const ctx = containerCanvas.getContext('2d');
        const imageData = ctx?.getImageData(0, 0, containerCanvas.width, containerCanvas.height);
        const isEmpty = imageData && imageData.data.every((value, index) => {
          if (index % 4 === 3) return value === 255; // Alpha channel
          return value === 255; // RGB channels
        });
        
        if (!isEmpty) {
          console.log('Container capture successful! (includes legend)');
          const containerDataUrl = containerCanvas.toDataURL('image/png', 0.9);
          console.log('Container capture length:', containerDataUrl.length);
          return containerDataUrl;
        } else {
          console.log('Container capture was empty, trying alternative capture method...');
        }
      } catch (error) {
        console.log('Container capture failed, falling back to SVG method:', error);
      }
    }

    // Alternative approach: Try to capture ResponsiveContainer with enhanced settings
    const responsiveContainer = document.querySelector('.recharts-responsive-container') as HTMLElement;
    if (responsiveContainer) {
      console.log('Trying ResponsiveContainer capture with enhanced settings...');
      const containerRect = responsiveContainer.getBoundingClientRect();
      console.log('ResponsiveContainer dimensions:', containerRect.width, 'x', containerRect.height);
      
      try {
        const respCanvas = await html2canvas(responsiveContainer, {
          backgroundColor: '#ffffff',
          scale: 1,
          useCORS: true,
          allowTaint: true,
          logging: false,
          removeContainer: false,
          width: Math.max(containerRect.width, responsiveContainer.scrollWidth),
          height: Math.max(containerRect.height, responsiveContainer.scrollHeight),
          ignoreElements: (element) => {
            return element.classList.contains('recharts-tooltip-wrapper');
          },
          onclone: (clonedDoc) => {
            // Force legend visibility in cloned document
            console.log('Forcing legend visibility in ResponsiveContainer clone...');
            const allText = clonedDoc.querySelectorAll('text, span, div');
            allText.forEach((el) => {
              const htmlEl = el as HTMLElement;
              if (htmlEl.textContent && htmlEl.textContent.trim().length > 0) {
                htmlEl.style.visibility = 'visible';
                htmlEl.style.opacity = '1';
                htmlEl.style.display = 'block';
                if (htmlEl.tagName.toLowerCase() === 'text') {
                  htmlEl.style.fill = '#000000';
                } else {
                  htmlEl.style.color = '#000000';
                }
              }
            });
          }
        });
        
        const ctx = respCanvas.getContext('2d');
        const imageData = ctx?.getImageData(0, 0, respCanvas.width, respCanvas.height);
        const isEmpty = imageData && imageData.data.every((value, index) => {
          if (index % 4 === 3) return value === 255;
          return value === 255;
        });
        
        if (!isEmpty) {
          console.log('ResponsiveContainer capture successful!');
          const respDataUrl = respCanvas.toDataURL('image/png', 0.9);
          console.log('ResponsiveContainer capture length:', respDataUrl.length);
          return respDataUrl;
        } else {
          console.log('ResponsiveContainer capture was empty');
        }
      } catch (error) {
        console.log('ResponsiveContainer capture failed:', error);
      }
    }

    // Fallback: Try multiple selectors to find the chart container (including legend)
    const selectors = [
      '[data-testid="chart-container"]', // This should include the full container with legend
      '.recharts-wrapper',
      '.recharts-responsive-container'
    ];
    
    let chartElement: HTMLElement | null = null;
    for (const selector of selectors) {
      chartElement = document.querySelector(selector) as HTMLElement;
      if (chartElement && chartElement.offsetWidth > 0 && chartElement.offsetHeight > 0) {
        console.log(`Found chart container with selector: ${selector}`);
        console.log('Element dimensions:', chartElement.offsetWidth, 'x', chartElement.offsetHeight);
        break;
      }
    }
    
    if (!chartElement) {
      console.log('No suitable chart element found');
      return null;
    }
    
    console.log('Final chart element to capture:', chartElement.tagName, chartElement.className);
    
    // Simplified html2canvas options for reliable capture with legend and Y-axis label support
    const canvas = await html2canvas(chartElement, {
      backgroundColor: '#ffffff',
      scale: 2, // Higher scale for better quality
      useCORS: true,
      allowTaint: true,
      logging: false,
      removeContainer: false,
      width: chartElement.scrollWidth, // Ensure full width including legend
      height: chartElement.scrollHeight, // Ensure full height
      ignoreElements: (element) => {
        // Only ignore tooltip elements, keep legends and Y-axis labels
        return element.classList.contains('recharts-tooltip-wrapper');
      },
      onclone: (clonedDoc) => {
        // Ensure legend elements are visible and properly styled
        const clonedLegends = clonedDoc.querySelectorAll('.recharts-legend-wrapper, .recharts-legend-item, .recharts-legend-item-text');
        clonedLegends.forEach((el) => {
          const htmlEl = el as HTMLElement;
          htmlEl.style.visibility = 'visible';
          htmlEl.style.display = 'block';
          htmlEl.style.opacity = '1';
          htmlEl.style.color = '#000000';
          htmlEl.style.fontWeight = 'bold';
          htmlEl.style.fontSize = '16px';
        });
        
        // Ensure all text elements are visible and black
        const allText = clonedDoc.querySelectorAll('text, span, div');
        allText.forEach((el) => {
          const htmlEl = el as HTMLElement;
          if (htmlEl.textContent && htmlEl.textContent.trim().length > 0) {
            htmlEl.style.visibility = 'visible';
            htmlEl.style.opacity = '1';
            htmlEl.style.display = 'block';
            if (htmlEl.tagName.toLowerCase() === 'text') {
              htmlEl.style.fill = '#000000';
            } else {
              htmlEl.style.color = '#000000';
            }
          }
        });
        
        // Ensure SVG text elements are visible
        const textElements = clonedDoc.querySelectorAll('text');
        textElements.forEach((text) => {
          if (text instanceof SVGTextElement) {
            text.style.fill = text.style.fill || '#000000';
            text.style.fontSize = text.style.fontSize || '16px';
            text.style.fontWeight = 'bold';
          }
        });
      }
    });
    
    console.log('html2canvas completed');
    console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
    
    // Check if canvas is actually empty
    const ctx = canvas.getContext('2d');
    const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
    const isEmpty = imageData && imageData.data.every((value, index) => {
      // Check if all pixels are white (rgba values: 255, 255, 255, 255)
      if (index % 4 === 3) return value === 255; // Alpha channel
      return value === 255; // RGB channels
    });
    
    if (isEmpty) {
      console.log('Canvas is empty (all white), chart capture failed');
      return null;
    }
    
    const dataUrl = canvas.toDataURL('image/png', 0.9);
    console.log('Data URL created, length:', dataUrl.length);
    
    return dataUrl;
  } catch (error) {
    console.error('Chart capture failed:', error);
    return null;
  }
} 