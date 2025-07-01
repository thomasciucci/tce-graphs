'use client';

import { useState } from 'react';
import { DataPoint } from '../types';

interface DataEditorProps {
  data: DataPoint[];
  onDataUpdate: (data: DataPoint[]) => void;
}

export default function DataEditor({ data, onDataUpdate }: DataEditorProps) {
  const [editingData, setEditingData] = useState<DataPoint[]>(data);
  const [isEditing, setIsEditing] = useState(false);

  const handleEdit = () => {
    setIsEditing(true);
    setEditingData([...data]);
  };

  const handleSave = () => {
    onDataUpdate(editingData);
    setIsEditing(false);
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

  const currentData = isEditing ? editingData : data;

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Data Editor</h2>
        {!isEditing ? (
          <button
            onClick={handleEdit}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Edit Data
          </button>
        ) : (
          <div className="space-x-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {currentData.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700">
                  Concentration
                </th>
                {currentData[0].sampleNames.map((name, index) => (
                  <th key={index} className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700">
                    {name}
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
                <tr key={rowIndex} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-3 py-2">
                    {isEditing ? (
                      <input
                        type="number"
                        step="any"
                        value={row.concentration}
                        onChange={(e) => updateValue(rowIndex, 0, e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    ) : (
                      row.concentration
                    )}
                  </td>
                  {row.responses.map((response, colIndex) => (
                    <td key={colIndex} className="border border-gray-300 px-3 py-2">
                      {isEditing ? (
                        <input
                          type="number"
                          step="any"
                          value={response}
                          onChange={(e) => updateValue(rowIndex, colIndex + 1, e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded"
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
                        className="px-2 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                      >
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
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add Row
          </button>
        </div>
      )}
    </div>
  );
} 