'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { WorkbookData, SheetPreview, SpreadsheetData, MultiSheetSelection, SheetPatternComparison } from '../types';
import { FileSpreadsheet, ChevronRight, Eye, BarChart3, CheckSquare, Square, Layers } from 'lucide-react';

interface SheetSelectorProps {
  workbookData: WorkbookData;
  onSheetSelected: (spreadsheetData: SpreadsheetData) => void;
  onMultipleSheetsSelected?: (selection: MultiSheetSelection, workbookData: WorkbookData) => void;
  onBack: () => void;
}

export function SheetSelector({ workbookData, onSheetSelected, onMultipleSheetsSelected, onBack }: SheetSelectorProps) {
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState<string>('');
  // Enable multi-select by default if there are multiple sheets and onMultipleSheetsSelected is provided
  const [multiSelectMode, setMultiSelectMode] = useState<boolean>(
    Boolean(onMultipleSheetsSelected && workbookData?.sheetNames?.length > 1)
  );

  // Generate sheet previews
  const sheetPreviews = useMemo((): SheetPreview[] => {
    if (!workbookData?.sheetNames || !Array.isArray(workbookData.sheetNames)) {
      return [];
    }
    
    return workbookData.sheetNames.map(sheetName => {
      const sheetData = workbookData.sheets[sheetName];
      if (!sheetData || !sheetData.originalData) {
        return {
          sheetName,
          rowCount: 0,
          columnCount: 0,
          hasData: false,
          preview: [],
        };
      }
      
      const preview = sheetData.originalData.slice(0, 5).map(row => 
        (row || []).slice(0, 6)
      );
      
      let hasData = false;
      let nonEmptyCount = 0;
      
      // Check if sheet has meaningful data
      for (const row of sheetData.originalData.slice(0, 10)) {
        if (row) {
          for (const cell of row.slice(0, 10)) {
            if (cell != null && cell !== '') {
              nonEmptyCount++;
            }
          }
        }
      }
      
      hasData = nonEmptyCount > 5; // Must have at least 5 non-empty cells

      return {
        sheetName,
        rowCount: sheetData.dimensions?.rows || 0,
        columnCount: sheetData.dimensions?.columns || 0,
        hasData,
        preview,
      };
    });
  }, [workbookData]);

  const handleSheetToggle = useCallback((sheetName: string) => {
    if (multiSelectMode) {
      setSelectedSheets(prev => {
        const newSet = new Set(prev);
        if (newSet.has(sheetName)) {
          newSet.delete(sheetName);
        } else {
          newSet.add(sheetName);
        }
        return newSet;
      });
    } else {
      // Single select mode
      const spreadsheetData = workbookData.sheets[sheetName];
      if (spreadsheetData) {
        onSheetSelected(spreadsheetData);
      }
    }
  }, [multiSelectMode, workbookData.sheets, onSheetSelected]);

  const handleMultiSelectConfirm = useCallback(async () => {
    if (selectedSheets.size === 0) return;

    // Import pattern detection dynamically
    const { detectSheetPatternConsistency } = await import('../utils/sheetPatternDetection');

    try {
      const selectedSheetsArray = Array.from(selectedSheets);
      const sheetsData = selectedSheetsArray.map(sheetName => ({
        sheetName,
        data: workbookData.sheets[sheetName]
      }));

      const patternComparison = detectSheetPatternConsistency(sheetsData);

      const multiSheetSelection: MultiSheetSelection = {
        selectedSheets: selectedSheetsArray,
        hasConsistentPattern: patternComparison.isConsistent,
        patternDetected: patternComparison.commonPattern ? {
          ...patternComparison.commonPattern,
          confidence: patternComparison.confidence
        } : undefined,
      };

      if (onMultipleSheetsSelected) {
        onMultipleSheetsSelected(multiSheetSelection, workbookData);
      }
    } catch (error) {
      console.error('Error analyzing sheet patterns:', error);
      // Simple fallback
      const multiSheetSelection: MultiSheetSelection = {
        selectedSheets: Array.from(selectedSheets),
        hasConsistentPattern: false,
      };
      if (onMultipleSheetsSelected) {
        onMultipleSheetsSelected(multiSheetSelection, workbookData);
      }
    }
  }, [selectedSheets, workbookData, onMultipleSheetsSelected]);

  const formatCellValue = (value: any): string => {
    if (value == null || value === '') return '';
    if (typeof value === 'number') {
      return value.toString();
    }
    return String(value).substring(0, 10);
  };

  const getSheetIcon = (preview: SheetPreview) => {
    if (!preview.hasData) {
      return <FileSpreadsheet className="h-5 w-5 text-gray-400" />;
    }
    
    // Try to detect if it looks like dose-response data
    const hasNumericColumns = preview.preview.some(row => 
      row.some(cell => typeof cell === 'number' && cell > 0)
    );
    
    if (hasNumericColumns) {
      return <BarChart3 className="h-5 w-5 text-blue-500" />;
    }
    
    return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
  };

  const recommendedSheets = sheetPreviews.filter(sheet => sheet.hasData);
  const otherSheets = sheetPreviews.filter(sheet => !sheet.hasData);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white">
      <div className="mb-6">
        <button
          onClick={onBack}
          className="mb-4 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          ← Back to file upload
        </button>
        
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Sheet{multiSelectMode ? 's' : ''}</h2>
            <p className="text-gray-600">
              Your Excel file contains {workbookData?.sheetNames?.length || 0} sheet{(workbookData?.sheetNames?.length || 0) !== 1 ? 's' : ''}. 
              {multiSelectMode 
                ? 'Select multiple sheets to analyze together.'
                : 'Choose the sheet containing your dose-response data.'
              }
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setMultiSelectMode(!multiSelectMode);
                setSelectedSheets(new Set());
              }}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                multiSelectMode 
                  ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                  : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
              }`}
            >
              <Layers size={16} />
              <span>{multiSelectMode ? 'Multi-Select ON' : 'Enable Multi-Select'}</span>
            </button>
            
            {multiSelectMode && selectedSheets.size > 0 && (
              <button
                onClick={handleMultiSelectConfirm}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <span>Analyze {selectedSheets.size} Sheet{selectedSheets.size !== 1 ? 's' : ''}</span>
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Recommended sheets */}
        {recommendedSheets.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <BarChart3 className="h-5 w-5 text-blue-500 mr-2" />
              Recommended Sheets
              <span className="ml-2 text-sm text-gray-500">(contain data)</span>
            </h3>
            
            <div className="grid gap-4">
              {recommendedSheets.map((sheetPreview) => (
                <div
                  key={sheetPreview.sheetName}
                  className={`border rounded-lg transition-all hover:shadow-md ${
                    selectedSheets.has(sheetPreview.sheetName) 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {multiSelectMode && (
                          <button
                            onClick={() => handleSheetToggle(sheetPreview.sheetName)}
                            className="text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            {selectedSheets.has(sheetPreview.sheetName) ? (
                              <CheckSquare size={20} />
                            ) : (
                              <Square size={20} />
                            )}
                          </button>
                        )}
                        {getSheetIcon(sheetPreview)}
                        <div>
                          <h4 className="font-medium text-gray-900">{sheetPreview.sheetName}</h4>
                          <p className="text-sm text-gray-600">
                            {sheetPreview.rowCount} rows × {sheetPreview.columnCount} columns
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setShowPreview(
                            showPreview === sheetPreview.sheetName ? '' : sheetPreview.sheetName
                          )}
                          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Preview data"
                        >
                          <Eye size={16} />
                        </button>
                        
                        {!multiSelectMode && (
                          <button
                            onClick={() => handleSheetToggle(sheetPreview.sheetName)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                          >
                            <span>Select Sheet</span>
                            <ChevronRight size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Preview */}
                    {showPreview === sheetPreview.sheetName && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Data Preview:</h5>
                        <div className="bg-gray-50 rounded border overflow-auto">
                          <div className="inline-block min-w-full">
                            {sheetPreview.preview.map((row, rowIndex) => (
                              <div key={rowIndex} className="flex border-b border-gray-200 last:border-b-0">
                                <div className="w-8 h-8 border-r border-gray-200 flex items-center justify-center text-xs font-medium text-gray-500 bg-gray-100">
                                  {rowIndex + 1}
                                </div>
                                {Array.from({ length: 6 }, (_, colIndex) => (
                                  <div
                                    key={colIndex}
                                    className="w-20 h-8 border-r border-gray-200 flex items-center justify-center text-xs px-1"
                                  >
                                    <span className="truncate" title={formatCellValue(row[colIndex])}>
                                      {formatCellValue(row[colIndex])}
                                    </span>
                                  </div>
                                ))}
                                {(row.length > 6) && (
                                  <div className="w-12 h-8 flex items-center justify-center text-xs text-gray-400">
                                    ...
                                  </div>
                                )}
                              </div>
                            ))}
                            {sheetPreview.preview.length > 5 && (
                              <div className="flex">
                                <div className="w-8 h-6 border-r border-gray-200 flex items-center justify-center text-xs text-gray-400 bg-gray-100">
                                  ...
                                </div>
                                <div className="flex-1 h-6 flex items-center justify-center text-xs text-gray-400">
                                  {sheetPreview.rowCount - 5} more rows
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Other sheets */}
        {otherSheets.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <FileSpreadsheet className="h-5 w-5 text-gray-400 mr-2" />
              Other Sheets
              <span className="ml-2 text-sm text-gray-500">(appear empty or contain minimal data)</span>
            </h3>
            
            <div className="grid gap-3">
              {otherSheets.map((sheetPreview) => (
                <div
                  key={sheetPreview.sheetName}
                  className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {multiSelectMode && (
                        <button
                          onClick={() => handleSheetToggle(sheetPreview.sheetName)}
                          className="text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          {selectedSheets.has(sheetPreview.sheetName) ? (
                            <CheckSquare size={18} />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                      )}
                      {getSheetIcon(sheetPreview)}
                      <div>
                        <h4 className="font-medium text-gray-700">{sheetPreview.sheetName}</h4>
                        <p className="text-sm text-gray-500">
                          {sheetPreview.rowCount} rows × {sheetPreview.columnCount} columns
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setShowPreview(
                          showPreview === sheetPreview.sheetName ? '' : sheetPreview.sheetName
                        )}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Preview data"
                      >
                        <Eye size={14} />
                      </button>
                      
                      {!multiSelectMode && (
                        <button
                          onClick={() => handleSheetToggle(sheetPreview.sheetName)}
                          className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700 transition-colors"
                        >
                          Select
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Preview for other sheets */}
                  {showPreview === sheetPreview.sheetName && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Data Preview:</h5>
                      <div className="bg-gray-50 rounded border overflow-auto">
                        <div className="inline-block min-w-full">
                          {sheetPreview.preview.slice(0, 3).map((row, rowIndex) => (
                            <div key={rowIndex} className="flex border-b border-gray-200 last:border-b-0">
                              <div className="w-8 h-6 border-r border-gray-200 flex items-center justify-center text-xs font-medium text-gray-500 bg-gray-100">
                                {rowIndex + 1}
                              </div>
                              {Array.from({ length: 6 }, (_, colIndex) => (
                                <div
                                  key={colIndex}
                                  className="w-16 h-6 border-r border-gray-200 flex items-center justify-center text-xs px-1"
                                >
                                  <span className="truncate" title={formatCellValue(row[colIndex])}>
                                    {formatCellValue(row[colIndex])}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Help section */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">💡 Sheet Selection Tips</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Look for sheets with dose/concentration data and response measurements</li>
          <li>• Recommended sheets contain sufficient data for analysis</li>
          <li>• You can preview any sheet before selecting it</li>
          <li>• After selection, you&apos;ll visually choose data regions within that sheet</li>
        </ul>
      </div>
    </div>
  );
}