'use client';

import React, { useCallback } from 'react';
import { 
  AnalysisConfiguration, 
  OutputMetrics
} from '../types';
import { Settings, CheckCircle } from 'lucide-react';

interface AnalysisConfigurationProps {
  configuration: AnalysisConfiguration;
  onConfigurationUpdate: (config: AnalysisConfiguration) => void;
  onProceed: () => void;
}

// Simplified configuration presets
const DEFAULT_CONFIGS: Record<string, AnalysisConfiguration> = {
  inhibition: {
    assayType: 'inhibition',
    constraints: {
      topConstraints: { enabled: true, fixed: 100 },
      bottomConstraints: { enabled: true, fixed: 0 },
      hillSlopeConstraints: { enabled: false, min: -10, max: -0.1 },
      ec50Constraints: { enabled: false }
    },
    statistics: {
      confidenceLevel: 0.95,
      calculateCI: false,
      outlierDetection: { enabled: false, method: 'z-score', threshold: 2.5 },
      qualityThresholds: { minimumRSquared: 0.80, minimumDataPoints: 6 }
    },
    metrics: {
      calculateIC10: true,
      calculateIC50: true,
      calculateIC90: true,
      calculateEC10: false,
      calculateEC50: false,
      calculateEC90: false,
      calculateHillSlope: true,
      calculateAUC: true
    },
    preprocessing: {
      normalization: { enabled: false, method: 'percent-control' },
      logTransform: { concentration: true, response: false }
    }
  },
  stimulation: {
    assayType: 'stimulation',
    constraints: {
      topConstraints: { enabled: false },
      bottomConstraints: { enabled: true, fixed: 0 },
      hillSlopeConstraints: { enabled: false, min: 0.1, max: 10 },
      ec50Constraints: { enabled: false }
    },
    statistics: {
      confidenceLevel: 0.95,
      calculateCI: false,
      outlierDetection: { enabled: false, method: 'z-score', threshold: 2.5 },
      qualityThresholds: { minimumRSquared: 0.80, minimumDataPoints: 6 }
    },
    metrics: {
      calculateIC10: false,
      calculateIC50: false,
      calculateIC90: false,
      calculateEC10: true,
      calculateEC50: true,
      calculateEC90: true,
      calculateHillSlope: true,
      calculateAUC: true
    },
    preprocessing: {
      normalization: { enabled: false, method: 'percent-control' },
      logTransform: { concentration: true, response: false }
    }
  }
};

const AnalysisConfigurationComponent: React.FC<AnalysisConfigurationProps> = ({
  configuration,
  onConfigurationUpdate,
  onProceed
}) => {

  // Handle preset selection
  const handlePresetChange = useCallback((preset: string) => {
    if (preset in DEFAULT_CONFIGS) {
      onConfigurationUpdate(DEFAULT_CONFIGS[preset]);
    }
  }, [onConfigurationUpdate]);

  // Update constraints - simplified for top/bottom only
  const updateConstraints = useCallback((constraintType: 'top' | 'bottom', constraintMode: 'fixed' | 'free') => {
    const updates = constraintMode === 'fixed' 
      ? { enabled: true, fixed: constraintType === 'top' ? 100 : 0 }
      : { enabled: false, fixed: undefined };
    
    const field = constraintType === 'top' ? 'topConstraints' : 'bottomConstraints';
    onConfigurationUpdate({
      ...configuration,
      constraints: {
        ...configuration.constraints,
        [field]: { ...configuration.constraints[field], ...updates }
      }
    });
  }, [configuration, onConfigurationUpdate]);

  // Update output metrics
  const updateMetrics = useCallback((updates: Partial<OutputMetrics>) => {
    onConfigurationUpdate({
      ...configuration,
      metrics: { ...configuration.metrics, ...updates }
    });
  }, [configuration, onConfigurationUpdate]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-[#8A0051]" />
        <h2 className="text-2xl font-bold text-gray-900">Analysis Configuration</h2>
      </div>

      {/* Assay Type Selection */}
      <div className="mb-6 p-4 bg-[#8A0051]/5 rounded-lg border border-[#8A0051]/20">
        <h3 className="text-sm font-semibold text-[#8A0051] mb-3">Assay Type</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries({
            inhibition: 'IC50 Inhibition',
            stimulation: 'EC50 Stimulation'
          }).map(([key, label]) => (
            <button
              key={key}
              onClick={() => handlePresetChange(key)}
              className={`px-4 py-2 rounded-md border transition-all ${
                configuration.assayType === key
                  ? 'bg-[#8A0051] text-white border-[#8A0051]'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-[#8A0051]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {/* Top/Bottom Constraints */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-4">Curve Constraints</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700">Top (Maximum Response)</label>
              <select
                value={configuration.constraints.topConstraints.enabled && configuration.constraints.topConstraints.fixed !== undefined ? 'fixed' : 'free'}
                onChange={(e) => updateConstraints('top', e.target.value as 'fixed' | 'free')}
                className="px-3 py-1 border border-gray-300 rounded-md focus:ring-[#8A0051] focus:border-[#8A0051]"
              >
                <option value="fixed">Fixed (0-100)</option>
                <option value="free">Free fitting</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700">Bottom (Minimum Response)</label>
              <select
                value={configuration.constraints.bottomConstraints.enabled && configuration.constraints.bottomConstraints.fixed !== undefined ? 'fixed' : 'free'}
                onChange={(e) => updateConstraints('bottom', e.target.value as 'fixed' | 'free')}
                className="px-3 py-1 border border-gray-300 rounded-md focus:ring-[#8A0051] focus:border-[#8A0051]"
              >
                <option value="fixed">Fixed (0-100)</option>
                <option value="free">Free fitting</option>
              </select>
            </div>
          </div>
        </div>

        {/* Output Metrics */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-4">Output Metrics</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries({
              calculateEC10: 'EC10',
              calculateEC50: 'EC50', 
              calculateEC90: 'EC90',
              calculateHillSlope: 'Slope',
              calculateAUC: 'AUC'
            }).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={configuration.metrics[key as keyof OutputMetrics]}
                  onChange={(e) => updateMetrics({ [key]: e.target.checked })}
                  className="rounded text-[#8A0051] focus:ring-[#8A0051]"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              R² (goodness of fit) is always calculated automatically
            </p>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={onProceed}
          className="px-6 py-2 bg-[#8A0051] text-white rounded-md hover:bg-[#6A003F] transition-colors flex items-center gap-2"
        >
          <CheckCircle className="w-4 h-4" />
          Apply Configuration
        </button>
      </div>
    </div>
  );
};

export default AnalysisConfigurationComponent;