'use client';

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { CellData, BoundingBox, GateSelection } from '../types';

interface SpreadsheetGridProps {
  cells: CellData[][];
  gates: GateSelection[];
  onGateCreate: (boundingBox: BoundingBox) => void;
  onGateUpdate: (gateId: string, boundingBox: BoundingBox) => void;
  onGateSelect: (gateId: string) => void;
  selectedGateId?: string;
  maxDisplayRows?: number;
  maxDisplayColumns?: number;
  showFullSheet?: boolean;
}

interface SelectionState {
  isSelecting: boolean;
  startRow: number;
  startColumn: number;
  currentRow: number;
  currentColumn: number;
}

// Export consistent colors for use across components - reduced palette
export const GATE_COLORS = [
  'rgba(33, 102, 172, 0.3)', // professional blue
  'rgba(118, 42, 131, 0.3)', // deep purple  
  'rgba(27, 120, 55, 0.3)',  // forest green
  'rgba(224, 130, 20, 0.3)', // amber orange
];

// Solid versions for UI elements
export const GATE_COLORS_SOLID = [
  '#2166AC', // professional blue
  '#762A83', // deep purple
  '#1B7837', // forest green
  '#E08214', // amber orange
];

export function SpreadsheetGrid({
  cells,
  gates,
  onGateCreate,
  onGateUpdate,
  onGateSelect,
  selectedGateId,
  maxDisplayRows = 100,
  maxDisplayColumns = 50,
  showFullSheet = true,
}: SpreadsheetGridProps) {
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const displayCells = useMemo(() => {
    if (!cells || cells.length === 0) return [];
    
    const actualMaxRows = showFullSheet ? Math.min(cells.length, maxDisplayRows) : Math.min(50, maxDisplayRows);
    const actualMaxCols = showFullSheet ? Math.min(
      Math.max(...cells.map(row => row?.length || 0)), 
      maxDisplayColumns
    ) : Math.min(20, maxDisplayColumns);
    
    return cells.slice(0, actualMaxRows).map(row => {
      if (!row) return Array(actualMaxCols).fill(null);
      const paddedRow = [...row];
      while (paddedRow.length < actualMaxCols) {
        paddedRow.push({
          value: null,
          row: cells.indexOf(row),
          column: paddedRow.length,
          isNumeric: false,
          isEmpty: true,
          isHeader: false,
        });
      }
      return paddedRow.slice(0, actualMaxCols);
    });
  }, [cells, maxDisplayRows, maxDisplayColumns, showFullSheet]);

  const handleMouseDown = useCallback((row: number, column: number, event: React.MouseEvent) => {
    event.preventDefault();
    
    // Check if clicking on existing gate
    const clickedGate = gates.find(gate => 
      row >= gate.boundingBox.startRow && 
      row <= gate.boundingBox.endRow &&
      column >= gate.boundingBox.startColumn && 
      column <= gate.boundingBox.endColumn
    );

    if (clickedGate) {
      onGateSelect(clickedGate.id);
      return;
    }

    // Start new selection
    setSelection({
      isSelecting: true,
      startRow: row,
      startColumn: column,
      currentRow: row,
      currentColumn: column,
    });
  }, [gates, onGateSelect]);

  const handleMouseMove = useCallback((row: number, column: number) => {
    if (selection?.isSelecting) {
      setSelection(prev => prev ? {
        ...prev,
        currentRow: row,
        currentColumn: column,
      } : null);
    }
  }, [selection]);

  const handleMouseUp = useCallback(() => {
    if (selection?.isSelecting) {
      const boundingBox: BoundingBox = {
        startRow: Math.min(selection.startRow, selection.currentRow),
        endRow: Math.max(selection.startRow, selection.currentRow),
        startColumn: Math.min(selection.startColumn, selection.currentColumn),
        endColumn: Math.max(selection.startColumn, selection.currentColumn),
      };

      // Only create gate if selection is more than single cell
      if (boundingBox.endRow > boundingBox.startRow || boundingBox.endColumn > boundingBox.startColumn) {
        onGateCreate(boundingBox);
      }

      setSelection(null);
    }
  }, [selection, onGateCreate]);

  const isInGate = useCallback((row: number, column: number): GateSelection | null => {
    return gates.find(gate => 
      row >= gate.boundingBox.startRow && 
      row <= gate.boundingBox.endRow &&
      column >= gate.boundingBox.startColumn && 
      column <= gate.boundingBox.endColumn
    ) || null;
  }, [gates]);

  const isInSelection = useCallback((row: number, column: number): boolean => {
    if (!selection?.isSelecting) return false;
    
    const minRow = Math.min(selection.startRow, selection.currentRow);
    const maxRow = Math.max(selection.startRow, selection.currentRow);
    const minCol = Math.min(selection.startColumn, selection.currentColumn);
    const maxCol = Math.max(selection.startColumn, selection.currentColumn);

    return row >= minRow && row <= maxRow && column >= minCol && column <= maxCol;
  }, [selection]);

  const getCellStyle = useCallback((row: number, column: number) => {
    const gate = isInGate(row, column);
    const inSelection = isInSelection(row, column);
    const isSelected = gate?.id === selectedGateId;

    let backgroundColor = '';
    let border = '1px solid #e5e7eb';

    if (inSelection) {
      backgroundColor = 'rgba(59, 130, 246, 0.2)';
      border = '2px solid #3b82f6';
    } else if (gate) {
      const gateIndex = gates.findIndex(g => g.id === gate.id);
      backgroundColor = gate.color || GATE_COLORS[gateIndex % GATE_COLORS.length];
      border = isSelected ? '3px solid #1f2937' : '2px solid rgba(0, 0, 0, 0.3)';
    }

    return {
      backgroundColor,
      border,
      cursor: gate ? 'pointer' : 'crosshair',
    };
  }, [isInGate, isInSelection, selectedGateId, gates]);

  const formatCellValue = useCallback((cell: CellData | undefined) => {
    if (!cell || cell.isEmpty) return '';
    
    if (typeof cell.value === 'number') {
      return cell.value.toString();
    }
    
    return String(cell.value).substring(0, 10);
  }, []);

  const generateColumnHeaders = useMemo(() => {
    const actualMaxCols = showFullSheet ? Math.min(
      Math.max(...cells.map(row => row?.length || 0)), 
      maxDisplayColumns
    ) : Math.min(20, maxDisplayColumns);
    
    return Array.from({ length: actualMaxCols }, (_, i) => {
      let header = '';
      let num = i;
      while (num >= 0) {
        header = String.fromCharCode(65 + (num % 26)) + header;
        num = Math.floor(num / 26) - 1;
      }
      return header;
    });
  }, [maxDisplayColumns, showFullSheet, cells]);

  return (
    <div className="overflow-auto border border-gray-300 rounded-lg bg-white max-h-[600px]">
      <div 
        ref={gridRef}
        className="inline-block min-w-full"
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Header row */}
        <div className="flex border-b border-gray-300 bg-gray-50">
          <div className="w-12 h-8 border-r border-gray-300 flex items-center justify-center text-xs font-medium text-gray-500">
            #
          </div>
          {generateColumnHeaders.map((header, colIndex) => (
            <div
              key={colIndex}
              className="w-20 h-8 border-r border-gray-300 flex items-center justify-center text-xs font-medium text-gray-700"
            >
              {header}
            </div>
          ))}
        </div>

        {/* Data rows */}
        {displayCells.map((row, rowIndex) => (
          <div key={rowIndex} className="flex border-b border-gray-200 hover:bg-gray-50">
            {/* Row number */}
            <div className="w-12 h-8 border-r border-gray-300 flex items-center justify-center text-xs font-medium text-gray-500 bg-gray-50">
              {rowIndex + 1}
            </div>
            
            {/* Data cells */}
            {displayCells[rowIndex]?.map((cell, colIndex) => (
              <div
                key={colIndex}
                className="w-20 h-8 border-r border-gray-200 flex items-center justify-center text-xs relative"
                style={getCellStyle(rowIndex, colIndex)}
                onMouseDown={(e) => handleMouseDown(rowIndex, colIndex, e)}
                onMouseMove={() => handleMouseMove(rowIndex, colIndex)}
              >
                <span className="truncate px-1" title={formatCellValue(cell)}>
                  {formatCellValue(cell)}
                </span>
              </div>
            )) || []}
          </div>
        ))}
      </div>
      
      {/* Instructions */}
      <div className="p-3 bg-gray-50 border-t border-gray-300 text-sm text-gray-600">
        <p>
          <strong>Instructions:</strong> Drag to select data regions. Click existing selections to edit.
        </p>
      </div>
    </div>
  );
}