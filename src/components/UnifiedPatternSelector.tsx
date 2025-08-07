'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { SpreadsheetGrid, GATE_COLORS, GATE_COLORS_SOLID } from './SpreadsheetGrid';
import { 
  MultiSheetSelection, 
  WorkbookData, 
  GateSelection, 
  BoundingBox,
  GateAnalysisResult,
  SpreadsheetData
} from '../types';
import { Layers, Play, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';
import { suggestGates } from '../utils/gateDetection';

interface UnifiedPatternSelectorProps {
  multiSheetSelection: MultiSheetSelection;
  workbookData: WorkbookData;
  onPatternConfirmed: (results: GateAnalysisResult[]) => void;
  onBack: () => void;
  isProcessing?: boolean;
}

export function UnifiedPatternSelector({
  multiSheetSelection,
  workbookData,
  onPatternConfirmed,
  onBack,
  isProcessing = false,
}: UnifiedPatternSelectorProps) {
  const [gates, setGates] = useState<GateSelection[]>([]);
  const [autoDetectedGateIds, setAutoDetectedGateIds] = useState<Set<string>>(new Set());
  const [autoDetectionEnabled, setAutoDetectionEnabled] = useState(false);
  const [selectedGateId, setSelectedGateId] = useState<string | undefined>();
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);

  // Get current sheet data for display
  const currentSheetName = multiSheetSelection.selectedSheets[activeSheetIndex];
  const currentSpreadsheetData = workbookData.sheets[currentSheetName];

  // Auto-suggest gates using enhanced detection
  const autoSuggestedGates = useMemo(() => {
    try {
      const suggestions = suggestGates(currentSpreadsheetData);
      
      return suggestions.slice(0, 3).map((suggestion: any, index: number) => ({
        id: `unified-suggestion-${index}`,
        name: suggestion.name,
        boundingBox: suggestion.boundingBox,
        isSelected: false,
        dataType: 'dose-response' as const,
        color: index === 0 ? '#3b82f680' : index === 1 ? '#22c55e80' : '#ef444480',
      }));
    } catch (error) {
      console.error('Error generating suggestions in UnifiedPatternSelector:', error);
      
      // Fallback to old pattern detection
      if (!multiSheetSelection.patternDetected) return [];

      const pattern = multiSheetSelection.patternDetected;
      const boundingBox: BoundingBox = {
        startRow: Math.max(0, pattern.headerRow),
        endRow: Math.min(currentSpreadsheetData.dimensions.rows - 1, pattern.headerRow + 15),
        startColumn: Math.min(pattern.concentrationColumn, ...pattern.responseColumns),
        endColumn: Math.max(pattern.concentrationColumn, ...pattern.responseColumns),
      };

      return [{
        id: 'pattern-suggestion',
        name: 'Detected Pattern',
        boundingBox,
        isSelected: false,
        dataType: 'dose-response' as const,
        color: '#3b82f680',
      }];
    }
  }, [currentSheetName, currentSpreadsheetData, multiSheetSelection.patternDetected]);

  // Handle auto-detection toggle
  const handleAutoDetectionToggle = useCallback(() => {
    if (!autoDetectionEnabled) {
      // Enable auto-detection and add suggested gates with consistent colors
      const existingGatesCount = gates.filter(g => !autoDetectedGateIds.has(g.id)).length;
      const newAutoGates = autoSuggestedGates.map((gate, index) => ({
        ...gate,
        id: `auto-${Date.now()}-${index}`,
        color: GATE_COLORS[(existingGatesCount + index) % GATE_COLORS.length]
      }));
      
      // Track which gates are auto-detected
      const newAutoIds = new Set(newAutoGates.map(g => g.id));
      setAutoDetectedGateIds(newAutoIds);
      
      // Add auto-detected gates to existing user-defined gates
      setGates(prev => [...prev.filter(g => !autoDetectedGateIds.has(g.id)), ...newAutoGates]);
      setAutoDetectionEnabled(true);
    } else {
      // Disable auto-detection and remove ONLY auto-detected gates
      setGates(prev => prev.filter(g => !autoDetectedGateIds.has(g.id)));
      setAutoDetectedGateIds(new Set());
      setAutoDetectionEnabled(false);
      
      // Clear selection if it was an auto-detected gate
      if (selectedGateId && autoDetectedGateIds.has(selectedGateId)) {
        setSelectedGateId(undefined);
      }
    }
  }, [autoDetectionEnabled, autoSuggestedGates, gates, autoDetectedGateIds]);

  const generateGateId = useCallback(() => {
    return `gate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const handleGateCreate = useCallback((boundingBox: BoundingBox) => {
    const gateId = generateGateId();
    const userDefinedGatesCount = gates.filter(g => !autoDetectedGateIds.has(g.id)).length;
    
    const colorIndex = gates.length % GATE_COLORS.length;
    const newGate: GateSelection = {
      id: gateId,
      name: `Pattern ${userDefinedGatesCount + 1}`,
      boundingBox,
      isSelected: true,
      dataType: 'dose-response' as const,
      color: GATE_COLORS[colorIndex], // Use consistent color from palette
    };

    setGates(prev => [...prev, newGate]);
    setSelectedGateId(gateId);
  }, [gates, autoDetectedGateIds, generateGateId]);

  const handleGateUpdate = useCallback((gateId: string, boundingBox: BoundingBox) => {
    setGates(prev => prev.map(gate => 
      gate.id === gateId ? { ...gate, boundingBox } : gate
    ));
  }, []);

  const handleGateSelect = useCallback((gateId: string) => {
    setSelectedGateId(gateId);
    setGates(prev => prev.map(gate => ({
      ...gate,
      isSelected: gate.id === gateId,
    })));
  }, []);

  const handleGateDelete = useCallback((gateId: string) => {
    setGates(prev => prev.filter(gate => gate.id !== gateId));
    // Remove from auto-detected set if it was auto-detected
    if (autoDetectedGateIds.has(gateId)) {
      setAutoDetectedGateIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(gateId);
        return newSet;
      });
    }
    if (selectedGateId === gateId) {
      setSelectedGateId(undefined);
    }
  }, [selectedGateId, autoDetectedGateIds]);

  const handleConfirmPattern = useCallback(async () => {
    if (gates.length === 0) return;

    try {
      // Import the gate processor
      const { processGatesForMultipleSheets } = await import('../utils/multiSheetGateProcessor');
      
      const results = await processGatesForMultipleSheets(
        gates,
        multiSheetSelection,
        workbookData
      );
      
      onPatternConfirmed(results);
    } catch (error) {
      console.error('Error processing unified pattern:', error);
    }
  }, [gates, multiSheetSelection, workbookData, onPatternConfirmed]);

  return (
    <div className="w-full max-w-7xl mx-auto p-8 bg-white">
      <div className="mb-8">
        <button
          onClick={onBack}
          className="mb-4 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          ← Back
        </button>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Select Pattern</h2>
          {autoSuggestedGates.length > 0 && (
            <button
              onClick={handleAutoDetectionToggle}
              className={`px-3 py-1.5 rounded-lg border-2 transition-all text-sm font-semibold ${
                autoDetectionEnabled 
                  ? 'bg-[#8A0051] border-[#8A0051] text-white' 
                  : 'bg-white border-gray-300 text-gray-700 hover:border-[#8A0051] hover:text-[#8A0051]'
              }`}
            >
              {autoDetectionEnabled ? '✓ Auto' : 'Auto'}
            </button>
          )}
        </div>
        <p className="text-gray-500 text-sm">
          Applies to {multiSheetSelection.selectedSheets.length} sheets
        </p>

        {multiSheetSelection.patternDetected && (
          <div className="mt-2 text-xs text-gray-600">
            Detected: Header row {multiSheetSelection.patternDetected.headerRow + 1}, 
            Concentration column {String.fromCharCode(65 + multiSheetSelection.patternDetected.concentrationColumn)}, 
            {multiSheetSelection.patternDetected.responseColumns.length} response columns
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main spreadsheet view */}
        <div className="lg:col-span-3">
          <div className="bg-white border border-gray-200 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            {/* Sheet tabs */}
            <div className="border-b border-gray-200 px-4 py-2">
              <div className="flex space-x-1 overflow-x-auto">
                {multiSheetSelection.selectedSheets.map((sheetName, index) => (
                  <button
                    key={sheetName}
                    onClick={() => setActiveSheetIndex(index)}
                    className={`px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${
                      index === activeSheetIndex
                        ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-500'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {sheetName}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-b border-gray-200 px-4 py-3">
              <h3 className="text-lg font-medium text-gray-900">
                {currentSheetName}
              </h3>
              <p className="text-sm text-gray-500">
                {currentSpreadsheetData.dimensions.rows} rows × {currentSpreadsheetData.dimensions.columns} columns
              </p>
            </div>
            
            <div className="p-4">
              <SpreadsheetGrid
                cells={currentSpreadsheetData.cells}
                gates={gates}
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
          <div className="bg-white border border-gray-200 rounded-lg shadow-md hover:shadow-lg transition-shadow h-fit">
            <div className="border-b border-gray-200 px-4 py-3">
              <h3 className="text-lg font-medium text-gray-900">Pattern Configuration</h3>
              <p className="text-sm text-gray-500">
                {gates.length} pattern{gates.length !== 1 ? 's' : ''} defined
              </p>
            </div>

            <div className="p-4 space-y-3">
              {gates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No patterns defined</p>
                  <p className="text-xs mt-1">
                    {autoSuggestedGates.length > 0 
                      ? 'Auto-suggested pattern will be applied'
                      : 'Click and drag on the spreadsheet to define data pattern'
                    }
                  </p>
                </div>
              ) : (
                gates.map((gate, index) => {
                  // Get the solid color version of the gate's color
                  const gateColorIndex = GATE_COLORS.indexOf(gate.color || '');
                  const solidColor = gateColorIndex >= 0 
                    ? GATE_COLORS_SOLID[gateColorIndex] 
                    : GATE_COLORS_SOLID[index % GATE_COLORS_SOLID.length];
                  
                  const isAutoDetected = autoDetectedGateIds.has(gate.id);
                  
                  return (
                    <div
                      key={gate.id}
                      className={`border-2 rounded-lg p-3 transition-all cursor-pointer hover:shadow-md ${
                        gate.id === selectedGateId 
                          ? 'border-blue-500 bg-blue-50 shadow-md' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      style={{
                        borderLeftColor: solidColor,
                        borderLeftWidth: '4px'
                      }}
                      onClick={() => handleGateSelect(gate.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2 flex-1">
                          {/* Color indicator - larger and more prominent */}
                          <div 
                            className="w-4 h-4 rounded border-2 border-gray-400 flex-shrink-0"
                            style={{ backgroundColor: solidColor }}
                            title={`Pattern color`}
                          />
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-gray-900">
                              {gate.name}
                            </h4>
                            {isAutoDetected && (
                              <span className="text-xs text-blue-600">Auto-detected</span>
                            )}
                            {!isAutoDetected && (
                              <span className="text-xs text-green-600">User-defined</span>
                            )}
                          </div>
                        </div>
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

                    <div className="text-xs text-blue-600 font-medium">
                      Will apply to all {multiSheetSelection.selectedSheets.length} sheets
                    </div>
                  </div>
                  );
                })
              )}
            </div>

            {gates.length > 0 && (
              <div className="border-t border-gray-200 p-4">
                <button
                  onClick={handleConfirmPattern}
                  disabled={isProcessing}
                  className="w-full bg-gradient-to-r from-[#8A0051] to-[#B8006B] text-white py-3 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span className="text-lg">Processing...</span>
                    </>
                  ) : (
                    <>
                      <Play size={20} />
                      <span className="text-lg">Apply to All Sheets</span>
                      <ChevronRight size={20} />
                    </>
                  )}
                </button>
                
                <p className="text-xs text-gray-500 mt-2 text-center">
                  This pattern will be applied to all selected sheets
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}