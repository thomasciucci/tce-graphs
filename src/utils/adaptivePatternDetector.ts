/**
 * Adaptive Pattern Detection for nVitro Studio
 * Multi-scale pattern recognition with machine learning and Bayesian inference
 */

import { parseConcentration, normalizeConcentration } from './dataDetection';

// Core pattern detection interfaces
export interface PatternCandidate {
  type: 'serial' | 'log-scale' | 'half-log' | 'custom' | 'irregular';
  parameters: PatternParameters;
  confidence: number;
  evidence: PatternEvidence;
  statisticalMetrics: StatisticalMetrics;
}

export interface PatternParameters {
  dilutionFactor?: number;
  logBase?: number;
  customSequence?: number[];
  startValue?: number;
  endValue?: number;
  stepCount?: number;
}

export interface PatternEvidence {
  dataPoints: number[];
  ratios: number[];
  gaps: number[];
  outliers: number[];
  consistency: number;
  completeness: number;
}

export interface StatisticalMetrics {
  median: number;
  robustStdDev: number;
  coefficientOfVariation: number;
  skewness: number;
  kurtosis: number;
  autocorrelation: number;
}

export interface BayesianResult {
  posteriorProbabilities: Map<string, number>;
  evidenceWeight: number;
  priorInfluence: number;
  modelConfidence: number;
  alternativeHypotheses: AlternativeHypothesis[];
}

export interface AlternativeHypothesis {
  type: string;
  probability: number;
  parameters: PatternParameters;
  explanation: string;
}

export interface MLPrediction {
  predictedType: string;
  confidence: number;
  features: FeatureVector;
  modelVersion: string;
  uncertainty: number;
}

export interface FeatureVector {
  // Statistical features
  ratioMean: number;
  ratioStd: number;
  ratioSkew: number;
  logRatioMean: number;
  
  // Pattern features
  monotonicity: number;
  regularity: number;
  logLinearity: number;
  
  // Distribution features
  rangeSpan: number;
  densityVariation: number;
  spacingConsistency: number;
  
  // Biological features
  biologicalPlausibility: number;
  concentrationAppropriate: number;
  assayRelevance: number;
}

// Laboratory priors for Bayesian inference
const ENHANCED_PRIORS = {
  // Pattern type priors based on laboratory practices
  patternTypes: new Map([
    ['serial-2fold', 0.20],      // 2-fold serial dilutions
    ['serial-3fold', 0.15],      // 3-fold serial dilutions
    ['serial-5fold', 0.10],      // 5-fold serial dilutions
    ['log-scale', 0.25],         // 10-fold (log scale)
    ['half-log', 0.12],          // √10-fold (half-log)
    ['custom-regular', 0.08],    // Other regular patterns
    ['irregular', 0.05],         // Irregular but valid
    ['custom-complex', 0.05]     // Complex custom patterns
  ]),
  
  // Concentration range priors by assay type
  concentrationRanges: new Map([
    ['binding', { min: 0.1, max: 100000, typical: [1, 10000] }],     // nM
    ['enzymatic', { min: 1, max: 1000000, typical: [10, 100000] }],  // nM
    ['cellular', { min: 10, max: 10000000, typical: [100, 1000000] }], // nM
    ['general', { min: 0.01, max: 100000000, typical: [1, 100000] }]
  ]),
  
  // Quality thresholds
  qualityThresholds: {
    excellentConsistency: 0.95,
    goodConsistency: 0.85,
    acceptableConsistency: 0.70,
    minimumPoints: 5,
    recommendedPoints: 8,
    maxOutlierFraction: 0.15
  }
};

/**
 * Advanced adaptive pattern detector with multi-scale analysis
 */
export class AdaptivePatternDetector {
  private readonly bayesianEngine: BayesianInferenceEngine;
  private readonly mlPredictor: MLPatternPredictor;
  private readonly statisticalAnalyzer: StatisticalAnalyzer;
  
  constructor() {
    this.bayesianEngine = new BayesianInferenceEngine();
    this.mlPredictor = new MLPatternPredictor();
    this.statisticalAnalyzer = new StatisticalAnalyzer();
  }

  /**
   * Multi-level pattern detection with adaptive thresholds
   */
  async detectPattern(concentrationData: any[]): Promise<PatternCandidate[]> {
    try {
      // Level 1: Fast heuristic screening
      const candidates = await this.screenForPatterns(concentrationData);
      
      // Level 2: Statistical validation
      const validatedCandidates = await this.validatePatterns(candidates);
      
      // Level 3: Bayesian inference
      const bayesianResults = await this.performBayesianInference(validatedCandidates, concentrationData);
      
      // Level 4: ML prediction (if available)
      const mlResults = await this.performMLPrediction(concentrationData);
      
      // Level 5: Ensemble combination
      const finalCandidates = this.combineResults(validatedCandidates, bayesianResults, mlResults);
      
      return finalCandidates.sort((a, b) => b.confidence - a.confidence);
      
    } catch (error) {
      console.warn('Pattern detection failed:', error);
      return this.createFallbackResults(concentrationData);
    }
  }

  /**
   * Level 1: Fast heuristic screening
   */
  private async screenForPatterns(concentrationData: any[]): Promise<PatternCandidate[]> {
    const numericValues = this.parseConcentrationValues(concentrationData);
    
    if (numericValues.length < 3) {
      return [];
    }

    const candidates: PatternCandidate[] = [];
    
    // Screen for serial dilutions
    candidates.push(...this.screenSerialDilutions(numericValues));
    
    // Screen for log-scale patterns
    candidates.push(...this.screenLogScalePatterns(numericValues));
    
    // Screen for custom patterns
    candidates.push(...this.screenCustomPatterns(numericValues));
    
    return candidates.filter(c => c.confidence > 0.1); // Basic threshold
  }

  /**
   * Screen for serial dilution patterns
   */
  private screenSerialDilutions(values: number[]): PatternCandidate[] {
    const candidates: PatternCandidate[] = [];
    const sortedValues = [...values].sort((a, b) => b - a);
    
    // Common dilution factors to test
    const dilutionFactors = [2, 3, 4, 5, 6, 7, 8, 9, 10];
    
    for (const factor of dilutionFactors) {
      const analysis = this.analyzeSerialPattern(sortedValues, factor);
      
      if (analysis.confidence > 0.2) {
        candidates.push({
          type: factor === 10 ? 'log-scale' : 'serial',
          parameters: {
            dilutionFactor: factor,
            startValue: sortedValues[0],
            endValue: sortedValues[sortedValues.length - 1],
            stepCount: sortedValues.length
          },
          confidence: analysis.confidence,
          evidence: analysis.evidence,
          statisticalMetrics: analysis.metrics
        });
      }
    }
    
    return candidates;
  }

  /**
   * Analyze serial dilution pattern for a specific factor
   */
  private analyzeSerialPattern(sortedValues: number[], factor: number): {
    confidence: number;
    evidence: PatternEvidence;
    metrics: StatisticalMetrics;
  } {
    const ratios = this.calculateRatios(sortedValues);
    const metrics = this.statisticalAnalyzer.calculateMetrics(ratios);
    
    // Calculate how close ratios are to the expected factor
    const deviations = ratios.map(r => Math.abs(r - factor) / factor);
    const meanDeviation = deviations.reduce((sum, d) => sum + d, 0) / deviations.length;
    
    // Base confidence on consistency and proximity to expected factor
    const consistencyScore = 1 - meanDeviation;
    const outlierPenalty = this.calculateOutlierPenalty(deviations);
    const completenessScore = this.calculateCompleteness(sortedValues, factor);
    
    const confidence = Math.max(0, consistencyScore * 0.6 + 
                                  (1 - outlierPenalty) * 0.2 + 
                                  completenessScore * 0.2);
    
    const evidence: PatternEvidence = {
      dataPoints: sortedValues,
      ratios,
      gaps: this.identifyGaps(sortedValues, factor),
      outliers: this.identifyOutliers(deviations),
      consistency: consistencyScore,
      completeness: completenessScore
    };

    return { confidence, evidence, metrics };
  }

  /**
   * Screen for log-scale patterns
   */
  private screenLogScalePatterns(values: number[]): PatternCandidate[] {
    const candidates: PatternCandidate[] = [];
    const sortedValues = [...values].sort((a, b) => b - a);
    
    // Test different log bases
    const logBases = [10, Math.E, 2];
    
    for (const base of logBases) {
      const logValues = sortedValues.map(v => Math.log(v) / Math.log(base));
      const logSpacing = this.analyzeLogSpacing(logValues);
      
      if (logSpacing.confidence > 0.3) {
        candidates.push({
          type: base === 10 ? 'log-scale' : 'custom',
          parameters: {
            logBase: base,
            dilutionFactor: Math.pow(base, logSpacing.avgStep),
            startValue: sortedValues[0],
            endValue: sortedValues[sortedValues.length - 1]
          },
          confidence: logSpacing.confidence,
          evidence: logSpacing.evidence,
          statisticalMetrics: logSpacing.metrics
        });
      }
    }
    
    return candidates;
  }

  /**
   * Analyze log spacing for pattern detection
   */
  private analyzeLogSpacing(logValues: number[]): {
    confidence: number;
    evidence: PatternEvidence;
    metrics: StatisticalMetrics;
    avgStep: number;
  } {
    if (logValues.length < 3) {
      return { confidence: 0, evidence: this.createEmptyEvidence(), metrics: this.createEmptyMetrics(), avgStep: 0 };
    }

    // Calculate spacing between consecutive log values
    const spacings: number[] = [];
    for (let i = 0; i < logValues.length - 1; i++) {
      spacings.push(Math.abs(logValues[i] - logValues[i + 1]));
    }
    
    const avgStep = spacings.reduce((sum, s) => sum + s, 0) / spacings.length;
    const spacingVariability = this.calculateVariability(spacings);
    
    // Good log spacing should have consistent steps
    const consistency = Math.max(0, 1 - spacingVariability);
    const linearityScore = this.calculateLogLinearity(logValues);
    
    const confidence = consistency * 0.7 + linearityScore * 0.3;
    
    const evidence: PatternEvidence = {
      dataPoints: logValues,
      ratios: spacings,
      gaps: [],
      outliers: [],
      consistency,
      completeness: 1
    };
    
    const metrics = this.statisticalAnalyzer.calculateMetrics(spacings);
    
    return { confidence, evidence, metrics, avgStep };
  }

  /**
   * Screen for custom patterns
   */
  private screenCustomPatterns(values: number[]): PatternCandidate[] {
    const candidates: PatternCandidate[] = [];
    const sortedValues = [...values].sort((a, b) => b - a);
    
    // Look for any consistent ratio pattern
    const ratios = this.calculateRatios(sortedValues);
    if (ratios.length === 0) return candidates;
    
    const ratioAnalysis = this.analyzeRatioConsistency(ratios);
    
    if (ratioAnalysis.confidence > 0.4) {
      candidates.push({
        type: 'custom',
        parameters: {
          customSequence: sortedValues,
          dilutionFactor: ratioAnalysis.dominantRatio
        },
        confidence: ratioAnalysis.confidence,
        evidence: ratioAnalysis.evidence,
        statisticalMetrics: ratioAnalysis.metrics
      });
    }
    
    return candidates;
  }

  /**
   * Level 2: Statistical validation of candidates
   */
  private async validatePatterns(candidates: PatternCandidate[]): Promise<PatternCandidate[]> {
    const validated: PatternCandidate[] = [];
    
    for (const candidate of candidates) {
      const validation = await this.performStatisticalValidation(candidate);
      
      if (validation.isValid) {
        candidate.confidence *= validation.confidenceMultiplier;
        candidate.statisticalMetrics = {
          ...candidate.statisticalMetrics,
          ...validation.enhancedMetrics
        };
        validated.push(candidate);
      }
    }
    
    return validated;
  }

  /**
   * Statistical validation of individual pattern candidates
   */
  private async performStatisticalValidation(candidate: PatternCandidate): Promise<{
    isValid: boolean;
    confidenceMultiplier: number;
    enhancedMetrics: Partial<StatisticalMetrics>;
  }> {
    const ratios = candidate.evidence.ratios;
    
    // Normality test for ratios
    const normalityResult = this.testNormality(ratios);
    
    // Outlier detection
    const outlierResult = this.detectStatisticalOutliers(ratios);
    
    // Autocorrelation test
    const autocorrelationResult = this.testAutocorrelation(ratios);
    
    // Combine validation results
    let confidenceMultiplier = 1.0;
    
    if (normalityResult.isNormal) {
      confidenceMultiplier *= 1.1; // Bonus for normality
    }
    
    if (outlierResult.outlierFraction > 0.2) {
      confidenceMultiplier *= 0.8; // Penalty for too many outliers
    }
    
    if (autocorrelationResult.hasAutocorrelation) {
      confidenceMultiplier *= 0.9; // Slight penalty for autocorrelation
    }
    
    const isValid = candidate.confidence * confidenceMultiplier > 0.15;
    
    return {
      isValid,
      confidenceMultiplier,
      enhancedMetrics: {
        autocorrelation: autocorrelationResult.correlation
      }
    };
  }

  /**
   * Level 3: Bayesian inference
   */
  private async performBayesianInference(
    candidates: PatternCandidate[],
    concentrationData: any[]
  ): Promise<BayesianResult[]> {
    return this.bayesianEngine.inferPatterns(candidates, concentrationData);
  }

  /**
   * Level 4: Machine learning prediction
   */
  private async performMLPrediction(concentrationData: any[]): Promise<MLPrediction | null> {
    try {
      return await this.mlPredictor.predict(concentrationData);
    } catch (error) {
      console.warn('ML prediction failed:', error);
      return null;
    }
  }

  /**
   * Level 5: Ensemble combination
   */
  private combineResults(
    validatedCandidates: PatternCandidate[],
    bayesianResults: BayesianResult[],
    mlResult: MLPrediction | null
  ): PatternCandidate[] {
    // Weight the different approaches
    const weights = {
      statistical: 0.4,
      bayesian: 0.4,
      ml: 0.2
    };
    
    const combined: PatternCandidate[] = [];
    
    for (let i = 0; i < validatedCandidates.length; i++) {
      const candidate = validatedCandidates[i];
      const bayesian = bayesianResults[i];
      
      // Combine confidences
      let combinedConfidence = candidate.confidence * weights.statistical;
      
      if (bayesian) {
        combinedConfidence += bayesian.modelConfidence * weights.bayesian;
      }
      
      if (mlResult && mlResult.predictedType === candidate.type) {
        combinedConfidence += mlResult.confidence * weights.ml;
      }
      
      combined.push({
        ...candidate,
        confidence: Math.min(1.0, combinedConfidence)
      });
    }
    
    return combined;
  }

  // Helper methods
  private parseConcentrationValues(concentrationData: any[]): number[] {
    const values: number[] = [];
    
    for (const item of concentrationData) {
      if (typeof item === 'number' && item > 0 && isFinite(item)) {
        values.push(item);
      } else if (typeof item === 'string') {
        const parsed = parseConcentration(item);
        if (parsed.isValid) {
          const normalized = normalizeConcentration(parsed);
          if (!isNaN(normalized) && normalized > 0 && isFinite(normalized)) {
            values.push(normalized);
          }
        }
      }
    }
    
    return values;
  }

  private calculateRatios(sortedValues: number[]): number[] {
    const ratios: number[] = [];
    for (let i = 0; i < sortedValues.length - 1; i++) {
      const ratio = sortedValues[i] / sortedValues[i + 1];
      if (isFinite(ratio) && ratio > 0) {
        ratios.push(ratio);
      }
    }
    return ratios;
  }

  private calculateOutlierPenalty(deviations: number[]): number {
    const threshold = 0.3; // 30% deviation threshold
    const outliers = deviations.filter(d => d > threshold);
    return Math.min(1, outliers.length / deviations.length);
  }

  private calculateCompleteness(values: number[], expectedFactor: number): number {
    if (values.length < 2) return 0;
    
    const range = values[0] / values[values.length - 1];
    const expectedSteps = Math.log(range) / Math.log(expectedFactor);
    const actualSteps = values.length - 1;
    
    return Math.min(1, actualSteps / expectedSteps);
  }

  private identifyGaps(values: number[], expectedFactor: number): number[] {
    const gaps: number[] = [];
    // Implementation would identify missing expected values
    return gaps;
  }

  private identifyOutliers(deviations: number[]): number[] {
    const threshold = 0.3;
    return deviations.map((d, i) => d > threshold ? i : -1).filter(i => i >= 0);
  }

  private calculateVariability(values: number[]): number {
    if (values.length === 0) return 1;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance) / mean; // Coefficient of variation
  }

  private calculateLogLinearity(logValues: number[]): number {
    if (logValues.length < 3) return 0;
    
    // Simple linear regression to test linearity
    const n = logValues.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = logValues;
    
    const sumX = x.reduce((sum, xi) => sum + xi, 0);
    const sumY = y.reduce((sum, yi) => sum + yi, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const yMean = sumY / n;
    const totalSumSquares = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const residualSumSquares = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    
    const rSquared = 1 - (residualSumSquares / totalSumSquares);
    return Math.max(0, rSquared);
  }

  private analyzeRatioConsistency(ratios: number[]): {
    confidence: number;
    evidence: PatternEvidence;
    metrics: StatisticalMetrics;
    dominantRatio: number;
  } {
    if (ratios.length === 0) {
      return {
        confidence: 0,
        evidence: this.createEmptyEvidence(),
        metrics: this.createEmptyMetrics(),
        dominantRatio: 1
      };
    }

    const metrics = this.statisticalAnalyzer.calculateMetrics(ratios);
    const dominantRatio = metrics.median;
    
    // Consistency based on coefficient of variation
    const consistency = Math.max(0, 1 - metrics.coefficientOfVariation);
    
    const evidence: PatternEvidence = {
      dataPoints: ratios,
      ratios,
      gaps: [],
      outliers: [],
      consistency,
      completeness: 1
    };
    
    return {
      confidence: consistency,
      evidence,
      metrics,
      dominantRatio
    };
  }

  private testNormality(values: number[]): { isNormal: boolean; pValue: number } {
    // Simplified normality test - would implement Shapiro-Wilk or similar
    if (values.length < 3) return { isNormal: false, pValue: 0 };
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Simple skewness test
    const skewness = values.reduce((sum, v) => sum + Math.pow((v - mean) / stdDev, 3), 0) / values.length;
    
    const isNormal = Math.abs(skewness) < 1; // Rough threshold
    const pValue = Math.max(0, 1 - Math.abs(skewness)); // Rough approximation
    
    return { isNormal, pValue };
  }

  private detectStatisticalOutliers(values: number[]): { outlierFraction: number; outliers: number[] } {
    if (values.length < 3) return { outlierFraction: 0, outliers: [] };
    
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    const outliers = values.map((v, i) => (v < lowerBound || v > upperBound) ? i : -1)
                          .filter(i => i >= 0);
    
    return {
      outlierFraction: outliers.length / values.length,
      outliers
    };
  }

  private testAutocorrelation(values: number[]): { hasAutocorrelation: boolean; correlation: number } {
    if (values.length < 4) return { hasAutocorrelation: false, correlation: 0 };
    
    // Calculate lag-1 autocorrelation
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < values.length - 1; i++) {
      numerator += (values[i] - mean) * (values[i + 1] - mean);
    }
    
    for (let i = 0; i < values.length; i++) {
      denominator += Math.pow(values[i] - mean, 2);
    }
    
    const correlation = denominator !== 0 ? numerator / denominator : 0;
    const hasAutocorrelation = Math.abs(correlation) > 0.5;
    
    return { hasAutocorrelation, correlation };
  }

  private createFallbackResults(concentrationData: any[]): PatternCandidate[] {
    return [{
      type: 'irregular',
      parameters: {},
      confidence: 0.1,
      evidence: this.createEmptyEvidence(),
      statisticalMetrics: this.createEmptyMetrics()
    }];
  }

  private createEmptyEvidence(): PatternEvidence {
    return {
      dataPoints: [],
      ratios: [],
      gaps: [],
      outliers: [],
      consistency: 0,
      completeness: 0
    };
  }

  private createEmptyMetrics(): StatisticalMetrics {
    return {
      median: 0,
      robustStdDev: 0,
      coefficientOfVariation: 0,
      skewness: 0,
      kurtosis: 0,
      autocorrelation: 0
    };
  }
}

/**
 * Bayesian inference engine for pattern classification
 */
class BayesianInferenceEngine {
  async inferPatterns(candidates: PatternCandidate[], concentrationData: any[]): Promise<BayesianResult[]> {
    const results: BayesianResult[] = [];
    
    for (const candidate of candidates) {
      const result = this.performBayesianInference(candidate, concentrationData);
      results.push(result);
    }
    
    return results;
  }

  private performBayesianInference(candidate: PatternCandidate, concentrationData: any[]): BayesianResult {
    // Simplified Bayesian inference implementation
    const posteriorProbabilities = new Map<string, number>();
    
    // Calculate likelihood for each pattern type
    for (const [patternType, prior] of ENHANCED_PRIORS.patternTypes) {
      const likelihood = this.calculateLikelihood(candidate, patternType);
      const posterior = likelihood * prior;
      posteriorProbabilities.set(patternType, posterior);
    }
    
    // Normalize probabilities
    const total = Array.from(posteriorProbabilities.values()).reduce((sum, p) => sum + p, 0);
    if (total > 0) {
      for (const [type, prob] of posteriorProbabilities) {
        posteriorProbabilities.set(type, prob / total);
      }
    }
    
    const maxPosterior = Math.max(...posteriorProbabilities.values());
    
    return {
      posteriorProbabilities,
      evidenceWeight: candidate.confidence,
      priorInfluence: 0.3, // Estimated prior influence
      modelConfidence: maxPosterior,
      alternativeHypotheses: []
    };
  }

  private calculateLikelihood(candidate: PatternCandidate, patternType: string): number {
    // Simplified likelihood calculation
    if (candidate.type === 'serial' && patternType.includes('serial')) {
      return candidate.confidence;
    } else if (candidate.type === 'log-scale' && patternType === 'log-scale') {
      return candidate.confidence;
    } else if (candidate.type === patternType) {
      return candidate.confidence;
    } else {
      return 0.1; // Small likelihood for mismatched types
    }
  }
}

/**
 * Machine learning pattern predictor
 */
class MLPatternPredictor {
  async predict(concentrationData: any[]): Promise<MLPrediction | null> {
    // Placeholder for ML prediction
    // In a real implementation, this would load a trained model
    return null;
  }
}

/**
 * Statistical analyzer for pattern metrics
 */
class StatisticalAnalyzer {
  calculateMetrics(values: number[]): StatisticalMetrics {
    if (values.length === 0) {
      return {
        median: 0,
        robustStdDev: 0,
        coefficientOfVariation: 0,
        skewness: 0,
        kurtosis: 0,
        autocorrelation: 0
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const median = this.calculateMedian(sorted);
    const robustStdDev = this.calculateRobustStdDev(values, median);
    const coefficientOfVariation = robustStdDev / median;
    const skewness = this.calculateSkewness(values);
    const kurtosis = this.calculateKurtosis(values);
    const autocorrelation = this.calculateAutocorrelation(values);

    return {
      median,
      robustStdDev,
      coefficientOfVariation,
      skewness,
      kurtosis,
      autocorrelation
    };
  }

  private calculateMedian(sortedValues: number[]): number {
    const mid = Math.floor(sortedValues.length / 2);
    if (sortedValues.length % 2 === 0) {
      return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
    } else {
      return sortedValues[mid];
    }
  }

  private calculateRobustStdDev(values: number[], median: number): number {
    const deviations = values.map(v => Math.abs(v - median));
    const mad = this.calculateMedian(deviations.sort((a, b) => a - b));
    return mad * 1.4826; // Scale factor for normal distribution
  }

  private calculateSkewness(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    return values.reduce((sum, v) => sum + Math.pow((v - mean) / stdDev, 3), 0) / values.length;
  }

  private calculateKurtosis(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    return values.reduce((sum, v) => sum + Math.pow((v - mean) / stdDev, 4), 0) / values.length - 3;
  }

  private calculateAutocorrelation(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < values.length - 1; i++) {
      numerator += (values[i] - mean) * (values[i + 1] - mean);
    }
    
    for (let i = 0; i < values.length; i++) {
      denominator += Math.pow(values[i] - mean, 2);
    }
    
    return denominator !== 0 ? numerator / denominator : 0;
  }
}

// Export convenience function
export async function detectDilutionPattern(concentrationData: any[]): Promise<PatternCandidate[]> {
  const detector = new AdaptivePatternDetector();
  return detector.detectPattern(concentrationData);
}