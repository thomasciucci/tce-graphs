import React, { useState } from 'react';

interface UnifiedColumnReplicateEditorProps {
  sampleNames: string[];
  onSave: (columnNames: string[], groupAssignments: string[], groupNames: Record<string, string>) => void;
  initialGroupAssignments?: string[];
  initialGroupNames?: Record<string, string>;
  tableName?: string;
}

export default function UnifiedColumnReplicateEditor({
  sampleNames,
  onSave,
  initialGroupAssignments = [],
  initialGroupNames = {},
  tableName = ''
}: UnifiedColumnReplicateEditorProps) {
  const [columnNames, setColumnNames] = useState<string[]>(sampleNames);
  const [groupAssignments, setGroupAssignments] = useState<string[]>(
    initialGroupAssignments.length === sampleNames.length
      ? initialGroupAssignments
      : sampleNames.map((_, i) => `Group ${i + 1}`)
  );
  const [groupNames, setGroupNames] = useState<Record<string, string>>({
    ...Object.fromEntries(sampleNames.map((_, i) => [`Group ${i + 1}`, `Group ${i + 1}`])),
    ...initialGroupNames
  });
  const [groupOptions, setGroupOptions] = useState<string[]>(
    Array.from(new Set(groupAssignments.length === sampleNames.length ? groupAssignments : sampleNames.map((_, i) => `Group ${i + 1}`)))
  );

  const handleColumnNameChange = (idx: number, value: string) => {
    setColumnNames(prev => prev.map((n, i) => (i === idx ? value : n)));
  };
  const handleGroupAssignmentChange = (idx: number, group: string) => {
    let assignedGroup = group;
    if (group === '') {
      // Find the next available group number
      const existingNumbers = groupOptions
        .map(opt => {
          const match = opt.match(/^Group (\d+)$/);
          return match ? parseInt(match[1], 10) : null;
        })
        .filter((n): n is number => n !== null);
      let nextNumber = 1;
      while (existingNumbers.includes(nextNumber)) {
        nextNumber++;
      }
      assignedGroup = `Group ${nextNumber}`;
    }
    setGroupAssignments(prev => prev.map((g, i) => (i === idx ? assignedGroup : g)));
    if (!groupOptions.includes(assignedGroup)) {
      setGroupOptions(prev => [...prev, assignedGroup]);
      setGroupNames(prev => ({ ...prev, [assignedGroup]: assignedGroup }));
    }
  };
  const handleGroupNameChange = (group: string, name: string) => {
    setGroupNames(prev => ({ ...prev, [group]: name }));
  };
  const handleSave = () => {
    onSave(columnNames, groupAssignments, groupNames);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow max-w-xl mx-auto mt-8">
      <h2 className="text-xl font-semibold mb-4">Edit Columns and Replicates{tableName ? `: ${tableName}` : ''}</h2>
      <table className="w-full mb-4">
        <thead>
          <tr>
            <th className="text-left p-2">Column</th>
            <th className="text-left p-2">Replicate Group</th>
          </tr>
        </thead>
        <tbody>
          {columnNames.map((name, idx) => (
            <tr key={idx}>
              <td className="p-2">
                <input
                  type="text"
                  className="border rounded px-2 py-1 w-full"
                  value={name}
                  onChange={e => handleColumnNameChange(idx, e.target.value)}
                />
              </td>
              <td className="p-2">
                <select
                  className="border rounded px-2 py-1"
                  value={groupAssignments[idx]}
                  onChange={e => handleGroupAssignmentChange(idx, e.target.value)}
                >
                  {groupOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  <option value="">-- New Group --</option>
                </select>
                {groupAssignments[idx] === '' && (
                  <input
                    type="text"
                    className="border rounded px-2 py-1 ml-2"
                    placeholder="Group name"
                    onBlur={e => handleGroupAssignmentChange(idx, e.target.value)}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Live summary of group assignments */}
      <div className="mb-4">
        <h3 className="font-medium mb-2">Current Groupings</h3>
        <ul className="text-sm text-gray-800">
          {groupOptions.map(group => {
            const members = columnNames
              .map((col, idx) => groupAssignments[idx] === group ? col : null)
              .filter(Boolean);
            if (!members || members.length === 0) return null;
            return (
              <li key={group} className="mb-1">
                <span className="font-semibold text-[#8A0051]">{groupNames[group] || group}:</span> {members.join(', ')}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="mb-4">
        <h3 className="font-medium mb-2">Name Each Group</h3>
        {groupOptions.map(group => (
          <div key={group} className="flex items-center mb-2">
            <span className="w-32">{group}:</span>
            <input
              type="text"
              className="border rounded px-2 py-1 ml-2"
              value={groupNames[group] || group}
              onChange={e => handleGroupNameChange(group, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
                          className="bg-[#8A0051] text-white px-4 py-2 rounded hover:bg-[#6A003F]"
          onClick={handleSave}
        >
          Continue
        </button>
      </div>
    </div>
  );
} 