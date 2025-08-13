'use client';

import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { DataPoint, Dataset, FittedCurve } from '../types';
import { getPrismExportOptions } from '../utils/prismExport';
import { exportToSimplePrism, SimplePrismExportOptions } from '../utils/prismExportSimple';
import { exportWithActualTemplate, ActualTemplateOptions, replaceDataInActualTemplate } from '../utils/actualTemplateExport';

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
  const [selectedFormat, setSelectedFormat] = useState<'basic-pzfx' | 'template-based'>('template-based');
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [useBuiltInTemplate, setUseBuiltInTemplate] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState(false);

  // Determine available export options (only needed for basic export)
  const availableOptions = datasets.length > 0 
    ? getPrismExportOptions(datasets[0]?.data || [])
    : getPrismExportOptions(currentData);

  // Set default export type when modal opens (only for basic export)
  React.useEffect(() => {
    if (isOpen && selectedFormat === 'basic-pzfx' && availableOptions.options.length > 0 && !selectedExportType) {
      if (hasReplicates) {
        setSelectedExportType('with_replicates_mean');
      } else {
        setSelectedExportType('raw_and_edited');
      }
    }
  }, [isOpen, selectedFormat, availableOptions, hasReplicates, selectedExportType]);

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
    // Validation: template-based needs template file if custom, basic needs export type
    if (isExporting) return;
    
    if (selectedFormat === 'template-based') {
      if (!useBuiltInTemplate && !templateFile) {
        alert('Please upload a template file or use the built-in template.');
        return;
      }
    } else if (selectedFormat === 'basic-pzfx') {
      if (!selectedExportType) {
        alert('Please select an export type for basic export.');
        return;
      }
    } else {
      return; // Unknown format
    }

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

      if (selectedFormat === 'template-based') {
        // Export using template-based approach
        if (!useBuiltInTemplate && templateFile) {
          // User uploaded their own template
          const reader = new FileReader();
          reader.onload = async (e) => {
            const templateContent = e.target?.result as string;
            const modifiedTemplate = replaceDataInActualTemplate(
              { datasets: baseDatasets, editedDataByDataset: baseEditedData },
              templateContent
            );
            
            // Download the modified template
            const blob = new Blob([modifiedTemplate], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const timestamp = new Date().toISOString().split('T')[0];
            const datasetName = baseDatasets[0]?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'data';
            link.download = `${datasetName}_from_custom_template_${timestamp}.pzfx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            alert(`✅ Template-Based Export Complete!

Your data has been inserted into your custom template.
All analysis settings and graph configurations are preserved.`);
          };
          reader.readAsText(templateFile);
        } else {
          // Use built-in template
          const templateOptions: ActualTemplateOptions = {
            datasets: baseDatasets,
            editedDataByDataset: baseEditedData
          };
          await exportWithActualTemplate(templateOptions);
        }
      } else {
        // Basic data-only export
        const simpleExportOptions: SimplePrismExportOptions = {
          datasets: baseDatasets,
          editedDataByDataset: baseEditedData,
          exportType: selectedExportType as 'raw_and_edited' | 'with_replicates_mean' | 'with_replicates_individual'
        };
        await exportToSimplePrism(simpleExportOptions);
        
        alert(`✅ Basic Prism Export Complete!

📊 To analyze your data in GraphPad Prism:

1. Open the exported .pzfx file
2. Select your data table
3. Click "Analyze" → "XY analyses" → "Nonlinear regression"
4. Choose "log(agonist) vs. response -- Variable slope"
5. Click OK to run the analysis`);
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
              Choose your export method:
            </p>

            {/* Simplified Format Selection */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="space-y-3">
                <label className="flex items-start p-3 border rounded-lg cursor-pointer transition-colors hover:bg-white">
                  <input
                    type="radio"
                    name="format"
                    value="template-based"
                    checked={selectedFormat === 'template-based'}
                    onChange={(e) => setSelectedFormat(e.target.value as 'template-based')}
                    className="mt-1 mr-3 text-[#8A0051] focus:ring-[#8A0051]"
                  />
                  <div>
                    <span className="font-medium text-green-700">📊 Template-Based Export (Recommended)</span>
                    <p className="text-sm text-gray-600">Preserves all analysis settings and graph configurations</p>
                  </div>
                </label>
                <label className="flex items-start p-3 border rounded-lg cursor-pointer transition-colors hover:bg-white">
                  <input
                    type="radio"
                    name="format"
                    value="basic-pzfx"
                    checked={selectedFormat === 'basic-pzfx'}
                    onChange={(e) => setSelectedFormat(e.target.value as 'basic-pzfx')}
                    className="mt-1 mr-3 text-[#8A0051] focus:ring-[#8A0051]"
                  />
                  <div>
                    <span className="font-medium text-gray-700">📄 Basic Data Export</span>
                    <p className="text-sm text-gray-600">Simple data table - requires manual analysis setup in Prism</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Template Options - only show when template-based is selected */}
            {selectedFormat === 'template-based' && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Template Options:</h4>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={useBuiltInTemplate}
                      onChange={() => setUseBuiltInTemplate(true)}
                      className="mr-2 text-[#8A0051] focus:ring-[#8A0051]"
                    />
                    <div>
                      <span className="font-medium">Use Built-in Template</span>
                      <p className="text-sm text-gray-600">Standard dose-response template (supports up to 3 datasets, 6 samples each)</p>
                    </div>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={!useBuiltInTemplate}
                      onChange={() => setUseBuiltInTemplate(false)}
                      className="mr-2 text-[#8A0051] focus:ring-[#8A0051]"
                    />
                    <div>
                      <span className="font-medium">Upload Custom Template</span>
                      <p className="text-sm text-gray-600">Use your own Prism template file (.pzfx)</p>
                    </div>
                  </label>
                  
                  {!useBuiltInTemplate && (
                    <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                      <input
                        type="file"
                        accept=".pzfx"
                        onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
                        className="text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#8A0051] file:text-white hover:file:bg-[#6A003F]"
                      />
                      {templateFile && (
                        <p className="mt-2 text-sm text-green-600">✓ {templateFile.name}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Export Type Options - only show when basic-pzfx is selected */}
            {selectedFormat === 'basic-pzfx' && (
              <div className="mb-6 p-4 bg-orange-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Data Organization:</h4>
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
              </div>
            )}

          </div>

          {/* Preview of what will be exported */}
          <div className="mb-6 p-3 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Export Preview:</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>• {datasets.length || 1} dataset{(datasets.length || 1) !== 1 ? 's' : ''}</div>
              <div>• {hasReplicates ? 'Contains replicate data' : 'Individual data points only'}</div>
              {selectedFormat === 'template-based' ? (
                <div>
                  {useBuiltInTemplate ? (
                    <>
                      • <strong>Built-in template with your data (.pzfx)</strong>
                      <br />• Supports up to 3 datasets
                      <br />• Up to 6 samples per dataset
                      <br />• Pre-configured dose-response analysis
                      <br />• Professional graph formatting
                    </>
                  ) : templateFile ? (
                    <>
                      • <strong>Your custom template: {templateFile.name}</strong>
                      <br />• Preserves all your analysis settings
                      <br />• Maintains your graph configurations
                      <br />• Replaces only the data values
                    </>
                  ) : (
                    <>• Please upload a template file</>
                  )}
                </div>
              ) : (
                <div>
                  • <strong>Basic data export (.pzfx)</strong>
                  <br />• Simple XY data table
                  <br />• Concentration and response columns
                  <br />• Requires manual analysis setup in Prism
                  {selectedExportType && (
                    <>
                      <br />• Export type: {exportOptions.find(opt => opt.value === selectedExportType)?.label}
                    </>
                  )}
                </div>
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
              disabled={isExporting || (selectedFormat === 'template-based' && !useBuiltInTemplate && !templateFile) || (selectedFormat === 'basic-pzfx' && !selectedExportType)}
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
                'Export to Prism'
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