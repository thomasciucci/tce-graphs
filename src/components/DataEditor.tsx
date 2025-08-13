'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DataPoint, ReplicateGroupUtils } from '../types';

interface DataEditorProps {
  data: DataPoint[];
  onDataUpdate: (data: DataPoint[]) => void;
  datasets?: Array<{ id?: string; name: string; assayType?: string }>;
  activeDatasetIndex?: number;
  onDatasetChange?: (index: number) => void;
  hasReplicates?: boolean;
}

const DataEditor = React.memo(function DataEditor({ data, onDataUpdate, datasets, activeDatasetIndex, onDatasetChange, hasReplicates }: DataEditorProps) {
  const [editingData, setEditingData] = useState<DataPoint[]>(data);
  const [isEditing, setIsEditing] = useState(false);
  
  // Update editing data when the data prop changes (dataset switching)
  useEffect(() => {
    setEditingData([...data]);
    // Exit edit mode when switching datasets to avoid confusion
    setIsEditing(false);
  }, [data]);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setEditingData([...data]);
  }, [data]);

  const currentData = isEditing ? editingData : data;

  // Helper: get current replicateGroups (memoized)
  const getCurrentReplicateGroups = useMemo(() => {
    if (currentData.length > 0 && currentData[0].replicateGroups && currentData[0].replicateGroups.length === currentData[0].sampleNames.length) {
      return [...currentData[0].replicateGroups];
    }
    // Default: each column is its own group
    return currentData[0]?.sampleNames?.map((_, i) => `Group ${i + 1}`) || [];
  }, [currentData]);

  const [replicateGroups, setReplicateGroups] = useState<string[]>(getCurrentReplicateGroups);

  // Keep replicateGroups in sync with data/sampleNames
  useEffect(() => {
    setReplicateGroups(getCurrentReplicateGroups);
  }, [getCurrentReplicateGroups]);

  // Handler for changing a replicate group assignment
  const handleReplicateGroupChange = useCallback((colIdx: number, value: string) => {
    setReplicateGroups(prev => {
      const newGroups = [...prev];
      newGroups[colIdx] = value;
      return newGroups;
    });
  }, []);

  // Handler for renaming entire replicate groups
  const handleGroupRename = useCallback((oldName: string, newName: string) => {
    if (oldName === newName || !newName.trim()) return;
    
    setReplicateGroups(prev => prev.map(group => group === oldName ? newName.trim() : group));
    setEditingData(prev => ReplicateGroupUtils.updateGroupNames(prev, oldName, newName.trim()));
  }, []);

  const handleSave = useCallback(() => {
    // Ensure replicate groups are consistent and preserve them in all rows
    const updatedWithGroups = ReplicateGroupUtils.ensureReplicateGroups(editingData);
    const updated = updatedWithGroups.map(row => ({ ...row, replicateGroups: [...replicateGroups] }));
    onDataUpdate(updated);
    setIsEditing(false);
    setEditingData(updated);
  }, [editingData, replicateGroups, onDataUpdate]);

  const handleCancel = useCallback(() => {
    setEditingData([...data]);
    setIsEditing(false);
  }, [data]);

  const updateValue = useCallback((rowIndex: number, colIndex: number, value: string) => {
    setEditingData(prev => {
      const newData = [...prev];
      if (colIndex === 0) {
        // Update concentration
        newData[rowIndex].concentration = parseFloat(value) || 0;
      } else {
        // Update response value
        newData[rowIndex].responses[colIndex - 1] = parseFloat(value) || 0;
      }
      return newData;
    });
  }, []);

  const addRow = useCallback(() => {
    const newRow: DataPoint = {
      concentration: 0,
      responses: new Array(data[0]?.responses.length || 0).fill(0),
      sampleNames: data[0]?.sampleNames || []
    };
    setEditingData(prev => [...prev, newRow]);
  }, [data]);

  const removeRow = useCallback((index: number) => {
    setEditingData(prev => prev.filter((_, i) => i !== index));
  }, []);

  const removeColumn = useCallback((colIndex: number) => {
    setEditingData(prev => prev.map(row => ({
      ...row,
      responses: row.responses.filter((_, i) => i !== colIndex),
      sampleNames: row.sampleNames.filter((_, i) => i !== colIndex),
      replicateGroups: row.replicateGroups ? row.replicateGroups.filter((_, i) => i !== colIndex) : undefined
    })));
    
    // Update replicate groups state
    setReplicateGroups(prev => prev.filter((_, i) => i !== colIndex));
  }, []);


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
                    <div className="flex items-center justify-between">
                      <span>{name}</span>
                      {isEditing && currentData[0].sampleNames.length > 1 && (
                        <button
                          onClick={() => removeColumn(index)}
                          className="ml-2 p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors duration-200"
                          title="Remove column"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
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

      {/* Replicate Group Management Section */}
      {isEditing && hasReplicates && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Replicate Group Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ReplicateGroupUtils.getUniqueGroups(editingData).map((groupName) => {
              const samplesInGroup = ReplicateGroupUtils.getSamplesInGroup(editingData, groupName);
              const sampleNames = samplesInGroup.map(i => editingData[0].sampleNames[i]);
              return (
                <div key={groupName} className="bg-white p-3 rounded border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-800">{groupName}</h4>
                    <span className="text-sm text-gray-500">{samplesInGroup.length} samples</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <strong>Samples:</strong> {sampleNames.join(', ')}
                  </div>
                  <div className="mt-2">
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => handleGroupRename(groupName, e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Group name"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-xs text-gray-600">
            💡 <strong>Tip:</strong> Rename groups to create meaningful labels that will appear in your graphs and exports.
          </div>
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
});

export default DataEditor; 