'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { SpreadsheetGrid } from './SpreadsheetGrid';
import { 
  MultiSheetSelection, 
  WorkbookData, 
  GateSelection, 
  BoundingBox,
  GateAnalysisResult,
  SheetPatternComparison
} from '../types';
import { Layers, Play, AlertCircle, CheckCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { explainPatternDifferences } from '../utils/sheetPatternDetection';
import { suggestGates } from '../utils/gateDetection';

interface PerSheetPatternSelectorProps {
  multiSheetSelection: MultiSheetSelection;
  workbookData: WorkbookData;
  patternComparison: SheetPatternComparison;
  onPatternConfirmed: (results: GateAnalysisResult[]) => void;
  onBack: () => void;
  isProcessing?: boolean;
}

interface SheetGates {
  [sheetName: string]: GateSelection[];
}

export function PerSheetPatternSelector({
  multiSheetSelection,
  workbookData,
  patternComparison,
  onPatternConfirmed,
  onBack,
  isProcessing = false,
}: PerSheetPatternSelectorProps) {
  const [sheetGates, setSheetGates] = useState<SheetGates>({});
  const [selectedGateId, setSelectedGateId] = useState<string | undefined>();
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);

  // Get current sheet data
  const currentSheetName = multiSheetSelection.selectedSheets[activeSheetIndex];
  const currentSpreadsheetData = workbookData.sheets[currentSheetName];
  const currentGates = sheetGates[currentSheetName] || [];

  // Get pattern differences explanation
  const patternExplanations = useMemo(() => {
    return explainPatternDifferences(patternComparison);
  }, [patternComparison]);

  // Auto-suggest gates for current sheet
  const autoSuggestedGates = useMemo(() => {
    console.log('🎯 PerSheetPatternSelector: About to call suggestGates for sheet:', currentSheetName);
    console.log('🎯 Current sheet data:', currentSpreadsheetData ? 'EXISTS' : 'NULL', currentSpreadsheetData?.dimensions);
    try {
      const suggestions = suggestGates(currentSpreadsheetData);
      return suggestions.slice(0, 2).map((suggestion: any, index: number) => ({
        id: `${currentSheetName}-suggestion-${index}`,
        name: `${suggestion.name}`,
        boundingBox: suggestion.boundingBox,
        isSelected: false,
        dataType: 'dose-response' as const,
        color: index === 0 ? '#3b82f680' : '#22c55e80',
      }));
    } catch (error) {
      console.error('Error generating suggestions for sheet:', currentSheetName, error);
      return [];
    }
  }, [currentSheetName, currentSpreadsheetData]);

  // Initialize gates with auto-suggestions when switching sheets
  React.useEffect(() => {
    if (autoSuggestedGates.length > 0 && currentGates.length === 0) {
      setSheetGates(prev => ({
        ...prev,
        [currentSheetName]: autoSuggestedGates,
      }));
    }
  }, [currentSheetName, autoSuggestedGates, currentGates.length]);

  const generateGateId = useCallback(() => {
    return `${currentSheetName}-gate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, [currentSheetName]);

  const handleGateCreate = useCallback((boundingBox: BoundingBox) => {
    const gateId = generateGateId();
    
    const newGate: GateSelection = {
      id: gateId,
      name: `Pattern ${currentGates.length + 1}`,
      boundingBox,
      isSelected: true,
      dataType: 'dose-response',
      color: '#22c55e80',
    };

    setSheetGates(prev => ({
      ...prev,
      [currentSheetName]: [...(prev[currentSheetName] || []), newGate],
    }));
    setSelectedGateId(gateId);
  }, [currentSheetName, currentGates.length, generateGateId]);

  const handleGateUpdate = useCallback((gateId: string, boundingBox: BoundingBox) => {
    setSheetGates(prev => ({
      ...prev,
      [currentSheetName]: (prev[currentSheetName] || []).map(gate => 
        gate.id === gateId ? { ...gate, boundingBox } : gate
      ),
    }));
  }, [currentSheetName]);

  const handleGateSelect = useCallback((gateId: string) => {
    setSelectedGateId(gateId);
    setSheetGates(prev => ({
      ...prev,
      [currentSheetName]: (prev[currentSheetName] || []).map(gate => ({
        ...gate,
        isSelected: gate.id === gateId,
      })),
    }));
  }, [currentSheetName]);

  const handleGateDelete = useCallback((gateId: string) => {
    setSheetGates(prev => ({
      ...prev,
      [currentSheetName]: (prev[currentSheetName] || []).filter(gate => gate.id !== gateId),
    }));
    if (selectedGateId === gateId) {
      setSelectedGateId(undefined);
    }
  }, [currentSheetName, selectedGateId]);

  const handleNextSheet = useCallback(() => {
    if (activeSheetIndex < multiSheetSelection.selectedSheets.length - 1) {
      setActiveSheetIndex(prev => prev + 1);
      setSelectedGateId(undefined);
    }
  }, [activeSheetIndex, multiSheetSelection.selectedSheets.length]);

  const handlePrevSheet = useCallback(() => {
    if (activeSheetIndex > 0) {
      setActiveSheetIndex(prev => prev - 1);
      setSelectedGateId(undefined);
    }
  }, [activeSheetIndex]);

  const handleConfirmAllPatterns = useCallback(async () => {
    // Check that all sheets have at least one gate
    const sheetsWithGates = Object.keys(sheetGates).filter(sheetName => 
      sheetGates[sheetName] && sheetGates[sheetName].length > 0
    );

    if (sheetsWithGates.length !== multiSheetSelection.selectedSheets.length) {
      alert('Please configure patterns for all sheets before proceeding.');
      return;
    }

    try {
      const { processGatesForIndividualSheets } = await import('../utils/multiSheetGateProcessor');
      
      const results = await processGatesForIndividualSheets(sheetGates, workbookData);
      onPatternConfirmed(results);
    } catch (error) {
      console.error('Error processing individual sheet patterns:', error);
    }
  }, [sheetGates, multiSheetSelection.selectedSheets, workbookData, onPatternConfirmed]);

  // Calculate completion status
  const completionStatus = useMemo(() => {
    const totalSheets = multiSheetSelection.selectedSheets.length;
    const configuredSheets = multiSheetSelection.selectedSheets.filter(sheetName => 
      sheetGates[sheetName] && sheetGates[sheetName].length > 0
    ).length;
    
    return { configured: configuredSheets, total: totalSheets };
  }, [multiSheetSelection.selectedSheets, sheetGates]);

  return (
    <div className="w-full max-w-7xl mx-auto p-6 bg-white">
      <div className="mb-6">
        <button
          onClick={onBack}
          className="mb-4 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          ← Back to sheet selection
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <Layers className="h-6 w-6 text-orange-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Individual Sheet Patterns</h2>
            <p className="text-gray-600">
              Configure data patterns for each sheet individually due to layout differences.
            </p>
          </div>
        </div>

        {/* Pattern differences explanation */}
        <div className="p-4 rounded-lg border bg-orange-50 border-orange-200 mb-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-orange-800">Different Patterns Detected</h4>
              <div className="text-sm text-orange-700 mt-1">
                {patternExplanations.map((explanation, index) => (
                  <p key={index} className="mb-1">• {explanation}</p>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-4">
          <div className="flex items-center space-x-3">
            <div className="text-sm font-medium text-gray-700">
              Progress: {completionStatus.configured} of {completionStatus.total} sheets configured
            </div>
            <div className="flex space-x-1">
              {multiSheetSelection.selectedSheets.map((sheetName, index) => (
                <div
                  key={sheetName}
                  className={`w-3 h-3 rounded-full ${
                    (sheetGates[sheetName] && sheetGates[sheetName].length > 0)
                      ? 'bg-green-500'
                      : index === activeSheetIndex
                        ? 'bg-blue-500'
                        : 'bg-gray-300'
                  }`}
                  title={`${sheetName} - ${
                    (sheetGates[sheetName] && sheetGates[sheetName].length > 0) ? 'Configured' : 'Pending'
                  }`}
                />
              ))}
            </div>
          </div>
          
          {completionStatus.configured === completionStatus.total && (
            <button
              onClick={handleConfirmAllPatterns}
              disabled={isProcessing}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center space-x-2"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Play size={16} />
                  <span>Process All Sheets</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main spreadsheet view */}
        <div className="lg:col-span-3">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            {/* Sheet navigation */}
            <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {currentSheetName}
                </h3>
                <p className="text-sm text-gray-500">
                  Sheet {activeSheetIndex + 1} of {multiSheetSelection.selectedSheets.length} • {' '}
                  {currentSpreadsheetData.dimensions.rows} rows × {currentSpreadsheetData.dimensions.columns} columns
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePrevSheet}
                  disabled={activeSheetIndex === 0}
                  className="p-2 text-gray-500 hover:text-gray-700 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowLeft size={16} />
                </button>
                <button
                  onClick={handleNextSheet}
                  disabled={activeSheetIndex === multiSheetSelection.selectedSheets.length - 1}
                  className="p-2 text-gray-500 hover:text-gray-700 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
            
            <div className="p-4">
              <SpreadsheetGrid
                cells={currentSpreadsheetData.cells}
                gates={currentGates}
                onGateCreate={handleGateCreate}
                onGateUpdate={handleGateUpdate}
                onGateSelect={handleGateSelect}
                selectedGateId={selectedGateId}
                showFullSheet={true}
                maxDisplayRows={200}
                maxDisplayColumns={100}
              />
            </div>
          </div>
        </div>

        {/* Pattern configuration panel */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm h-fit">
            <div className="border-b border-gray-200 px-4 py-3">
              <h3 className="text-lg font-medium text-gray-900">
                {currentSheetName} Patterns
              </h3>
              <p className="text-sm text-gray-500">
                {currentGates.length} pattern{currentGates.length !== 1 ? 's' : ''} defined
              </p>
            </div>

            <div className="p-4 space-y-3">
              {currentGates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No patterns defined for this sheet</p>
                  <p className="text-xs mt-1">Click and drag on the spreadsheet to define data pattern</p>
                </div>
              ) : (
                currentGates.map((gate, index) => (
                  <div
                    key={gate.id}
                    className={`border rounded-lg p-3 transition-all ${
                      gate.id === selectedGateId 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleGateSelect(gate.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900">
                        {gate.name}
                      </h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGateDelete(gate.id);
                        }}
                        className="text-gray-400 hover:text-red-600 transition-colors text-xs"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="text-xs text-gray-500 mb-2">
                      Rows {gate.boundingBox.startRow + 1}-{gate.boundingBox.endRow + 1}, 
                      Cols {String.fromCharCode(65 + gate.boundingBox.startColumn)}-{String.fromCharCode(65 + gate.boundingBox.endColumn)}
                    </div>

                    <div className={`text-xs font-medium ${
                      gate.color.includes('3b82f6') ? 'text-blue-600' : 'text-green-600'
                    }`}>
                      {gate.color.includes('3b82f6') ? 'Auto-suggested' : 'User-defined'}
                    </div>
                  </div>
                ))
              )}
            </div>

            {currentGates.length > 0 && (
              <div className="border-t border-gray-200 p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700 font-medium">
                    Sheet configured
                  </span>
                </div>
                
                <div className="text-xs text-gray-500">
                  {activeSheetIndex < multiSheetSelection.selectedSheets.length - 1
                    ? 'Use navigation arrows to configure other sheets'
                    : 'All sheets configured. Click "Process All Sheets" to continue.'
                  }
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}