/**
 * Guided Correction Workflow for nVitro Studio
 * Step-by-step correction process with real-time validation and smart suggestions
 */

'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Dialog } from '@headlessui/react';
import { RobustDetectionResult, EnhancedRecommendation } from '../utils/robustDetectionEngine';
import { ScientificValidationResult } from '../utils/scientificValidator';

// Core workflow interfaces
export interface GuidedCorrectionWorkflowProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (corrections: CorrectionResult) => void;
  detectionResult: RobustDetectionResult;
  rawData: any[][];
  issues: WorkflowIssue[];
}

export interface WorkflowIssue {
  id: string;
  type: 'critical' | 'important' | 'suggestion' | 'optimization';
  category: 'structure' | 'pattern' | 'quality' | 'configuration';
  title: string;
  description: string;
  impact: IssueImpact;
  correctionSteps: CorrectionStep[];
  autoFixAvailable: boolean;
  estimatedTime: string;
}

export interface IssueImpact {
  confidence: number;
  accuracy: number;
  reliability: number;
  description: string;
}

export interface CorrectionStep {
  id: string;
  title: string;
  description: string;
  type: 'selection' | 'input' | 'validation' | 'confirmation';
  required: boolean;
  options?: CorrectionOption[];
  validation?: StepValidation;
  guidance?: StepGuidance;
}

export interface CorrectionOption {
  id: string;
  label: string;
  description: string;
  recommended: boolean;
  impact: string;
}

export interface StepValidation {
  rules: ValidationRule[];
  realTimeValidation: boolean;
  errorMessages: Record<string, string>;
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'range' | 'pattern' | 'custom';
  params?: any;
  message: string;
}

export interface StepGuidance {
  tips: string[];
  examples: string[];
  commonMistakes: string[];
  bestPractices: string[];
}

export interface CorrectionResult {
  correctedIssues: string[];
  appliedFixes: AppliedFix[];
  updatedConfiguration: any;
  validationResults: any;
  userActions: UserAction[];
}

export interface AppliedFix {
  issueId: string;
  stepId: string;
  action: string;
  parameters: any;
  impact: IssueImpact;
}

export interface UserAction {
  timestamp: number;
  action: string;
  target: string;
  parameters: any;
}

// Workflow state management
interface WorkflowState {
  currentIssueIndex: number;
  currentStepIndex: number;
  completedIssues: Set<string>;
  stepResults: Record<string, any>;
  validationErrors: Record<string, string[]>;
  userActions: UserAction[];
}

/**
 * Main Guided Correction Workflow Component
 */
export default function GuidedCorrectionWorkflow({
  isOpen,
  onClose,
  onComplete,
  detectionResult,
  rawData,
  issues
}: GuidedCorrectionWorkflowProps) {
  // Workflow state
  const [workflowState, setWorkflowState] = useState<WorkflowState>({
    currentIssueIndex: 0,
    currentStepIndex: 0,
    completedIssues: new Set(),
    stepResults: {},
    validationErrors: {},
    userActions: []
  });

  // UI state
  const [showGuidance, setShowGuidance] = useState(true);
  const [autoApplyRecommended, setAutoApplyRecommended] = useState(false);
  const [validationInProgress, setValidationInProgress] = useState(false);

  // Current context
  const currentIssue = issues[workflowState.currentIssueIndex];
  const currentStep = currentIssue?.correctionSteps[workflowState.currentStepIndex];
  const isFirstIssue = workflowState.currentIssueIndex === 0;
  const isLastIssue = workflowState.currentIssueIndex === issues.length - 1;
  const isFirstStep = workflowState.currentStepIndex === 0;
  const isLastStep = currentIssue && workflowState.currentStepIndex === currentIssue.correctionSteps.length - 1;

  // Progress calculation
  const overallProgress = useMemo(() => {
    const totalSteps = issues.reduce((sum, issue) => sum + issue.correctionSteps.length, 0);
    const completedSteps = workflowState.completedIssues.size * 
      (issues.find(i => workflowState.completedIssues.has(i.id))?.correctionSteps.length || 0) +
      workflowState.currentStepIndex;
    
    return totalSteps > 0 ? completedSteps / totalSteps : 0;
  }, [issues, workflowState]);

  // Record user action
  const recordUserAction = useCallback((action: string, target: string, parameters: any = {}) => {
    const userAction: UserAction = {
      timestamp: Date.now(),
      action,
      target,
      parameters
    };

    setWorkflowState(prev => ({
      ...prev,
      userActions: [...prev.userActions, userAction]
    }));
  }, []);

  // Handle step completion
  const handleStepCompletion = useCallback(async (stepResult: any) => {
    recordUserAction('complete_step', currentStep?.id || '', stepResult);

    // Update step results
    setWorkflowState(prev => ({
      ...prev,
      stepResults: {
        ...prev.stepResults,
        [`${currentIssue.id}-${currentStep?.id}`]: stepResult
      }
    }));

    // Validate step if required
    if (currentStep?.validation?.realTimeValidation) {
      setValidationInProgress(true);
      const validationResult = await validateStep(currentStep, stepResult);
      
      if (!validationResult.isValid) {
        setWorkflowState(prev => ({
          ...prev,
          validationErrors: {
            ...prev.validationErrors,
            [currentStep.id]: validationResult.errors
          }
        }));
        setValidationInProgress(false);
        return;
      }
    }

    // Move to next step or issue
    if (isLastStep) {
      // Mark issue as completed
      setWorkflowState(prev => ({
        ...prev,
        completedIssues: new Set([...prev.completedIssues, currentIssue.id]),
        currentIssueIndex: isLastIssue ? prev.currentIssueIndex : prev.currentIssueIndex + 1,
        currentStepIndex: 0,
        validationErrors: {}
      }));
    } else {
      // Move to next step
      setWorkflowState(prev => ({
        ...prev,
        currentStepIndex: prev.currentStepIndex + 1,
        validationErrors: {}
      }));
    }

    setValidationInProgress(false);
  }, [currentIssue, currentStep, isLastStep, isLastIssue, recordUserAction]);

  // Handle auto-fix application
  const handleAutoFix = useCallback(async (issue: WorkflowIssue) => {
    recordUserAction('apply_auto_fix', issue.id);

    // Apply automatic fix logic here
    const autoFixResult = await applyAutoFix(issue, detectionResult, rawData);
    
    if (autoFixResult.success) {
      setWorkflowState(prev => ({
        ...prev,
        completedIssues: new Set([...prev.completedIssues, issue.id])
      }));
      
      // Move to next issue
      if (!isLastIssue) {
        setWorkflowState(prev => ({
          ...prev,
          currentIssueIndex: prev.currentIssueIndex + 1,
          currentStepIndex: 0
        }));
      }
    }
  }, [detectionResult, rawData, isLastIssue, recordUserAction]);

  // Handle navigation
  const handleNavigation = useCallback((direction: 'prev' | 'next' | 'skip') => {
    recordUserAction('navigate', direction);

    switch (direction) {
      case 'prev':
        if (!isFirstStep) {
          setWorkflowState(prev => ({
            ...prev,
            currentStepIndex: prev.currentStepIndex - 1
          }));
        } else if (!isFirstIssue) {
          setWorkflowState(prev => ({
            ...prev,
            currentIssueIndex: prev.currentIssueIndex - 1,
            currentStepIndex: 0
          }));
        }
        break;
      
      case 'next':
        if (!isLastStep) {
          setWorkflowState(prev => ({
            ...prev,
            currentStepIndex: prev.currentStepIndex + 1
          }));
        } else if (!isLastIssue) {
          setWorkflowState(prev => ({
            ...prev,
            currentIssueIndex: prev.currentIssueIndex + 1,
            currentStepIndex: 0
          }));
        }
        break;
      
      case 'skip':
        if (!isLastIssue) {
          setWorkflowState(prev => ({
            ...prev,
            currentIssueIndex: prev.currentIssueIndex + 1,
            currentStepIndex: 0
          }));
        }
        break;
    }
  }, [isFirstStep, isFirstIssue, isLastStep, isLastIssue, recordUserAction]);

  // Handle workflow completion
  const handleWorkflowComplete = useCallback(() => {
    const correctionResult: CorrectionResult = {
      correctedIssues: Array.from(workflowState.completedIssues),
      appliedFixes: [], // Would be populated from step results
      updatedConfiguration: {}, // Would be built from step results
      validationResults: {}, // Would include final validation
      userActions: workflowState.userActions
    };

    recordUserAction('complete_workflow', 'all');
    onComplete(correctionResult);
  }, [workflowState, recordUserAction, onComplete]);

  // Auto-apply recommended fixes if enabled
  useEffect(() => {
    if (autoApplyRecommended && currentIssue?.autoFixAvailable) {
      handleAutoFix(currentIssue);
    }
  }, [autoApplyRecommended, currentIssue, handleAutoFix]);

  if (!currentIssue) {
    return null;
  }

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-4xl w-full bg-white rounded-xl shadow-2xl max-h-[95vh] overflow-hidden flex flex-col">
          {/* Header */}
          <WorkflowHeader
            currentIssue={currentIssue}
            currentStep={currentStep}
            progress={overallProgress}
            onClose={onClose}
          />

          {/* Progress Indicator */}
          <WorkflowProgress
            issues={issues}
            currentIssueIndex={workflowState.currentIssueIndex}
            currentStepIndex={workflowState.currentStepIndex}
            completedIssues={workflowState.completedIssues}
          />

          {/* Main Content */}
          <div className="flex-1 overflow-auto">
            <div className="p-6 space-y-6">
              {/* Issue Overview */}
              <IssueOverview
                issue={currentIssue}
                showGuidance={showGuidance}
                onToggleGuidance={() => setShowGuidance(!showGuidance)}
              />

              {/* Current Step */}
              <CurrentStepPanel
                step={currentStep}
                stepResult={workflowState.stepResults[`${currentIssue.id}-${currentStep?.id}`]}
                validationErrors={workflowState.validationErrors[currentStep?.id] || []}
                validationInProgress={validationInProgress}
                onStepComplete={handleStepCompletion}
                detectionResult={detectionResult}
                rawData={rawData}
              />

              {/* Guidance Panel */}
              {showGuidance && currentStep?.guidance && (
                <GuidancePanel guidance={currentStep.guidance} />
              )}
            </div>
          </div>

          {/* Action Bar */}
          <WorkflowActionBar
            currentIssue={currentIssue}
            currentStep={currentStep}
            canGoBack={!isFirstIssue || !isFirstStep}
            canSkip={!currentStep?.required}
            autoFixAvailable={currentIssue.autoFixAvailable}
            autoApplyRecommended={autoApplyRecommended}
            onAutoApplyToggle={setAutoApplyRecommended}
            onNavigation={handleNavigation}
            onAutoFix={() => handleAutoFix(currentIssue)}
            onComplete={handleWorkflowComplete}
            isLastIssue={isLastIssue}
            validationErrors={workflowState.validationErrors[currentStep?.id] || []}
          />
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

/**
 * Workflow Header Component
 */
const WorkflowHeader: React.FC<{
  currentIssue: WorkflowIssue;
  currentStep?: CorrectionStep;
  progress: number;
  onClose: () => void;
}> = ({ currentIssue, currentStep, progress, onClose }) => {
  const getIssueIcon = (type: WorkflowIssue['type']) => {
    switch (type) {
      case 'critical': return '🚨';
      case 'important': return '⚠️';
      case 'suggestion': return '💡';
      case 'optimization': return '⚙️';
      default: return '📋';
    }
  };

  return (
    <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-[#8A0051] to-[#B8006B]">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{getIssueIcon(currentIssue.type)}</span>
            <div>
              <Dialog.Title className="text-lg font-semibold text-white">
                {currentIssue.title}
              </Dialog.Title>
              <p className="text-[#E8B3D1] text-sm">
                {currentStep?.title || 'Preparing correction steps...'}
              </p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm text-[#E8B3D1] mb-1">
              <span>Correction Progress</span>
              <span>{Math.round(progress * 100)}% Complete</span>
            </div>
            <div className="w-full bg-[#6A003F] rounded-full h-2">
              <div 
                className="h-2 rounded-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-300"
                style={{ width: `${progress * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-white hover:text-[#E8B3D1] transition-colors ml-4"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

/**
 * Workflow Progress Component
 */
const WorkflowProgress: React.FC<{
  issues: WorkflowIssue[];
  currentIssueIndex: number;
  currentStepIndex: number;
  completedIssues: Set<string>;
}> = ({ issues, currentIssueIndex, currentStepIndex, completedIssues }) => {
  return (
    <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
      <div className="flex items-center space-x-4 overflow-x-auto">
        {issues.map((issue, index) => {
          const isCompleted = completedIssues.has(issue.id);
          const isCurrent = index === currentIssueIndex;
          const isPending = index > currentIssueIndex;

          return (
            <div 
              key={issue.id}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
                isCompleted 
                  ? 'bg-green-100 text-green-800'
                  : isCurrent
                  ? 'bg-[#8A0051] text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                isCompleted 
                  ? 'bg-green-500 text-white'
                  : isCurrent
                  ? 'bg-white text-[#8A0051]'
                  : 'bg-gray-400 text-white'
              }`}>
                {isCompleted ? '✓' : index + 1}
              </div>
              <span className="font-medium">{issue.title}</span>
              {isCurrent && (
                <div className="text-xs opacity-75">
                  Step {currentStepIndex + 1}/{issue.correctionSteps.length}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Issue Overview Component
 */
const IssueOverview: React.FC<{
  issue: WorkflowIssue;
  showGuidance: boolean;
  onToggleGuidance: () => void;
}> = ({ issue, showGuidance, onToggleGuidance }) => {
  const getImpactColor = (impact: number) => {
    if (impact >= 0.7) return 'text-red-600';
    if (impact >= 0.4) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Issue Description</h3>
          <p className="text-gray-700">{issue.description}</p>
        </div>
        
        <button
          onClick={onToggleGuidance}
          className="ml-4 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 border border-blue-300 rounded-md"
        >
          {showGuidance ? 'Hide' : 'Show'} Guidance
        </button>
      </div>

      {/* Impact Assessment */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className={`text-2xl font-bold ${getImpactColor(issue.impact.confidence)}`}>
            {Math.round(issue.impact.confidence * 100)}%
          </div>
          <div className="text-sm text-gray-600">Confidence Impact</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className={`text-2xl font-bold ${getImpactColor(issue.impact.accuracy)}`}>
            {Math.round(issue.impact.accuracy * 100)}%
          </div>
          <div className="text-sm text-gray-600">Accuracy Impact</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className={`text-2xl font-bold ${getImpactColor(issue.impact.reliability)}`}>
            {Math.round(issue.impact.reliability * 100)}%
          </div>
          <div className="text-sm text-gray-600">Reliability Impact</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>Estimated time: {issue.estimatedTime}</span>
        {issue.autoFixAvailable && (
          <span className="flex items-center space-x-1 text-green-600">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Auto-fix available</span>
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Current Step Panel Component
 */
const CurrentStepPanel: React.FC<{
  step?: CorrectionStep;
  stepResult: any;
  validationErrors: string[];
  validationInProgress: boolean;
  onStepComplete: (result: any) => void;
  detectionResult: RobustDetectionResult;
  rawData: any[][];
}> = ({ step, stepResult, validationErrors, validationInProgress, onStepComplete, detectionResult, rawData }) => {
  if (!step) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="text-center text-gray-500">
          No correction step available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
        <p className="text-gray-700">{step.description}</p>
        {step.required && (
          <div className="mt-2 text-sm text-red-600">* Required step</div>
        )}
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-sm font-medium text-red-800 mb-1">Validation Errors:</div>
          <ul className="text-sm text-red-700 list-disc list-inside">
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Step Content */}
      <StepContent
        step={step}
        currentResult={stepResult}
        onResultChange={onStepComplete}
        detectionResult={detectionResult}
        rawData={rawData}
        validationInProgress={validationInProgress}
      />
    </div>
  );
};

/**
 * Step Content Component (renders different UI based on step type)
 */
const StepContent: React.FC<{
  step: CorrectionStep;
  currentResult: any;
  onResultChange: (result: any) => void;
  detectionResult: RobustDetectionResult;
  rawData: any[][];
  validationInProgress: boolean;
}> = ({ step, currentResult, onResultChange, detectionResult, rawData, validationInProgress }) => {
  switch (step.type) {
    case 'selection':
      return (
        <SelectionStepContent
          step={step}
          currentResult={currentResult}
          onResultChange={onResultChange}
        />
      );
    case 'input':
      return (
        <InputStepContent
          step={step}
          currentResult={currentResult}
          onResultChange={onResultChange}
        />
      );
    case 'validation':
      return (
        <ValidationStepContent
          step={step}
          currentResult={currentResult}
          onResultChange={onResultChange}
          detectionResult={detectionResult}
          rawData={rawData}
        />
      );
    case 'confirmation':
      return (
        <ConfirmationStepContent
          step={step}
          currentResult={currentResult}
          onResultChange={onResultChange}
        />
      );
    default:
      return <div>Unknown step type</div>;
  }
};

/**
 * Guidance Panel Component
 */
const GuidancePanel: React.FC<{ guidance: StepGuidance }> = ({ guidance }) => {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <h4 className="font-semibold text-blue-900 mb-4">📖 Step Guidance</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {guidance.tips.length > 0 && (
          <div>
            <h5 className="font-medium text-blue-800 mb-2">💡 Tips</h5>
            <ul className="text-sm text-blue-700 space-y-1">
              {guidance.tips.map((tip, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {guidance.bestPractices.length > 0 && (
          <div>
            <h5 className="font-medium text-blue-800 mb-2">✅ Best Practices</h5>
            <ul className="text-sm text-blue-700 space-y-1">
              {guidance.bestPractices.map((practice, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <span className="text-green-500 mt-0.5">•</span>
                  <span>{practice}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {guidance.commonMistakes.length > 0 && (
        <div className="mt-4">
          <h5 className="font-medium text-blue-800 mb-2">⚠️ Common Mistakes to Avoid</h5>
          <ul className="text-sm text-blue-700 space-y-1">
            {guidance.commonMistakes.map((mistake, index) => (
              <li key={index} className="flex items-start space-x-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span>{mistake}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/**
 * Workflow Action Bar Component
 */
const WorkflowActionBar: React.FC<{
  currentIssue: WorkflowIssue;
  currentStep?: CorrectionStep;
  canGoBack: boolean;
  canSkip: boolean;
  autoFixAvailable: boolean;
  autoApplyRecommended: boolean;
  onAutoApplyToggle: (enabled: boolean) => void;
  onNavigation: (direction: 'prev' | 'next' | 'skip') => void;
  onAutoFix: () => void;
  onComplete: () => void;
  isLastIssue: boolean;
  validationErrors: string[];
}> = ({ 
  currentIssue, 
  currentStep, 
  canGoBack, 
  canSkip, 
  autoFixAvailable,
  autoApplyRecommended,
  onAutoApplyToggle,
  onNavigation, 
  onAutoFix, 
  onComplete, 
  isLastIssue,
  validationErrors
}) => {
  const hasValidationErrors = validationErrors.length > 0;
  const canProceed = !currentStep?.required || !hasValidationErrors;

  return (
    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between">
        {/* Left side - Navigation */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onNavigation('prev')}
            disabled={!canGoBack}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              canGoBack
                ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                : 'text-gray-400 bg-gray-100 cursor-not-allowed'
            }`}
          >
            ← Previous
          </button>

          {canSkip && (
            <button
              onClick={() => onNavigation('skip')}
              className="px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 border border-yellow-300 rounded-md hover:bg-yellow-100"
            >
              Skip This Issue
            </button>
          )}
        </div>

        {/* Center - Auto-fix options */}
        <div className="flex items-center space-x-4">
          {autoFixAvailable && (
            <div className="flex items-center space-x-3">
              <label className="flex items-center space-x-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={autoApplyRecommended}
                  onChange={(e) => onAutoApplyToggle(e.target.checked)}
                  className="rounded border-gray-300 text-[#8A0051] focus:ring-[#8A0051]"
                />
                <span>Auto-apply recommended fixes</span>
              </label>
              
              <button
                onClick={onAutoFix}
                className="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-300 rounded-md hover:bg-green-100"
              >
                🔧 Auto-fix This Issue
              </button>
            </div>
          )}
        </div>

        {/* Right side - Proceed */}
        <div className="flex items-center space-x-3">
          {hasValidationErrors && (
            <div className="text-sm text-red-600">
              Fix validation errors to proceed
            </div>
          )}

          <button
            onClick={isLastIssue ? onComplete : () => onNavigation('next')}
            disabled={!canProceed}
            className={`px-6 py-2 text-sm font-medium rounded-md ${
              canProceed
                ? 'text-white bg-[#8A0051] hover:bg-[#6A003F]'
                : 'text-gray-400 bg-gray-200 cursor-not-allowed'
            }`}
          >
            {isLastIssue ? 'Complete Workflow' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Placeholder step content components
const SelectionStepContent: React.FC<any> = () => <div>Selection Step Content</div>;
const InputStepContent: React.FC<any> = () => <div>Input Step Content</div>;
const ValidationStepContent: React.FC<any> = () => <div>Validation Step Content</div>;
const ConfirmationStepContent: React.FC<any> = () => <div>Confirmation Step Content</div>;

// Utility functions
async function validateStep(step: CorrectionStep, result: any): Promise<{ isValid: boolean; errors: string[] }> {
  // Implement step validation logic
  return { isValid: true, errors: [] };
}

async function applyAutoFix(issue: WorkflowIssue, detectionResult: RobustDetectionResult, rawData: any[][]): Promise<{ success: boolean; result?: any }> {
  // Implement auto-fix logic
  return { success: true };
}