/**
 * Smart Preview Dashboard for nVitro Studio
 * Revolutionary interface with intelligent data visualization and guided workflows
 */

'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { RobustDetectionResult, EnhancedRecommendation, RobustConfidence } from '../utils/robustDetectionEngine';
import { PatternCandidate } from '../utils/adaptivePatternDetector';
import { ScientificValidationResult, ValidationScore } from '../utils/scientificValidator';

// Core dashboard interfaces
export interface SmartPreviewDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (configuration: ImportConfiguration) => void;
  detectionResult: RobustDetectionResult;
  rawData: any[][];
}

export interface ImportConfiguration {
  detectionMethod: 'automatic' | 'guided' | 'manual';
  columnMapping: ColumnMapping;
  qualityThresholds: QualityThresholds;
  processingOptions: ProcessingOptions;
  selectedDatasets?: string[];
}

export interface ColumnMapping {
  headerRow: number;
  concentrationColumn: number;
  responseColumns: number[];
  metadataColumns: number[];
  dataStartRow: number;
  dataEndRow?: number;
}

export interface QualityThresholds {
  minimumConfidence: number;
  allowLowQualityData: boolean;
  requirePatternRecognition: boolean;
  enforceScientificValidation: boolean;
}

export interface ProcessingOptions {
  autoCorrectOutliers: boolean;
  interpolateMissingValues: boolean;
  normalizeUnits: boolean;
  validateBiologicalRelevance: boolean;
}

// Component interfaces
interface NavigationStep {
  id: string;
  title: string;
  status: 'pending' | 'current' | 'completed' | 'error';
  optional: boolean;
}

interface QualityIndicatorProps {
  score: ValidationScore;
  size?: 'small' | 'medium' | 'large';
  showDetails?: boolean;
}

interface ConfidenceVisualizationProps {
  confidence: RobustConfidence;
  showBreakdown?: boolean;
}

interface PatternVisualizationProps {
  patterns: PatternCandidate[];
  selectedPattern?: PatternCandidate;
  onPatternSelect: (pattern: PatternCandidate) => void;
}

interface RecommendationPanelProps {
  recommendations: EnhancedRecommendation[];
  onRecommendationAction: (recommendation: EnhancedRecommendation, action: string) => void;
}

interface DataGridProps {
  data: any[][];
  highlighting: DataHighlighting;
  interactive: boolean;
  onCellSelect?: (row: number, col: number) => void;
}

interface DataHighlighting {
  headerRow: number;
  concentrationColumn: number;
  responseColumns: number[];
  errorCells: Array<{row: number, col: number, type: string}>;
  qualityIssues: Array<{row: number, col: number, severity: string}>;
}

/**
 * Main Smart Preview Dashboard Component
 */
export default function SmartPreviewDashboard({
  isOpen,
  onClose,
  onAccept,
  detectionResult,
  rawData
}: SmartPreviewDashboardProps) {
  // Navigation state
  const [currentStep, setCurrentStep] = useState('overview');
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  
  // Configuration state
  const [importConfiguration, setImportConfiguration] = useState<ImportConfiguration>({
    detectionMethod: 'automatic',
    columnMapping: {
      headerRow: detectionResult.headerRow,
      concentrationColumn: detectionResult.concentrationColumn,
      responseColumns: detectionResult.responseColumns,
      metadataColumns: [],
      dataStartRow: detectionResult.dataStartRow
    },
    qualityThresholds: {
      minimumConfidence: 0.6,
      allowLowQualityData: false,
      requirePatternRecognition: true,
      enforceScientificValidation: true
    },
    processingOptions: {
      autoCorrectOutliers: false,
      interpolateMissingValues: false,
      normalizeUnits: true,
      validateBiologicalRelevance: true
    }
  });

  // UI state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview', 'quality']));
  const [selectedPattern, setSelectedPattern] = useState<PatternCandidate | undefined>(
    detectionResult.adaptivePatterns[0]
  );
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Navigation steps with dynamic status
  const navigationSteps: NavigationStep[] = useMemo(() => {
    const steps = [
      {
        id: 'overview',
        title: 'Overview',
        status: 'completed' as const,
        optional: false
      },
      {
        id: 'quality',
        title: 'Quality Assessment',
        status: detectionResult.validationResult.overall.level === 'unacceptable' ? 'error' as const : 'completed' as const,
        optional: false
      },
      {
        id: 'patterns',
        title: 'Pattern Analysis',
        status: detectionResult.adaptivePatterns.length > 0 ? 'completed' as const : 'error' as const,
        optional: true
      },
      {
        id: 'mapping',
        title: 'Column Mapping',
        status: detectionResult.concentrationColumn >= 0 ? 'completed' as const : 'pending' as const,
        optional: false
      },
      {
        id: 'configuration',
        title: 'Import Configuration',
        status: 'pending' as const,
        optional: true
      }
    ];

    // Update current step status
    return steps.map(step => ({
      ...step,
      status: step.id === currentStep ? 'current' as const : step.status
    }));
  }, [currentStep, detectionResult]);

  // Data highlighting for interactive grid
  const dataHighlighting: DataHighlighting = useMemo(() => ({
    headerRow: detectionResult.headerRow,
    concentrationColumn: detectionResult.concentrationColumn,
    responseColumns: detectionResult.responseColumns,
    errorCells: [], // Would be populated from validation results
    qualityIssues: [] // Would be populated from quality assessment
  }), [detectionResult]);

  // Handle navigation
  const handleStepNavigation = useCallback((stepId: string) => {
    setCurrentStep(stepId);
    
    // Mark previous steps as completed
    const stepIndex = navigationSteps.findIndex(s => s.id === stepId);
    if (stepIndex >= 0) {
      const newCompleted = new Set(completedSteps);
      navigationSteps.slice(0, stepIndex).forEach(step => {
        if (step.status !== 'error') {
          newCompleted.add(step.id);
        }
      });
      setCompletedSteps(newCompleted);
    }
  }, [navigationSteps, completedSteps]);

  // Handle configuration changes
  const handleConfigurationChange = useCallback(<K extends keyof ImportConfiguration>(
    key: K,
    value: ImportConfiguration[K]
  ) => {
    setImportConfiguration(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  // Handle recommendation actions
  const handleRecommendationAction = useCallback((
    recommendation: EnhancedRecommendation,
    action: string
  ) => {
    switch (action) {
      case 'apply':
        // Apply recommendation automatically
        if (recommendation.category === 'experimental-design') {
          // Update quality thresholds or processing options
        }
        break;
      case 'dismiss':
        // Remove recommendation from list
        break;
      case 'details':
        // Show detailed explanation
        break;
    }
  }, []);

  // Calculate readiness for import
  const importReadiness = useMemo(() => {
    const confidence = detectionResult.robustConfidence.overall;
    const qualityLevel = detectionResult.validationResult.overall.level;
    const hasPattern = detectionResult.adaptivePatterns.length > 0;
    const hasValidMapping = detectionResult.concentrationColumn >= 0 && detectionResult.responseColumns.length > 0;

    const criticalIssues = detectionResult.enhancedRecommendations.filter(r => r.type === 'critical').length;
    const readyForImport = confidence >= importConfiguration.qualityThresholds.minimumConfidence &&
                          hasValidMapping &&
                          criticalIssues === 0;

    return {
      ready: readyForImport,
      confidence,
      qualityLevel,
      hasPattern,
      hasValidMapping,
      criticalIssues,
      score: Math.min(confidence, hasValidMapping ? 1 : 0, criticalIssues === 0 ? 1 : 0)
    };
  }, [detectionResult, importConfiguration.qualityThresholds.minimumConfidence]);

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-7xl w-full bg-white rounded-xl shadow-2xl max-h-[95vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-[#8A0051] to-[#B8006B]">
            <div className="flex items-center justify-between">
              <div>
                <Dialog.Title className="text-xl font-semibold text-white">
                  Smart Data Import Analysis
                </Dialog.Title>
                <p className="text-[#E8B3D1] text-sm mt-1">
                  Intelligent detection with scientific validation and quality assessment
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <OverallConfidenceIndicator confidence={detectionResult.robustConfidence} />
                <button
                  onClick={onClose}
                  className="text-white hover:text-[#E8B3D1] transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Navigation Sidebar */}
            <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
              <NavigationSidebar
                steps={navigationSteps}
                currentStep={currentStep}
                onStepSelect={handleStepNavigation}
                readiness={importReadiness}
              />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-auto p-6">
                <StepContent
                  currentStep={currentStep}
                  detectionResult={detectionResult}
                  rawData={rawData}
                  configuration={importConfiguration}
                  onConfigurationChange={handleConfigurationChange}
                  selectedPattern={selectedPattern}
                  onPatternSelect={setSelectedPattern}
                  dataHighlighting={dataHighlighting}
                  onRecommendationAction={handleRecommendationAction}
                  showAdvancedOptions={showAdvancedOptions}
                  onToggleAdvancedOptions={() => setShowAdvancedOptions(!showAdvancedOptions)}
                />
              </div>

              {/* Action Bar */}
              <ActionBar
                readiness={importReadiness}
                currentStep={currentStep}
                navigationSteps={navigationSteps}
                onStepNavigation={handleStepNavigation}
                onAccept={() => onAccept(importConfiguration)}
                onCancel={onClose}
              />
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

/**
 * Overall Confidence Indicator Component
 */
const OverallConfidenceIndicator: React.FC<{ confidence: RobustConfidence }> = ({ confidence }) => {
  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-100 border-green-300';
    if (score >= 0.6) return 'text-yellow-100 border-yellow-300';
    if (score >= 0.4) return 'text-orange-100 border-orange-300';
    return 'text-red-100 border-red-300';
  };

  const getConfidenceIcon = (score: number) => {
    if (score >= 0.8) return '✓';
    if (score >= 0.6) return '⚠';
    if (score >= 0.4) return '!';
    return '✗';
  };

  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full border-2 font-medium ${getConfidenceColor(confidence.overall)}`}>
      <span className="mr-2">{getConfidenceIcon(confidence.overall)}</span>
      <span>Overall: {(confidence.overall * 100).toFixed(1)}%</span>
    </div>
  );
};

/**
 * Navigation Sidebar Component
 */
const NavigationSidebar: React.FC<{
  steps: NavigationStep[];
  currentStep: string;
  onStepSelect: (stepId: string) => void;
  readiness: any;
}> = ({ steps, currentStep, onStepSelect, readiness }) => {
  const getStepIcon = (step: NavigationStep) => {
    switch (step.status) {
      case 'completed':
        return <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-sm">✓</div>;
      case 'current':
        return <div className="w-6 h-6 rounded-full bg-[#8A0051] flex items-center justify-center text-white text-sm">●</div>;
      case 'error':
        return <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white text-sm">!</div>;
      default:
        return <div className="w-6 h-6 rounded-full bg-gray-300"></div>;
    }
  };

  return (
    <div className="p-4 space-y-2">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Analysis Steps</h3>
      
      {steps.map((step, index) => (
        <button
          key={step.id}
          onClick={() => onStepSelect(step.id)}
          className={`w-full flex items-center space-x-3 p-3 rounded-lg text-left transition-colors ${
            step.id === currentStep
              ? 'bg-[#8A0051] text-white'
              : step.status === 'completed'
              ? 'bg-green-50 text-green-800 hover:bg-green-100'
              : step.status === 'error'
              ? 'bg-red-50 text-red-800 hover:bg-red-100'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          {getStepIcon(step)}
          <div className="flex-1">
            <div className="font-medium text-sm">{step.title}</div>
            {step.optional && (
              <div className="text-xs opacity-75">Optional</div>
            )}
          </div>
        </button>
      ))}

      {/* Import Readiness Summary */}
      <div className="mt-6 p-3 bg-white rounded-lg border">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Import Readiness</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span>Overall Score</span>
            <span className={`font-medium ${readiness.score >= 0.8 ? 'text-green-600' : readiness.score >= 0.6 ? 'text-yellow-600' : 'text-red-600'}`}>
              {(readiness.score * 100).toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${readiness.score >= 0.8 ? 'bg-green-500' : readiness.score >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${readiness.score * 100}%` }}
            ></div>
          </div>
          {readiness.criticalIssues > 0 && (
            <div className="text-xs text-red-600">
              {readiness.criticalIssues} critical issue(s)
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Step Content Router Component
 */
const StepContent: React.FC<{
  currentStep: string;
  detectionResult: RobustDetectionResult;
  rawData: any[][];
  configuration: ImportConfiguration;
  onConfigurationChange: <K extends keyof ImportConfiguration>(key: K, value: ImportConfiguration[K]) => void;
  selectedPattern?: PatternCandidate;
  onPatternSelect: (pattern: PatternCandidate) => void;
  dataHighlighting: DataHighlighting;
  onRecommendationAction: (recommendation: EnhancedRecommendation, action: string) => void;
  showAdvancedOptions: boolean;
  onToggleAdvancedOptions: () => void;
}> = ({ 
  currentStep, 
  detectionResult, 
  rawData, 
  configuration, 
  onConfigurationChange,
  selectedPattern,
  onPatternSelect,
  dataHighlighting,
  onRecommendationAction,
  showAdvancedOptions,
  onToggleAdvancedOptions
}) => {
  switch (currentStep) {
    case 'overview':
      return (
        <OverviewStep
          detectionResult={detectionResult}
          rawData={rawData}
        />
      );
    case 'quality':
      return (
        <QualityAssessmentStep
          validationResult={detectionResult.validationResult}
          robustConfidence={detectionResult.robustConfidence}
          performanceMetrics={detectionResult.performanceMetrics}
        />
      );
    case 'patterns':
      return (
        <PatternAnalysisStep
          patterns={detectionResult.adaptivePatterns}
          selectedPattern={selectedPattern}
          onPatternSelect={onPatternSelect}
          integrationMetrics={detectionResult.integrationMetrics}
        />
      );
    case 'mapping':
      return (
        <ColumnMappingStep
          detectionResult={detectionResult}
          rawData={rawData}
          configuration={configuration}
          onConfigurationChange={onConfigurationChange}
          dataHighlighting={dataHighlighting}
        />
      );
    case 'configuration':
      return (
        <ImportConfigurationStep
          configuration={configuration}
          onConfigurationChange={onConfigurationChange}
          recommendations={detectionResult.enhancedRecommendations}
          onRecommendationAction={onRecommendationAction}
          showAdvancedOptions={showAdvancedOptions}
          onToggleAdvancedOptions={onToggleAdvancedOptions}
        />
      );
    default:
      return <div>Step not found</div>;
  }
};

/**
 * Overview Step Component
 */
const OverviewStep: React.FC<{
  detectionResult: RobustDetectionResult;
  rawData: any[][];
}> = ({ detectionResult, rawData }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Detection Overview</h2>
        <p className="text-gray-600">
          Comprehensive analysis of your Excel data with multi-method validation and scientific assessment.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Data Points"
          value={`${rawData.length - detectionResult.dataStartRow}`}
          subtitle={`${rawData.length} total rows`}
          icon="📊"
        />
        <StatCard
          title="Confidence"
          value={`${(detectionResult.robustConfidence.overall * 100).toFixed(1)}%`}
          subtitle="Multi-method consensus"
          icon="🎯"
        />
        <StatCard
          title="Pattern Quality"
          value={detectionResult.adaptivePatterns.length > 0 ? 
            `${(detectionResult.adaptivePatterns[0].confidence * 100).toFixed(1)}%` : 'N/A'
          }
          subtitle={detectionResult.adaptivePatterns[0]?.type || 'No pattern'}
          icon="📈"
        />
        <StatCard
          title="Scientific Grade"
          value={detectionResult.validationResult.qualityReport.summary.overallGrade}
          subtitle="Validation assessment"
          icon="🔬"
        />
      </div>

      {/* Method Comparison */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Detection Method Comparison</h3>
        <MethodComparisonChart 
          structuralConfidence={detectionResult.robustConfidence.structural}
          patternConfidence={detectionResult.robustConfidence.pattern}
          validationConfidence={detectionResult.robustConfidence.validation}
          consensusScore={detectionResult.integrationMetrics.consensusScore}
        />
      </div>

      {/* Critical Issues Alert */}
      {detectionResult.enhancedRecommendations.some(r => r.type === 'critical') && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="text-red-500 text-xl">⚠️</div>
            <div>
              <h4 className="font-semibold text-red-900">Critical Issues Detected</h4>
              <p className="text-red-700 text-sm mt-1">
                {detectionResult.enhancedRecommendations.filter(r => r.type === 'critical').length} critical issue(s) 
                require attention before import.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Quality Assessment Step Component
 */
const QualityAssessmentStep: React.FC<{
  validationResult: ScientificValidationResult;
  robustConfidence: RobustConfidence;
  performanceMetrics: any;
}> = ({ validationResult, robustConfidence, performanceMetrics }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Quality Assessment</h2>
        <p className="text-gray-600">
          Comprehensive scientific validation and quality metrics for your dose-response data.
        </p>
      </div>

      {/* Overall Quality Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Overall Quality Assessment</h3>
          <QualityGradeBadge grade={validationResult.qualityReport.summary.overallGrade} />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QualityMetricCard
            title="Biological Relevance"
            score={validationResult.qualityReport.scientificAssessment.biologicalRelevance}
            description="Appropriateness for biological systems"
          />
          <QualityMetricCard
            title="Statistical Power"
            score={validationResult.qualityReport.scientificAssessment.statisticalPower}
            description="Adequacy for reliable curve fitting"
          />
          <QualityMetricCard
            title="Methodological Soundness"
            score={validationResult.qualityReport.scientificAssessment.methodologicalSoundness}
            description="Adherence to best practices"
          />
        </div>
      </div>

      {/* Detailed Quality Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QualityDetailPanel
          title="Concentration Analysis"
          validation={validationResult.concentration}
          type="concentration"
        />
        <QualityDetailPanel
          title="Response Analysis"
          validation={validationResult.response}
          type="response"
        />
      </div>

      {/* Confidence Breakdown */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Confidence Analysis</h3>
        <ConfidenceBreakdownChart confidence={robustConfidence} />
      </div>
    </div>
  );
};

/**
 * Pattern Analysis Step Component
 */
const PatternAnalysisStep: React.FC<{
  patterns: PatternCandidate[];
  selectedPattern?: PatternCandidate;
  onPatternSelect: (pattern: PatternCandidate) => void;
  integrationMetrics: any;
}> = ({ patterns, selectedPattern, onPatternSelect, integrationMetrics }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Pattern Analysis</h2>
        <p className="text-gray-600">
          Advanced mathematical pattern recognition with statistical validation and biological assessment.
        </p>
      </div>

      {patterns.length > 0 ? (
        <>
          {/* Pattern Selection */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Detected Patterns</h3>
            <PatternSelectionGrid
              patterns={patterns}
              selectedPattern={selectedPattern}
              onPatternSelect={onPatternSelect}
            />
          </div>

          {/* Selected Pattern Details */}
          {selectedPattern && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Pattern Details</h3>
              <PatternDetailView pattern={selectedPattern} />
            </div>
          )}

          {/* Integration Metrics */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Method Integration</h3>
            <IntegrationMetricsView metrics={integrationMetrics} />
          </div>
        </>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <div className="text-yellow-500 text-xl">⚠️</div>
            <div>
              <h4 className="font-semibold text-yellow-900">No Clear Pattern Detected</h4>
              <p className="text-yellow-700 text-sm mt-1">
                The concentration series does not follow a recognizable dilution pattern. 
                This may affect curve fitting reliability.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Column Mapping Step Component
 */
const ColumnMappingStep: React.FC<{
  detectionResult: RobustDetectionResult;
  rawData: any[][];
  configuration: ImportConfiguration;
  onConfigurationChange: <K extends keyof ImportConfiguration>(key: K, value: ImportConfiguration[K]) => void;
  dataHighlighting: DataHighlighting;
}> = ({ detectionResult, rawData, configuration, onConfigurationChange, dataHighlighting }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Column Mapping</h2>
        <p className="text-gray-600">
          Verify and adjust the detected column assignments for optimal data import.
        </p>
      </div>

      {/* Interactive Data Grid */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Interactive Data Preview</h3>
        <InteractiveDataGrid
          data={rawData.slice(0, 15)} // Show first 15 rows
          highlighting={dataHighlighting}
          onCellSelect={(row: number, col: number) => {
            // Handle cell selection for manual mapping
          }}
        />
      </div>

      {/* Column Configuration Panel */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Column Configuration</h3>
        <ColumnConfigurationPanel
          configuration={configuration}
          onConfigurationChange={onConfigurationChange}
          maxColumns={rawData[0]?.length || 0}
          maxRows={rawData.length}
        />
      </div>
    </div>
  );
};

/**
 * Import Configuration Step Component
 */
const ImportConfigurationStep: React.FC<{
  configuration: ImportConfiguration;
  onConfigurationChange: <K extends keyof ImportConfiguration>(key: K, value: ImportConfiguration[K]) => void;
  recommendations: EnhancedRecommendation[];
  onRecommendationAction: (recommendation: EnhancedRecommendation, action: string) => void;
  showAdvancedOptions: boolean;
  onToggleAdvancedOptions: () => void;
}> = ({ 
  configuration, 
  onConfigurationChange, 
  recommendations, 
  onRecommendationAction,
  showAdvancedOptions,
  onToggleAdvancedOptions
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Import Configuration</h2>
        <p className="text-gray-600">
          Customize import settings and review recommendations for optimal data processing.
        </p>
      </div>

      {/* Recommendations Panel */}
      <RecommendationPanel
        recommendations={recommendations}
        onRecommendationAction={onRecommendationAction}
      />

      {/* Quality Thresholds */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Quality Thresholds</h3>
        <QualityThresholdPanel
          thresholds={configuration.qualityThresholds}
          onThresholdChange={(thresholds: any) => onConfigurationChange('qualityThresholds', thresholds)}
        />
      </div>

      {/* Processing Options */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Processing Options</h3>
          <button
            onClick={onToggleAdvancedOptions}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {showAdvancedOptions ? 'Hide' : 'Show'} Advanced Options
          </button>
        </div>
        <ProcessingOptionsPanel
          options={configuration.processingOptions}
          onOptionsChange={(options: any) => onConfigurationChange('processingOptions', options)}
          showAdvanced={showAdvancedOptions}
        />
      </div>
    </div>
  );
};

/**
 * Action Bar Component
 */
const ActionBar: React.FC<{
  readiness: any;
  currentStep: string;
  navigationSteps: NavigationStep[];
  onStepNavigation: (stepId: string) => void;
  onAccept: () => void;
  onCancel: () => void;
}> = ({ readiness, currentStep, navigationSteps, onStepNavigation, onAccept, onCancel }) => {
  const currentIndex = navigationSteps.findIndex(s => s.id === currentStep);
  const canGoNext = currentIndex < navigationSteps.length - 1;
  const canGoPrev = currentIndex > 0;

  const handleNext = () => {
    if (canGoNext) {
      onStepNavigation(navigationSteps[currentIndex + 1].id);
    }
  };

  const handlePrev = () => {
    if (canGoPrev) {
      onStepNavigation(navigationSteps[currentIndex - 1].id);
    }
  };

  return (
    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <button
          onClick={handlePrev}
          disabled={!canGoPrev}
          className={`px-4 py-2 text-sm font-medium rounded-md ${
            canGoPrev
              ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
              : 'text-gray-400 bg-gray-100 cursor-not-allowed'
          }`}
        >
          ← Previous
        </button>
        
        <button
          onClick={handleNext}
          disabled={!canGoNext}
          className={`px-4 py-2 text-sm font-medium rounded-md ${
            canGoNext
              ? 'text-white bg-[#8A0051] hover:bg-[#6A003F]'
              : 'text-gray-400 bg-gray-200 cursor-not-allowed'
          }`}
        >
          Next →
        </button>
      </div>

      <div className="flex items-center space-x-3">
        <div className="text-sm text-gray-600">
          Import Readiness: 
          <span className={`ml-1 font-medium ${
            readiness.score >= 0.8 ? 'text-green-600' : 
            readiness.score >= 0.6 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {(readiness.score * 100).toFixed(0)}%
          </span>
        </div>

        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        
        <button
          onClick={onAccept}
          disabled={!readiness.ready}
          className={`px-6 py-2 text-sm font-medium rounded-md ${
            readiness.ready
              ? 'text-white bg-[#8A0051] hover:bg-[#6A003F]'
              : 'text-gray-400 bg-gray-200 cursor-not-allowed'
          }`}
        >
          Import Data
        </button>
      </div>
    </div>
  );
};

// Placeholder components that would be implemented with full functionality
const StatCard: React.FC<{title: string, value: string, subtitle: string, icon: string}> = ({ title, value, subtitle, icon }) => (
  <div className="bg-white border border-gray-200 rounded-lg p-4">
    <div className="flex items-center justify-between mb-2">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-lg">{icon}</div>
    </div>
    <div className="text-xl font-semibold text-gray-900">{value}</div>
    <div className="text-xs text-gray-500">{subtitle}</div>
  </div>
);

const MethodComparisonChart: React.FC<{
  structuralConfidence: number;
  patternConfidence: number;
  validationConfidence: number;
  consensusScore: number;
}> = ({ structuralConfidence, patternConfidence, validationConfidence, consensusScore }) => (
  <div className="space-y-3">
    {[
      { label: 'Structural Detection', value: structuralConfidence },
      { label: 'Pattern Recognition', value: patternConfidence },
      { label: 'Scientific Validation', value: validationConfidence },
      { label: 'Method Consensus', value: consensusScore }
    ].map(({ label, value }) => (
      <div key={label} className="flex items-center space-x-3">
        <div className="w-32 text-sm text-gray-600">{label}</div>
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div 
            className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
            style={{ width: `${value * 100}%` }}
          ></div>
        </div>
        <div className="w-12 text-sm font-medium text-gray-900 text-right">
          {(value * 100).toFixed(0)}%
        </div>
      </div>
    ))}
  </div>
);

const QualityGradeBadge: React.FC<{grade: string}> = ({ grade }) => {
  const getGradeColor = (g: string) => {
    switch (g) {
      case 'A': return 'bg-green-100 text-green-800 border-green-300';
      case 'B': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'C': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'D': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'F': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full border font-semibold text-lg ${getGradeColor(grade)}`}>
      Grade {grade}
    </div>
  );
};

const QualityMetricCard: React.FC<{title: string, score: number, description: string}> = ({ title, score, description }) => (
  <div className="text-center">
    <div className="text-2xl font-bold text-gray-900">{(score * 100).toFixed(0)}%</div>
    <div className="text-sm font-medium text-gray-700">{title}</div>
    <div className="text-xs text-gray-500 mt-1">{description}</div>
  </div>
);

// Additional placeholder components would continue here...
const QualityDetailPanel: React.FC<any> = () => <div>Quality Detail Panel</div>;
const ConfidenceBreakdownChart: React.FC<any> = () => <div>Confidence Breakdown Chart</div>;
const PatternSelectionGrid: React.FC<any> = () => <div>Pattern Selection Grid</div>;
const PatternDetailView: React.FC<any> = () => <div>Pattern Detail View</div>;
const IntegrationMetricsView: React.FC<any> = () => <div>Integration Metrics View</div>;
const InteractiveDataGrid: React.FC<any> = () => <div>Interactive Data Grid</div>;
const ColumnConfigurationPanel: React.FC<any> = () => <div>Column Configuration Panel</div>;
const RecommendationPanel: React.FC<any> = () => <div>Recommendation Panel</div>;
const QualityThresholdPanel: React.FC<any> = () => <div>Quality Threshold Panel</div>;
const ProcessingOptionsPanel: React.FC<any> = () => <div>Processing Options Panel</div>;