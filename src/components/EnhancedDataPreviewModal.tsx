'use client';

import React, { useState, useMemo } from 'react';
import { Dialog } from '@headlessui/react';
import { EnhancedParseResult, DatasetBlockResult } from '../utils/enhancedParser';
import { DilutionPattern, ConcentrationAnalysis } from '../utils/dilutionPatterns';
import { DataBlock } from '../utils/multiDatasetDetection';
import { CellData } from '../utils/dataDetection';
import { ColumnMapping } from '../utils/flexibleParser';

interface EnhancedDataPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (selectedBlocks?: DataBlock[], customMapping?: ColumnMapping) => void;
  parseResult: EnhancedParseResult;
  rawData: any[][];
}

interface CellDisplayProps {
  cell: CellData;
  isHighlighted: boolean;
  highlightType?: 'concentration' | 'response' | 'header' | 'error' | 'pattern';
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
        case 'pattern':
          baseStyle += " bg-purple-100 border-purple-300";
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

const PatternIndicator: React.FC<{ pattern: DilutionPattern }> = ({ pattern }) => {
  const getPatternColor = (type: DilutionPattern['type']) => {
    switch (type) {
      case 'serial': return "text-blue-600 bg-blue-50";
      case 'log_scale': return "text-green-600 bg-green-50";
      case 'custom': return "text-purple-600 bg-purple-50";
      case 'linear': return "text-yellow-600 bg-yellow-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  const getPatternLabel = (pattern: DilutionPattern) => {
    switch (pattern.type) {
      case 'serial':
        return `${pattern.factor}x Serial`;
      case 'log_scale':
        return `Log${pattern.factor === 10 ? '10' : pattern.factor?.toFixed(1)} Scale`;
      case 'custom':
        return `${pattern.factor?.toFixed(2)}x Custom`;
      case 'linear':
        return 'Linear';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPatternColor(pattern.type)}`}>
      {getPatternLabel(pattern)} ({(pattern.confidence * 100).toFixed(1)}%)
    </div>
  );
};

const ConcentrationAnalysisDisplay: React.FC<{ analysis: ConcentrationAnalysis }> = ({ analysis }) => {
  if (!analysis.bestPattern) return null;

  return (
    <div className="space-y-3">
      <div>
        <h4 className="font-medium text-gray-900 mb-2">Detected Dilution Pattern</h4>
        <PatternIndicator pattern={analysis.bestPattern} />
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-gray-500">Direction</div>
          <div className="font-medium capitalize">{analysis.bestPattern.direction}</div>
        </div>
        <div>
          <div className="text-gray-500">Consistency</div>
          <div className="font-medium">{(analysis.bestPattern.consistency * 100).toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-gray-500">Concentration Range</div>
          <div className="font-medium">
            {analysis.metadata.logSpan.toFixed(1)} log units
          </div>
        </div>
        <div>
          <div className="text-gray-500">Data Points</div>
          <div className="font-medium">{analysis.metadata.pointCount}</div>
        </div>
      </div>

      {analysis.bestPattern.suggestions && analysis.bestPattern.suggestions.length > 0 && (
        <div>
          <div className="text-gray-500 text-sm mb-1">Pattern Analysis:</div>
          <ul className="text-sm text-gray-600 space-y-1">
            {analysis.bestPattern.suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start space-x-1">
                <span className="text-blue-500 mt-1">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const DatasetBlockSelector: React.FC<{
  blocks: DatasetBlockResult[];
  selectedBlocks: string[];
  onSelectionChange: (blockIds: string[]) => void;
}> = ({ blocks, selectedBlocks, onSelectionChange }) => {
  const handleBlockToggle = (blockId: string) => {
    if (selectedBlocks.includes(blockId)) {
      onSelectionChange(selectedBlocks.filter(id => id !== blockId));
    } else {
      onSelectionChange([...selectedBlocks, blockId]);
    }
  };

  const selectAll = () => {
    const recommendedIds = blocks.filter(b => b.isRecommended).map(b => b.block.id);
    onSelectionChange(recommendedIds);
  };

  const selectNone = () => {
    onSelectionChange([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Multiple Datasets Detected</h3>
        <div className="flex space-x-2">
          <button
            onClick={selectAll}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Select Recommended
          </button>
          <button
            onClick={selectNone}
            className="text-sm text-gray-600 hover:text-gray-700"
          >
            Clear All
          </button>
        </div>
      </div>

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {blocks.map((blockResult) => (
          <div
            key={blockResult.block.id}
            className={`border rounded-lg p-3 cursor-pointer transition-colors ${
              selectedBlocks.includes(blockResult.block.id)
                ? 'border-blue-300 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            } ${blockResult.isRecommended ? 'ring-2 ring-green-200' : ''}`}
            onClick={() => handleBlockToggle(blockResult.block.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedBlocks.includes(blockResult.block.id)}
                    onChange={() => handleBlockToggle(blockResult.block.id)}
                    className="rounded border-gray-300"
                  />
                  <h4 className="font-medium text-gray-900">{blockResult.block.name}</h4>
                  {blockResult.isRecommended && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Recommended
                    </span>
                  )}
                </div>
                
                <div className="mt-2 text-sm text-gray-600">
                  Location: {String.fromCharCode(65 + blockResult.block.bounds.startCol)}{blockResult.block.bounds.startRow + 1} - 
                  {String.fromCharCode(65 + blockResult.block.bounds.endCol)}{blockResult.block.bounds.endRow + 1}
                </div>
                
                <div className="mt-1 text-sm">
                  <span className="text-gray-500">Confidence: </span>
                  <span className={`font-medium ${blockResult.confidence > 0.7 ? 'text-green-600' : blockResult.confidence > 0.5 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {(blockResult.confidence * 100).toFixed(1)}%
                  </span>
                </div>

                {blockResult.block.concentrationAnalysis?.bestPattern && (
                  <div className="mt-2">
                    <PatternIndicator pattern={blockResult.block.concentrationAnalysis.bestPattern} />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function EnhancedDataPreviewModal({ 
  isOpen, 
  onClose, 
  onAccept, 
  parseResult, 
  rawData 
}: EnhancedDataPreviewModalProps) {
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
  const [showManualMapping, setShowManualMapping] = useState(false);
  const [customMapping, setCustomMapping] = useState<Partial<ColumnMapping>>({});

  // Initialize selected blocks with recommended ones
  React.useEffect(() => {
    if (parseResult.multiDatasetResults) {
      const recommendedIds = parseResult.multiDatasetResults
        .filter(r => r.isRecommended)
        .map(r => r.block.id);
      setSelectedBlocks(recommendedIds);
    }
  }, [parseResult.multiDatasetResults]);

  const isMultiDataset = parseResult.multiDatasetResults && parseResult.multiDatasetResults.length > 1;
  const canProceed = parseResult.success || parseResult.errors.filter(e => e.type === 'critical').length === 0;

  const handleAcceptWithSelection = () => {
    if (isMultiDataset && selectedBlocks.length > 0 && parseResult.multiDatasetResults) {
      const selectedBlockObjects = parseResult.multiDatasetResults
        .filter(r => selectedBlocks.includes(r.block.id))
        .map(r => r.block);
      onAccept(selectedBlockObjects);
    } else if (showManualMapping && Object.keys(customMapping).length > 0) {
      const mapping: ColumnMapping = {
        concentrationColumn: customMapping.concentrationColumn ?? parseResult.enhancedDetection.concentrationColumn,
        responseColumns: customMapping.responseColumns ?? parseResult.enhancedDetection.responseColumns,
        headerRow: customMapping.headerRow ?? parseResult.enhancedDetection.headerRow,
        dataStartRow: customMapping.dataStartRow ?? parseResult.enhancedDetection.dataStartRow
      };
      onAccept(undefined, mapping);
    } else {
      onAccept();
    }
  };

  const getRecommendedActionText = () => {
    switch (parseResult.recommendedAction) {
      case 'single_import':
        return 'Ready to import single dataset';
      case 'multi_select':
        return 'Select datasets to import';
      case 'manual_review':
        return 'Manual review required';
      case 'retry_format':
        return 'Consider reformatting data';
      default:
        return 'Review and proceed';
    }
  };

  const getRecommendedActionColor = () => {
    switch (parseResult.recommendedAction) {
      case 'single_import':
        return 'text-green-600 bg-green-50';
      case 'multi_select':
        return 'text-blue-600 bg-blue-50';
      case 'manual_review':
        return 'text-yellow-600 bg-yellow-50';
      case 'retry_format':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-6xl w-full bg-white rounded-lg shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-200">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Enhanced Data Import Preview
            </Dialog.Title>
            <div className="flex items-center justify-between mt-2">
              <p className="text-sm text-gray-600">
                Pattern-based detection with dilution analysis
              </p>
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRecommendedActionColor()}`}>
                {getRecommendedActionText()}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6 space-y-6">
            {/* Detection Method and Confidence */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Enhanced Detection Results</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Detection Method</div>
                  <div className="font-medium capitalize">{parseResult.enhancedDetection.detectionMethod}</div>
                </div>
                <div>
                  <div className="text-gray-500">Pattern Confidence</div>
                  <div className="font-medium">{(parseResult.enhancedDetection.patternBasedConfidence * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-gray-500">Keyword Confidence</div>
                  <div className="font-medium">{(parseResult.enhancedDetection.keywordBasedConfidence * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-gray-500">Overall Confidence</div>
                  <div className="font-medium">{(parseResult.enhancedDetection.confidence * 100).toFixed(1)}%</div>
                </div>
              </div>
            </div>

            {/* Concentration Analysis */}
            {parseResult.concentrationAnalysis && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">Concentration Pattern Analysis</h3>
                <ConcentrationAnalysisDisplay analysis={parseResult.concentrationAnalysis} />
              </div>
            )}

            {/* Multi-Dataset Selection */}
            {isMultiDataset && parseResult.multiDatasetResults && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <DatasetBlockSelector
                  blocks={parseResult.multiDatasetResults}
                  selectedBlocks={selectedBlocks}
                  onSelectionChange={setSelectedBlocks}
                />
              </div>
            )}

            {/* Issues & Warnings */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Issues & Warnings</h3>
              <div className="space-y-2">
                {parseResult.errors.map((error, index) => (
                  <div key={`error-${index}`} className="flex items-start space-x-2 text-red-600 text-sm">
                    <span className="text-red-500 mt-0.5">⚠</span>
                    <div>
                      <div className="font-medium">{error.message}</div>
                      {error.suggestion && (
                        <div className="text-red-500 text-xs mt-1">
                          Suggestion: {error.suggestion}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {parseResult.warnings.map((warning, index) => (
                  <div key={`warning-${index}`} className="flex items-start space-x-2 text-yellow-600 text-sm">
                    <span className="text-yellow-500 mt-0.5">⚠</span>
                    <div>{warning.message}</div>
                  </div>
                ))}

                {parseResult.errors.length === 0 && parseResult.warnings.length === 0 && (
                  <div className="text-green-600 text-sm">
                    ✓ No issues detected
                  </div>
                )}
              </div>
            </div>

            {/* Import Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Import Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Data Rows</div>
                  <div className="font-medium">{parseResult.metadata.dataRows}</div>
                </div>
                <div>
                  <div className="text-gray-500">Response Columns</div>
                  <div className="font-medium">{parseResult.metadata.responseColumns}</div>
                </div>
                <div>
                  <div className="text-gray-500">Detected Blocks</div>
                  <div className="font-medium">
                    {parseResult.multiDatasetResults?.length || 1}
                  </div>
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
              {!canProceed && !isMultiDataset && (
                <button
                  onClick={() => setShowManualMapping(!showManualMapping)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Manual Mapping
                </button>
              )}
              
              <button
                onClick={handleAcceptWithSelection}
                disabled={!canProceed && (!isMultiDataset || selectedBlocks.length === 0) && !showManualMapping}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  canProceed || (isMultiDataset && selectedBlocks.length > 0) || showManualMapping
                    ? 'text-white bg-[#8A0051] hover:bg-[#6A003F]'
                    : 'text-gray-400 bg-gray-200 cursor-not-allowed'
                }`}
              >
                {isMultiDataset && selectedBlocks.length > 0 
                  ? `Import ${selectedBlocks.length} Dataset${selectedBlocks.length !== 1 ? 's' : ''}`
                  : 'Import Data'
                }
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}