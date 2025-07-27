'use client';

import { useState } from 'react';
import { DataPoint, FittedCurve, Dataset } from '../types';

interface PowerPointExportProps {
  datasets: Dataset[];
  fittedCurvesByDataset: Record<string, FittedCurve[]>;
  originalDataByDataset: Record<string, DataPoint[]>;
  editedDataByDataset: Record<string, DataPoint[]>;
  curveColorsByDataset: Record<string, string[]>;
  curveVisibilityByDataset: Record<string, boolean[]>;
  globalChartSettings: {
    showGroups: boolean;
    showIndividuals: boolean;
    showCurveChart: boolean;
    showBarChart: boolean;
  };
  assayType?: string;
  data: DataPoint[];
  fittedCurves: FittedCurve[];
  curveColors: string[];
  activeDatasetIndex: number;
  hasResults: boolean;
  onDatasetSwitch?: (datasetIndex: number) => Promise<void>;
  onCurveVisibilityChange?: (datasetId: string, curveIndex: number, visible: boolean) => Promise<void>;
}

export default function PowerPointExport({
  datasets,
  fittedCurvesByDataset,
  originalDataByDataset,
  editedDataByDataset,
  curveColorsByDataset,
  curveVisibilityByDataset,
  globalChartSettings,
  assayType,
  data,
  fittedCurves,
  curveColors,
  activeDatasetIndex,
  hasResults,
  onDatasetSwitch,
  onCurveVisibilityChange
}: PowerPointExportProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPowerPoint = async () => {
    if (isExporting) return;
    
    try {
      setIsExporting(true);
      
      // Dynamic import that won't be processed during build
      const { exportToPowerPoint } = await import('../utils/pptExport');
      
      const exportOptions = {
        datasets: datasets.length > 0 ? datasets : [{ id: 'single', name: 'Single Dataset', data, assayType: 'Not specified' }],
        fittedCurvesByDataset: datasets.length > 0 ? fittedCurvesByDataset : { 'single': fittedCurves },
        originalDataByDataset: datasets.length > 0 ? originalDataByDataset : { 'single': originalDataByDataset['single'] || data },
        editedDataByDataset: datasets.length > 0 ? editedDataByDataset : { 'single': editedDataByDataset['single'] || data },
        curveColorsByDataset: datasets.length > 0 ? curveColorsByDataset : { 'single': curveColors },
        curveVisibilityByDataset: datasets.length > 0 ? curveVisibilityByDataset : { 'single': curveVisibilityByDataset['single'] || [] },
        assayType: datasets[activeDatasetIndex]?.assayType || assayType,
        globalChartSettings,
        onDatasetSwitch: datasets.length > 1 ? onDatasetSwitch : undefined,
        onCurveVisibilityChange
      };
      
      await exportToPowerPoint(exportOptions);
    } catch (error) {
      console.error('PowerPoint export failed:', error);
      alert('Failed to export PowerPoint. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExportPowerPoint}
      disabled={isExporting || !hasResults}
      className={`px-6 py-3 text-white rounded-lg font-medium transition-colors shadow-lg hover:shadow-xl ${
        isExporting || !hasResults
          ? 'bg-gray-400 cursor-not-allowed'
          : 'bg-[#8A0051] hover:bg-[#6A003F]'
      }`}
    >
      {isExporting ? (
        <div className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Generating PowerPoint...
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          Export to PowerPoint
        </div>
      )}
    </button>
  );
}