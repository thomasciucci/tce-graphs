/**
 * Enhanced PDF Export with SVG-first approach for vector graphics
 * Provides publication-quality PDF generation for scientific charts
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DataPoint, FittedCurve, Dataset } from '../types';
import { exportChartAsSVG, convertSVGToCanvas, exportSVGAsPNG } from './svgExport';
import { PUBLICATION_TYPOGRAPHY } from './publicationStyles';

interface EnhancedPDFExportOptions {
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
  exportOptions?: {
    includeRawData?: boolean;
    includeStatistics?: boolean;
    useVectorGraphics?: boolean;
    highResolution?: boolean;
    colorSpace?: 'RGB' | 'CMYK';
  };
}

export class EnhancedPDFExporter {
  private pdf: jsPDF;
  private currentPage: number = 1;
  private options: EnhancedPDFExportOptions;

  constructor(options: EnhancedPDFExportOptions) {
    this.options = options;
    this.pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });
    
    // Set document properties
    this.pdf.setDocumentProperties({
      title: 'nVitro Studio Analysis Report',
      subject: 'Dose-Response Analysis',
      author: 'nVitro Studio',
      creator: 'nVitro Studio Data Graphist'
    });
  }

  async exportToPDF(): Promise<Blob> {
    try {
      await this.addTitlePage();
      await this.addSummaryPage();
      
      // Export each dataset
      for (let i = 0; i < this.options.datasets.length; i++) {
        await this.addDatasetPage(i);
      }
      
      // Add statistics summary if requested
      if (this.options.exportOptions?.includeStatistics) {
        await this.addStatisticsPage();
      }
      
      return this.pdf.output('blob');
    } catch (error) {
      console.error('Error generating enhanced PDF:', error);
      throw error;
    }
  }

  async downloadPDF(filename: string = 'nvitro-analysis-report.pdf'): Promise<void> {
    const blob = await this.exportToPDF();
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  private async addTitlePage(): Promise<void> {
    const pageWidth = this.pdf.internal.pageSize.width;
    const pageHeight = this.pdf.internal.pageSize.height;
    
    // Title
    this.pdf.setFontSize(24);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('nVitro Studio', pageWidth / 2, 50, { align: 'center' });
    
    this.pdf.setFontSize(18);
    this.pdf.text('Dose-Response Analysis Report', pageWidth / 2, 70, { align: 'center' });
    
    // Date and time
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'normal');
    const now = new Date();
    this.pdf.text(`Generated: ${now.toLocaleString()}`, pageWidth / 2, 90, { align: 'center' });
    
    // Dataset summary
    const datasetCount = this.options.datasets.length;
    const totalSamples = this.options.datasets.reduce((sum, dataset) => {
      const curves = this.options.fittedCurvesByDataset[dataset.id] || [];
      return sum + curves.length;
    }, 0);
    
    this.pdf.setFontSize(14);
    this.pdf.text(`Datasets: ${datasetCount}`, pageWidth / 2, 120, { align: 'center' });
    this.pdf.text(`Total Samples: ${totalSamples}`, pageWidth / 2, 135, { align: 'center' });
    
    if (this.options.assayType) {
      this.pdf.text(`Assay Type: ${this.options.assayType}`, pageWidth / 2, 150, { align: 'center' });
    }
    
    this.pdf.addPage();
    this.currentPage++;
  }

  private async addSummaryPage(): Promise<void> {
    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Analysis Summary', 20, 30);
    
    // Create summary table
    const summaryData = this.options.datasets.map((dataset, index) => {
      const curves = this.options.fittedCurvesByDataset[dataset.id] || [];
      const originalData = this.options.originalDataByDataset[dataset.id] || [];
      const editedData = this.options.editedDataByDataset[dataset.id] || [];
      
      // Calculate basic statistics
      const dataPoints = editedData.length > 0 ? editedData.length : originalData.length;
      const samplesCount = curves.length;
      
      return [
        dataset.name || `Dataset ${index + 1}`,
        samplesCount.toString(),
        dataPoints.toString(),
        dataset.assayType || 'Not specified'
      ];
    });
    
    autoTable(this.pdf, {
      head: [['Dataset', 'Samples', 'Data Points', 'Assay Type']],
      body: summaryData,
      startY: 45,
      styles: {
        fontSize: 10,
        font: 'helvetica'
      },
      headStyles: {
        fillColor: [41, 102, 172], // Professional blue
        textColor: 255,
        fontStyle: 'bold'
      }
    });
    
    this.pdf.addPage();
    this.currentPage++;
  }

  private async addDatasetPage(datasetIndex: number): Promise<void> {
    const dataset = this.options.datasets[datasetIndex];
    const fittedCurves = this.options.fittedCurvesByDataset[dataset.id] || [];
    const originalData = this.options.originalDataByDataset[dataset.id] || [];
    const editedData = this.options.editedDataByDataset[dataset.id] || [];
    
    // Switch to dataset if callback provided
    if (this.options.onDatasetSwitch) {
      await this.options.onDatasetSwitch(datasetIndex);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for UI update
    }
    
    // Page header
    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(`Dataset: ${dataset.name || `Dataset ${datasetIndex + 1}`}`, 20, 30);
    
    let yPosition = 45;
    
    // Capture and add chart using SVG-first approach
    const chartImage = await this.captureChartAsSVG();
    if (chartImage) {
      try {
        // Convert SVG to high-resolution image
        const resolution = this.options.exportOptions?.highResolution ? 300 : 150;
        const chartWidth = 160; // mm
        const chartHeight = 100; // mm
        
        if (this.options.exportOptions?.useVectorGraphics) {
          // Add as SVG (requires jsPDF SVG plugin or conversion)
          const canvas = await convertSVGToCanvas(chartImage, chartWidth * 4, chartHeight * 4);
          const imgData = canvas.toDataURL('image/png', 1.0);
          this.pdf.addImage(imgData, 'PNG', 20, yPosition, chartWidth, chartHeight);
        } else {
          // Convert to high-resolution PNG
          const pngBlob = await exportSVGAsPNG(chartImage, chartWidth * 4, chartHeight * 4, 2);
          const imgData = await this.blobToDataURL(pngBlob);
          this.pdf.addImage(imgData, 'PNG', 20, yPosition, chartWidth, chartHeight);
        }
        
        yPosition += chartHeight + 10;
      } catch (error) {
        console.error('Error adding chart to PDF:', error);
        // Fallback to text
        this.pdf.setFontSize(12);
        this.pdf.text('Chart could not be rendered', 20, yPosition);
        yPosition += 10;
      }
    }
    
    // Add curve parameters table
    if (fittedCurves.length > 0) {
      const parametersData = fittedCurves.map(curve => [
        curve.sampleName,
        curve.ec50?.toFixed(3) || 'N/A',
        curve.hillSlope?.toFixed(3) || 'N/A',
        curve.rSquared?.toFixed(3) || 'N/A',
        curve.top?.toFixed(1) || 'N/A',
        curve.bottom?.toFixed(1) || 'N/A'
      ]);
      
      autoTable(this.pdf, {
        head: [['Sample', 'EC50', 'Hill Slope', 'R²', 'Top', 'Bottom']],
        body: parametersData,
        startY: yPosition,
        styles: {
          fontSize: 9,
          font: 'helvetica'
        },
        headStyles: {
          fillColor: [118, 42, 131], // Scientific purple
          textColor: 255,
          fontStyle: 'bold'
        },
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' }
        }
      });
    }
    
    // Add raw data table if requested
    if (this.options.exportOptions?.includeRawData && originalData.length > 0) {
      this.pdf.addPage();
      this.currentPage++;
      
      this.pdf.setFontSize(14);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text(`Raw Data - ${dataset.name}`, 20, 30);
      
      // Create data table
      const dataTable = this.createDataTable(originalData);
      autoTable(this.pdf, {
        head: dataTable.headers,
        body: dataTable.rows,
        startY: 45,
        styles: {
          fontSize: 8,
          font: 'helvetica'
        },
        headStyles: {
          fillColor: [27, 120, 55], // Scientific green
          textColor: 255,
          fontStyle: 'bold'
        }
      });
    }
    
    if (datasetIndex < this.options.datasets.length - 1) {
      this.pdf.addPage();
      this.currentPage++;
    }
  }

  private async addStatisticsPage(): Promise<void> {
    this.pdf.addPage();
    this.currentPage++;
    
    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Statistical Summary', 20, 30);
    
    // Calculate overall statistics
    const allCurves = Object.values(this.options.fittedCurvesByDataset).flat();
    const ec50Values = allCurves.map(c => c.ec50).filter(v => v !== undefined && !isNaN(v)) as number[];
    const rSquaredValues = allCurves.map(c => c.rSquared).filter(v => v !== undefined && !isNaN(v)) as number[];
    
    if (ec50Values.length > 0) {
      const ec50Stats = this.calculateStatistics(ec50Values);
      const rSquaredStats = this.calculateStatistics(rSquaredValues);
      
      const statsData = [
        ['EC50 Mean', ec50Stats.mean.toFixed(3)],
        ['EC50 Median', ec50Stats.median.toFixed(3)],
        ['EC50 Std Dev', ec50Stats.stdDev.toFixed(3)],
        ['EC50 Min', ec50Stats.min.toFixed(3)],
        ['EC50 Max', ec50Stats.max.toFixed(3)],
        ['', ''],
        ['R² Mean', rSquaredStats.mean.toFixed(3)],
        ['R² Median', rSquaredStats.median.toFixed(3)],
        ['R² Std Dev', rSquaredStats.stdDev.toFixed(3)],
        ['R² Min', rSquaredStats.min.toFixed(3)],
        ['R² Max', rSquaredStats.max.toFixed(3)]
      ];
      
      autoTable(this.pdf, {
        body: statsData,
        startY: 45,
        styles: {
          fontSize: 11,
          font: 'helvetica'
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 40 },
          1: { halign: 'right', cellWidth: 30 }
        }
      });
    }
  }

  private async captureChartAsSVG(): Promise<string | null> {
    try {
      const chartContainer = document.querySelector('[data-testid="chart-container"]') as HTMLElement;
      if (!chartContainer) {
        console.warn('Chart container not found for SVG export');
        return null;
      }
      
      return await exportChartAsSVG(chartContainer, {
        width: 800,
        height: 500,
        backgroundColor: 'white',
        includeFonts: true,
        preserveAspectRatio: 'xMidYMid meet'
      });
    } catch (error) {
      console.error('Error capturing chart as SVG:', error);
      return null;
    }
  }

  private createDataTable(data: DataPoint[]): { headers: string[][], rows: string[][] } {
    if (!data.length) return { headers: [], rows: [] };
    
    const sample = data[0];
    const headers = [['Concentration', ...sample.sampleNames]];
    
    const concentrations = [...new Set(data.map(d => d.concentration))].sort((a, b) => a - b);
    const rows = concentrations.map(conc => {
      const row = [conc.toString()];
      const dataForConc = data.filter(d => d.concentration === conc)[0];
      if (dataForConc) {
        row.push(...dataForConc.responses.map(y => y?.toFixed(2) || 'N/A'));
      }
      return row;
    });
    
    return { headers, rows };
  }

  private calculateStatistics(values: number[]): {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
  } {
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const median = sorted.length % 2 === 0 
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      mean,
      median,
      stdDev,
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  private async blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

// Convenience function for backward compatibility
export async function exportEnhancedPDF(options: EnhancedPDFExportOptions): Promise<void> {
  const exporter = new EnhancedPDFExporter(options);
  await exporter.downloadPDF();
}