'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DataPoint, ReplicateGroupUtils } from '../types';
import { Users, BarChart3, AlertCircle, CheckCircle, ArrowRight, Shuffle } from 'lucide-react';

interface SampleOrganizerProps {
  data: DataPoint[];
  onGroupingUpdate: (data: DataPoint[]) => void;
  onProceedToAnalysis: () => void;
  hasReplicates?: boolean;
}

interface GroupInfo {
  name: string;
  sampleIndices: number[];
  customName: string;
  color: string;
}

// Colors for different replicate groups - burgundy theme variations
const GROUP_COLORS = [
  '#8A0051', // Primary burgundy
  '#B8006B', // Light burgundy
  '#6A003F', // Dark burgundy
  '#A0005A', // Medium burgundy
  '#D10080', // Bright burgundy
  '#5A0033', // Deep burgundy
  '#C2007A', // Warm burgundy
  '#4A0029', // Very dark burgundy
  '#E6009E', // Light magenta
  '#3A001F', // Nearly black burgundy
];

const SampleOrganizer = React.memo(function SampleOrganizer({
  data,
  onGroupingUpdate,
  onProceedToAnalysis,
  hasReplicates = true
}: SampleOrganizerProps) {
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [draggedSample, setDraggedSample] = useState<{ index: number; name: string } | null>(null);

  // Initialize groups from data (preserve existing groupings only)
  useEffect(() => {
    const sampleNames = data[0]?.sampleNames || [];
    const existingGroups = data[0]?.replicateGroups;

    if (existingGroups && existingGroups.length === sampleNames.length) {
      // Convert existing groups to our format
      const uniqueGroupNames = Array.from(new Set(existingGroups));
      const initialGroups: GroupInfo[] = uniqueGroupNames.map((groupName, index) => {
        const sampleIndices = existingGroups
          .map((group, idx) => group === groupName ? idx : -1)
          .filter(idx => idx !== -1);
        
        return {
          name: groupName,
          sampleIndices,
          customName: groupName,
          color: GROUP_COLORS[index % GROUP_COLORS.length]
        };
      });
      setGroups(initialGroups);
    } else {
      // Start with empty groups - user must organize manually
      setGroups([]);
    }
  }, [data]);

  // Create a new empty group for user organization
  const createNewGroup = useCallback(() => {
    const newGroup: GroupInfo = {
      name: `Group ${groups.length + 1}`,
      sampleIndices: [],
      customName: `Treatment ${groups.length + 1}`,
      color: GROUP_COLORS[groups.length % GROUP_COLORS.length]
    };
    setGroups(prev => [...prev, newGroup]);
  }, [groups.length]);

  // Get unassigned samples
  const unassignedSamples = useMemo(() => {
    const assignedIndices = new Set(groups.flatMap(g => g.sampleIndices));
    const sampleNames = data[0]?.sampleNames || [];
    
    return sampleNames
      .map((name, index) => ({ name, index }))
      .filter(sample => !assignedIndices.has(sample.index));
  }, [groups, data]);

  // Drag and drop handlers
  const handleDragStart = useCallback((sample: { index: number; name: string }) => {
    setDraggedSample(sample);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((groupIndex: number) => {
    if (!draggedSample) return;

    setGroups(prev => {
      const newGroups = [...prev];
      
      // Remove sample from any existing group
      newGroups.forEach(group => {
        group.sampleIndices = group.sampleIndices.filter(idx => idx !== draggedSample.index);
      });
      
      // Add to target group
      if (groupIndex >= 0 && groupIndex < newGroups.length) {
        newGroups[groupIndex].sampleIndices.push(draggedSample.index);
      }
      
      return newGroups.filter(group => group.sampleIndices.length > 0);
    });

    setDraggedSample(null);
  }, [draggedSample]);

  // Remove empty groups helper
  const cleanupEmptyGroups = useCallback(() => {
    setGroups(prev => prev.filter(group => group.sampleIndices.length > 0));
  }, []);

  // Update group name
  const updateGroupName = useCallback((groupIndex: number, newName: string) => {
    setGroups(prev => prev.map((group, idx) => 
      idx === groupIndex ? { ...group, customName: newName } : group
    ));
  }, []);

  // Calculate statistics for a group
  const getGroupStatistics = useCallback((groupIndices: number[]) => {
    if (groupIndices.length === 0 || data.length === 0) return null;

    const allValues: number[] = [];
    data.forEach(point => {
      groupIndices.forEach(sampleIdx => {
        const value = point.responses[sampleIdx];
        if (value !== null && value !== undefined && !isNaN(value)) {
          allValues.push(value);
        }
      });
    });

    if (allValues.length === 0) return null;

    const mean = allValues.reduce((sum, val) => sum + val, 0) / allValues.length;
    const variance = allValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / allValues.length;
    const stdev = Math.sqrt(variance);

    return {
      sampleCount: groupIndices.length,
      dataPoints: allValues.length,
      mean: mean.toFixed(2),
      stdev: stdev.toFixed(2),
      range: [Math.min(...allValues).toFixed(2), Math.max(...allValues).toFixed(2)]
    };
  }, [data]);

  // Apply grouping to data and proceed
  const handleProceedToAnalysis = useCallback(() => {
    const sampleNames = data[0]?.sampleNames || [];
    const replicateGroups = new Array(sampleNames.length).fill('');

    // Apply group names to replicate groups array
    groups.forEach(group => {
      group.sampleIndices.forEach(sampleIdx => {
        if (sampleIdx < replicateGroups.length) {
          replicateGroups[sampleIdx] = group.customName;
        }
      });
    });

    // Update data with replicate groups
    const updatedData = data.map(point => ({
      ...point,
      replicateGroups: [...replicateGroups]
    }));

    onGroupingUpdate(updatedData);
    onProceedToAnalysis();
  }, [data, groups, onGroupingUpdate, onProceedToAnalysis]);

  // Validation - allow progression with individual samples
  const validation = useMemo(() => {
    const issues: string[] = [];
    const hasUnassigned = unassignedSamples.length > 0;
    const hasEmptyGroups = groups.some(g => g.sampleIndices.length === 0);
    const hasSingletonGroups = groups.some(g => g.sampleIndices.length === 1);
    const hasGroups = groups.length > 0 && groups.some(g => g.sampleIndices.length > 0);
    
    if (hasUnassigned && hasGroups) {
      issues.push(`${unassignedSamples.length} samples not assigned to any group`);
    }
    if (hasSingletonGroups) {
      issues.push('Some groups have only 1 sample (consider adding replicates)');
    }

    return {
      isValid: issues.length === 0,
      // Allow progression either with no groups (individual analysis) or with all samples assigned
      canProceed: !hasEmptyGroups && (!hasGroups || !hasUnassigned),
      issues,
      hasGroups
    };
  }, [unassignedSamples, groups]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-[#8A0051]" />
          <h2 className="text-2xl font-bold text-gray-900">Sample Organization</h2>
          
          {validation.isValid ? (
            <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>Ready</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{validation.issues.length} issue{validation.issues.length > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mb-6 p-4 bg-[#8A0051]/10 rounded-lg border border-[#8A0051]/30">
        <h3 className="text-sm font-semibold text-[#8A0051] mb-2">Organize Your Samples</h3>
        <p className="text-sm text-gray-700">
          <strong>Optional:</strong> Group samples into biological replicates by dragging them into groups below. 
          Samples in the same group will be treated as replicates in the analysis.
        </p>
        <p className="text-sm text-gray-600 mt-1">
          You can also proceed without grouping to analyze samples individually.
        </p>
      </div>

      {/* Validation Issues */}
      {validation.issues.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-sm font-semibold text-yellow-800 mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Organization Issues
          </h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            {validation.issues.map((issue, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="w-1 h-1 bg-yellow-600 rounded-full mt-2 flex-shrink-0"></span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Groups Column */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Replicate Groups</h3>
            <button
              onClick={createNewGroup}
              className="px-3 py-1 bg-[#8A0051]/10 text-[#8A0051] rounded-md hover:bg-[#8A0051]/20 transition-colors text-sm flex items-center gap-1"
            >
              <Users className="w-3 h-3" />
              New Group
            </button>
          </div>

          <div className="space-y-4">
            {groups.map((group, groupIndex) => (
              <div
                key={`group-${groupIndex}`}
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-[100px] hover:border-gray-400 transition-colors"
                style={{ borderColor: group.sampleIndices.length > 0 ? group.color : undefined }}
                onDragOver={handleDragOver}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(groupIndex);
                }}
              >
                {/* Group header */}
                <div className="flex items-center justify-between mb-3">
                  <input
                    type="text"
                    value={group.customName}
                    onChange={(e) => updateGroupName(groupIndex, e.target.value)}
                    className="text-sm font-semibold bg-transparent border-b border-gray-300 focus:border-gray-600 outline-none flex-1 mr-2"
                    placeholder="Group name"
                  />
                  <div 
                    className="w-4 h-4 rounded-full border-2 border-gray-400"
                    style={{ backgroundColor: group.color }}
                  />
                </div>

                {/* Samples in group */}
                <div className="flex flex-wrap gap-2 min-h-[40px]">
                  {group.sampleIndices.map(sampleIdx => {
                    const sampleName = data[0]?.sampleNames[sampleIdx] || `Sample ${sampleIdx + 1}`;
                    return (
                      <div
                        key={`sample-${sampleIdx}`}
                        className="px-3 py-1 rounded-full text-sm font-medium text-white cursor-move"
                        style={{ backgroundColor: group.color }}
                        draggable
                        onDragStart={() => handleDragStart({ index: sampleIdx, name: sampleName })}
                      >
                        {sampleName}
                      </div>
                    );
                  })}
                  
                  {group.sampleIndices.length === 0 && (
                    <div className="text-gray-400 text-sm italic py-2">
                      Drag samples here...
                    </div>
                  )}
                </div>

                {/* Group statistics */}
                {group.sampleIndices.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span>{group.sampleIndices.length} samples</span>
                      {(() => {
                        const stats = getGroupStatistics(group.sampleIndices);
                        if (stats) {
                          return (
                            <>
                              <span>{stats.dataPoints} data points</span>
                              <span>Mean: {stats.mean} (±{stats.stdev})</span>
                            </>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Unassigned Samples & Actions Column */}
        <div className="space-y-6">
          {/* Unassigned samples */}
          {unassignedSamples.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Unassigned Samples</h3>
              <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                <div className="space-y-2">
                  {unassignedSamples.map(sample => (
                    <div
                      key={`unassigned-${sample.index}`}
                      className="px-3 py-2 bg-white border border-gray-300 rounded-md cursor-move hover:shadow-sm transition-shadow"
                      draggable
                      onDragStart={() => handleDragStart(sample)}
                    >
                      <span className="text-sm font-medium">{sample.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Organization summary */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Organization Summary
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Samples:</span>
                <span className="font-medium">{data[0]?.sampleNames.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Groups Created:</span>
                <span className="font-medium">{groups.filter(g => g.sampleIndices.length > 0).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Assigned Samples:</span>
                <span className="font-medium">
                  {(data[0]?.sampleNames.length || 0) - unassignedSamples.length}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={cleanupEmptyGroups}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
            >
              <Shuffle className="w-4 h-4 inline mr-2" />
              Clean Up Empty Groups
            </button>

            <button
              onClick={handleProceedToAnalysis}
              disabled={!validation.canProceed}
              className={`w-full px-4 py-3 rounded-md transition-colors flex items-center justify-center gap-2 font-semibold ${
                validation.canProceed
                  ? 'bg-[#8A0051] text-white hover:bg-[#6A003F] shadow-md hover:shadow-lg'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <span>
                {validation.hasGroups ? 'Proceed with Groups' : 'Proceed with Individual Samples'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-6 text-xs text-gray-600">
        <strong>Sample Organization Purpose:</strong> Group your samples into biological replicates. 
        Samples in the same group will be averaged together in the analysis and shown as replicates in charts.
      </div>
    </div>
  );
});

// Note: Auto-detection removed - users must manually organize replicates

export default SampleOrganizer;