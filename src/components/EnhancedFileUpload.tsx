'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { DataPoint, Dataset } from '../types';
import { parseExcelData, ParseResult, ParseOptions, ColumnMapping } from '../utils/flexibleParser';
import DataPreviewModal from './DataPreviewModal';

interface EnhancedFileUploadProps {
  onDataUpload: (data: DataPoint[]) => void;
  onMultipleDatasetsUpload?: (datasets: Dataset[]) => void;
}

interface ProcessedSheet {
  name: string;
  parseResult: ParseResult;
  rawData: any[][];
}

export default function EnhancedFileUpload({ onDataUpload, onMultipleDatasetsUpload }: EnhancedFileUploadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processedSheets, setProcessedSheets] = useState<ProcessedSheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<ProcessedSheet | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [parseOptions, setParseOptions] = useState<ParseOptions>({
    autoConvertUnits: true,
    skipEmptyRows: true,
    ignoreErrors: false,
    forceParsing: false
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setProcessedSheets([]);
    setSelectedSheet(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      const sheets: ProcessedSheet[] = [];

      for (const sheetName of workbook.SheetNames) {
        try {
          const worksheet = workbook.Sheets[sheetName];
          const rawData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            defval: null,
            raw: false // Keep formatting for better detection
          }) as any[][];

          // Skip empty sheets
          if (rawData.length === 0 || rawData.every(row => !row || row.length === 0)) {
            continue;
          }

          // Parse the sheet data
          const parseResult = await parseExcelData(rawData, parseOptions);
          
          sheets.push({
            name: sheetName,
            parseResult,
            rawData
          });
        } catch (error) {
          console.error(`Failed to process sheet ${sheetName}:`, error);
          // Continue processing other sheets
        }
      }

      setProcessedSheets(sheets);

      // Auto-select the best sheet if only one valid sheet
      if (sheets.length === 1) {
        setSelectedSheet(sheets[0]);
        setShowPreview(true);
      } else if (sheets.length === 0) {
        setError('No valid data sheets found in the Excel file');
      }

    } catch (error) {
      console.error('File processing error:', error);
      setError(`Failed to read Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSheetSelect = (sheet: ProcessedSheet) => {
    setSelectedSheet(sheet);
    setShowPreview(true);
  };

  const handlePreviewAccept = async (customMapping?: ColumnMapping) => {
    if (!selectedSheet) return;

    try {
      setIsLoading(true);

      // Reparse with custom mapping if provided
      let finalParseResult = selectedSheet.parseResult;
      if (customMapping) {
        const newOptions: ParseOptions = {
          ...parseOptions,
          customMapping,
          forceParsing: true
        };
        finalParseResult = await parseExcelData(selectedSheet.rawData, newOptions);
      }

      if (!finalParseResult.success && !parseOptions.forceParsing) {
        setError('Failed to parse data with current settings');
        return;
      }

      // Handle single vs multiple datasets
      if (processedSheets.length === 1 || finalParseResult.datasets.length === 1) {
        // Single dataset
        if (finalParseResult.data.length > 0) {
          onDataUpload(finalParseResult.data);
        } else if (finalParseResult.datasets.length > 0) {
          onDataUpload(finalParseResult.datasets[0].data);
        }
      } else {
        // Multiple datasets
        if (onMultipleDatasetsUpload) {
          // Parse all successful sheets
          const allDatasets: Dataset[] = [];
          
          for (const sheet of processedSheets) {
            if (sheet.parseResult.success && sheet.parseResult.datasets.length > 0) {
              const dataset = sheet.parseResult.datasets[0];
              dataset.name = sheet.name;
              dataset.sheetName = sheet.name;
              allDatasets.push(dataset);
            }
          }
          
          onMultipleDatasetsUpload(allDatasets);
        }
      }

      // Reset state
      setShowPreview(false);
      setSelectedSheet(null);
      setProcessedSheets([]);
      
    } catch (error) {
      setError(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleParseOptionsChange = (key: keyof ParseOptions, value: any) => {
    setParseOptions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const getSheetStatusIcon = (parseResult: ParseResult) => {
    if (parseResult.success) {
      return <span className="text-green-500">✓</span>;
    } else if (parseResult.errors.filter(e => e.type === 'critical').length === 0) {
      return <span className="text-yellow-500">⚠</span>;
    } else {
      return <span className="text-red-500">✗</span>;
    }
  };

  const getSheetStatusText = (parseResult: ParseResult) => {
    if (parseResult.success) {
      return 'Ready to import';
    } else if (parseResult.errors.filter(e => e.type === 'critical').length === 0) {
      return 'Warnings detected';
    } else {
      return 'Errors detected';
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Upload Excel File</h2>
      
      {/* File Upload Area */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
        <input
          type="file"
          accept=".xls,.xlsx"
          onChange={handleFileUpload}
          disabled={isLoading}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className={`cursor-pointer ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="space-y-2">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div className="text-sm text-gray-600">
              {isLoading ? (
                <span className="flex items-center justify-center space-x-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  <span>Processing file...</span>
                </span>
              ) : (
                <>
                  <span className="font-medium text-[#8A0051]">Click to upload</span> or drag and drop
                  <br />
                  <span className="text-xs">Excel files (.xls, .xlsx)</span>
                </>
              )}
            </div>
          </div>
        </label>
      </div>

      {/* Parse Options */}
      <div className="mt-4 bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Import Options</h3>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={parseOptions.autoConvertUnits}
              onChange={(e) => handleParseOptionsChange('autoConvertUnits', e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-600">Auto-convert concentration units</span>
          </label>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={parseOptions.skipEmptyRows}
              onChange={(e) => handleParseOptionsChange('skipEmptyRows', e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-600">Skip empty rows</span>
          </label>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={parseOptions.ignoreErrors}
              onChange={(e) => handleParseOptionsChange('ignoreErrors', e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-600">Continue despite errors</span>
          </label>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={parseOptions.forceParsing}
              onChange={(e) => handleParseOptionsChange('forceParsing', e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-600">Force parsing (ignore confidence)</span>
          </label>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <span className="text-red-500 mt-0.5">⚠</span>
            <div>
              <div className="text-red-700 font-medium">Import Error</div>
              <div className="text-red-600 text-sm mt-1">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Sheet Selection */}
      {processedSheets.length > 1 && (
        <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Multiple Sheets Detected</h3>
          <div className="space-y-2">
            {processedSheets.map((sheet, index) => (
              <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-3">
                  {getSheetStatusIcon(sheet.parseResult)}
                  <div>
                    <div className="font-medium text-gray-900">{sheet.name}</div>
                    <div className="text-sm text-gray-500">
                      {sheet.parseResult.metadata.dataRows} rows, {sheet.parseResult.metadata.responseColumns} response columns
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">{getSheetStatusText(sheet.parseResult)}</span>
                  <button
                    onClick={() => handleSheetSelect(sheet)}
                    className="px-3 py-1 text-sm text-[#8A0051] border border-[#8A0051] rounded hover:bg-[#8A0051] hover:text-white transition-colors"
                  >
                    Preview
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          {processedSheets.filter(s => s.parseResult.success).length > 1 && onMultipleDatasetsUpload && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <button
                onClick={() => {
                  // Import all successful sheets
                  const allDatasets = processedSheets
                    .filter(s => s.parseResult.success)
                    .map(s => ({
                      ...s.parseResult.datasets[0],
                      name: s.name,
                      sheetName: s.name
                    }));
                  onMultipleDatasetsUpload(allDatasets);
                  setProcessedSheets([]);
                }}
                className="w-full px-4 py-2 bg-[#8A0051] text-white rounded-lg hover:bg-[#6A003F] transition-colors"
              >
                Import All Valid Sheets ({processedSheets.filter(s => s.parseResult.success).length})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Single Sheet Preview */}
      {processedSheets.length === 1 && (
        <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getSheetStatusIcon(processedSheets[0].parseResult)}
              <div>
                <div className="font-medium text-gray-900">{processedSheets[0].name}</div>
                <div className="text-sm text-gray-500">
                  {processedSheets[0].parseResult.metadata.dataRows} rows, {processedSheets[0].parseResult.metadata.responseColumns} response columns
                </div>
              </div>
            </div>
            <button
              onClick={() => handleSheetSelect(processedSheets[0])}
              className="px-4 py-2 bg-[#8A0051] text-white rounded-lg hover:bg-[#6A003F] transition-colors"
            >
              Preview & Import
            </button>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && selectedSheet && (
        <DataPreviewModal
          isOpen={showPreview}
          onClose={() => {
            setShowPreview(false);
            setSelectedSheet(null);
          }}
          onAccept={handlePreviewAccept}
          parseResult={selectedSheet.parseResult}
          rawData={selectedSheet.rawData}
        />
      )}
    </div>
  );
}