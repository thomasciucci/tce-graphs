/**
 * Real-Time Quality Assessment Component for nVitro Studio
 * Provides immediate feedback during manual configuration with traffic light indicators
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ScientificValidationResult, ValidationScore } from '../utils/scientificValidator';
import { RobustDetectionResult, RobustConfidence } from '../utils/robustDetectionEngine';
import { PatternCandidate } from '../utils/adaptivePatternDetector';

// Core assessment interfaces
export interface RealTimeQualityAssessmentProps {
  detectionResult: RobustDetectionResult;
  currentConfiguration: ImportConfiguration;
  onConfigurationChange: (config: ImportConfiguration) => void;
  onQualityChange: (assessment: QualityAssessment) => void;
  showDetailedMetrics?: boolean;
  updateInterval?: number;
}

export interface ImportConfiguration {
  columnMapping: ColumnMapping;
  qualityThresholds: QualityThresholds;
  processingOptions: ProcessingOptions;
}

export interface ColumnMapping {
  headerRow: number;
  concentrationColumn: number;
  responseColumns: number[];
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

export interface QualityAssessment {
  overallScore: number;
  level: 'excellent' | 'good' | 'acceptable' | 'poor' | 'unacceptable';
  dimensions: QualityDimensions;
  issues: QualityIssue[];
  recommendations: QualityRecommendation[];
  readinessForAnalysis: boolean;
  confidence: number;
}

export interface QualityDimensions {
  structuralIntegrity: QualityDimension;
  patternRecognition: QualityDimension;
  scientificValidity: QualityDimension;
  statisticalPower: QualityDimension;
  dataCompleteness: QualityDimension;
}

export interface QualityDimension {
  score: number;
  level: 'excellent' | 'good' | 'acceptable' | 'poor' | 'unacceptable';
  factors: QualityFactor[];
  trend: 'improving' | 'stable' | 'degrading';
  recommendations: string[];
}

export interface QualityFactor {
  name: string;
  value: number;
  weight: number;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
}

export interface QualityIssue {
  id: string;
  severity: 'critical' | 'major' | 'minor' | 'info';
  category: 'structural' | 'pattern' | 'scientific' | 'statistical';
  title: string;
  description: string;
  impact: string;
  autoFixable: boolean;
  suggestion: string;
}

export interface QualityRecommendation {
  id: string;
  type: 'immediate' | 'short-term' | 'long-term';
  priority: number;
  title: string;
  description: string;
  expectedImprovement: number;
  implementationEffort: 'trivial' | 'easy' | 'moderate' | 'difficult';
  action: string;
}

/**
 * Main Real-Time Quality Assessment Component
 */
export default function RealTimeQualityAssessment({
  detectionResult,
  currentConfiguration,
  onConfigurationChange,
  onQualityChange,
  showDetailedMetrics = true,
  updateInterval = 500
}: RealTimeQualityAssessmentProps) {
  // Quality assessment state
  const [qualityAssessment, setQualityAssessment] = useState<QualityAssessment | null>(null);
  const [isAssessing, setIsAssessing] = useState(false);
  const [assessmentHistory, setAssessmentHistory] = useState<QualityAssessment[]>([]);

  // UI state
  const [expandedDimensions, setExpandedDimensions] = useState<Set<string>>(new Set(['structuralIntegrity']));
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [highlightChanges, setHighlightChanges] = useState(true);

  // Real-time quality assessment
  const performQualityAssessment = useCallback(async () => {
    if (isAssessing) return;

    setIsAssessing(true);
    
    try {
      const assessment = await calculateQualityAssessment(detectionResult, currentConfiguration);
      
      setQualityAssessment(assessment);
      onQualityChange(assessment);
      
      // Update history
      setAssessmentHistory(prev => [...prev.slice(-9), assessment]); // Keep last 10 assessments
      
    } catch (error) {
      console.error('Quality assessment failed:', error);
    } finally {
      setIsAssessing(false);
    }
  }, [detectionResult, currentConfiguration, isAssessing, onQualityChange]);

  // Debounced assessment updates
  useEffect(() => {
    const timer = setTimeout(() => {
      performQualityAssessment();
    }, updateInterval);

    return () => clearTimeout(timer);
  }, [performQualityAssessment, updateInterval]);

  // Quality trend analysis
  const qualityTrend = useMemo(() => {
    if (assessmentHistory.length < 3) return 'stable';
    
    const recent = assessmentHistory.slice(-3);
    const trend = recent[2].overallScore - recent[0].overallScore;
    
    if (trend > 0.05) return 'improving';
    if (trend < -0.05) return 'degrading';
    return 'stable';
  }, [assessmentHistory]);

  // Handle dimension expansion
  const toggleDimension = useCallback((dimensionId: string) => {
    setExpandedDimensions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dimensionId)) {
        newSet.delete(dimensionId);
      } else {
        newSet.add(dimensionId);
      }
      return newSet;
    });
  }, []);

  if (!qualityAssessment) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-center space-x-3">
          <div className="animate-spin w-5 h-5 border-2 border-[#8A0051] border-t-transparent rounded-full"></div>
          <span className="text-gray-600">Performing quality assessment...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Quality Indicator */}
      <OverallQualityIndicator
        assessment={qualityAssessment}
        trend={qualityTrend}
        isAssessing={isAssessing}
        onToggleRecommendations={() => setShowRecommendations(!showRecommendations)}
      />

      {/* Quality Dimensions */}
      <QualityDimensionsPanel
        dimensions={qualityAssessment.dimensions}
        expandedDimensions={expandedDimensions}
        onToggleDimension={toggleDimension}
        highlightChanges={highlightChanges}
      />

      {/* Real-time Issues */}
      <QualityIssuesPanel
        issues={qualityAssessment.issues}
        onAutoFix={(issueId) => {
          // Handle auto-fix
        }}
      />

      {/* Recommendations Panel */}
      {showRecommendations && (
        <QualityRecommendationsPanel
          recommendations={qualityAssessment.recommendations}
          currentConfiguration={currentConfiguration}
          onConfigurationChange={onConfigurationChange}
        />
      )}

      {/* Detailed Metrics */}
      {showDetailedMetrics && (
        <DetailedMetricsPanel
          detectionResult={detectionResult}
          qualityAssessment={qualityAssessment}
          assessmentHistory={assessmentHistory}
        />
      )}
    </div>
  );
}

/**
 * Overall Quality Indicator Component
 */
const OverallQualityIndicator: React.FC<{
  assessment: QualityAssessment;
  trend: 'improving' | 'stable' | 'degrading';
  isAssessing: boolean;
  onToggleRecommendations: () => void;
}> = ({ assessment, trend, isAssessing, onToggleRecommendations }) => {
  const getQualityColor = (level: string) => {
    switch (level) {
      case 'excellent': return 'bg-green-500 text-white';
      case 'good': return 'bg-blue-500 text-white';
      case 'acceptable': return 'bg-yellow-500 text-white';
      case 'poor': return 'bg-orange-500 text-white';
      case 'unacceptable': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return '📈';
      case 'degrading': return '📉';
      default: return '➡️';
    }
  };

  const getTrafficLightColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-500';
    if (score >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          {/* Traffic Light Indicator */}
          <div className="flex flex-col space-y-1">
            <div className={`w-4 h-4 rounded-full ${assessment.overallScore >= 0.8 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <div className={`w-4 h-4 rounded-full ${assessment.overallScore >= 0.6 && assessment.overallScore < 0.8 ? 'bg-yellow-500' : 'bg-gray-300'}`}></div>
            <div className={`w-4 h-4 rounded-full ${assessment.overallScore < 0.6 ? 'bg-red-500' : 'bg-gray-300'}`}></div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              Overall Data Quality
            </h3>
            <div className="flex items-center space-x-3 mt-1">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getQualityColor(assessment.level)}`}>
                {assessment.level.charAt(0).toUpperCase() + assessment.level.slice(1)}
              </span>
              <span className="text-2xl font-bold text-gray-900">
                {Math.round(assessment.overallScore * 100)}%
              </span>
              <span className="text-lg" title={`Quality trend: ${trend}`}>
                {getTrendIcon(trend)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {isAssessing && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <div className="animate-spin w-4 h-4 border-2 border-[#8A0051] border-t-transparent rounded-full"></div>
              <span>Updating...</span>
            </div>
          )}
          
          <button
            onClick={onToggleRecommendations}
            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
          >
            📋 Recommendations
          </button>
        </div>
      </div>

      {/* Quality Score Breakdown */}
      <div className="grid grid-cols-5 gap-4">
        {Object.entries(assessment.dimensions).map(([key, dimension]) => (
          <QualityDimensionCard key={key} name={key} dimension={dimension} />
        ))}
      </div>

      {/* Readiness Indicator */}
      <div className="mt-6 flex items-center justify-between p-4 bg-white rounded-lg border">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${assessment.readinessForAnalysis ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="font-medium text-gray-900">
            {assessment.readinessForAnalysis ? 'Ready for Analysis' : 'Not Ready for Analysis'}
          </span>
        </div>
        <div className="text-sm text-gray-600">
          Confidence: {Math.round(assessment.confidence * 100)}%
        </div>
      </div>
    </div>
  );
};

/**
 * Quality Dimension Card Component
 */
const QualityDimensionCard: React.FC<{
  name: string;
  dimension: QualityDimension;
}> = ({ name, dimension }) => {
  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getDimensionIcon = (name: string) => {
    switch (name) {
      case 'structuralIntegrity': return '🏗️';
      case 'patternRecognition': return '📊';
      case 'scientificValidity': return '🔬';
      case 'statisticalPower': return '📈';
      case 'dataCompleteness': return '📋';
      default: return '📏';
    }
  };

  const formatDimensionName = (name: string) => {
    return name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-lg">{getDimensionIcon(name)}</div>
        <div className={`text-lg font-bold ${getScoreColor(dimension.score)}`}>
          {Math.round(dimension.score * 100)}%
        </div>
      </div>
      <div className="text-xs font-medium text-gray-700">
        {formatDimensionName(name)}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
        <div 
          className={`h-1.5 rounded-full ${
            dimension.score >= 0.8 ? 'bg-green-500' : 
            dimension.score >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${dimension.score * 100}%` }}
        ></div>
      </div>
    </div>
  );
};

/**
 * Quality Dimensions Panel Component
 */
const QualityDimensionsPanel: React.FC<{
  dimensions: QualityDimensions;
  expandedDimensions: Set<string>;
  onToggleDimension: (dimensionId: string) => void;
  highlightChanges: boolean;
}> = ({ dimensions, expandedDimensions, onToggleDimension, highlightChanges }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quality Dimensions</h3>
      
      <div className="space-y-3">
        {Object.entries(dimensions).map(([key, dimension]) => (
          <DimensionDetailPanel
            key={key}
            dimensionId={key}
            dimension={dimension}
            isExpanded={expandedDimensions.has(key)}
            onToggle={() => onToggleDimension(key)}
            highlightChanges={highlightChanges}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Dimension Detail Panel Component
 */
const DimensionDetailPanel: React.FC<{
  dimensionId: string;
  dimension: QualityDimension;
  isExpanded: boolean;
  onToggle: () => void;
  highlightChanges: boolean;
}> = ({ dimensionId, dimension, isExpanded, onToggle, highlightChanges }) => {
  const formatDimensionName = (name: string) => {
    return name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100 border-green-300 text-green-800';
    if (score >= 0.6) return 'bg-yellow-100 border-yellow-300 text-yellow-800';
    return 'bg-red-100 border-red-300 text-red-800';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return '↗️';
      case 'degrading': return '↘️';
      default: return '→';
    }
  };

  return (
    <div className={`border rounded-lg transition-all duration-200 ${
      isExpanded ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
    }`}>
      <button
        onClick={onToggle}
        className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 rounded-lg transition-colors"
      >
        <div className="flex items-center space-x-3">
          <div className={`px-3 py-1 rounded-full border text-sm font-medium ${getScoreColor(dimension.score)}`}>
            {Math.round(dimension.score * 100)}%
          </div>
          <span className="font-medium text-gray-900">
            {formatDimensionName(dimensionId)}
          </span>
          <span className="text-sm text-gray-500">
            {getTrendIcon(dimension.trend)}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500 capitalize">
            {dimension.level}
          </span>
          <svg 
            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Quality Factors */}
          <div>
            <h5 className="text-sm font-medium text-gray-700 mb-2">Quality Factors</h5>
            <div className="space-y-2">
              {dimension.factors.map((factor, index) => (
                <QualityFactorItem key={index} factor={factor} />
              ))}
            </div>
          </div>

          {/* Recommendations */}
          {dimension.recommendations.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-2">Recommendations</h5>
              <ul className="text-sm text-gray-600 space-y-1">
                {dimension.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Quality Factor Item Component
 */
const QualityFactorItem: React.FC<{ factor: QualityFactor }> = ({ factor }) => {
  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'positive': return 'text-green-600';
      case 'negative': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'positive': return '✓';
      case 'negative': return '✗';
      default: return '–';
    }
  };

  return (
    <div className="flex items-center justify-between p-2 bg-white rounded border">
      <div className="flex items-center space-x-2">
        <span className={`text-sm ${getImpactColor(factor.impact)}`}>
          {getImpactIcon(factor.impact)}
        </span>
        <span className="text-sm font-medium text-gray-700">{factor.name}</span>
        <span className="text-xs text-gray-500" title={factor.description}>
          (weight: {Math.round(factor.weight * 100)}%)
        </span>
      </div>
      <div className="text-sm font-medium text-gray-900">
        {typeof factor.value === 'number' ? factor.value.toFixed(2) : factor.value}
      </div>
    </div>
  );
};

/**
 * Quality Issues Panel Component
 */
const QualityIssuesPanel: React.FC<{
  issues: QualityIssue[];
  onAutoFix: (issueId: string) => void;
}> = ({ issues, onAutoFix }) => {
  const groupedIssues = useMemo(() => {
    return issues.reduce((groups, issue) => {
      const severity = issue.severity;
      if (!groups[severity]) groups[severity] = [];
      groups[severity].push(issue);
      return groups;
    }, {} as Record<string, QualityIssue[]>);
  }, [issues]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 border-red-300 text-red-800';
      case 'major': return 'bg-orange-100 border-orange-300 text-orange-800';
      case 'minor': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      default: return 'bg-blue-100 border-blue-300 text-blue-800';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return '🚨';
      case 'major': return '⚠️';
      case 'minor': return '⚡';
      default: return 'ℹ️';
    }
  };

  if (issues.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">✅</span>
          <div>
            <h3 className="font-semibold text-green-900">No Quality Issues Detected</h3>
            <p className="text-green-700 text-sm">
              Your data configuration meets all quality standards.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quality Issues</h3>
      
      <div className="space-y-4">
        {Object.entries(groupedIssues).map(([severity, severityIssues]) => (
          <div key={severity}>
            <h4 className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-3 ${getSeverityColor(severity)}`}>
              <span className="mr-2">{getSeverityIcon(severity)}</span>
              {severity.charAt(0).toUpperCase() + severity.slice(1)} Issues ({severityIssues.length})
            </h4>
            
            <div className="space-y-2">
              {severityIssues.map((issue) => (
                <QualityIssueItem
                  key={issue.id}
                  issue={issue}
                  onAutoFix={() => onAutoFix(issue.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Quality Issue Item Component
 */
const QualityIssueItem: React.FC<{
  issue: QualityIssue;
  onAutoFix: () => void;
}> = ({ issue, onAutoFix }) => {
  return (
    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h5 className="font-medium text-gray-900 mb-1">{issue.title}</h5>
          <p className="text-sm text-gray-700 mb-2">{issue.description}</p>
          <div className="text-xs text-gray-600">
            <span className="font-medium">Impact:</span> {issue.impact}
          </div>
          {issue.suggestion && (
            <div className="mt-2 text-xs text-blue-700 bg-blue-50 p-2 rounded">
              <span className="font-medium">Suggestion:</span> {issue.suggestion}
            </div>
          )}
        </div>
        
        {issue.autoFixable && (
          <button
            onClick={onAutoFix}
            className="ml-4 px-3 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-300 rounded hover:bg-green-100"
          >
            Auto-fix
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Quality Recommendations Panel Component
 */
const QualityRecommendationsPanel: React.FC<{
  recommendations: QualityRecommendation[];
  currentConfiguration: ImportConfiguration;
  onConfigurationChange: (config: ImportConfiguration) => void;
}> = ({ recommendations, currentConfiguration, onConfigurationChange }) => {
  const prioritizedRecommendations = useMemo(() => {
    return recommendations
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5); // Show top 5 recommendations
  }, [recommendations]);

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quality Recommendations</h3>
      
      <div className="space-y-3">
        {prioritizedRecommendations.map((recommendation) => (
          <QualityRecommendationItem
            key={recommendation.id}
            recommendation={recommendation}
            currentConfiguration={currentConfiguration}
            onConfigurationChange={onConfigurationChange}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Quality Recommendation Item Component
 */
const QualityRecommendationItem: React.FC<{
  recommendation: QualityRecommendation;
  currentConfiguration: ImportConfiguration;
  onConfigurationChange: (config: ImportConfiguration) => void;
}> = ({ recommendation, currentConfiguration, onConfigurationChange }) => {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'immediate': return 'bg-red-100 text-red-800 border-red-300';
      case 'short-term': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'long-term': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'trivial': return 'text-green-600';
      case 'easy': return 'text-blue-600';
      case 'moderate': return 'text-yellow-600';
      case 'difficult': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="p-4 border border-gray-200 rounded-lg">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getTypeColor(recommendation.type)}`}>
            {recommendation.type}
          </span>
          <span className="text-sm font-medium text-gray-900">
            Priority: {recommendation.priority}/10
          </span>
        </div>
        <div className="text-xs text-gray-600">
          <span className={`font-medium ${getEffortColor(recommendation.implementationEffort)}`}>
            {recommendation.implementationEffort}
          </span>
        </div>
      </div>
      
      <h5 className="font-medium text-gray-900 mb-1">{recommendation.title}</h5>
      <p className="text-sm text-gray-700 mb-2">{recommendation.description}</p>
      
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-600">
          Expected improvement: <span className="font-medium text-green-600">
            +{Math.round(recommendation.expectedImprovement * 100)}%
          </span>
        </div>
        
        <button
          onClick={() => {
            // Apply recommendation action
            console.log('Applying recommendation:', recommendation.action);
          }}
          className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded hover:bg-blue-100"
        >
          Apply
        </button>
      </div>
    </div>
  );
};

/**
 * Detailed Metrics Panel Component
 */
const DetailedMetricsPanel: React.FC<{
  detectionResult: RobustDetectionResult;
  qualityAssessment: QualityAssessment;
  assessmentHistory: QualityAssessment[];
}> = ({ detectionResult, qualityAssessment, assessmentHistory }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Metrics</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Confidence Metrics */}
        <div>
          <h4 className="font-medium text-gray-700 mb-3">Confidence Metrics</h4>
          <div className="space-y-2">
            <MetricItem 
              label="Overall Confidence" 
              value={`${Math.round(detectionResult.robustConfidence.overall * 100)}%`}
              color={detectionResult.robustConfidence.overall >= 0.8 ? 'green' : detectionResult.robustConfidence.overall >= 0.6 ? 'yellow' : 'red'}
            />
            <MetricItem 
              label="Structural" 
              value={`${Math.round(detectionResult.robustConfidence.structural * 100)}%`}
              color={detectionResult.robustConfidence.structural >= 0.8 ? 'green' : 'gray'}
            />
            <MetricItem 
              label="Pattern" 
              value={`${Math.round(detectionResult.robustConfidence.pattern * 100)}%`}
              color={detectionResult.robustConfidence.pattern >= 0.8 ? 'green' : 'gray'}
            />
            <MetricItem 
              label="Validation" 
              value={`${Math.round(detectionResult.robustConfidence.validation * 100)}%`}
              color={detectionResult.robustConfidence.validation >= 0.8 ? 'green' : 'gray'}
            />
          </div>
        </div>

        {/* Pattern Metrics */}
        <div>
          <h4 className="font-medium text-gray-700 mb-3">Pattern Analysis</h4>
          <div className="space-y-2">
            {detectionResult.adaptivePatterns.length > 0 ? (
              <>
                <MetricItem 
                  label="Pattern Type" 
                  value={detectionResult.adaptivePatterns[0].type}
                  color="blue"
                />
                <MetricItem 
                  label="Pattern Confidence" 
                  value={`${Math.round(detectionResult.adaptivePatterns[0].confidence * 100)}%`}
                  color={detectionResult.adaptivePatterns[0].confidence >= 0.8 ? 'green' : 'yellow'}
                />
                <MetricItem 
                  label="Data Points" 
                  value={detectionResult.adaptivePatterns[0].evidence.dataPoints.length.toString()}
                  color="gray"
                />
              </>
            ) : (
              <MetricItem label="Pattern Status" value="Not detected" color="red" />
            )}
          </div>
        </div>

        {/* Performance Metrics */}
        <div>
          <h4 className="font-medium text-gray-700 mb-3">Performance</h4>
          <div className="space-y-2">
            <MetricItem 
              label="Detection Time" 
              value={`${Math.round(detectionResult.performanceMetrics.detectionTime)}ms`}
              color="gray"
            />
            <MetricItem 
              label="Memory Usage" 
              value={`${detectionResult.performanceMetrics.memoryUsage.toFixed(1)}MB`}
              color="gray"
            />
            <MetricItem 
              label="Complexity" 
              value={detectionResult.performanceMetrics.computationalComplexity}
              color="gray"
            />
          </div>
        </div>
      </div>

      {/* Quality Trend Chart */}
      {assessmentHistory.length > 1 && (
        <div className="mt-6">
          <h4 className="font-medium text-gray-700 mb-3">Quality Trend</h4>
          <QualityTrendChart history={assessmentHistory} />
        </div>
      )}
    </div>
  );
};

/**
 * Metric Item Component
 */
const MetricItem: React.FC<{
  label: string;
  value: string;
  color: 'green' | 'yellow' | 'red' | 'blue' | 'gray';
}> = ({ label, value, color }) => {
  const getColorClasses = (color: string) => {
    switch (color) {
      case 'green': return 'text-green-600 bg-green-50';
      case 'yellow': return 'text-yellow-600 bg-yellow-50';
      case 'red': return 'text-red-600 bg-red-50';
      case 'blue': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-600">{label}</span>
      <span className={`text-xs font-medium px-2 py-1 rounded ${getColorClasses(color)}`}>
        {value}
      </span>
    </div>
  );
};

/**
 * Quality Trend Chart Component (Simplified)
 */
const QualityTrendChart: React.FC<{ history: QualityAssessment[] }> = ({ history }) => {
  const maxPoints = 10;
  const displayHistory = history.slice(-maxPoints);
  
  return (
    <div className="h-20 bg-gray-50 rounded-lg p-3 flex items-end space-x-1">
      {displayHistory.map((assessment, index) => (
        <div
          key={index}
          className="flex-1 bg-blue-500 rounded-t"
          style={{ height: `${assessment.overallScore * 100}%` }}
          title={`Quality: ${Math.round(assessment.overallScore * 100)}%`}
        ></div>
      ))}
    </div>
  );
};

// Utility function to calculate quality assessment
async function calculateQualityAssessment(
  detectionResult: RobustDetectionResult,
  configuration: ImportConfiguration
): Promise<QualityAssessment> {
  // This would implement the actual quality calculation logic
  // For now, returning a mock assessment
  
  const overallScore = detectionResult.robustConfidence.overall;
  
  return {
    overallScore,
    level: overallScore >= 0.8 ? 'excellent' : overallScore >= 0.6 ? 'good' : overallScore >= 0.4 ? 'acceptable' : 'poor',
    dimensions: {
      structuralIntegrity: {
        score: detectionResult.robustConfidence.structural,
        level: 'good',
        factors: [],
        trend: 'stable',
        recommendations: []
      },
      patternRecognition: {
        score: detectionResult.robustConfidence.pattern,
        level: 'acceptable',
        factors: [],
        trend: 'stable',
        recommendations: []
      },
      scientificValidity: {
        score: detectionResult.robustConfidence.validation,
        level: 'good',
        factors: [],
        trend: 'stable',
        recommendations: []
      },
      statisticalPower: {
        score: 0.7,
        level: 'acceptable',
        factors: [],
        trend: 'stable',
        recommendations: []
      },
      dataCompleteness: {
        score: 0.9,
        level: 'excellent',
        factors: [],
        trend: 'stable',
        recommendations: []
      }
    },
    issues: [],
    recommendations: [],
    readinessForAnalysis: overallScore >= 0.6,
    confidence: overallScore
  };
}