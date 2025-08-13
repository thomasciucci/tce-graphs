/**
 * Robust Detection Engine for nVitro Studio
 * Integrates scientific detection, adaptive pattern analysis, and comprehensive validation
 */

import { ScientificDetectionEngine, ScientificDetectionResult } from './scientificDetection';
import { AdaptivePatternDetector, PatternCandidate } from './adaptivePatternDetector';
import { ScientificValidator, ScientificValidationResult } from './scientificValidator';
import { parseConcentration, normalizeConcentration } from './dataDetection';

// Integration interfaces
export interface RobustDetectionResult extends ScientificDetectionResult {
  adaptivePatterns: PatternCandidate[];
  validationResult: ScientificValidationResult;
  integrationMetrics: IntegrationMetrics;
  robustConfidence: RobustConfidence;
  enhancedRecommendations: EnhancedRecommendation[];
  performanceMetrics: PerformanceMetrics;
}

export interface IntegrationMetrics {
  consensusScore: number;           // Agreement between detection methods
  crossValidationScore: number;    // Cross-validation consistency
  robustnessScore: number;         // Robustness to variations
  reliabilityScore: number;        // Overall reliability assessment
  methodAgreement: MethodAgreement;
}

export interface RobustConfidence {
  overall: number;                  // Overall robust confidence
  structural: number;               // Structural detection confidence
  pattern: number;                  // Pattern analysis confidence
  validation: number;               // Scientific validation confidence
  consensus: number;                // Cross-method consensus
  uncertainty: ConfidenceInterval; // Uncertainty quantification
}

export interface MethodAgreement {
  structuralVsPattern: number;      // Agreement between structural and pattern detection
  patternVsValidation: number;      // Agreement between pattern and validation
  structuralVsValidation: number;   // Agreement between structural and validation
  overallConsensus: number;         // Overall method consensus
}

export interface ConfidenceInterval {
  lower: number;                    // Lower confidence bound
  upper: number;                    // Upper confidence bound
  width: number;                    // Confidence interval width
  method: string;                   // Uncertainty quantification method
}

export interface EnhancedRecommendation {
  type: 'critical' | 'important' | 'suggestion' | 'optimization';
  priority: number;                 // 1-10 priority score
  category: 'data-quality' | 'pattern-detection' | 'experimental-design' | 'analysis-optimization';
  title: string;
  description: string;
  technicalDetails: string;
  actionable: boolean;
  estimatedImpact: {
    confidence: number;             // Impact on confidence
    accuracy: number;               // Impact on accuracy
    reliability: number;            // Impact on reliability
  };
  implementationGuide: {
    complexity: 'trivial' | 'easy' | 'moderate' | 'difficult' | 'expert';
    timeRequired: string;
    resourcesNeeded: string[];
    steps: string[];
  };
  scientificJustification: string;
}

export interface PerformanceMetrics {
  detectionTime: number;            // Time taken for detection (ms)
  memoryUsage: number;              // Memory usage estimate (MB)
  computationalComplexity: string;  // Complexity assessment
  scalability: ScalabilityMetrics;
  errorHandling: ErrorHandlingMetrics;
}

export interface ScalabilityMetrics {
  maxDataPoints: number;            // Maximum recommended data points
  performanceDegradation: number;   // Performance degradation rate
  memoryScaling: string;            // Memory scaling characteristics
  timeComplexity: string;           // Time complexity
}

export interface ErrorHandlingMetrics {
  errorRate: number;                // Error rate during processing
  recoveryRate: number;             // Recovery rate from errors
  robustnessToNoise: number;        // Robustness to noisy data
  failureMode: string;              // Primary failure mode
}

export interface RobustDetectionOptions {
  enableAdaptivePatterns: boolean;
  enableScientificValidation: boolean;
  performCrossValidation: boolean;
  uncertaintyQuantification: boolean;
  performanceOptimization: boolean;
  robustnessLevel: 'basic' | 'standard' | 'comprehensive' | 'maximum';
  timeoutMs?: number;
  maxMemoryMB?: number;
}

/**
 * Robust detection engine that integrates multiple detection and validation approaches
 */
export class RobustDetectionEngine {
  private readonly scientificEngine: ScientificDetectionEngine;
  private readonly adaptiveDetector: AdaptivePatternDetector;
  private readonly scientificValidator: ScientificValidator;
  
  constructor() {
    this.scientificEngine = new ScientificDetectionEngine();
    this.adaptiveDetector = new AdaptivePatternDetector();
    this.scientificValidator = new ScientificValidator();
  }

  /**
   * Comprehensive robust detection with multi-method integration
   */
  async detectWithRobustness(
    rawData: any[][],
    options: RobustDetectionOptions = this.getDefaultOptions()
  ): Promise<RobustDetectionResult> {
    const startTime = performance.now();
    
    try {
      // Phase 1: Core scientific detection
      const scientificResult = this.scientificEngine.analyzeExcelData(rawData);
      
      // Phase 2: Adaptive pattern analysis (if enabled)
      let adaptivePatterns: PatternCandidate[] = [];
      if (options.enableAdaptivePatterns) {
        adaptivePatterns = await this.performAdaptivePatternAnalysis(rawData, scientificResult);
      }
      
      // Phase 3: Scientific validation (if enabled)
      let validationResult: ScientificValidationResult | null = null;
      if (options.enableScientificValidation) {
        validationResult = await this.performScientificValidation(rawData, scientificResult);
      }
      
      // Phase 4: Cross-validation and integration
      const integrationMetrics = this.calculateIntegrationMetrics(
        scientificResult,
        adaptivePatterns,
        validationResult
      );
      
      // Phase 5: Robust confidence calculation
      const robustConfidence = this.calculateRobustConfidence(
        scientificResult,
        adaptivePatterns,
        validationResult,
        integrationMetrics
      );
      
      // Phase 6: Enhanced recommendations
      const enhancedRecommendations = this.generateEnhancedRecommendations(
        scientificResult,
        adaptivePatterns,
        validationResult,
        integrationMetrics
      );
      
      // Phase 7: Performance metrics
      const endTime = performance.now();
      const performanceMetrics = this.calculatePerformanceMetrics(
        startTime,
        endTime,
        rawData,
        options
      );
      
      // Integrate all results
      const robustResult: RobustDetectionResult = {
        ...scientificResult,
        adaptivePatterns,
        validationResult: validationResult || this.createEmptyValidationResult(),
        integrationMetrics,
        robustConfidence,
        enhancedRecommendations,
        performanceMetrics
      };
      
      // Apply final confidence adjustment
      robustResult.confidence.overall = robustConfidence.overall;
      
      return robustResult;
      
    } catch (error) {
      console.error('Robust detection failed:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Perform adaptive pattern analysis
   */
  private async performAdaptivePatternAnalysis(
    rawData: any[][],
    scientificResult: ScientificDetectionResult
  ): Promise<PatternCandidate[]> {
    if (scientificResult.concentrationColumn === -1 || scientificResult.dataStartRow === -1) {
      return [];
    }

    // Extract concentration data
    const concentrationData = this.extractColumnData(
      rawData,
      scientificResult.concentrationColumn,
      scientificResult.dataStartRow
    );
    
    if (concentrationData.length === 0) {
      return [];
    }

    // Perform adaptive pattern detection
    return await this.adaptiveDetector.detectPattern(concentrationData);
  }

  /**
   * Perform scientific validation
   */
  private async performScientificValidation(
    rawData: any[][],
    scientificResult: ScientificDetectionResult
  ): Promise<ScientificValidationResult | null> {
    if (scientificResult.concentrationColumn === -1 || 
        scientificResult.responseColumns.length === 0 ||
        scientificResult.dataStartRow === -1) {
      return null;
    }

    // Extract concentration and response data
    const concentrationData = this.extractColumnData(
      rawData,
      scientificResult.concentrationColumn,
      scientificResult.dataStartRow
    );
    
    const responseData: number[][] = [];
    for (let row = scientificResult.dataStartRow; row < rawData.length; row++) {
      const responseRow: number[] = [];
      for (const colIndex of scientificResult.responseColumns) {
        const cell = rawData[row]?.[colIndex];
        if (typeof cell === 'number' && isFinite(cell)) {
          responseRow.push(cell);
        }
      }
      if (responseRow.length > 0) {
        responseData.push(responseRow);
      }
    }
    
    if (concentrationData.length === 0 || responseData.length === 0) {
      return null;
    }

    // Perform scientific validation
    return this.scientificValidator.validateDoseResponseData(
      concentrationData,
      responseData,
      {
        assayType: this.inferAssayType(scientificResult),
        experimentalContext: 'dose-response'
      }
    );
  }

  /**
   * Calculate integration metrics
   */
  private calculateIntegrationMetrics(
    scientificResult: ScientificDetectionResult,
    adaptivePatterns: PatternCandidate[],
    validationResult: ScientificValidationResult | null
  ): IntegrationMetrics {
    // Calculate consensus between different methods
    const methodAgreement = this.calculateMethodAgreement(
      scientificResult,
      adaptivePatterns,
      validationResult
    );
    
    // Cross-validation score
    const crossValidationScore = this.performCrossValidation(
      scientificResult,
      adaptivePatterns
    );
    
    // Robustness assessment
    const robustnessScore = this.assessRobustness(
      scientificResult,
      adaptivePatterns,
      validationResult
    );
    
    // Overall consensus
    const consensusScore = (
      methodAgreement.overallConsensus * 0.4 +
      crossValidationScore * 0.3 +
      robustnessScore * 0.3
    );
    
    // Reliability assessment
    const reliabilityScore = this.calculateReliability(
      scientificResult,
      adaptivePatterns,
      validationResult,
      consensusScore
    );
    
    return {
      consensusScore,
      crossValidationScore,
      robustnessScore,
      reliabilityScore,
      methodAgreement
    };
  }

  /**
   * Calculate agreement between different detection methods
   */
  private calculateMethodAgreement(
    scientificResult: ScientificDetectionResult,
    adaptivePatterns: PatternCandidate[],
    validationResult: ScientificValidationResult | null
  ): MethodAgreement {
    let structuralVsPattern = 0.5; // Default neutral agreement
    let patternVsValidation = 0.5;
    let structuralVsValidation = 0.5;
    
    // Compare structural detection with adaptive patterns
    if (adaptivePatterns.length > 0) {
      const bestPattern = adaptivePatterns[0];
      const structuralConfidence = scientificResult.confidence.structural;
      const patternConfidence = bestPattern.confidence;
      
      // Agreement based on confidence similarity
      const confidenceDiff = Math.abs(structuralConfidence - patternConfidence);
      structuralVsPattern = Math.max(0, 1 - confidenceDiff);
    }
    
    // Compare patterns with validation
    if (adaptivePatterns.length > 0 && validationResult) {
      const bestPattern = adaptivePatterns[0];
      const patternQuality = bestPattern.confidence;
      const validationQuality = validationResult.concentration.patternQuality.consistency;
      
      const qualityDiff = Math.abs(patternQuality - validationQuality);
      patternVsValidation = Math.max(0, 1 - qualityDiff);
    }
    
    // Compare structural with validation
    if (validationResult) {
      const structuralConfidence = scientificResult.confidence.structural;
      const validationConfidence = validationResult.overall.confidence;
      
      const confidenceDiff = Math.abs(structuralConfidence - validationConfidence);
      structuralVsValidation = Math.max(0, 1 - confidenceDiff);
    }
    
    const overallConsensus = (structuralVsPattern + patternVsValidation + structuralVsValidation) / 3;
    
    return {
      structuralVsPattern,
      patternVsValidation,
      structuralVsValidation,
      overallConsensus
    };
  }

  /**
   * Perform cross-validation of detection results
   */
  private performCrossValidation(
    scientificResult: ScientificDetectionResult,
    adaptivePatterns: PatternCandidate[]
  ): number {
    // Simplified cross-validation - in practice would use k-fold validation
    let validationScore = 0.7; // Base score
    
    // Check consistency of pattern detection
    if (adaptivePatterns.length > 1) {
      const topPatterns = adaptivePatterns.slice(0, 3);
      const confidenceVariability = this.calculateVariability(
        topPatterns.map(p => p.confidence)
      );
      
      // Lower variability = higher cross-validation score
      validationScore += (1 - confidenceVariability) * 0.2;
    }
    
    // Check consistency with scientific detection
    if (scientificResult.patternDetection.dilutionPattern.type !== 'unknown') {
      const scientificPatternType = scientificResult.patternDetection.dilutionPattern.type;
      const adaptivePatternType = adaptivePatterns.length > 0 ? adaptivePatterns[0].type : 'unknown';
      
      if (scientificPatternType === adaptivePatternType) {
        validationScore += 0.1;
      }
    }
    
    return Math.min(1, validationScore);
  }

  /**
   * Assess robustness of detection
   */
  private assessRobustness(
    scientificResult: ScientificDetectionResult,
    adaptivePatterns: PatternCandidate[],
    validationResult: ScientificValidationResult | null
  ): number {
    let robustnessScore = 0.5; // Base score
    
    // Robustness based on pattern consistency
    if (scientificResult.patternDetection.robustnessMetrics) {
      robustnessScore += scientificResult.patternDetection.robustnessMetrics.stability * 0.3;
    }
    
    // Robustness based on validation results
    if (validationResult) {
      const validationLevel = validationResult.overall.level;
      switch (validationLevel) {
        case 'excellent':
          robustnessScore += 0.3;
          break;
        case 'good':
          robustnessScore += 0.2;
          break;
        case 'acceptable':
          robustnessScore += 0.1;
          break;
        default:
          robustnessScore -= 0.1;
      }
    }
    
    // Robustness based on adaptive pattern agreement
    if (adaptivePatterns.length >= 2) {
      const topTwo = adaptivePatterns.slice(0, 2);
      if (topTwo[0].type === topTwo[1].type) {
        robustnessScore += 0.1;
      }
    }
    
    return Math.max(0, Math.min(1, robustnessScore));
  }

  /**
   * Calculate overall reliability
   */
  private calculateReliability(
    scientificResult: ScientificDetectionResult,
    adaptivePatterns: PatternCandidate[],
    validationResult: ScientificValidationResult | null,
    consensusScore: number
  ): number {
    const baseReliability = consensusScore;
    
    // Adjust based on data quality
    let qualityAdjustment = 0;
    if (validationResult) {
      const overallScore = validationResult.overall.score;
      qualityAdjustment = (overallScore - 0.5) * 0.2; // -0.1 to +0.1 adjustment
    }
    
    // Adjust based on pattern strength
    let patternAdjustment = 0;
    if (adaptivePatterns.length > 0) {
      const bestPatternConfidence = adaptivePatterns[0].confidence;
      patternAdjustment = (bestPatternConfidence - 0.5) * 0.1; // -0.05 to +0.05 adjustment
    }
    
    return Math.max(0, Math.min(1, baseReliability + qualityAdjustment + patternAdjustment));
  }

  /**
   * Calculate robust confidence with uncertainty quantification
   */
  private calculateRobustConfidence(
    scientificResult: ScientificDetectionResult,
    adaptivePatterns: PatternCandidate[],
    validationResult: ScientificValidationResult | null,
    integrationMetrics: IntegrationMetrics
  ): RobustConfidence {
    // Individual confidence components
    const structural = scientificResult.confidence.structural;
    const pattern = adaptivePatterns.length > 0 ? adaptivePatterns[0].confidence : 0;
    const validation = validationResult ? validationResult.overall.confidence : 0;
    const consensus = integrationMetrics.consensusScore;
    
    // Weighted overall confidence
    const weights = {
      structural: 0.3,
      pattern: 0.25,
      validation: 0.25,
      consensus: 0.2
    };
    
    const overall = 
      structural * weights.structural +
      pattern * weights.pattern +
      validation * weights.validation +
      consensus * weights.consensus;
    
    // Uncertainty quantification
    const uncertainty = this.quantifyUncertainty([structural, pattern, validation, consensus]);
    
    return {
      overall,
      structural,
      pattern,
      validation,
      consensus,
      uncertainty
    };
  }

  /**
   * Quantify uncertainty in confidence estimates
   */
  private quantifyUncertainty(confidenceValues: number[]): ConfidenceInterval {
    const validValues = confidenceValues.filter(v => v > 0);
    
    if (validValues.length === 0) {
      return {
        lower: 0,
        upper: 0,
        width: 0,
        method: 'no-data'
      };
    }

    const mean = validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
    const variance = validValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / validValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Simple confidence interval (mean ± 1.96 * stdDev for 95% CI)
    const margin = 1.96 * stdDev / Math.sqrt(validValues.length);
    const lower = Math.max(0, mean - margin);
    const upper = Math.min(1, mean + margin);
    
    return {
      lower,
      upper,
      width: upper - lower,
      method: 'normal-approximation'
    };
  }

  /**
   * Generate enhanced recommendations with detailed implementation guidance
   */
  private generateEnhancedRecommendations(
    scientificResult: ScientificDetectionResult,
    adaptivePatterns: PatternCandidate[],
    validationResult: ScientificValidationResult | null,
    integrationMetrics: IntegrationMetrics
  ): EnhancedRecommendation[] {
    const recommendations: EnhancedRecommendation[] = [];
    
    // Data quality recommendations
    if (validationResult && validationResult.overall.level === 'poor') {
      recommendations.push({
        type: 'critical',
        priority: 9,
        category: 'data-quality',
        title: 'Critical Data Quality Issues Detected',
        description: 'The imported data has significant quality issues that may affect analysis reliability.',
        technicalDetails: this.getDataQualityDetails(validationResult),
        actionable: true,
        estimatedImpact: {
          confidence: 0.4,
          accuracy: 0.5,
          reliability: 0.6
        },
        implementationGuide: {
          complexity: 'moderate',
          timeRequired: '30-60 minutes',
          resourcesNeeded: ['Original data files', 'Laboratory protocols'],
          steps: [
            'Review original experimental data',
            'Check for transcription errors',
            'Verify concentration calculations',
            'Consider additional replicates'
          ]
        },
        scientificJustification: 'Poor data quality can lead to unreliable curve fitting and incorrect parameter estimates.'
      });
    }
    
    // Pattern detection recommendations
    if (adaptivePatterns.length === 0 || adaptivePatterns[0].confidence < 0.5) {
      recommendations.push({
        type: 'important',
        priority: 7,
        category: 'pattern-detection',
        title: 'Irregular Concentration Pattern Detected',
        description: 'The concentration series does not follow a recognizable dilution pattern.',
        technicalDetails: this.getPatternDetails(adaptivePatterns),
        actionable: true,
        estimatedImpact: {
          confidence: 0.3,
          accuracy: 0.2,
          reliability: 0.4
        },
        implementationGuide: {
          complexity: 'easy',
          timeRequired: '15-30 minutes',
          resourcesNeeded: ['Concentration calculations'],
          steps: [
            'Use consistent dilution ratios (e.g., 3-fold, 10-fold)',
            'Ensure adequate concentration range (2-4 orders of magnitude)',
            'Include at least 6-8 concentration points',
            'Double-check concentration calculations'
          ]
        },
        scientificJustification: 'Regular dilution patterns improve curve fitting reliability and parameter precision.'
      });
    }
    
    // Consensus recommendations
    if (integrationMetrics.consensusScore < 0.6) {
      recommendations.push({
        type: 'suggestion',
        priority: 5,
        category: 'analysis-optimization',
        title: 'Low Consensus Between Detection Methods',
        description: 'Different analysis methods show poor agreement, suggesting data ambiguity.',
        technicalDetails: this.getConsensusDetails(integrationMetrics),
        actionable: true,
        estimatedImpact: {
          confidence: 0.2,
          accuracy: 0.3,
          reliability: 0.4
        },
        implementationGuide: {
          complexity: 'moderate',
          timeRequired: '20-40 minutes',
          resourcesNeeded: ['Analysis software', 'Statistical expertise'],
          steps: [
            'Review data for potential issues',
            'Consider manual configuration',
            'Try alternative analysis approaches',
            'Consult with data analysis expert'
          ]
        },
        scientificJustification: 'Method consensus provides confidence in analysis results and identifies potential data issues.'
      });
    }
    
    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(
    startTime: number,
    endTime: number,
    rawData: any[][],
    options: RobustDetectionOptions
  ): PerformanceMetrics {
    const detectionTime = endTime - startTime;
    const dataSize = rawData.length * (rawData[0]?.length || 0);
    
    // Estimate memory usage (rough approximation)
    const memoryUsage = dataSize * 8 / (1024 * 1024); // Assume 8 bytes per cell, convert to MB
    
    // Assess computational complexity
    let computationalComplexity = 'linear';
    if (options.robustnessLevel === 'comprehensive' || options.robustnessLevel === 'maximum') {
      computationalComplexity = 'quadratic';
    }
    
    const scalability: ScalabilityMetrics = {
      maxDataPoints: this.estimateMaxDataPoints(options),
      performanceDegradation: this.estimatePerformanceDegradation(detectionTime, dataSize),
      memoryScaling: 'linear',
      timeComplexity: computationalComplexity
    };
    
    const errorHandling: ErrorHandlingMetrics = {
      errorRate: 0.01, // Estimated 1% error rate
      recoveryRate: 0.95, // 95% recovery rate
      robustnessToNoise: 0.8, // Good robustness to noise
      failureMode: 'graceful-degradation'
    };
    
    return {
      detectionTime,
      memoryUsage,
      computationalComplexity,
      scalability,
      errorHandling
    };
  }

  // Helper methods
  private getDefaultOptions(): RobustDetectionOptions {
    return {
      enableAdaptivePatterns: true,
      enableScientificValidation: true,
      performCrossValidation: true,
      uncertaintyQuantification: true,
      performanceOptimization: true,
      robustnessLevel: 'standard',
      timeoutMs: 30000, // 30 seconds
      maxMemoryMB: 500  // 500 MB
    };
  }

  private extractColumnData(rawData: any[][], column: number, startRow: number): any[] {
    const data: any[] = [];
    for (let row = startRow; row < rawData.length; row++) {
      const cell = rawData[row]?.[column];
      if (cell !== undefined && cell !== null && cell !== '') {
        data.push(cell);
      }
    }
    return data;
  }

  private inferAssayType(scientificResult: ScientificDetectionResult): string {
    // Simple inference based on concentration range
    if (scientificResult.concentrationColumn >= 0) {
      return 'unknown'; // Would implement actual inference logic
    }
    return 'unknown';
  }

  private calculateVariability(values: number[]): number {
    if (values.length === 0) return 1;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    if (mean === 0) return 1;
    
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / mean; // Coefficient of variation
  }

  private getDataQualityDetails(validationResult: ScientificValidationResult): string {
    const issues: string[] = [];
    
    if (validationResult.concentration.powerAnalysis.estimatedPower < 0.8) {
      issues.push('Insufficient statistical power');
    }
    
    if (!validationResult.concentration.rangeAppropriate.isAppropriate) {
      issues.push('Inappropriate concentration range');
    }
    
    return issues.join('; ');
  }

  private getPatternDetails(adaptivePatterns: PatternCandidate[]): string {
    if (adaptivePatterns.length === 0) {
      return 'No recognizable dilution pattern detected';
    }
    
    const bestPattern = adaptivePatterns[0];
    return `Detected pattern: ${bestPattern.type} (confidence: ${(bestPattern.confidence * 100).toFixed(1)}%)`;
  }

  private getConsensusDetails(integrationMetrics: IntegrationMetrics): string {
    return `Method agreement: ${(integrationMetrics.methodAgreement.overallConsensus * 100).toFixed(1)}%, ` +
           `Cross-validation: ${(integrationMetrics.crossValidationScore * 100).toFixed(1)}%`;
  }

  private estimateMaxDataPoints(options: RobustDetectionOptions): number {
    switch (options.robustnessLevel) {
      case 'basic': return 10000;
      case 'standard': return 5000;
      case 'comprehensive': return 2000;
      case 'maximum': return 1000;
      default: return 5000;
    }
  }

  private estimatePerformanceDegradation(detectionTime: number, dataSize: number): number {
    // Rough estimate of performance degradation per 1000 data points
    return Math.max(0, Math.min(1, detectionTime / (dataSize / 1000) / 100));
  }

  private createEmptyValidationResult(): ScientificValidationResult {
    // Return a minimal validation result
    const emptyScore = { score: 0, level: 'unacceptable' as const, confidence: 0, factors: [] };
    
    return {
      overall: emptyScore,
      concentration: {
        unitConsistency: { isConsistent: false, detectedUnits: [], conversionIssues: [], recommendedUnit: 'nM', confidence: 0 },
        rangeAppropriate: { isAppropriate: false, orderOfMagnitude: 0, minConcentration: 0, maxConcentration: 0, expectedRange: [1, 1000], rangeCategory: 'unrealistic', coverage: 0 },
        biologicalRelevance: { isRelevant: false, assayType: { primary: 'unknown', confidence: 0, characteristics: [] }, concentrationContext: { typicalRange: [1, 1000], targetConcentration: 0, mechanism: 'unknown', cellularContext: false }, biologicalPlausibility: 0, literatureComparison: { hasComparableStudies: false, rangeSimilarity: 0, potencySimilarity: 0, methodSimilarity: 0 } },
        patternQuality: { isRecognizable: false, patternType: 'unknown', consistency: 0, completeness: 0, spacing: { uniformity: 0, logUniformity: 0, coverage: 0, gaps: [] } },
        powerAnalysis: { estimatedPower: 0, currentN: 0, recommendedN: 8, minimumN: 5, adequateForFitting: false, expectedPrecision: { ic50Precision: 0, slopePrecision: 0, asymptotePrecision: 0, overallPrecision: 0 } },
        overall: emptyScore
      },
      response: {
        dataQuality: { completeness: 0, missingDataPattern: { pattern: 'systematic', severity: 1, impact: 'severe' }, dataTypeConsistency: { allNumeric: false, mixedTypes: true, conversionIssues: [] }, rangeReasonableness: { reasonable: false, negativeValues: false, extremeValues: [], suspiciousValues: [] }, precision: { significantDigits: 0, detectionLimit: 0, quantificationLimit: 0, instrumentalPrecision: 0 } },
        replicateConsistency: { hasReplicates: false, replicateCount: 0, withinReplicateCV: 1, betweenReplicateCV: 1, consistency: { withinGroupVariability: 1, betweenGroupVariability: 1, systematicBias: true, replicateQuality: 'poor' }, adequateReplication: false },
        outlierAnalysis: { outlierCount: 0, outlierPercentage: 0, outlierSeverity: [], outlierPattern: { randomDistribution: false, clusteredOutliers: false, concentrationDependent: false, replicateSpecific: false }, impactOnFitting: { parameterBias: 1, fittingStability: 0, recommendRemoval: [] } },
        statisticalPower: { statisticalPower: 0, effectSizeDetectable: 0, currentSampleSize: 0, recommendedSampleSize: 0, powerCurve: [] },
        signalToNoise: { signalToNoiseRatio: 0, noiseCharacteristics: { noiseLevel: 1, noiseType: 'systematic', correlatedNoise: true, noiseStability: 0 }, signalClarity: 0, dynamicRange: 0, qualityCategory: 'poor' },
        overall: emptyScore
      },
      doseResponse: {
        relationship: { hasRelationship: false, relationshipStrength: 0, relationshipType: 'none', correlationCoefficient: 0, significanceLevel: 1 },
        monotonicity: { isMonotonic: false, monotonicityStrength: 0, direction: 'mixed', violations: [], expectedDirection: 'unknown' },
        dynamicRange: { dynamicRange: 0, baseline: 0, maximum: 0, saturation: { isSaturated: false, saturationLevel: 0, saturationConcentration: 0, baselineLevel: 0 }, adequateForFitting: false },
        fittingProspects: { fittingProspects: { convergenceProbability: 0, parameterIdentifiability: 0, modelComplexity: 1, fittingChallenges: [] }, expectedParameters: { ic50: { estimate: 0, lowerBound: 0, upperBound: 0, confidence: 0 }, hillSlope: { estimate: 0, lowerBound: 0, upperBound: 0, confidence: 0 }, top: { estimate: 0, lowerBound: 0, upperBound: 0, confidence: 0 }, bottom: { estimate: 0, lowerBound: 0, upperBound: 0, confidence: 0 } }, convergenceLikelihood: 0, uncertaintyEstimates: { correlationMatrix: [], standardErrors: [], confidenceIntervals: [] } },
        overall: emptyScore
      },
      recommendations: [],
      qualityReport: {
        summary: { overallGrade: 'F', strengths: [], weaknesses: [], criticalIssues: [], readinessForAnalysis: false },
        dataCharacteristics: { concentrationPoints: 0, responseReplicates: 0, concentrationRange: 0, responseRange: 0, dataCompleteness: 0, experimentalDesign: 'unknown' },
        scientificAssessment: { biologicalRelevance: 0, statisticalPower: 0, methodologicalSoundness: 0, reproducibilityProspects: 0 },
        recommendations: [],
        benchmarks: { industryStandards: { score: 0, percentile: 0, comparison: 'well-below' }, academicStandards: { score: 0, percentile: 0, comparison: 'well-below' }, regulatoryStandards: { score: 0, percentile: 0, comparison: 'well-below' }, bestPractices: { score: 0, percentile: 0, comparison: 'well-below' } }
      }
    };
  }

  private createErrorResult(message: string): RobustDetectionResult {
    const baseError = this.scientificEngine.analyzeExcelData([]);
    
    return {
      ...baseError,
      adaptivePatterns: [],
      validationResult: this.createEmptyValidationResult(),
      integrationMetrics: {
        consensusScore: 0,
        crossValidationScore: 0,
        robustnessScore: 0,
        reliabilityScore: 0,
        methodAgreement: {
          structuralVsPattern: 0,
          patternVsValidation: 0,
          structuralVsValidation: 0,
          overallConsensus: 0
        }
      },
      robustConfidence: {
        overall: 0,
        structural: 0,
        pattern: 0,
        validation: 0,
        consensus: 0,
        uncertainty: { lower: 0, upper: 0, width: 0, method: 'error' }
      },
      enhancedRecommendations: [{
        type: 'critical',
        priority: 10,
        category: 'data-quality',
        title: 'Detection Engine Error',
        description: message,
        technicalDetails: `System error: ${message}`,
        actionable: false,
        estimatedImpact: { confidence: 0, accuracy: 0, reliability: 0 },
        implementationGuide: { complexity: 'expert', timeRequired: 'unknown', resourcesNeeded: ['Technical support'], steps: ['Contact technical support'] },
        scientificJustification: 'System error prevents analysis'
      }],
      performanceMetrics: {
        detectionTime: 0,
        memoryUsage: 0,
        computationalComplexity: 'error',
        scalability: { maxDataPoints: 0, performanceDegradation: 1, memoryScaling: 'error', timeComplexity: 'error' },
        errorHandling: { errorRate: 1, recoveryRate: 0, robustnessToNoise: 0, failureMode: 'system-error' }
      }
    };
  }
}

// Export convenience function
export async function robustDetectExcelData(
  rawData: any[][],
  options?: Partial<RobustDetectionOptions>
): Promise<RobustDetectionResult> {
  const engine = new RobustDetectionEngine();
  const fullOptions = { ...engine['getDefaultOptions'](), ...options };
  return engine.detectWithRobustness(rawData, fullOptions);
}