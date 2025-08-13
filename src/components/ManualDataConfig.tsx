'use client';

import { useState, useCallback } from 'react';
import { DataLayout, DetectionIssue } from '../utils/dataDetection';

interface ManualDataConfigProps {
  sheetName: string;
  sheetData: unknown[][];
  currentLayout: DataLayout;
  onLayoutChange: (layout: Partial<DataLayout>) => void;
  onValidate: () => { isValid: boolean; issues: DetectionIssue[] };
  onApply: () => void;
  onCancel: () => void;
}

export default function ManualDataConfig({
  sheetName,
  sheetData,
  currentLayout,
  onLayoutChange,
  onValidate,
  onApply,
  onCancel
}: ManualDataConfigProps) {
  const [activeSection, setActiveSection] = useState<'header' | 'data' | 'columns'>('header');
  const [validationResult, setValidationResult] = useState<{ isValid: boolean; issues: DetectionIssue[] } | null>(null);

  const handleValidate = useCallback(() => {
    const result = onValidate();
    setValidationResult(result);
  }, [onValidate]);

  const handleHeaderRowChange = useCallback((row: number) => {
    onLayoutChange({ 
      headerRow: row,
      dataStartRow: row + 1
    });
  }, [onLayoutChange]);

  const handleDataRangeChange = useCallback((startRow: number, endRow: number) => {
    onLayoutChange({ 
      dataStartRow: startRow,
      dataEndRow: endRow
    });
  }, [onLayoutChange]);

  const handleConcentrationColumnChange = useCallback((col: number) => {
    onLayoutChange({ 
      concentrationColumn: col
    });
  }, [onLayoutChange]);

  const handleResponseColumnsChange = useCallback((columns: number[]) => {
    onLayoutChange({ 
      responseColumns: columns
    });
  }, [onLayoutChange]);

  const handleSampleNamesChange = useCallback((names: string[]) => {
    onLayoutChange({ 
      sampleNames: names
    });
  }, [onLayoutChange]);

  const renderCellHighlight = (rowIndex: number, colIndex: number) => {
    let className = 'border border-gray-300 px-2 py-1 text-xs';
    
    if (rowIndex === currentLayout.headerRow) {
      className += ' bg-purple-100 border-purple-300';
    } else if (rowIndex >= currentLayout.dataStartRow && rowIndex <= (currentLayout.dataEndRow || sheetData.length - 1)) {
      if (colIndex === currentLayout.concentrationColumn) {
        className += ' bg-blue-100 border-blue-300';
      } else if (currentLayout.responseColumns.includes(colIndex)) {
        className += ' bg-green-100 border-green-300';
      } else {
        className += ' bg-gray-50';
      }
    }
    
    return className;
  };

  const maxCols = Math.max(...sheetData.map(row => row ? row.length : 0));
  const colOptions = Array.from({ length: maxCols }, (_, i) => i);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-[#8A0051] text-white">
          <h2 className="text-xl font-semibold">Manual Data Configuration</h2>
          <p className="text-sm opacity-90">Sheet: {sheetName}</p>
        </div>

        <div className="flex h-[calc(90vh-80px)]">
          {/* Configuration Panel */}
          <div className="w-1/3 p-6 border-r border-gray-200 overflow-y-auto">
            <div className="space-y-6">
              {/* Section Navigation */}
              <div className="flex space-x-2">
                {[
                  { id: 'header', label: 'Header' },
                  { id: 'data', label: 'Data Range' },
                  { id: 'columns', label: 'Columns' }
                ].map(section => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id as any)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg ${
                      activeSection === section.id
                        ? 'bg-[#8A0051] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {section.label}
                  </button>
                ))}
              </div>

              {/* Header Configuration */}
              {activeSection === 'header' && (
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Header Row</h3>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">
                      Select the row containing column headers:
                    </label>
                    <select
                      value={currentLayout.headerRow}
                      onChange={(e) => handleHeaderRowChange(parseInt(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      {sheetData.slice(0, 10).map((_, rowIndex) => (
                        <option key={rowIndex} value={rowIndex}>
                          Row {rowIndex + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="text-xs text-gray-500">
                    The header row contains column names and will be highlighted in purple in the preview.
                  </div>
                </div>
              )}

              {/* Data Range Configuration */}
              {activeSection === 'data' && (
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Data Range</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-2">Start Row:</label>
                      <select
                        value={currentLayout.dataStartRow}
                        onChange={(e) => handleDataRangeChange(parseInt(e.target.value), currentLayout.dataEndRow || sheetData.length - 1)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      >
                        {sheetData.map((_, rowIndex) => (
                          <option key={rowIndex} value={rowIndex}>
                            Row {rowIndex + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-2">End Row:</label>
                      <select
                        value={currentLayout.dataEndRow}
                        onChange={(e) => handleDataRangeChange(currentLayout.dataStartRow, parseInt(e.target.value))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      >
                        {sheetData.map((_, rowIndex) => (
                          <option key={rowIndex} value={rowIndex}>
                            Row {rowIndex + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    Data rows will be highlighted in the preview. Select the range containing your concentration-response data.
                  </div>
                </div>
              )}

              {/* Columns Configuration */}
              {activeSection === 'columns' && (
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Column Configuration</h3>
                  
                  {/* Concentration Column */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Concentration Column:</label>
                    <select
                      value={currentLayout.concentrationColumn}
                      onChange={(e) => handleConcentrationColumnChange(parseInt(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      {colOptions.map(col => (
                        <option key={col} value={col}>
                          Column {String.fromCharCode(65 + col)} ({col + 1})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Response Columns */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Response Columns:</label>
                    <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {colOptions.map(col => (
                        <label key={col} className="flex items-center mb-1">
                          <input
                            type="checkbox"
                            checked={currentLayout.responseColumns.includes(col)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                handleResponseColumnsChange([...currentLayout.responseColumns, col]);
                              } else {
                                handleResponseColumnsChange(currentLayout.responseColumns.filter(c => c !== col));
                              }
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm">
                            Column {String.fromCharCode(65 + col)} ({col + 1})
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Sample Names */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Sample Names:</label>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {currentLayout.responseColumns.map((col, index) => (
                        <div key={col} className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500 w-16">
                            Col {String.fromCharCode(65 + col)}:
                          </span>
                          <input
                            type="text"
                            value={(currentLayout.sampleNames || [])[index] || ''}
                            onChange={(e) => {
                              const newNames = [...(currentLayout.sampleNames || [])];
                              newNames[index] = e.target.value;
                              handleSampleNamesChange(newNames);
                            }}
                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                            placeholder={`Sample ${index + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Validation */}
              <div>
                <button
                  onClick={handleValidate}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Validate Configuration
                </button>
                
                {validationResult && (
                  <div className={`mt-3 p-3 rounded-lg ${
                    validationResult.isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}>
                    <div className="flex items-center mb-2">
                      {validationResult.isValid ? (
                        <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className={`font-medium ${
                        validationResult.isValid ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {validationResult.isValid ? 'Configuration Valid' : 'Configuration Issues'}
                      </span>
                    </div>
                    {validationResult.issues.length > 0 && (
                      <ul className="space-y-1 text-sm">
                        {validationResult.issues.map((issue, index) => (
                          <li key={index} className={
                            issue.type === 'error' ? 'text-red-700' : 'text-yellow-700'
                          }>
                            • {issue.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Data Preview */}
          <div className="flex-1 p-6 overflow-auto">
            <div className="mb-4">
              <h3 className="font-medium text-gray-900 mb-2">Data Preview</h3>
              <div className="flex items-center space-x-4 text-xs text-gray-600">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-purple-100 border border-purple-300 mr-2"></div>
                  Header Row
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-blue-100 border border-blue-300 mr-2"></div>
                  Concentration Column
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-100 border border-green-300 mr-2"></div>
                  Response Columns
                </div>
              </div>
            </div>

            <div className="overflow-auto border border-gray-200 rounded-lg">
              <table className="min-w-full">
                <tbody>
                  {sheetData.slice(0, 20).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      <td className="px-2 py-1 text-xs text-gray-500 bg-gray-50 border-r border-gray-200 sticky left-0">
                        {rowIndex + 1}
                      </td>
                      {(row as unknown[]).slice(0, 10).map((cell, colIndex) => (
                        <td
                          key={colIndex}
                          className={renderCellHighlight(rowIndex, colIndex)}
                          title={`Row ${rowIndex + 1}, Column ${String.fromCharCode(65 + colIndex)}`}
                        >
                          {cell ? String(cell) : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={onApply}
            disabled={!validationResult?.isValid}
            className="px-6 py-2 bg-[#8A0051] text-white rounded-lg hover:bg-[#6A003F] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply Configuration
          </button>
        </div>
      </div>
    </div>
  );
}