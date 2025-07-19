import React, { useState } from 'react';
import { DataPoint, Dataset } from '../types';

interface CurveNameEditorProps {
  data: DataPoint[];
  onSave: (newSampleNames: string[], newReplicateGroups?: string[], newTableName?: string, applyToAll?: boolean) => void;
  replicateGroups?: string[];
  onCancel?: () => void;
  tableName?: string;
  showApplyToAll?: boolean;
  datasets?: Dataset[]; // New: all datasets for dropdown mode
  onFinish?: (updatedDatasets: Dataset[]) => void; // New: finish callback
}

export default function CurveNameEditor({
  data,
  onSave,
  replicateGroups,
  onCancel,
  tableName = '',
  showApplyToAll = false,
  datasets = [],
  onFinish
}: CurveNameEditorProps) {
  // Multi-table dropdown mode if datasets.length > 1 and not showApplyToAll
  const multiTableMode = datasets.length > 1 && !showApplyToAll;
  const [selectedTableIdx, setSelectedTableIdx] = useState(0);
  // Local state for all tables' names
  const [editedDatasets, setEditedDatasets] = useState<Dataset[]>(
    datasets.length > 0 ? datasets.map(ds => ({ ...ds, data: ds.data.map(row => ({ ...row })) })) : []
  );
  // State for current table (single-table or apply-to-all mode)
  const [sampleNames, setSampleNames] = useState<string[]>(data[0]?.sampleNames || []);
  const [groupNames, setGroupNames] = useState<string[]>(
    replicateGroups && replicateGroups.length === sampleNames.length
      ? [...new Set(replicateGroups)]
      : []
  );
  const [editedReplicateGroups, setEditedReplicateGroups] = useState<string[]>(replicateGroups || []);
  const [editedTableName, setEditedTableName] = useState<string>(tableName);
  const groupNameMap = groupNames.reduce((acc, name) => {
    acc[name] = name;
    return acc;
  }, {} as Record<string, string>);
  const [editedGroupNames, setEditedGroupNames] = useState<Record<string, string>>(groupNameMap);
  const [applyToAll, setApplyToAll] = useState<boolean>(false);

  // For multi-table mode, update local state when switching tables
  React.useEffect(() => {
    if (multiTableMode && editedDatasets.length > 0) {
      const ds = editedDatasets[selectedTableIdx];
      setSampleNames(ds.data[0]?.sampleNames || []);
      setEditedReplicateGroups(ds.data[0]?.replicateGroups || []);
      setEditedTableName(ds.name || '');
      // Update groupNames and groupNameMap
      const gns = ds.data[0]?.replicateGroups && ds.data[0].replicateGroups.length === (ds.data[0].sampleNames?.length || 0)
        ? [...new Set(ds.data[0].replicateGroups)]
        : [];
      setGroupNames(gns);
      const groupNameMap = gns.reduce((acc, name) => { acc[name] = name; return acc; }, {} as Record<string, string>);
      setEditedGroupNames(groupNameMap);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTableIdx]);

  // Save changes for current table in multi-table mode
  const saveCurrentTableEdits = () => {
    if (!multiTableMode) return;
    setEditedDatasets(prev => prev.map((ds, i) =>
      i === selectedTableIdx
        ? {
            ...ds,
            name: editedTableName,
            data: ds.data.map(row => ({
              ...row,
              sampleNames: sampleNames,
              replicateGroups: editedReplicateGroups.length > 0 ? editedReplicateGroups : row.replicateGroups,
            })),
          }
        : ds
    ));
  };

  // When switching tables, save edits for the current table
  const handleTableChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    saveCurrentTableEdits();
    setSelectedTableIdx(Number(e.target.value));
  };

  // Save handler for single/apply-to-all mode
  const handleSave = () => {
    let finalReplicateGroups = editedReplicateGroups;
    if (groupNames.length > 0) {
      finalReplicateGroups = editedReplicateGroups;
    }
    onSave(sampleNames, finalReplicateGroups, editedTableName, applyToAll);
  };

  // Finish handler for multi-table mode
  const handleFinish = () => {
    saveCurrentTableEdits();
    if (onFinish) {
      onFinish(editedDatasets);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow max-w-xl mx-auto mt-8">
      <h2 className="text-xl font-semibold mb-4">Edit Table and Curve Names</h2>
      {multiTableMode && (
        <div className="mb-4">
          <label className="block text-gray-700 font-medium mb-1">Select Table</label>
          <select
            className="border rounded px-2 py-1 w-full"
            value={selectedTableIdx}
            onChange={handleTableChange}
          >
            {editedDatasets.map((ds, idx) => (
              <option key={ds.id} value={idx}>{ds.name || `Table ${idx + 1}`}</option>
            ))}
          </select>
        </div>
      )}
      <div className="mb-4">
        <label className="block text-gray-700 font-medium mb-1">Table/Dataset Name</label>
        <input
          type="text"
          className="border rounded px-2 py-1 w-full"
          value={editedTableName}
          onChange={e => setEditedTableName(e.target.value)}
        />
      </div>
      <table className="w-full mb-4">
        <thead>
          <tr>
            <th className="text-left p-2">Curve (Column)</th>
            {groupNames.length > 0 && <th className="text-left p-2">Group</th>}
          </tr>
        </thead>
        <tbody>
          {sampleNames.map((name, idx) => (
            <tr key={idx}>
              <td className="p-2">
                <input
                  type="text"
                  className="border rounded px-2 py-1 w-full"
                  value={name}
                  onChange={e => setSampleNames(prev => prev.map((n, i) => (i === idx ? e.target.value : n)))}
                />
              </td>
              {groupNames.length > 0 && (
                <td className="p-2">
                  <input
                    type="text"
                    className="border rounded px-2 py-1 w-full"
                    value={editedGroupNames[editedReplicateGroups[idx]] || editedReplicateGroups[idx]}
                    onChange={e => {
                      setEditedGroupNames(prev => ({ ...prev, [editedReplicateGroups[idx]]: e.target.value }));
                      setEditedReplicateGroups(prev => prev.map((g, i) => (i === idx ? e.target.value : g)));
                    }}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {showApplyToAll && (
        <div className="mb-4 flex items-center">
          <input
            type="checkbox"
            id="applyToAll"
            className="mr-2"
            checked={applyToAll}
            onChange={e => setApplyToAll(e.target.checked)}
          />
          <label htmlFor="applyToAll" className="text-gray-700">Apply these names to all tables</label>
        </div>
      )}
      <div className="flex gap-2">
        {multiTableMode ? (
          <button
            className="bg-[#8A0051] text-white px-4 py-2 rounded hover:bg-[#6A003F]"
            onClick={handleFinish}
          >
            Finish
          </button>
        ) : (
          <button
            className="bg-[#8A0051] text-white px-4 py-2 rounded hover:bg-[#6A003F]"
            onClick={handleSave}
          >
            Continue
          </button>
        )}
        {onCancel && (
          <button
            className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
} 