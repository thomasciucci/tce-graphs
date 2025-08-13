'use client';

import React from 'react';
import { CheckCircle, Eye, Users, Settings } from 'lucide-react';

export type WorkflowPhase = 'data-review' | 'sample-organization' | 'analysis-setup' | 'results';

interface WorkflowProgressProps {
  currentPhase: WorkflowPhase;
  completedPhases: WorkflowPhase[];
  onPhaseClick?: (phase: WorkflowPhase) => void;
}

const phases = [
  {
    id: 'data-review' as WorkflowPhase,
    title: 'Data Review',
    description: 'Verify data accuracy',
    icon: Eye,
  },
  {
    id: 'sample-organization' as WorkflowPhase,
    title: 'Sample Organization',
    description: 'Group replicates',
    icon: Users,
  },
  {
    id: 'analysis-setup' as WorkflowPhase,
    title: 'Analysis Setup',
    description: 'Configure parameters',
    icon: Settings,
  }
];

const WorkflowProgress: React.FC<WorkflowProgressProps> = ({
  currentPhase,
  completedPhases,
  onPhaseClick
}) => {
  const getPhaseStatus = (phaseId: WorkflowPhase) => {
    if (completedPhases.includes(phaseId)) return 'completed';
    if (phaseId === currentPhase) return 'current';
    return 'pending';
  };

  const getPhaseStyles = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          container: 'bg-green-50 border-green-200',
          icon: 'bg-green-100 text-green-700',
          title: 'text-green-800',
          description: 'text-green-600',
          connector: 'bg-green-300'
        };
      case 'current':
        return {
          container: 'bg-[#8A0051]/5 border-[#8A0051] ring-2 ring-[#8A0051]/20',
          icon: 'bg-[#8A0051] text-white',
          title: 'text-[#8A0051]',
          description: 'text-gray-600',
          connector: 'bg-gray-300'
        };
      default:
        return {
          container: 'bg-gray-50 border-gray-200',
          icon: 'bg-gray-200 text-gray-500',
          title: 'text-gray-500',
          description: 'text-gray-400',
          connector: 'bg-gray-300'
        };
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Analysis Workflow</h2>
        <div className="text-sm text-gray-600">
          Step {phases.findIndex(p => p.id === currentPhase) + 1} of {phases.length}
        </div>
      </div>
      
      <div className="relative">
        <div className="flex items-center justify-between">
          {phases.map((phase, index) => {
            const status = getPhaseStatus(phase.id);
            const styles = getPhaseStyles(status);
            const Icon = phase.icon;
            const isClickable = onPhaseClick && completedPhases.includes(phase.id);

            return (
              <div key={phase.id} className="flex-1 relative">
                <div
                  className={`
                    border-2 rounded-lg p-4 transition-all cursor-pointer
                    ${styles.container}
                    ${isClickable ? 'hover:shadow-md' : ''}
                  `}
                  onClick={isClickable ? () => onPhaseClick(phase.id) : undefined}
                >
                  <div className="flex flex-col items-center text-center">
                    {/* Icon */}
                    <div className={`
                      w-12 h-12 rounded-full flex items-center justify-center mb-2 relative
                      ${styles.icon}
                    `}>
                      {status === 'completed' ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        <Icon className="w-6 h-6" />
                      )}
                    </div>
                    
                    {/* Title */}
                    <h3 className={`font-semibold text-sm mb-1 ${styles.title}`}>
                      {phase.title}
                    </h3>
                    
                    {/* Description */}
                    <p className={`text-xs ${styles.description}`}>
                      {phase.description}
                    </p>
                  </div>
                </div>

                {/* Connector line */}
                {index < phases.length - 1 && (
                  <div
                    className={`
                      absolute top-6 left-full w-4 h-0.5 transform translate-y-1
                      ${status === 'completed' ? 'bg-green-300' : 'bg-gray-300'}
                    `}
                    style={{ width: 'calc(100% - 2rem)', left: 'calc(100% - 1rem)' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-6">
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span>Workflow Progress</span>
          <span>{Math.round(((completedPhases.length + (currentPhase ? 0.5 : 0)) / phases.length) * 100)}% Complete</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-[#8A0051] h-2 rounded-full transition-all duration-300"
            style={{
              width: `${((completedPhases.length + (currentPhase ? 0.5 : 0)) / phases.length) * 100}%`
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default WorkflowProgress;