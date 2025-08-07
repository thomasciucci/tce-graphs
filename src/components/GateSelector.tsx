'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { SpreadsheetGrid, GATE_COLORS, GATE_COLORS_SOLID } from './SpreadsheetGrid';
import { 
  GateSelection, 
  BoundingBox, 
  CellData, 
  SpreadsheetData, 
  GateAnalysisResult,
  ProcessedGate
} from '../types';
import { SuggestedGate } from '../utils/gateDetection';
import { Trash2, Edit3, Play, ChevronRight } from 'lucide-react';

interface GateSelectorProps {
  spreadsheetData: SpreadsheetData;
  onGatesConfirmed: (results: GateAnalysisResult[]) => void;
  autoSuggestedGates?: SuggestedGate[];
  isProcessing?: boolean;
}

export function GateSelector({
  spreadsheetData,
  onGatesConfirmed,
  autoSuggestedGates = [],
  isProcessing = false,
}: GateSelectorProps) {
  const [gates, setGates] = useState<GateSelection[]>([]); // Start with no patterns
  const [autoDetectedGateIds, setAutoDetectedGateIds] = useState<Set<string>>(new Set());
  const [autoDetectionEnabled, setAutoDetectionEnabled] = useState(false);
  const [selectedGateId, setSelectedGateId] = useState<string | undefined>();
  const [editingGateId, setEditingGateId] = useState<string | undefined>();
  const [gateNameInput, setGateNameInput] = useState('');

  const generateGateId = useCallback(() => {
    return `gate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const generateGateName = useCallback((index: number) => {
    return `Dataset ${index + 1}`;
  }, []);

  const handleGateCreate = useCallback((boundingBox: BoundingBox) => {
    const gateId = generateGateId();
    const gateIndex = gates.length;
    
    const colorIndex = gateIndex % GATE_COLORS.length;
    const newGate: GateSelection = {
      id: gateId,
      name: generateGateName(gateIndex),
      boundingBox,
      isSelected: true,
      dataType: 'dose-response',
      color: GATE_COLORS[colorIndex], // Use the exact same color
    };

    setGates(prev => [...prev, newGate]);
    setSelectedGateId(gateId);
  }, [gates.length, generateGateId, generateGateName]);

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

  const handleGateRename = useCallback((gateId: string, newName: string) => {
    setGates(prev => prev.map(gate => 
      gate.id === gateId ? { ...gate, name: newName } : gate
    ));
    setEditingGateId(undefined);
    setGateNameInput('');
  }, []);

  const startRenaming = useCallback((gate: GateSelection) => {
    setEditingGateId(gate.id);
    setGateNameInput(gate.name);
  }, []);

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
  }, [autoDetectionEnabled, autoSuggestedGates, gates, autoDetectedGateIds, selectedGateId]);

  const handleConfirmGates = useCallback(async () => {
    if (gates.length === 0) return;

    // Import gate processor dynamically to avoid circular dependencies
    const { processGates } = await import('../utils/gateProcessor');
    
    try {
      const results = await processGates(gates, spreadsheetData);
      onGatesConfirmed(results);
    } catch (error) {
      console.error('Error processing gates:', error);
      // Handle error - could show toast or modal
    }
  }, [gates, spreadsheetData, onGatesConfirmed]);

  const selectedGate = useMemo(() => {
    return gates.find(gate => gate.id === selectedGateId);
  }, [gates, selectedGateId]);

  const getGatePreview = useCallback((gate: GateSelection) => {
    const { boundingBox } = gate;
    const previewData = [];
    
    for (let row = boundingBox.startRow; row <= Math.min(boundingBox.endRow, boundingBox.startRow + 3); row++) {
      const rowData = [];
      for (let col = boundingBox.startColumn; col <= Math.min(boundingBox.endColumn, boundingBox.startColumn + 3); col++) {
        const cell = spreadsheetData.cells[row]?.[col];
        rowData.push(cell?.value || '');
      }
      previewData.push(rowData);
    }
    
    return previewData;
  }, [spreadsheetData.cells]);

  return (
    <div className="w-full max-w-7xl mx-auto p-8 bg-white">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Select Data</h2>
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
          Drag to select regions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main spreadsheet view */}
        <div className="lg:col-span-3">
          <div className="bg-white border border-gray-200 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <div className="border-b border-gray-200 px-4 py-3">
              <h3 className="text-lg font-medium text-gray-900">
                {spreadsheetData.sheetName}
              </h3>
              <p className="text-sm text-gray-500">
                {spreadsheetData.dimensions.rows} rows × {spreadsheetData.dimensions.columns} columns
              </p>
            </div>
            
            <div className="p-4">
              <SpreadsheetGrid
                cells={spreadsheetData.cells}
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

        {/* Gates panel */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg shadow-md hover:shadow-lg transition-shadow h-fit">
            <div className="border-b border-gray-200 px-4 py-3">
              <h3 className="text-lg font-semibold text-gray-900">Selections</h3>
              <p className="text-xs text-gray-500">{gates.length} selected</p>
            </div>

            <div className="p-4 space-y-3">
              {gates.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">No selection</p>
                  <p className="text-xs mt-1">Drag to select</p>
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
                            title={`Dataset color`}
                          />
                          
                          {editingGateId === gate.id ? (
                            <input
                              type="text"
                              value={gateNameInput}
                              onChange={(e) => setGateNameInput(e.target.value)}
                              onBlur={() => handleGateRename(gate.id, gateNameInput)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleGateRename(gate.id, gateNameInput);
                                } else if (e.key === 'Escape') {
                                  setEditingGateId(undefined);
                                  setGateNameInput('');
                                }
                              }}
                              className="text-sm font-medium bg-white border border-gray-300 rounded px-2 py-1 flex-1"
                              autoFocus
                            />
                          ) : (
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
                          )}
                        </div>
                      
                      <div className="flex items-center space-x-1 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startRenaming(gate);
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Rename"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGateDelete(gate.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-gray-500 mt-2">
                      Rows {gate.boundingBox.startRow + 1}-{gate.boundingBox.endRow + 1}, 
                      Cols {String.fromCharCode(65 + gate.boundingBox.startColumn)}-{String.fromCharCode(65 + gate.boundingBox.endColumn)}
                    </div>

                    {/* Gate preview */}
                    <div className="bg-gray-50 rounded p-2 text-xs">
                      <div className="font-medium mb-1">Preview:</div>
                      {getGatePreview(gate).map((row, rowIdx) => (
                        <div key={rowIdx} className="flex space-x-1 mb-1">
                          {row.map((cell, colIdx) => (
                            <span key={colIdx} className="bg-white px-1 py-0.5 rounded border min-w-[40px] text-center">
                              {String(cell).substring(0, 6) || '—'}
                            </span>
                          ))}
                          {row.length > 4 && <span className="text-gray-400">...</span>}
                        </div>
                      ))}
                      {getGatePreview(gate).length > 4 && (
                        <div className="text-center text-gray-400">...</div>
                      )}
                    </div>
                  </div>
                  );
                })
              )}
            </div>

            {gates.length > 0 && (
              <div className="border-t border-gray-200 p-4">
                <button
                  onClick={handleConfirmGates}
                  disabled={isProcessing}
                  className="w-full bg-gradient-to-r from-[#8A0051] to-[#B8006B] text-white py-3 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span className="text-lg">Processing...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-lg">Analyze</span>
                      <ChevronRight size={20} />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}