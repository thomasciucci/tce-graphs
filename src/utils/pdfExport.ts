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
  assayType?: string;
  chartImage?: string;
}

// Add interface for dataset switching callback
interface PDFExportOptionsWithCallback extends PDFExportOptions {
  onDatasetSwitch?: (datasetIndex: number) => Promise<void>;
}

export async function exportToPDF(options: PDFExportOptionsWithCallback): Promise<void> {
  const {
    datasets,
    fittedCurvesByDataset,
    originalDataByDataset,
    editedDataByDataset,
    curveColorsByDataset,
    assayType,
    onDatasetSwitch
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
    if (onDatasetSwitch) {
      console.log(`Switching to dataset ${i}: ${dataset.name}`);
      await onDatasetSwitch(i);
      
      // Wait for UI to update
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Capture chart for this specific dataset
      console.log(`Capturing chart for dataset: ${dataset.name}`);
      const capturedImage = await captureChartImage();
      if (capturedImage) {
        datasetChartImage = capturedImage;
        console.log(`Chart captured for ${dataset.name}, length: ${capturedImage.length}`);
      } else {
        console.log(`Failed to capture chart for ${dataset.name}`);
      }
    }

    // Single page with all data for this dataset
    await addDatasetPage(pdf, dataset, originalData, editedData, fittedCurves, curveColors, currentPage, datasetChartImage);
    currentPage++;
  }

  // Save the PDF
  pdf.save(`dose-response-analysis-${new Date().toISOString().split('T')[0]}.pdf`);
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
  chartImage?: string
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
      curve.ec50.toExponential(2),
      curve.top.toFixed(1),
      curve.bottom.toFixed(1),
      curve.rSquared.toFixed(3)
    ]);

    autoTable(pdf, {
      startY: currentY,
      head: [['Sample', 'EC50 [nM]', 'Top (%)', 'Bottom (%)', 'R²']],
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

  // Section 4: Fitted Values Table (compact)
  if (fittedCurves.length > 0) {
    pdf.setFontSize(10);
    pdf.setTextColor(138, 0, 81);
    pdf.text('Fitted Values', margin, currentY);
    currentY += 8;

    const fittedData = fittedCurves.map((curve) => [
      curve.sampleName,
      curve.ec50.toExponential(2),
      curve.hillSlope.toFixed(2),
      curve.top.toFixed(1),
      curve.bottom.toFixed(1),
      curve.rSquared.toFixed(3)
    ]);

    autoTable(pdf, {
      startY: currentY,
      head: [['Sample', 'EC50 [nM]', 'Hill Slope', 'Top (%)', 'Bottom (%)', 'R²']],
      body: fittedData,
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

  // Section 5: Chart image (if available)
  if (chartImage) {
    try {
      console.log('Attempting to add chart image to PDF, currentY:', currentY);
      console.log('Chart image data URL starts with:', chartImage.substring(0, 50));
      console.log('Chart image data URL length:', chartImage.length);
      
      // Check if there's enough space on the page
      if (currentY + 200 < 250) {
        // Add to current page
        const imgWidth = Math.min(160, contentWidth);
        const imgHeight = (imgWidth * 0.7);
        pdf.addImage(chartImage, 'PNG', margin, currentY, imgWidth, imgHeight);
        console.log('Chart image added to current page at Y:', currentY);
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
        
        // Add chart image with better sizing
        const imgWidth = Math.min(200, contentWidth);
        const imgHeight = (imgWidth * 0.7);
        pdf.addImage(chartImage, 'PNG', margin, 45, imgWidth, imgHeight);
        console.log('Chart image added to new page in PDF');
      }
    } catch (error) {
      console.error('Failed to add chart image to PDF:', error);
    }
  } else {
    console.log('No chart image available for PDF');
  }

  // Add page number
  pdf.setFontSize(8);
  pdf.setTextColor(128, 128, 128);
  pdf.text(`Page ${pageNumber}`, margin, pdf.internal.pageSize.height - 10);
}

// Helper function to capture chart as image (requires DOM element)
export async function captureChartImage(): Promise<string | null> {
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
    
    // Try to capture the entire chart container (including legend) first
    const fullChartContainer = document.querySelector('[data-testid="chart-container"]') as HTMLElement;
    
    if (fullChartContainer) {
      console.log('Found chart container, attempting to capture entire container (with legend)');
      const containerRect = fullChartContainer.getBoundingClientRect();
      console.log('Container dimensions:', containerRect.width, 'x', containerRect.height);
      
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
          scale: 1, // Use scale 1 for reliability
          useCORS: true,
          allowTaint: true,
          logging: false,
          removeContainer: false,
          width: fullChartContainer.scrollWidth, // Use scrollWidth to ensure full content
          height: fullChartContainer.scrollHeight, // Use scrollHeight to ensure full content
          ignoreElements: (element) => {
            // Only ignore tooltip elements, keep legends
            return element.classList.contains('recharts-tooltip-wrapper');
          },
          onclone: (clonedDoc) => {
            console.log('Processing cloned document for legend visibility...');
            
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
                htmlEl.style.display = 'block';
                htmlEl.style.opacity = '1';
                htmlEl.style.color = '#000000';
                htmlEl.style.fontSize = '14px';
                htmlEl.style.fontFamily = 'Arial, sans-serif';
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
            
            // Ensure custom Y-axis label is captured
            const customYAxisLabel = clonedDoc.querySelector('[style*="transform"][style*="rotate"]');
            if (customYAxisLabel) {
              const htmlEl = customYAxisLabel as HTMLElement;
              htmlEl.style.visibility = 'visible';
              htmlEl.style.display = 'block';
              htmlEl.style.opacity = '1';
              htmlEl.style.color = '#000000';
              htmlEl.style.zIndex = '999';
            }
            
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
    
    // Simplified html2canvas options for reliable capture with legend support
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
        // Only ignore tooltip elements, keep legends
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