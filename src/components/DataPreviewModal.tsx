'use client';

import React, { useState, useMemo } from 'react';
import { Dialog } from '@headlessui/react';
import { DetectionResult, CellData, DatasetDetection, DilutionPatternInfo } from '../utils/dataDetection';
import { ParseResult, ParseError, ParseWarning, ColumnMapping, DatasetParseResult } from '../utils/flexibleParser';

interface DataPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (customMapping?: ColumnMapping, selectedDatasetIds?: string[]) => void;
  parseResult: ParseResult;
  rawData: any[][];
}

interface CellDisplayProps {
  cell: CellData;
  isHighlighted: boolean;
  highlightType?: 'concentration' | 'response' | 'header' | 'error';
}

const CellDisplay: React.FC<CellDisplayProps> = ({ cell, isHighlighted, highlightType }) => {
  const getCellStyle = () => {
    let baseStyle = "px-2 py-1 text-xs border-r border-b border-gray-200 min-w-[80px] max-w-[120px] truncate";
    
    if (isHighlighted) {
      switch (highlightType) {
        case 'concentration':
          baseStyle += " bg-blue-100 border-blue-300";
          break;
        case 'response':
          baseStyle += " bg-green-100 border-green-300";
          break;
        case 'header':
          baseStyle += " bg-yellow-100 border-yellow-300 font-medium";
          break;
        case 'error':
          baseStyle += " bg-red-100 border-red-300";
          break;
        default:
          baseStyle += " bg-gray-100";
      }
    }
    
    if (cell.type === 'empty') {
      baseStyle += " bg-gray-50 text-gray-400";
    }
    
    return baseStyle;
  };

  const displayValue = cell.value === null || cell.value === undefined || cell.value === '' 
    ? '(empty)' 
    : String(cell.value);

  return (
    <div 
      className={getCellStyle()}
      title={`Type: ${cell.type}, Value: ${displayValue}, Row: ${cell.row + 1}, Col: ${cell.column + 1}`}
    >
      {displayValue}
    </div>
  );
};

const ConfidenceIndicator: React.FC<{ confidence: number }> = ({ confidence }) => {
  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) return "text-green-600 bg-green-50";
    if (conf >= 0.6) return "text-yellow-600 bg-yellow-50";
    if (conf >= 0.4) return "text-orange-600 bg-orange-50";
    return "text-red-600 bg-red-50";
  };

  const getConfidenceText = (conf: number) => {
    if (conf >= 0.8) return "High";
    if (conf >= 0.6) return "Medium";
    if (conf >= 0.4) return "Low";
    return "Very Low";
  };

  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(confidence)}`}>
      {getConfidenceText(confidence)} ({(confidence * 100).toFixed(1)}%)
    </div>
  );
};

const IssueDisplay: React.FC<{ errors: ParseError[]; warnings: ParseWarning[] }> = ({ errors, warnings }) => {
  if (errors.length === 0 && warnings.length === 0) {
    return (
      <div className="text-green-600 text-sm">
        ✓ No issues detected
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {errors.map((error, index) => (
        <div key={`error-${index}`} className="flex items-start space-x-2 text-red-600 text-sm">
          <span className="text-red-500 mt-0.5">⚠</span>
          <div>
            <div className="font-medium">{error.message}</div>
            {error.suggestion && (
              <div className="text-red-500 text-xs mt-1">
                Suggestion: {error.suggestion}
              </div>
            )}
            {(error.row !== undefined || error.column !== undefined) && (
              <div className="text-red-400 text-xs">
                Location: Row {(error.row || 0) + 1}, Column {(error.column || 0) + 1}
              </div>
            )}
          </div>
        </div>
      ))}
      
      {warnings.map((warning, index) => (
        <div key={`warning-${index}`} className="flex items-start space-x-2 text-yellow-600 text-sm">
          <span className="text-yellow-500 mt-0.5">⚠</span>
          <div>
            <div>{warning.message}</div>
            {(warning.row !== undefined || warning.column !== undefined) && (
              <div className="text-yellow-500 text-xs">
                Location: Row {(warning.row || 0) + 1}, Column {(warning.column || 0) + 1}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const DilutionPatternDisplay: React.FC<{ pattern: DilutionPatternInfo }> = ({ pattern }) => {
  const getPatternIcon = (type: DilutionPatternInfo['type']) => {
    switch (type) {
      case 'serial': return '📉';
      case 'log-scale': return '📊';
      case 'half-log': return '📈';
      case 'custom': return '🔧';
      case 'irregular': return '⚠️';
      default: return '❓';
    }
  };

  const getPatternDescription = (type: DilutionPatternInfo['type'], factor?: number) => {
    switch (type) {
      case 'serial': return `${factor?.toFixed(1)}x serial dilution`;
      case 'log-scale': return 'Log-scale (10-fold) dilution';
      case 'half-log': return 'Half-log (√10-fold) dilution';
      case 'custom': return `${factor?.toFixed(1)}x custom dilution`;
      case 'irregular': return 'Irregular pattern';
      default: return 'Unknown pattern';
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
      <div className="flex items-center space-x-2 mb-2">
        <span className="text-lg">{getPatternIcon(pattern.type)}</span>
        <h4 className="font-medium text-blue-900">Dilution Pattern Analysis</h4>
        <ConfidenceIndicator confidence={pattern.confidence} />
      </div>
      
      <div className="text-sm text-blue-800 space-y-1">
        <div><strong>Pattern:</strong> {getPatternDescription(pattern.type, pattern.factor)}</div>
        <div><strong>Detected ratio:</strong> {pattern.detectedRatio.toFixed(2)}</div>
        <div><strong>Consistency:</strong> {(pattern.patternConsistency * 100).toFixed(1)}%</div>
        <div><strong>Range:</strong> {pattern.concentrationRange.min.toExponential(2)} - {pattern.concentrationRange.max.toExponential(2)} ({pattern.concentrationRange.orderOfMagnitude.toFixed(1)} orders)</div>
        
        {pattern.missingPoints.length > 0 && (
          <div className="text-yellow-700">
            <strong>Missing points:</strong> {pattern.missingPoints.length} expected concentration(s)
          </div>
        )}
        
        {pattern.irregularities.length > 0 && (
          <div className="text-orange-700 mt-2">
            <strong>Irregularities:</strong>
            <ul className="list-disc list-inside ml-2">
              {pattern.irregularities.map((irregularity, index) => (
                <li key={index} className="text-xs">{irregularity}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

const MultiDatasetSelector: React.FC<{
  datasets: DatasetDetection[];
  selectedIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
  activeTab: string | null;
  onTabChange: (datasetId: string) => void;
}> = ({ datasets, selectedIds, onSelectionChange, activeTab, onTabChange }) => {
  const handleDatasetToggle = (datasetId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(datasetId)) {
      newSelected.delete(datasetId);
    } else {
      newSelected.add(datasetId);
    }
    onSelectionChange(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === datasets.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(datasets.map(d => d.id)));
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900">Multiple Datasets Detected</h3>
        <button
          onClick={handleSelectAll}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          {selectedIds.size === datasets.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>
      
      <div className="space-y-3">
        {datasets.map((dataset) => (
          <div key={dataset.id} className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(dataset.id)}
                  onChange={() => handleDatasetToggle(dataset.id)}
                  className="rounded border-gray-300 text-[#8A0051] focus:ring-[#8A0051]"
                />
                <div>
                  <div className="font-medium text-gray-900">{dataset.name}</div>
                  <div className="text-sm text-gray-500">
                    {dataset.responseColumns.length} samples, {dataset.dataEndRow - dataset.dataStartRow} data points
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <ConfidenceIndicator confidence={dataset.confidence} />
                <button
                  onClick={() => onTabChange(dataset.id)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {activeTab === dataset.id ? 'Hide Preview' : 'Preview'}
                </button>
              </div>
            </div>
            
            {dataset.dilutionPattern && (
              <div className="mt-2">
                <DilutionPatternDisplay pattern={dataset.dilutionPattern} />
              </div>
            )}
            
            {dataset.issues.length > 0 && (
              <div className="mt-2">
                <IssueDisplay 
                  errors={dataset.issues.filter(i => i.type === 'error').map(i => ({ 
                    type: 'critical' as const, 
                    message: i.message, 
                    suggestion: i.suggestion 
                  }))} 
                  warnings={dataset.issues.filter(i => i.type === 'warning').map(i => ({ 
                    message: i.message, 
                    impact: 'medium' as const 
                  }))} 
                />
              </div>
            )}
          </div>
        ))}
      </div>
      
      {selectedIds.size > 1 && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-blue-800">
            <strong>{selectedIds.size} datasets selected.</strong> They can be imported separately or merged into a single dataset.
          </div>
        </div>
      )}
    </div>
  );
};

export default function DataPreviewModal({ 
  isOpen, 
  onClose, 
  onAccept, 
  parseResult, 
  rawData 
}: DataPreviewModalProps) {
  const [showManualMapping, setShowManualMapping] = useState(false);
  const [customMapping, setCustomMapping] = useState<Partial<ColumnMapping>>({});
  const [selectedDatasetIds, setSelectedDatasetIds] = useState<Set<string>>(new Set());
  const [activeDatasetTab, setActiveDatasetTab] = useState<string | null>(null);

  // Prepare preview data with highlighting
  const previewData = useMemo(() => {
    if (!parseResult.detection.preview) return [];
    
    return parseResult.detection.preview.slice(0, 10); // Show first 10 rows
  }, [parseResult.detection.preview]);

  const getCellHighlight = (cell: CellData): { isHighlighted: boolean; type?: 'concentration' | 'response' | 'header' | 'error' } => {
    const detection = parseResult.detection;
    
    // Header row highlighting
    if (cell.row === detection.headerRow) {
      return { isHighlighted: true, type: 'header' };
    }
    
    // Concentration column highlighting
    if (cell.column === detection.concentrationColumn && cell.row >= detection.dataStartRow) {
      return { isHighlighted: true, type: 'concentration' };
    }
    
    // Response columns highlighting
    if (detection.responseColumns.includes(cell.column) && cell.row >= detection.dataStartRow) {
      return { isHighlighted: true, type: 'response' };
    }
    
    // Error highlighting (cells with issues)
    const hasError = parseResult.errors.some(error => 
      error.row === cell.row && error.column === cell.column
    );
    if (hasError) {
      return { isHighlighted: true, type: 'error' };
    }
    
    return { isHighlighted: false };
  };

  const handleManualMappingChange = (field: keyof ColumnMapping, value: any) => {
    setCustomMapping(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAcceptWithMapping = () => {
    const selectedIds = Array.from(selectedDatasetIds);
    
    if (showManualMapping && Object.keys(customMapping).length > 0) {
      const mapping: ColumnMapping = {
        concentrationColumn: customMapping.concentrationColumn ?? parseResult.detection.concentrationColumn,
        responseColumns: customMapping.responseColumns ?? parseResult.detection.responseColumns,
        headerRow: customMapping.headerRow ?? parseResult.detection.headerRow,
        dataStartRow: customMapping.dataStartRow ?? parseResult.detection.dataStartRow
      };
      onAccept(mapping, selectedIds);
    } else {
      onAccept(undefined, selectedIds);
    }
  };

  const canProceed = parseResult.success || parseResult.errors.filter(e => e.type === 'critical').length === 0;
  const hasMultipleDatasets = parseResult.detection.multipleDatasets && parseResult.detection.multipleDatasets.length > 1;
  const canImport = canProceed || showManualMapping || (hasMultipleDatasets && selectedDatasetIds.size > 0);

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-6xl w-full bg-white rounded-lg shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-200">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Data Import Preview
            </Dialog.Title>
            <p className="text-sm text-gray-600 mt-1">
              Review the detected data structure and resolve any issues before importing
            </p>
          </div>

          <div className="flex-1 overflow-auto p-6 space-y-6">
            {/* Multiple Datasets Section */}
            {parseResult.detection.multipleDatasets && parseResult.detection.multipleDatasets.length > 1 && (
              <MultiDatasetSelector
                datasets={parseResult.detection.multipleDatasets}
                selectedIds={selectedDatasetIds}
                onSelectionChange={setSelectedDatasetIds}
                activeTab={activeDatasetTab}
                onTabChange={(id) => setActiveDatasetTab(activeDatasetTab === id ? null : id)}
              />
            )}

            {/* Detection Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">
                {parseResult.detection.multipleDatasets && parseResult.detection.multipleDatasets.length > 1 
                  ? 'Primary Dataset Summary' 
                  : 'Detection Summary'}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Confidence</div>
                  <ConfidenceIndicator confidence={parseResult.detection.confidence} />
                </div>
                <div>
                  <div className="text-gray-500">Header Row</div>
                  <div className="font-medium">{parseResult.detection.headerRow + 1}</div>
                </div>
                <div>
                  <div className="text-gray-500">Concentration Column</div>
                  <div className="font-medium">
                    {String.fromCharCode(65 + parseResult.detection.concentrationColumn)} 
                    ({parseResult.detection.concentrationColumn + 1})
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Response Columns</div>
                  <div className="font-medium">{parseResult.detection.responseColumns.length}</div>
                </div>
              </div>
              
              {/* Pattern Analysis for Single Dataset */}
              {parseResult.detection.dilutionPattern && 
               (!parseResult.detection.multipleDatasets || parseResult.detection.multipleDatasets.length <= 1) && (
                <div className="mt-4">
                  <DilutionPatternDisplay pattern={parseResult.detection.dilutionPattern} />
                </div>
              )}
            </div>

            {/* Issues */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Issues & Warnings</h3>
              <IssueDisplay errors={parseResult.errors} warnings={parseResult.warnings} />
            </div>

            {/* Data Preview */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">Data Preview</h3>
                <div className="flex items-center space-x-4 text-xs">
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-yellow-100 border border-yellow-300"></div>
                    <span>Header</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-blue-100 border border-blue-300"></div>
                    <span>Concentration</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-green-100 border border-green-300"></div>
                    <span>Response</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-red-100 border border-red-300"></div>
                    <span>Error</span>
                  </div>
                </div>
              </div>
              
              <div className="overflow-auto max-h-64 border border-gray-200 rounded">
                <div className="grid grid-flow-col auto-cols-max">
                  {previewData.map((row, rowIndex) => (
                    <div key={rowIndex} className="grid grid-flow-row">
                      {row.map((cell, cellIndex) => {
                        const highlight = getCellHighlight(cell);
                        return (
                          <CellDisplay
                            key={`${rowIndex}-${cellIndex}`}
                            cell={cell}
                            isHighlighted={highlight.isHighlighted}
                            highlightType={highlight.type}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              
              {rawData.length > 10 && (
                <p className="text-xs text-gray-500 mt-2">
                  Showing first 10 rows of {rawData.length} total rows
                </p>
              )}
            </div>

            {/* Manual Mapping Option */}
            {!canProceed && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">Manual Configuration</h3>
                  <button
                    onClick={() => setShowManualMapping(!showManualMapping)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {showManualMapping ? 'Hide' : 'Show'} Manual Mapping
                  </button>
                </div>
                
                {showManualMapping && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      If automatic detection failed, you can manually specify the column mapping:
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Header Row (1-based)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={(customMapping.headerRow ?? parseResult.detection.headerRow) + 1}
                          onChange={(e) => handleManualMappingChange('headerRow', parseInt(e.target.value) - 1)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Concentration Column (1-based)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={(customMapping.concentrationColumn ?? parseResult.detection.concentrationColumn) + 1}
                          onChange={(e) => handleManualMappingChange('concentrationColumn', parseInt(e.target.value) - 1)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Response Columns (comma-separated, 1-based)
                      </label>
                      <input
                        type="text"
                        value={(customMapping.responseColumns ?? parseResult.detection.responseColumns)
                          .map(col => col + 1).join(', ')}
                        onChange={(e) => {
                          const values = e.target.value.split(',').map(v => parseInt(v.trim()) - 1).filter(v => !isNaN(v));
                          handleManualMappingChange('responseColumns', values);
                        }}
                        placeholder="e.g., 2, 3, 4"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Metadata */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Import Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Total Rows</div>
                  <div className="font-medium">{parseResult.metadata.totalRows}</div>
                </div>
                <div>
                  <div className="text-gray-500">Data Rows</div>
                  <div className="font-medium">{parseResult.metadata.dataRows}</div>
                </div>
                <div>
                  <div className="text-gray-500">Response Columns</div>
                  <div className="font-medium">{parseResult.metadata.responseColumns}</div>
                </div>
                <div>
                  <div className="text-gray-500">Processing Time</div>
                  <div className="font-medium">{parseResult.metadata.processingTime.toFixed(1)}ms</div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            
            <div className="flex items-center space-x-3">
              {!canImport && (
                <div className="text-sm text-red-600">
                  {hasMultipleDatasets && selectedDatasetIds.size === 0 
                    ? 'Select at least one dataset to import'
                    : 'Cannot proceed due to critical errors'}
                </div>
              )}
              
              {hasMultipleDatasets && selectedDatasetIds.size > 0 && (
                <div className="text-sm text-gray-600">
                  {selectedDatasetIds.size} dataset(s) selected
                </div>
              )}
              
              <button
                onClick={handleAcceptWithMapping}
                disabled={!canImport}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  canImport
                    ? 'text-white bg-[#8A0051] hover:bg-[#6A003F]'
                    : 'text-gray-400 bg-gray-200 cursor-not-allowed'
                }`}
              >
                Import Data
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}