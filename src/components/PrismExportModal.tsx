'use client';

import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { DataPoint, Dataset, FittedCurve } from '../types';
import { getPrismExportOptions } from '../utils/prismExport';
import { exportToSimplePrism, SimplePrismExportOptions } from '../utils/prismExportSimple';
import { exportToEnhancedPrism, EnhancedPrismExportOptions } from '../utils/enhancedPrismExport';
import { exportWorkingPrism, WorkingPrismExportOptions } from '../utils/workingPrismExport';
import { exportToCSV, CSVExportOptions } from '../utils/csvExport';

interface PrismExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasets: Dataset[];
  fittedCurves: FittedCurve[];
  fittedCurvesByDataset: Record<string, FittedCurve[]>;
  originalDataByDataset: Record<string, DataPoint[]>;
  editedDataByDataset: Record<string, DataPoint[]>;
  curveColorsByDataset: Record<string, string[]>;
  currentData: DataPoint[];
  hasReplicates: boolean;
}

export default function PrismExportModal({
  isOpen,
  onClose,
  datasets,
  fittedCurves,
  fittedCurvesByDataset,
  originalDataByDataset: _originalDataByDataset,  
  editedDataByDataset,
  curveColorsByDataset: _curveColorsByDataset,  
  currentData,
  hasReplicates
}: PrismExportModalProps) {
  const [selectedExportType, setSelectedExportType] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'pzfx' | 'enhanced-pzfx' | 'working-pzfx'>('working-pzfx');
  const [includeAnalysis, setIncludeAnalysis] = useState<boolean>(true);
  const [includeGraphs, setIncludeGraphs] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState(false);

  // Determine available export options
  const availableOptions = datasets.length > 0 
    ? getPrismExportOptions(datasets[0]?.data || [])
    : getPrismExportOptions(currentData);

  // Set default export type when modal opens
  React.useEffect(() => {
    if (isOpen && availableOptions.options.length > 0 && !selectedExportType) {
      if (hasReplicates) {
        setSelectedExportType('with_replicates_mean');
      } else {
        setSelectedExportType('raw_and_edited');
      }
    }
  }, [isOpen, availableOptions, hasReplicates, selectedExportType]);

  const exportOptions = [
    {
      value: 'raw_and_edited',
      label: 'Raw & Edited Data',
      description: 'Export both original and edited data as separate XY tables with curve fitting',
      available: true
    },
    {
      value: 'with_replicates_mean',
      label: 'Mean Data with Error Bars',
      description: 'Export replicate group means with SEM error bars for statistical analysis',
      available: hasReplicates
    },
    {
      value: 'with_replicates_individual',
      label: 'Individual Replicates',
      description: 'Export all individual replicate data points with separate curve fits',
      available: hasReplicates
    },
    {
      value: 'both_replicates',
      label: 'Both Mean & Individual',
      description: 'Comprehensive export with both mean data and individual replicates',
      available: hasReplicates
    }
  ].filter(option => option.available);

  const handleExport = async () => {
    if (!selectedExportType || isExporting) return;

    try {
      setIsExporting(true);

      const baseDatasets = datasets.length > 0 ? datasets : [{ 
        id: 'single', 
        name: 'Single Dataset', 
        data: currentData, 
        assayType: 'Not specified' 
      }];

      const baseEditedData = datasets.length > 0 ? editedDataByDataset : { 'single': currentData };

      // Fix: Ensure fitted curves are available for single dataset mode
      const finalFittedCurves = datasets.length > 0 
        ? fittedCurvesByDataset 
        : { 'single': fittedCurves };
      
      console.log('Final fitted curves for export:', finalFittedCurves);

      if (selectedFormat === 'working-pzfx') {
        // Export using WORKING Prism format (default)
        const workingExportOptions: WorkingPrismExportOptions = {
          datasets: baseDatasets,
          editedDataByDataset: baseEditedData,
          fittedCurvesByDataset: finalFittedCurves
        };
        
        await exportWorkingPrism(workingExportOptions);
        
        // Show success message with instructions
        alert(`✅ Prism file exported successfully!

📊 To analyze your data in GraphPad Prism:

1. Open the exported .pzfx file in GraphPad Prism
2. Select your data table
3. Click the "Analyze" button
4. Choose "XY analyses" → "Nonlinear regression (curve fit)"
5. In "Dose-response - Stimulation" section, select:
   "log(agonist) vs. response -- Variable slope (four parameters)"
6. Click OK

Your results will include:
• EC50 value
• Hill Slope
• Top and Bottom plateaus
• R² (goodness of fit)
• Confidence intervals`);
        
      } else if (selectedFormat === 'csv') {
        // Export as CSV
        const csvOptions: CSVExportOptions = {
          datasets: baseDatasets,
          editedDataByDataset: baseEditedData,
          fittedCurvesByDataset: finalFittedCurves,
          exportType: selectedExportType as 'raw_and_edited' | 'with_replicates_mean' | 'with_replicates_individual',
          includeAnalysis: includeAnalysis
        };

        await exportToCSV(csvOptions);
      } else if (selectedFormat === 'enhanced-pzfx') {
        // Export as Enhanced PZFX (experimental)
        const enhancedExportOptions: EnhancedPrismExportOptions = {
          datasets: baseDatasets,
          editedDataByDataset: baseEditedData,
          fittedCurvesByDataset: finalFittedCurves,
          exportType: selectedExportType as 'raw_and_edited' | 'with_replicates_mean' | 'with_replicates_individual',
          includeAnalysis: includeAnalysis,
          includeGraphs: includeGraphs
        };

        const result = await exportToEnhancedPrism(enhancedExportOptions);
        console.log('Enhanced Prism export result:', result);
      } else {
        // Export as Simple PZFX (legacy)
        const simpleExportOptions: SimplePrismExportOptions = {
          datasets: baseDatasets,
          editedDataByDataset: baseEditedData,
          exportType: selectedExportType as 'raw_and_edited' | 'with_replicates_mean' | 'with_replicates_individual'
        };

        await exportToSimplePrism(simpleExportOptions);
      }
      
      // Show success message
      setTimeout(() => {
        onClose();
      }, 1000);

    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-lg rounded-lg bg-white p-6 shadow-xl">
          <Dialog.Title className="text-lg font-medium leading-6 text-gray-900 mb-4">
            Export to GraphPad Prism
            <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-md">
              ✅ Compatible Format
            </span>
          </Dialog.Title>

          <div className="mb-6">
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <span className="text-yellow-600">⚠️</span>
                </div>
                <div className="ml-2 text-sm">
                  <p className="font-medium text-yellow-800">Work in Progress</p>
                  <p className="text-yellow-700">
                    Current exports require manual analysis setup in Prism. We&apos;re working on full automation 
                    with embedded nonlinear regression and pre-configured graphs.
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Choose the format and data organization for GraphPad Prism analysis:
            </p>

            {/* Format Selection */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Export Format:</h4>
              <div className="space-y-3">
                <label className="flex items-start p-3 border rounded-lg cursor-pointer transition-colors hover:bg-white">
                  <input
                    type="radio"
                    name="format"
                    value="working-pzfx"
                    checked={selectedFormat === 'working-pzfx'}
                    onChange={(e) => setSelectedFormat(e.target.value as 'working-pzfx')}
                    className="mt-1 mr-3 text-[#8A0051] focus:ring-[#8A0051]"
                  />
                  <div>
                    <span className="font-medium text-green-700">✅ Standard Prism Format (Recommended)</span>
                    <p className="text-sm text-gray-600">Clean data table ready for dose-response analysis in Prism</p>
                  </div>
                </label>
                <label className="flex items-start p-3 border rounded-lg cursor-pointer transition-colors hover:bg-white">
                  <input
                    type="radio"
                    name="format"
                    value="enhanced-pzfx"
                    checked={selectedFormat === 'enhanced-pzfx'}
                    onChange={(e) => setSelectedFormat(e.target.value as 'enhanced-pzfx')}
                    className="mt-1 mr-3 text-[#8A0051] focus:ring-[#8A0051]"
                  />
                  <div>
                    <span className="font-medium text-blue-700">🚀 Enhanced Project (Experimental)</span>
                    <p className="text-sm text-gray-600">Attempts to include analysis - may not work in all Prism versions</p>
                  </div>
                </label>
                <label className="flex items-start p-3 border rounded-lg cursor-pointer transition-colors hover:bg-white">
                  <input
                    type="radio"
                    name="format"
                    value="csv"
                    checked={selectedFormat === 'csv'}
                    onChange={(e) => setSelectedFormat(e.target.value as 'csv')}
                    className="mt-1 mr-3 text-[#8A0051] focus:ring-[#8A0051]"
                  />
                  <div>
                    <span className="font-medium text-green-700">CSV Format</span>
                    <p className="text-sm text-gray-600">Simple data export for manual import into Prism</p>
                  </div>
                </label>
                <label className="flex items-start p-3 border rounded-lg cursor-pointer transition-colors hover:bg-white">
                  <input
                    type="radio"
                    name="format"
                    value="pzfx"
                    checked={selectedFormat === 'pzfx'}
                    onChange={(e) => setSelectedFormat(e.target.value as 'pzfx')}
                    className="mt-1 mr-3 text-[#8A0051] focus:ring-[#8A0051]"
                  />
                  <div>
                    <span className="font-medium text-orange-700">Basic PZFX (Data Only)</span>
                    <p className="text-sm text-gray-600">Raw data export without analysis results</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Enhanced options for PZFX export */}
            {(selectedFormat === 'enhanced-pzfx' || selectedFormat === 'csv') && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Export Options:</h4>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={includeAnalysis}
                      onChange={(e) => setIncludeAnalysis(e.target.checked)}
                      className="mr-2 text-[#8A0051] focus:ring-[#8A0051]"
                    />
                    <div>
                      <span className="font-medium">Include Curve Fitting Results</span>
                      <p className="text-sm text-gray-600">
                        Export fitted parameters (EC50, Hill slope, R²) and theoretical curves
                      </p>
                    </div>
                  </label>
                  {selectedFormat === 'enhanced-pzfx' && (
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={includeGraphs}
                        onChange={(e) => setIncludeGraphs(e.target.checked)}
                        className="mr-2 text-[#8A0051] focus:ring-[#8A0051]"
                      />
                      <div>
                        <span className="font-medium">Include Publication-Ready Graphs</span>
                        <p className="text-sm text-gray-600">
                          Pre-configured dose-response graphs with professional formatting
                        </p>
                      </div>
                    </label>
                  )}
                </div>
              </div>
            )}

            {selectedFormat !== 'working-pzfx' && (
            <div className="space-y-3">
              {exportOptions.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedExportType === option.value
                      ? 'border-[#8A0051] bg-[#8A0051]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="exportType"
                    value={option.value}
                    checked={selectedExportType === option.value}
                    onChange={(e) => setSelectedExportType(e.target.value)}
                    className="mt-1 mr-3 text-[#8A0051] focus:ring-[#8A0051]"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{option.label}</div>
                    <div className="text-sm text-gray-600 mt-1">{option.description}</div>
                  </div>
                </label>
              ))}
            </div>
            )}
          </div>

          {/* Preview of what will be exported */}
          <div className="mb-6 p-3 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Export Preview:</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>• {datasets.length || 1} dataset{(datasets.length || 1) !== 1 ? 's' : ''}</div>
              <div>• {hasReplicates ? 'Contains replicate data' : 'Individual data points only'}</div>
              {includeAnalysis && Object.keys(fittedCurvesByDataset).length > 0 && (
                <>
                  <div>• <strong>Curve fitting parameters</strong> (EC50, Hill slope, R²)</div>
                  <div>• <strong>Fitted curve points</strong> for graphing in Prism</div>
                </>
              )}
              {selectedFormat === 'working-pzfx' ? (
                <div>
                  • <strong>Standard Prism format (.pzfx)</strong> - guaranteed compatibility
                  <br />• Clean XY data table ready for analysis
                  <br />• Proper concentration and response columns
                  <br />• Instructions included for running dose-response analysis
                </div>
              ) : selectedFormat === 'enhanced-pzfx' ? (
                <div>
                  • <strong>Enhanced Prism project (.pzfx)</strong> - experimental features
                  <br />• Attempts to include fitted curves and parameters
                  <br />• May require manual adjustments in some Prism versions
                  {includeGraphs && <><br />• Graph templates included</>}
                </div>
              ) : selectedFormat === 'csv' ? (
                <div>• CSV format - requires manual import and setup in Prism</div>
              ) : (
                <div>• Basic PZFX format - minimal data export</div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              onClick={onClose}
              disabled={isExporting}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`px-6 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                isExporting || !selectedExportType
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-[#8A0051] hover:bg-[#6A003F]'
              }`}
              onClick={handleExport}
              disabled={isExporting || !selectedExportType}
            >
              {isExporting ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Exporting...
                </div>
              ) : (
                selectedFormat === 'csv' ? 'Export to CSV' : 'Export to Prism'
              )}
            </button>
          </div>

          {/* Help text */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              💡 <strong>Current Status:</strong> Data exports work, but require manual analysis setup in Prism. 
              Future versions will include automatic nonlinear regression with pre-fitted curves and statistical results.
            </p>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}