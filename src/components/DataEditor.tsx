'use client';

import React, { useState, useEffect } from 'react';
import { DataPoint } from '../types';

interface DataEditorProps {
  data: DataPoint[];
  onDataUpdate: (data: DataPoint[]) => void;
  datasets?: Array<{ id?: string; name: string; assayType?: string }>;
  activeDatasetIndex?: number;
  onDatasetChange?: (index: number) => void;
  hasReplicates?: boolean;
}

export default function DataEditor({ data, onDataUpdate, datasets, activeDatasetIndex, onDatasetChange, hasReplicates }: DataEditorProps) {
  const [editingData, setEditingData] = useState<DataPoint[]>(data);
  const [isEditing, setIsEditing] = useState(false);
  
  // Update editing data when the data prop changes (dataset switching)
  useEffect(() => {
    setEditingData([...data]);
    // Exit edit mode when switching datasets to avoid confusion
    setIsEditing(false);
  }, [data]);

  const handleEdit = () => {
    setIsEditing(true);
    setEditingData([...data]);
    // Remove replicateGroups state and related useEffect
  };

  const currentData = isEditing ? editingData : data;

  // Helper: get current replicateGroups (assume all rows have the same)
  const getCurrentReplicateGroups = () => {
    if (currentData.length > 0 && currentData[0].replicateGroups && currentData[0].replicateGroups.length === currentData[0].sampleNames.length) {
      return [...currentData[0].replicateGroups];
    }
    // Default: each column is its own group
    return currentData[0]?.sampleNames?.map((_, i) => `Group ${i + 1}`) || [];
  };

  const [replicateGroups, setReplicateGroups] = useState<string[]>(getCurrentReplicateGroups());

  // Keep replicateGroups in sync with data/sampleNames
  useEffect(() => {
    setReplicateGroups(getCurrentReplicateGroups());
  }, [isEditing, currentData.length, currentData[0]?.sampleNames?.join(','), currentData[0]?.replicateGroups?.join(',')]);

  // Handler for changing a replicate group assignment
  const handleReplicateGroupChange = (colIdx: number, value: string) => {
    const newGroups = [...replicateGroups];
    newGroups[colIdx] = value;
    setReplicateGroups(newGroups);
  };

  const handleSave = () => {
    // Preserve replicateGroups in all rows
    const updated = editingData.map(row => ({ ...row, replicateGroups: [...replicateGroups] }));
    onDataUpdate(updated);
    setIsEditing(false);
    setEditingData(updated);
  };

  const handleCancel = () => {
    setEditingData([...data]);
    setIsEditing(false);
  };

  const updateValue = (rowIndex: number, colIndex: number, value: string) => {
    const newData = [...editingData];
    if (colIndex === 0) {
      // Update concentration
      newData[rowIndex].concentration = parseFloat(value) || 0;
    } else {
      // Update response value
      newData[rowIndex].responses[colIndex - 1] = parseFloat(value) || 0;
    }
    setEditingData(newData);
  };

  const addRow = () => {
    const newRow: DataPoint = {
      concentration: 0,
      responses: new Array(data[0]?.responses.length || 0).fill(0),
      sampleNames: data[0]?.sampleNames || []
    };
    setEditingData([...editingData, newRow]);
  };

  const removeRow = (index: number) => {
    setEditingData(editingData.filter((_, i) => i !== index));
  };

  const addGroup = () => {
    setReplicateGroups([...replicateGroups, `Group ${replicateGroups.length + 1}`]);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <svg className="w-6 h-6 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Data Editor
        </h2>
        {!isEditing ? (
          <button
            onClick={handleEdit}
            className="px-4 py-2 bg-[#8A0051] text-white rounded-md hover:bg-[#6A003F] transition-colors duration-200 flex items-center gap-2 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Data
          </button>
        ) : (
          <div className="space-x-2">
            <button
              onClick={handleSave}
                              className="px-4 py-2 bg-[#8A0051] text-white rounded-md hover:bg-[#6A003F] transition-colors duration-200 flex items-center gap-2 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors duration-200 flex items-center gap-2 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Dataset Selection (only show when multiple datasets) */}
      {datasets && datasets.length > 1 && onDatasetChange && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="font-medium text-gray-900 mb-3">Select Dataset</h3>
          <div className="flex flex-wrap gap-2">
            {datasets.map((dataset, index) => {
              // Use the best keyword for the tab label
              let label = dataset.name;
              const genericPattern = /^data table/i;
              if (genericPattern.test(label)) {
                // Try to find a better keyword in sample names
                const sampleText = (dataset.name || '').toLowerCase();
                if (sampleText.includes('cytotoxicity') || sampleText.includes('killing')) {
                  label = 'Cytotoxicity';
                } else if (sampleText.includes('cd4')) {
                  label = 'CD4 Activation';
                } else if (sampleText.includes('cd8')) {
                  label = 'CD8 Activation';
                }
              }
              return (
                <button
                  key={`${dataset.id || ''}_${index}`}
                  onClick={() => onDatasetChange(index)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    index === activeDatasetIndex
                      ? 'bg-[#8A0051] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {currentData.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700">
                  Concentration
                </th>
                {currentData[0].sampleNames.map((name, index) => (
                  <th key={`header_${name || 'col'}_${index}`} className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700">
                    <div>{name}</div>
                  </th>
                ))}
                {isEditing && (
                  <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700">
                    Actions
                  </th>
                )}
              </tr>
              {hasReplicates && (
                <tr className="bg-gray-100">
                  <td className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold text-gray-700">
                    Replicate Group
                  </td>
                  {currentData[0].sampleNames.map((name, colIdx) => (
                    <td key={`repgroup_${colIdx}`} className="border border-gray-300 px-3 py-2 text-xs">
                      {isEditing ? (
                        <input
                          type="text"
                          value={replicateGroups[colIdx] || ''}
                          onChange={e => handleReplicateGroupChange(colIdx, e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder={`Group ${colIdx + 1}`}
                        />
                      ) : (
                        <span className="text-gray-700">{replicateGroups[colIdx]}</span>
                      )}
                    </td>
                  ))}
                  {isEditing && <td className="border border-gray-300 px-3 py-2"></td>}
                </tr>
              )}
            </thead>
            <tbody>
              {currentData.map((row, rowIndex) => (
                <tr key={`row_${rowIndex}`} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-3 py-2">
                    {isEditing ? (
                      <input
                        type="text"
                        value={row.concentration}
                        onChange={(e) => updateValue(rowIndex, 0, e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter concentration"
                      />
                    ) : (
                      row.concentration
                    )}
                  </td>
                  {row.responses.map((response, colIndex) => (
                    <td key={`cell_${rowIndex}_${colIndex}`} className="border border-gray-300 px-3 py-2">
                      {isEditing ? (
                        <input
                          type="text"
                          value={response}
                          onChange={(e) => updateValue(rowIndex, colIndex + 1, e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter value"
                        />
                      ) : (
                        response
                      )}
                    </td>
                  ))}
                  {isEditing && (
                    <td className="border border-gray-300 px-3 py-2">
                      <button
                        onClick={() => removeRow(rowIndex)}
                        className="px-2 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors duration-200 flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isEditing && (
        <div className="mt-4">
          <button
            onClick={addRow}
            className="px-4 py-2 bg-[#8A0051] text-white rounded-md hover:bg-[#6A003F] transition-colors duration-200 flex items-center gap-2 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Row
          </button>
        </div>
      )}
    </div>
  );
} 