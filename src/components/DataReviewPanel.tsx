'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DataPoint } from '../types';
import { CheckCircle, AlertCircle, Edit3, Eye, Minus } from 'lucide-react';

interface DataReviewPanelProps {
  data: DataPoint[];
  onDataUpdate: (data: DataPoint[]) => void;
  datasets?: Array<{ id?: string; name: string; assayType?: string }>;
  activeDatasetIndex?: number;
  onDatasetChange?: (index: number) => void;
  hasReplicates?: boolean;
}

const DataReviewPanel = React.memo(function DataReviewPanel({ 
  data, 
  onDataUpdate, 
  datasets, 
  activeDatasetIndex, 
  onDatasetChange, 
  hasReplicates 
}: DataReviewPanelProps) {
  const [editingData, setEditingData] = useState<DataPoint[]>(data);
  const [isEditing, setIsEditing] = useState(false);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);

  // Data validation function
  const validateData = useCallback((dataToValidate: DataPoint[]) => {
    const issues: string[] = [];
    
    if (dataToValidate.length < 4) {
      issues.push('Consider having at least 4 concentration points for reliable curve fitting');
    }
    
    // Check for missing values
    const hasEmptyValues = dataToValidate.some(row => 
      row.responses.some(val => val === null || val === undefined || isNaN(val))
    );
    if (hasEmptyValues) {
      issues.push('Some response values are missing or invalid');
    }
    
    // Check concentration pattern
    const concentrations = dataToValidate.map(row => row.concentration).sort((a, b) => a - b);
    const isMonotonic = concentrations.every((val, i) => i === 0 || val > concentrations[i - 1]);
    if (!isMonotonic) {
      issues.push('Duplicate or non-increasing concentrations detected');
    }
    
    setValidationIssues(issues);
  }, []);

  // Update editing data when the data prop changes (dataset switching)
  useEffect(() => {
    setEditingData([...data]);
    setIsEditing(false);
    validateData([...data]);
  }, [data, validateData]);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setEditingData([...data]);
  }, [data]);

  const handleSave = useCallback(() => {
    validateData(editingData);
    onDataUpdate(editingData);
    setIsEditing(false);
  }, [editingData, onDataUpdate, validateData]);

  const handleCancel = useCallback(() => {
    setEditingData([...data]);
    setIsEditing(false);
  }, [data]);

  const updateValue = useCallback((rowIndex: number, colIndex: number, value: string) => {
    setEditingData(prev => {
      const newData = [...prev];
      if (colIndex === 0) {
        // Update concentration
        newData[rowIndex] = {
          ...newData[rowIndex],
          concentration: parseFloat(value) || 0
        };
      } else {
        // Update response value
        const newResponses = [...newData[rowIndex].responses];
        newResponses[colIndex - 1] = parseFloat(value) || 0;
        newData[rowIndex] = {
          ...newData[rowIndex],
          responses: newResponses
        };
      }
      return newData;
    });
  }, []);

  // Removed addRow - users shouldn't add concentration points

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
  }, []);

  const currentData = isEditing ? editingData : data;

  // Data quality summary
  const dataQuality = useMemo(() => {
    const totalPoints = currentData.length * (currentData[0]?.responses.length || 0);
    const validPoints = currentData.reduce((count, row) => 
      count + row.responses.filter(val => val !== null && val !== undefined && !isNaN(val)).length, 0
    );
    const completeness = totalPoints > 0 ? (validPoints / totalPoints) * 100 : 0;
    
    return {
      totalPoints,
      validPoints,
      completeness: Math.round(completeness),
      concentrationPoints: currentData.length,
      samples: currentData[0]?.sampleNames.length || 0
    };
  }, [currentData]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <Edit3 className="w-6 h-6 text-[#8A0051]" />
            ) : (
              <Eye className="w-6 h-6 text-[#8A0051]" />
            )}
            <h2 className="text-2xl font-bold text-gray-900">
              Data Review
            </h2>
          </div>
          
          {/* Data Quality Indicator */}
          <div className="flex items-center gap-2">
            {validationIssues.length === 0 ? (
              <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>Valid</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{validationIssues.length} issue{validationIssues.length > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>

        {/* Edit Controls */}
        {!isEditing ? (
          <button
            onClick={handleEdit}
            className="px-4 py-2 bg-[#8A0051] text-white rounded-md hover:bg-[#6A003F] transition-colors duration-200 flex items-center gap-2 shadow-sm"
          >
            <Edit3 className="w-4 h-4" />
            Review & Edit Data
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-[#8A0051] text-white rounded-md hover:bg-[#6A003F] transition-colors duration-200 flex items-center gap-2 shadow-sm"
            >
              <CheckCircle className="w-4 h-4" />
              Save Changes
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Data Quality Summary */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Data Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Concentration Points</div>
            <div className="font-semibold text-gray-900">{dataQuality.concentrationPoints}</div>
          </div>
          <div>
            <div className="text-gray-500">Samples</div>
            <div className="font-semibold text-gray-900">{dataQuality.samples}</div>
          </div>
          <div>
            <div className="text-gray-500">Data Completeness</div>
            <div className="font-semibold text-gray-900">{dataQuality.completeness}%</div>
          </div>
          <div>
            <div className="text-gray-500">Total Data Points</div>
            <div className="font-semibold text-gray-900">{dataQuality.validPoints}/{dataQuality.totalPoints}</div>
          </div>
        </div>
      </div>

      {/* Validation Issues */}
      {validationIssues.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-sm font-semibold text-yellow-800 mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Data Quality Notes
          </h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            {validationIssues.map((issue, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="w-1 h-1 bg-yellow-600 rounded-full mt-2 flex-shrink-0"></span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Dataset Selection */}
      {datasets && datasets.length > 1 && onDatasetChange && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="font-medium text-gray-900 mb-3">Select Dataset</h3>
          <div className="flex flex-wrap gap-2">
            {datasets.map((dataset, index) => (
              <button
                key={`${dataset.id || ''}_${index}`}
                onClick={() => onDatasetChange(index)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  index === activeDatasetIndex
                    ? 'bg-[#8A0051] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {dataset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Data Table */}
      {currentData.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700">
                  Concentration [nM]
                </th>
                {currentData[0].sampleNames.map((name, index) => (
                  <th key={`header_${name || 'col'}_${index}`} className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700">
                    <div className="flex items-center justify-between">
                      <span>{name}</span>
                      {isEditing && currentData[0].sampleNames.length > 1 && (
                        <button
                          onClick={() => removeColumn(index)}
                          className="ml-2 p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                          title="Remove column"
                        >
                          <Minus className="w-3 h-3" />
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
            </thead>
            <tbody>
              {currentData.map((row, rowIndex) => (
                <tr key={`row_${rowIndex}`} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-3 py-2">
                    {isEditing ? (
                      <input
                        type="number"
                        value={row.concentration}
                        onChange={(e) => updateValue(rowIndex, 0, e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter concentration"
                      />
                    ) : (
                      <span className="font-mono">{row.concentration}</span>
                    )}
                  </td>
                  {row.responses.map((response, colIndex) => (
                    <td key={`cell_${rowIndex}_${colIndex}`} className="border border-gray-300 px-3 py-2">
                      {isEditing ? (
                        <input
                          type="number"
                          value={response}
                          onChange={(e) => updateValue(rowIndex, colIndex + 1, e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter value"
                        />
                      ) : (
                        <span className="font-mono">{response}</span>
                      )}
                    </td>
                  ))}
                  {isEditing && (
                    <td className="border border-gray-300 px-3 py-2">
                      <button
                        onClick={() => removeRow(rowIndex)}
                        className="px-2 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors flex items-center gap-1"
                        title="Remove this concentration point"
                      >
                        <Minus className="w-3 h-3" />
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

      {/* Data Quality Tools (only show when editing) */}
      {isEditing && (
        <div className="mt-6 p-4 bg-[#8A0051]/10 rounded-lg border border-[#8A0051]/30">
          <h3 className="text-sm font-semibold text-[#8A0051] mb-3">Data Quality Tools</h3>
          <div className="text-sm text-gray-700">
            <div className="flex items-center gap-1 mb-2">
              <AlertCircle className="w-4 h-4 text-[#8A0051]" />
              <strong>Edit individual values to fix:</strong>
            </div>
            <ul className="ml-5 space-y-1">
              <li>• Outlier data points</li>
              <li>• Technical errors in measurements</li>
              <li>• Incorrect concentration values</li>
            </ul>
            <div className="mt-3 text-xs text-[#8A0051]">
              <strong>Note:</strong> Use &quot;Remove&quot; buttons to exclude entire concentration points or samples with systematic issues
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-4 text-xs text-gray-600">
        <strong>Data Review Purpose:</strong> Verify that your imported data is accurate and complete before proceeding to sample organization and analysis.
      </div>
    </div>
  );
});

export default DataReviewPanel;