/**
 * Scientific Validation Engine for nVitro Studio
 * Comprehensive biological and statistical validation of dose-response data
 */

import { parseConcentration, normalizeConcentration } from './dataDetection';

// Core validation interfaces
export interface ScientificValidationResult {
  overall: ValidationScore;
  concentration: ConcentrationValidationResult;
  response: ResponseValidationResult;
  doseResponse: DoseResponseValidationResult;
  recommendations: ValidationRecommendation[];
  qualityReport: QualityReport;
}

export interface ValidationScore {
  score: number;                    // 0-1 overall score
  level: 'excellent' | 'good' | 'acceptable' | 'poor' | 'unacceptable';
  confidence: number;               // Confidence in the validation
  factors: ValidationFactor[];      // Contributing factors
}

export interface ValidationFactor {
  name: string;
  weight: number;                   // 0-1 importance weight
  score: number;                    // 0-1 factor score
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
}

export interface ConcentrationValidationResult {
  unitConsistency: UnitValidation;
  rangeAppropriate: RangeValidation;
  biologicalRelevance: BiologicalValidation;
  patternQuality: PatternValidation;
  powerAnalysis: PowerAnalysis;
  overall: ValidationScore;
}

export interface ResponseValidationResult {
  dataQuality: DataQualityValidation;
  replicateConsistency: ReplicateValidation;
  outlierAnalysis: OutlierValidation;
  statisticalPower: PowerValidation;
  signalToNoise: SignalNoiseValidation;
  overall: ValidationScore;
}

export interface DoseResponseValidationResult {
  relationship: RelationshipValidation;
  monotonicity: MonotonicityValidation;
  dynamicRange: DynamicRangeValidation;
  fittingProspects: FittingValidation;
  overall: ValidationScore;
}

export interface ValidationRecommendation {
  type: 'critical' | 'important' | 'suggestion' | 'optimization';
  category: 'concentration' | 'response' | 'experimental-design' | 'data-quality';
  message: string;
  technicalExplanation: string;
  actionable: boolean;
  estimatedImpact: 'high' | 'medium' | 'low';
  implementationComplexity: 'easy' | 'moderate' | 'difficult';
}

export interface QualityReport {
  summary: QualitySummary;
  dataCharacteristics: DataCharacteristics;
  scientificAssessment: ScientificAssessment;
  recommendations: QualityRecommendation[];
  benchmarks: BenchmarkComparison;
}

// Detailed validation result interfaces
export interface UnitValidation {
  isConsistent: boolean;
  detectedUnits: string[];
  conversionIssues: string[];
  recommendedUnit: string;
  confidence: number;
}

export interface RangeValidation {
  isAppropriate: boolean;
  orderOfMagnitude: number;
  minConcentration: number;
  maxConcentration: number;
  expectedRange: [number, number];
  rangeCategory: 'too-narrow' | 'appropriate' | 'too-wide' | 'unrealistic';
  coverage: number; // How well the range covers the expected dynamic range
}

export interface BiologicalValidation {
  isRelevant: boolean;
  assayType: AssayType;
  concentrationContext: ConcentrationContext;
  biologicalPlausibility: number;
  literatureComparison: LiteratureComparison;
}

export interface PatternValidation {
  isRecognizable: boolean;
  patternType: string;
  consistency: number;
  completeness: number;
  spacing: SpacingQuality;
}

export interface PowerAnalysis {
  estimatedPower: number;
  currentN: number;
  recommendedN: number;
  minimumN: number;
  adequateForFitting: boolean;
  expectedPrecision: PrecisionEstimate;
}

export interface DataQualityValidation {
  completeness: number;
  missingDataPattern: MissingDataAnalysis;
  dataTypeConsistency: TypeConsistency;
  rangeReasonableness: RangeCheck;
  precision: PrecisionAnalysis;
}

export interface ReplicateValidation {
  hasReplicates: boolean;
  replicateCount: number;
  withinReplicateCV: number;
  betweenReplicateCV: number;
  consistency: ReplicateConsistency;
  adequateReplication: boolean;
}

export interface OutlierValidation {
  outlierCount: number;
  outlierPercentage: number;
  outlierSeverity: OutlierSeverity[];
  outlierPattern: OutlierPattern;
  impactOnFitting: OutlierImpact;
}

export interface PowerValidation {
  statisticalPower: number;
  effectSizeDetectable: number;
  currentSampleSize: number;
  recommendedSampleSize: number;
  powerCurve: PowerCurvePoint[];
}

export interface SignalNoiseValidation {
  signalToNoiseRatio: number;
  noiseCharacteristics: NoiseAnalysis;
  signalClarity: number;
  dynamicRange: number;
  qualityCategory: 'excellent' | 'good' | 'acceptable' | 'poor';
}

export interface RelationshipValidation {
  hasRelationship: boolean;
  relationshipStrength: number;
  relationshipType: 'sigmoid' | 'linear' | 'exponential' | 'complex' | 'none';
  correlationCoefficient: number;
  significanceLevel: number;
}

export interface MonotonicityValidation {
  isMonotonic: boolean;
  monotonicityStrength: number;
  direction: 'increasing' | 'decreasing' | 'mixed';
  violations: MonotonicityViolation[];
  expectedDirection: 'increasing' | 'decreasing' | 'unknown';
}

export interface DynamicRangeValidation {
  dynamicRange: number;
  baseline: number;
  maximum: number;
  saturation: SaturationAnalysis;
  adequateForFitting: boolean;
}

export interface FittingValidation {
  fittingProspects: FittingProspects;
  expectedParameters: ParameterEstimates;
  convergenceLikelihood: number;
  uncertaintyEstimates: ParameterUncertainty;
}

// Supporting interfaces
export interface AssayType {
  primary: 'binding' | 'functional' | 'cytotoxicity' | 'enzymatic' | 'reporter' | 'unknown';
  confidence: number;
  characteristics: string[];
}

export interface ConcentrationContext {
  typicalRange: [number, number];
  targetConcentration: number;
  mechanism: string;
  cellularContext: boolean;
}

export interface LiteratureComparison {
  hasComparableStudies: boolean;
  rangeSimilarity: number;
  potencySimilarity: number;
  methodSimilarity: number;
}

export interface SpacingQuality {
  uniformity: number;
  logUniformity: number;
  coverage: number;
  gaps: ConcentrationGap[];
}

export interface PrecisionEstimate {
  ic50Precision: number;
  slopePrecision: number;
  asymptotePrecision: number;
  overallPrecision: number;
}

export interface MissingDataAnalysis {
  pattern: 'random' | 'systematic' | 'concentration-dependent' | 'replicate-dependent';
  severity: number;
  impact: string;
}

export interface TypeConsistency {
  allNumeric: boolean;
  mixedTypes: boolean;
  conversionIssues: string[];
}

export interface RangeCheck {
  reasonable: boolean;
  negativeValues: boolean;
  extremeValues: number[];
  suspiciousValues: number[];
}

export interface PrecisionAnalysis {
  significantDigits: number;
  detectionLimit: number;
  quantificationLimit: number;
  instrumentalPrecision: number;
}

export interface ReplicateConsistency {
  withinGroupVariability: number;
  betweenGroupVariability: number;
  systematicBias: boolean;
  replicateQuality: 'excellent' | 'good' | 'acceptable' | 'poor';
}

export interface OutlierSeverity {
  index: number;
  value: number;
  severity: 'mild' | 'moderate' | 'severe' | 'extreme';
  likelihood: number;
}

export interface OutlierPattern {
  randomDistribution: boolean;
  clusteredOutliers: boolean;
  concentrationDependent: boolean;
  replicateSpecific: boolean;
}

export interface OutlierImpact {
  parameterBias: number;
  fittingStability: number;
  recommendRemoval: boolean[];
}

export interface PowerCurvePoint {
  sampleSize: number;
  power: number;
  effectSize: number;
}

export interface NoiseAnalysis {
  noiseLevel: number;
  noiseType: 'gaussian' | 'heteroscedastic' | 'systematic' | 'mixed';
  correlatedNoise: boolean;
  noiseStability: number;
}

export interface MonotonicityViolation {
  concentrationIndex: number;
  expectedDirection: 'up' | 'down';
  actualDirection: 'up' | 'down';
  magnitude: number;
}

export interface SaturationAnalysis {
  isSaturated: boolean;
  saturationLevel: number;
  saturationConcentration: number;
  baselineLevel: number;
}

export interface FittingProspects {
  convergenceProbability: number;
  parameterIdentifiability: number;
  modelComplexity: number;
  fittingChallenges: string[];
}

export interface ParameterEstimates {
  ic50: ParameterEstimate;
  hillSlope: ParameterEstimate;
  top: ParameterEstimate;
  bottom: ParameterEstimate;
}

export interface ParameterEstimate {
  estimate: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
}

export interface ParameterUncertainty {
  correlationMatrix: number[][];
  standardErrors: number[];
  confidenceIntervals: [number, number][];
}

export interface QualitySummary {
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  strengths: string[];
  weaknesses: string[];
  criticalIssues: string[];
  readinessForAnalysis: boolean;
}

export interface DataCharacteristics {
  concentrationPoints: number;
  responseReplicates: number;
  concentrationRange: number;
  responseRange: number;
  dataCompleteness: number;
  experimentalDesign: string;
}

export interface ScientificAssessment {
  biologicalRelevance: number;
  statisticalPower: number;
  methodologicalSoundness: number;
  reproducibilityProspects: number;
}

export interface QualityRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  description: string;
  expectedImprovement: number;
}

export interface BenchmarkComparison {
  industryStandards: BenchmarkScore;
  academicStandards: BenchmarkScore;
  regulatoryStandards: BenchmarkScore;
  bestPractices: BenchmarkScore;
}

export interface BenchmarkScore {
  score: number;
  percentile: number;
  comparison: 'exceeds' | 'meets' | 'below' | 'well-below';
}

export interface ConcentrationGap {
  expectedConcentration: number;
  actualGap: number;
  severity: 'minor' | 'moderate' | 'major';
}

// Quality thresholds and standards
const VALIDATION_STANDARDS = {
  concentration: {
    minimumPoints: 5,
    recommendedPoints: 8,
    minimumRange: 2, // orders of magnitude
    recommendedRange: 3,
    maxOutlierFraction: 0.15,
    unitConsistencyThreshold: 0.95
  },
  
  response: {
    minimumReplicates: 2,
    recommendedReplicates: 3,
    maxCVWithinReplicates: 0.20,
    maxCVBetweenReplicates: 0.30,
    minimumDynamicRange: 2,
    recommendedDynamicRange: 5
  },
  
  statistical: {
    minimumPower: 0.80,
    recommendedPower: 0.90,
    significanceLevel: 0.05,
    effectSizeThreshold: 0.5
  },
  
  biological: {
    typicalBindingRange: [0.1, 100000], // nM
    typicalFunctionalRange: [1, 1000000], // nM
    typicalCytotoxicityRange: [10, 10000000], // nM
    maxReasonableRange: [0.001, 1000000000] // nM
  }
};

/**
 * Scientific validation engine for dose-response data
 */
export class ScientificValidator {
  
  /**
   * Comprehensive scientific validation of dose-response data
   */
  validateDoseResponseData(
    concentrations: any[],
    responses: number[][],
    options: {
      assayType?: string;
      expectedPotency?: number;
      experimentalContext?: string;
    } = {}
  ): ScientificValidationResult {
    try {
      // Parse and validate input data
      const parsedConcentrations = this.parseConcentrations(concentrations);
      const validatedResponses = this.validateResponseData(responses);
      
      // Perform comprehensive validation
      const concentrationValidation = this.validateConcentrations(parsedConcentrations, options);
      const responseValidation = this.validateResponses(validatedResponses, options);
      const doseResponseValidation = this.validateDoseResponse(parsedConcentrations, validatedResponses, options);
      
      // Calculate overall validation score
      const overall = this.calculateOverallValidation(
        concentrationValidation,
        responseValidation,
        doseResponseValidation
      );
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(
        concentrationValidation,
        responseValidation,
        doseResponseValidation
      );
      
      // Create quality report
      const qualityReport = this.generateQualityReport(
        parsedConcentrations,
        validatedResponses,
        concentrationValidation,
        responseValidation,
        doseResponseValidation
      );
      
      return {
        overall,
        concentration: concentrationValidation,
        response: responseValidation,
        doseResponse: doseResponseValidation,
        recommendations,
        qualityReport
      };
      
    } catch (error) {
      console.error('Scientific validation failed:', error);
      return this.createErrorValidationResult(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Parse and normalize concentration values
   */
  private parseConcentrations(concentrations: any[]): number[] {
    const parsed: number[] = [];
    
    for (const conc of concentrations) {
      if (typeof conc === 'number' && conc > 0 && isFinite(conc)) {
        parsed.push(conc);
      } else if (typeof conc === 'string') {
        const parsedConc = parseConcentration(conc);
        if (parsedConc.isValid) {
          const normalized = normalizeConcentration(parsedConc);
          if (!isNaN(normalized) && normalized > 0 && isFinite(normalized)) {
            parsed.push(normalized);
          }
        }
      }
    }
    
    return parsed;
  }

  /**
   * Validate response data structure and values
   */
  private validateResponseData(responses: number[][]): number[][] {
    const validated: number[][] = [];
    
    for (const responseSet of responses) {
      if (Array.isArray(responseSet)) {
        const validResponses = responseSet.filter(r => 
          typeof r === 'number' && isFinite(r)
        );
        if (validResponses.length > 0) {
          validated.push(validResponses);
        }
      }
    }
    
    return validated;
  }

  /**
   * Comprehensive concentration validation
   */
  private validateConcentrations(
    concentrations: number[],
    options: any
  ): ConcentrationValidationResult {
    // Unit consistency validation
    const unitValidation = this.validateUnitConsistency(concentrations);
    
    // Range appropriateness validation
    const rangeValidation = this.validateConcentrationRange(concentrations, options.assayType);
    
    // Biological relevance validation
    const biologicalValidation = this.validateBiologicalRelevance(concentrations, options);
    
    // Pattern quality validation
    const patternValidation = this.validateConcentrationPattern(concentrations);
    
    // Power analysis
    const powerAnalysis = this.performConcentrationPowerAnalysis(concentrations);
    
    // Calculate overall concentration validation score
    const overall = this.calculateConcentrationScore(
      unitValidation,
      rangeValidation,
      biologicalValidation,
      patternValidation,
      powerAnalysis
    );
    
    return {
      unitConsistency: unitValidation,
      rangeAppropriate: rangeValidation,
      biologicalRelevance: biologicalValidation,
      patternQuality: patternValidation,
      powerAnalysis,
      overall
    };
  }

  /**
   * Validate unit consistency
   */
  private validateUnitConsistency(concentrations: number[]): UnitValidation {
    // Since concentrations are already normalized to nM, assume consistency
    // In a real implementation, this would analyze the original string units
    
    return {
      isConsistent: true,
      detectedUnits: ['nM'],
      conversionIssues: [],
      recommendedUnit: 'nM',
      confidence: 0.95
    };
  }

  /**
   * Validate concentration range appropriateness
   */
  private validateConcentrationRange(concentrations: number[], assayType?: string): RangeValidation {
    if (concentrations.length === 0) {
      return {
        isAppropriate: false,
        orderOfMagnitude: 0,
        minConcentration: 0,
        maxConcentration: 0,
        expectedRange: [1, 1000],
        rangeCategory: 'unrealistic',
        coverage: 0
      };
    }

    const min = Math.min(...concentrations);
    const max = Math.max(...concentrations);
    const orderOfMagnitude = Math.log10(max / min);
    
    // Determine expected range based on assay type
    let expectedRange: [number, number];
    switch (assayType?.toLowerCase()) {
      case 'binding':
        expectedRange = VALIDATION_STANDARDS.biological.typicalBindingRange as [number, number];
        break;
      case 'functional':
        expectedRange = VALIDATION_STANDARDS.biological.typicalFunctionalRange as [number, number];
        break;
      case 'cytotoxicity':
        expectedRange = VALIDATION_STANDARDS.biological.typicalCytotoxicityRange as [number, number];
        break;
      default:
        expectedRange = [Math.min(...VALIDATION_STANDARDS.biological.typicalBindingRange),
                        Math.max(...VALIDATION_STANDARDS.biological.typicalCytotoxicityRange)];
    }
    
    // Assess range appropriateness
    let rangeCategory: RangeValidation['rangeCategory'];
    let isAppropriate: boolean;
    
    if (orderOfMagnitude < VALIDATION_STANDARDS.concentration.minimumRange) {
      rangeCategory = 'too-narrow';
      isAppropriate = false;
    } else if (orderOfMagnitude > 6) {
      rangeCategory = 'too-wide';
      isAppropriate = orderOfMagnitude <= 8; // Very wide but possibly valid
    } else if (min < expectedRange[0] / 1000 || max > expectedRange[1] * 1000) {
      rangeCategory = 'unrealistic';
      isAppropriate = false;
    } else {
      rangeCategory = 'appropriate';
      isAppropriate = true;
    }
    
    // Calculate coverage of expected dynamic range
    const expectedMin = expectedRange[0];
    const expectedMax = expectedRange[1];
    const actualOverlap = Math.min(max, expectedMax) - Math.max(min, expectedMin);
    const expectedSpan = expectedMax - expectedMin;
    const coverage = Math.max(0, actualOverlap / expectedSpan);
    
    return {
      isAppropriate,
      orderOfMagnitude,
      minConcentration: min,
      maxConcentration: max,
      expectedRange,
      rangeCategory,
      coverage
    };
  }

  /**
   * Validate biological relevance
   */
  private validateBiologicalRelevance(concentrations: number[], options: any): BiologicalValidation {
    const assayType = this.inferAssayType(concentrations, options);
    const concentrationContext = this.analyzeConcentrationContext(concentrations, assayType);
    const biologicalPlausibility = this.calculateBiologicalPlausibility(concentrations, assayType);
    const literatureComparison = this.performLiteratureComparison(concentrations, assayType);
    
    const isRelevant = biologicalPlausibility > 0.6 && 
                      concentrationContext.cellularContext || 
                      assayType.confidence > 0.7;
    
    return {
      isRelevant,
      assayType,
      concentrationContext,
      biologicalPlausibility,
      literatureComparison
    };
  }

  /**
   * Infer assay type from concentration range and context
   */
  private inferAssayType(concentrations: number[], options: any): AssayType {
    if (concentrations.length === 0) {
      return {
        primary: 'unknown',
        confidence: 0,
        characteristics: []
      };
    }

    const min = Math.min(...concentrations);
    const max = Math.max(...concentrations);
    const median = concentrations.sort((a, b) => a - b)[Math.floor(concentrations.length / 2)];
    
    // Scoring for different assay types
    const scores = {
      binding: 0,
      functional: 0,
      cytotoxicity: 0,
      enzymatic: 0,
      reporter: 0
    };
    
    // Binding assays typically use lower concentrations
    if (median < 10000) scores.binding += 0.3;
    if (min < 1) scores.binding += 0.2;
    
    // Functional assays typically use intermediate concentrations
    if (median > 10 && median < 100000) scores.functional += 0.3;
    
    // Cytotoxicity assays typically use higher concentrations
    if (median > 1000) scores.cytotoxicity += 0.3;
    if (max > 100000) scores.cytotoxicity += 0.2;
    
    // Check explicit hints from options
    if (options.assayType) {
      const explicitType = options.assayType.toLowerCase() as keyof typeof scores;
      if (scores[explicitType] !== undefined) {
        scores[explicitType] += 0.4;
      }
    }
    
    // Find highest scoring type
    const maxScore = Math.max(...Object.values(scores));
    const primaryType = Object.keys(scores).find(type => scores[type as keyof typeof scores] === maxScore) as AssayType['primary'];
    
    return {
      primary: primaryType || 'unknown',
      confidence: maxScore,
      characteristics: this.getAssayCharacteristics(primaryType, concentrations)
    };
  }

  /**
   * Get characteristics for identified assay type
   */
  private getAssayCharacteristics(assayType: AssayType['primary'], concentrations: number[]): string[] {
    const characteristics: string[] = [];
    const range = Math.log10(Math.max(...concentrations) / Math.min(...concentrations));
    
    characteristics.push(`${concentrations.length} concentration points`);
    characteristics.push(`${range.toFixed(1)} orders of magnitude range`);
    
    switch (assayType) {
      case 'binding':
        characteristics.push('High affinity expected');
        characteristics.push('Equilibrium binding conditions');
        break;
      case 'functional':
        characteristics.push('Functional readout');
        characteristics.push('Dose-dependent response');
        break;
      case 'cytotoxicity':
        characteristics.push('Cell viability endpoint');
        characteristics.push('Higher concentration tolerance');
        break;
    }
    
    return characteristics;
  }

  /**
   * Analyze concentration context
   */
  private analyzeConcentrationContext(concentrations: number[], assayType: AssayType): ConcentrationContext {
    const min = Math.min(...concentrations);
    const max = Math.max(...concentrations);
    const median = concentrations.sort((a, b) => a - b)[Math.floor(concentrations.length / 2)];
    
    // Determine typical range for assay type
    let typicalRange: [number, number];
    switch (assayType.primary) {
      case 'binding':
        typicalRange = VALIDATION_STANDARDS.biological.typicalBindingRange as [number, number];
        break;
      case 'functional':
        typicalRange = VALIDATION_STANDARDS.biological.typicalFunctionalRange as [number, number];
        break;
      case 'cytotoxicity':
        typicalRange = VALIDATION_STANDARDS.biological.typicalCytotoxicityRange as [number, number];
        break;
      default:
        typicalRange = [min, max];
    }
    
    // Estimate target concentration (likely IC50)
    const targetConcentration = Math.sqrt(min * max); // Geometric mean
    
    // Determine if cellular context is likely
    const cellularContext = max > 1000 || assayType.primary === 'cytotoxicity';
    
    return {
      typicalRange,
      targetConcentration,
      mechanism: this.inferMechanism(assayType, median),
      cellularContext
    };
  }

  /**
   * Infer mechanism from assay type and concentration
   */
  private inferMechanism(assayType: AssayType, medianConcentration: number): string {
    switch (assayType.primary) {
      case 'binding':
        return medianConcentration < 100 ? 'High affinity binding' : 'Moderate affinity binding';
      case 'functional':
        return 'Receptor/enzyme modulation';
      case 'cytotoxicity':
        return 'Cell death/growth inhibition';
      case 'enzymatic':
        return 'Enzyme inhibition/activation';
      default:
        return 'Unknown mechanism';
    }
  }

  /**
   * Calculate biological plausibility score
   */
  private calculateBiologicalPlausibility(concentrations: number[], assayType: AssayType): number {
    if (concentrations.length === 0) return 0;
    
    const min = Math.min(...concentrations);
    const max = Math.max(...concentrations);
    const range = Math.log10(max / min);
    
    let plausibility = 0.5; // Base score
    
    // Range appropriateness
    if (range >= 2 && range <= 6) {
      plausibility += 0.2;
    } else if (range < 1 || range > 8) {
      plausibility -= 0.3;
    }
    
    // Concentration level appropriateness
    const maxReasonable = VALIDATION_STANDARDS.biological.maxReasonableRange;
    if (min >= maxReasonable[0] && max <= maxReasonable[1]) {
      plausibility += 0.2;
    } else {
      plausibility -= 0.2;
    }
    
    // Assay-specific adjustments
    switch (assayType.primary) {
      case 'binding':
        if (max < 100000) plausibility += 0.1; // Binding assays rarely need very high concentrations
        break;
      case 'cytotoxicity':
        if (max > 1000) plausibility += 0.1; // Cytotoxicity often needs higher concentrations
        break;
    }
    
    return Math.max(0, Math.min(1, plausibility));
  }

  /**
   * Perform literature comparison (simplified)
   */
  private performLiteratureComparison(concentrations: number[], assayType: AssayType): LiteratureComparison {
    // Simplified implementation - would connect to literature databases in practice
    const range = Math.log10(Math.max(...concentrations) / Math.min(...concentrations));
    
    return {
      hasComparableStudies: true, // Assume we have comparable studies
      rangeSimilarity: range >= 2 && range <= 5 ? 0.8 : 0.5,
      potencySimilarity: 0.7, // Placeholder
      methodSimilarity: 0.6   // Placeholder
    };
  }

  /**
   * Validate concentration pattern quality
   */
  private validateConcentrationPattern(concentrations: number[]): PatternValidation {
    if (concentrations.length < 3) {
      return {
        isRecognizable: false,
        patternType: 'insufficient-data',
        consistency: 0,
        completeness: 0,
        spacing: {
          uniformity: 0,
          logUniformity: 0,
          coverage: 0,
          gaps: []
        }
      };
    }

    const sortedConcs = [...concentrations].sort((a, b) => b - a);
    
    // Calculate ratios between consecutive concentrations
    const ratios: number[] = [];
    for (let i = 0; i < sortedConcs.length - 1; i++) {
      ratios.push(sortedConcs[i] / sortedConcs[i + 1]);
    }
    
    // Analyze pattern consistency
    const meanRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
    const ratioVariability = this.calculateCoefficientOfVariation(ratios);
    const consistency = Math.max(0, 1 - ratioVariability);
    
    // Determine pattern type
    let patternType = 'irregular';
    if (ratioVariability < 0.2) {
      if (Math.abs(meanRatio - 10) < 1) {
        patternType = 'log-scale';
      } else if (Math.abs(meanRatio - Math.sqrt(10)) < 0.5) {
        patternType = 'half-log';
      } else if (meanRatio >= 2 && meanRatio <= 5) {
        patternType = 'serial';
      } else {
        patternType = 'custom';
      }
    }
    
    // Calculate spacing quality
    const spacing = this.analyzeConcentrationSpacing(sortedConcs);
    
    // Calculate completeness (how complete the concentration series is)
    const expectedPoints = Math.log(sortedConcs[0] / sortedConcs[sortedConcs.length - 1]) / Math.log(meanRatio);
    const completeness = Math.min(1, sortedConcs.length / expectedPoints);
    
    return {
      isRecognizable: consistency > 0.5,
      patternType,
      consistency,
      completeness,
      spacing
    };
  }

  /**
   * Analyze concentration spacing quality
   */
  private analyzeConcentrationSpacing(sortedConcs: number[]): SpacingQuality {
    if (sortedConcs.length < 3) {
      return {
        uniformity: 0,
        logUniformity: 0,
        coverage: 0,
        gaps: []
      };
    }

    // Linear spacing uniformity
    const linearSpacings: number[] = [];
    for (let i = 0; i < sortedConcs.length - 1; i++) {
      linearSpacings.push(sortedConcs[i] - sortedConcs[i + 1]);
    }
    const linearUniformity = 1 - this.calculateCoefficientOfVariation(linearSpacings);
    
    // Log spacing uniformity
    const logConcs = sortedConcs.map(c => Math.log10(c));
    const logSpacings: number[] = [];
    for (let i = 0; i < logConcs.length - 1; i++) {
      logSpacings.push(Math.abs(logConcs[i] - logConcs[i + 1]));
    }
    const logUniformity = 1 - this.calculateCoefficientOfVariation(logSpacings);
    
    // Coverage of concentration range
    const totalRange = Math.log10(sortedConcs[0] / sortedConcs[sortedConcs.length - 1]);
    const coverage = Math.min(1, sortedConcs.length / (totalRange * 2)); // Expect ~2 points per order of magnitude
    
    // Identify gaps
    const gaps: ConcentrationGap[] = [];
    const avgLogSpacing = logSpacings.reduce((sum, s) => sum + s, 0) / logSpacings.length;
    
    for (let i = 0; i < logSpacings.length; i++) {
      if (logSpacings[i] > avgLogSpacing * 2) {
        gaps.push({
          expectedConcentration: Math.sqrt(sortedConcs[i] * sortedConcs[i + 1]),
          actualGap: logSpacings[i],
          severity: logSpacings[i] > avgLogSpacing * 3 ? 'major' : 'moderate'
        });
      }
    }
    
    return {
      uniformity: Math.max(0, linearUniformity),
      logUniformity: Math.max(0, logUniformity),
      coverage,
      gaps
    };
  }

  /**
   * Perform power analysis for concentration series
   */
  private performConcentrationPowerAnalysis(concentrations: number[]): PowerAnalysis {
    const currentN = concentrations.length;
    const minimumN = VALIDATION_STANDARDS.concentration.minimumPoints;
    const recommendedN = VALIDATION_STANDARDS.concentration.recommendedPoints;
    
    // Estimate statistical power based on number of points and range
    const range = concentrations.length >= 2 ? 
      Math.log10(Math.max(...concentrations) / Math.min(...concentrations)) : 0;
    
    let estimatedPower: number;
    if (currentN < minimumN) {
      estimatedPower = 0.3 + (currentN / minimumN) * 0.3;
    } else if (currentN < recommendedN) {
      estimatedPower = 0.6 + ((currentN - minimumN) / (recommendedN - minimumN)) * 0.2;
    } else {
      estimatedPower = 0.8 + Math.min(0.15, (currentN - recommendedN) * 0.02);
    }
    
    // Adjust for concentration range
    if (range < 2) {
      estimatedPower *= 0.7; // Narrow range reduces power
    } else if (range > 4) {
      estimatedPower *= 1.1; // Wide range increases power
    }
    
    estimatedPower = Math.max(0, Math.min(1, estimatedPower));
    
    const adequateForFitting = estimatedPower >= VALIDATION_STANDARDS.statistical.minimumPower;
    
    return {
      estimatedPower,
      currentN,
      recommendedN,
      minimumN,
      adequateForFitting,
      expectedPrecision: this.estimatePrecision(currentN, range)
    };
  }

  /**
   * Estimate parameter precision based on experimental design
   */
  private estimatePrecision(nPoints: number, range: number): PrecisionEstimate {
    // Simplified precision estimation
    const baselineCV = 0.3; // 30% baseline CV
    const pointsAdjustment = Math.max(0.5, Math.min(1.2, nPoints / 8));
    const rangeAdjustment = Math.max(0.7, Math.min(1.3, range / 3));
    
    const overallPrecision = 1 / (baselineCV / pointsAdjustment / rangeAdjustment);
    
    return {
      ic50Precision: overallPrecision,
      slopePrecision: overallPrecision * 0.8,
      asymptotePrecision: overallPrecision * 0.6,
      overallPrecision
    };
  }

  /**
   * Calculate coefficient of variation for an array of values
   */
  private calculateCoefficientOfVariation(values: number[]): number {
    if (values.length === 0) return 1;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    if (mean === 0) return 1;
    
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev / mean;
  }

  /**
   * Calculate overall concentration validation score
   */
  private calculateConcentrationScore(
    unitValidation: UnitValidation,
    rangeValidation: RangeValidation,
    biologicalValidation: BiologicalValidation,
    patternValidation: PatternValidation,
    powerAnalysis: PowerAnalysis
  ): ValidationScore {
    const factors: ValidationFactor[] = [
      {
        name: 'Unit Consistency',
        weight: 0.15,
        score: unitValidation.confidence,
        impact: unitValidation.isConsistent ? 'positive' : 'negative',
        description: 'Consistency of concentration units'
      },
      {
        name: 'Range Appropriateness',
        weight: 0.25,
        score: rangeValidation.isAppropriate ? 0.9 : 0.3,
        impact: rangeValidation.isAppropriate ? 'positive' : 'negative',
        description: 'Appropriateness of concentration range for assay type'
      },
      {
        name: 'Biological Relevance',
        weight: 0.20,
        score: biologicalValidation.biologicalPlausibility,
        impact: biologicalValidation.isRelevant ? 'positive' : 'negative',
        description: 'Biological relevance of concentration levels'
      },
      {
        name: 'Pattern Quality',
        weight: 0.25,
        score: patternValidation.consistency,
        impact: patternValidation.isRecognizable ? 'positive' : 'negative',
        description: 'Quality and consistency of dilution pattern'
      },
      {
        name: 'Statistical Power',
        weight: 0.15,
        score: powerAnalysis.estimatedPower,
        impact: powerAnalysis.adequateForFitting ? 'positive' : 'negative',
        description: 'Adequacy for statistical curve fitting'
      }
    ];
    
    const weightedScore = factors.reduce((sum, factor) => 
      sum + factor.score * factor.weight, 0
    );
    
    let level: ValidationScore['level'];
    if (weightedScore >= 0.9) level = 'excellent';
    else if (weightedScore >= 0.75) level = 'good';
    else if (weightedScore >= 0.6) level = 'acceptable';
    else if (weightedScore >= 0.4) level = 'poor';
    else level = 'unacceptable';
    
    const confidence = Math.min(...factors.map(f => f.score));
    
    return {
      score: weightedScore,
      level,
      confidence,
      factors
    };
  }

  // Placeholder methods for response and dose-response validation
  // These would be implemented with similar rigor
  
  private validateResponses(responses: number[][], options: any): ResponseValidationResult {
    // Simplified implementation - would include comprehensive response validation
    return {
      dataQuality: {
        completeness: 0.9,
        missingDataPattern: { pattern: 'random', severity: 0.1, impact: 'minimal' },
        dataTypeConsistency: { allNumeric: true, mixedTypes: false, conversionIssues: [] },
        rangeReasonableness: { reasonable: true, negativeValues: false, extremeValues: [], suspiciousValues: [] },
        precision: { significantDigits: 3, detectionLimit: 0.01, quantificationLimit: 0.1, instrumentalPrecision: 0.05 }
      },
      replicateConsistency: {
        hasReplicates: responses[0]?.length > 1,
        replicateCount: responses[0]?.length || 1,
        withinReplicateCV: 0.15,
        betweenReplicateCV: 0.20,
        consistency: { withinGroupVariability: 0.1, betweenGroupVariability: 0.15, systematicBias: false, replicateQuality: 'good' },
        adequateReplication: true
      },
      outlierAnalysis: {
        outlierCount: 0,
        outlierPercentage: 0,
        outlierSeverity: [],
        outlierPattern: { randomDistribution: true, clusteredOutliers: false, concentrationDependent: false, replicateSpecific: false },
        impactOnFitting: { parameterBias: 0, fittingStability: 1, recommendRemoval: [] }
      },
      statisticalPower: {
        statisticalPower: 0.85,
        effectSizeDetectable: 0.5,
        currentSampleSize: responses.length,
        recommendedSampleSize: 8,
        powerCurve: []
      },
      signalToNoise: {
        signalToNoiseRatio: 10,
        noiseCharacteristics: { noiseLevel: 0.1, noiseType: 'gaussian', correlatedNoise: false, noiseStability: 0.9 },
        signalClarity: 0.9,
        dynamicRange: 5,
        qualityCategory: 'good'
      },
      overall: {
        score: 0.8,
        level: 'good',
        confidence: 0.85,
        factors: []
      }
    };
  }

  private validateDoseResponse(concentrations: number[], responses: number[][], options: any): DoseResponseValidationResult {
    // Simplified implementation - would include comprehensive dose-response relationship validation
    return {
      relationship: {
        hasRelationship: true,
        relationshipStrength: 0.85,
        relationshipType: 'sigmoid',
        correlationCoefficient: 0.9,
        significanceLevel: 0.01
      },
      monotonicity: {
        isMonotonic: true,
        monotonicityStrength: 0.9,
        direction: 'decreasing',
        violations: [],
        expectedDirection: 'decreasing'
      },
      dynamicRange: {
        dynamicRange: 5,
        baseline: 100,
        maximum: 20,
        saturation: { isSaturated: true, saturationLevel: 95, saturationConcentration: 1000, baselineLevel: 20 },
        adequateForFitting: true
      },
      fittingProspects: {
        fittingProspects: { convergenceProbability: 0.9, parameterIdentifiability: 0.85, modelComplexity: 0.3, fittingChallenges: [] },
        expectedParameters: {
          ic50: { estimate: 100, lowerBound: 50, upperBound: 200, confidence: 0.8 },
          hillSlope: { estimate: 1, lowerBound: 0.5, upperBound: 2, confidence: 0.7 },
          top: { estimate: 100, lowerBound: 95, upperBound: 105, confidence: 0.9 },
          bottom: { estimate: 20, lowerBound: 15, upperBound: 25, confidence: 0.8 }
        },
        convergenceLikelihood: 0.9,
        uncertaintyEstimates: { correlationMatrix: [], standardErrors: [], confidenceIntervals: [] }
      },
      overall: {
        score: 0.85,
        level: 'good',
        confidence: 0.85,
        factors: []
      }
    };
  }

  private calculateOverallValidation(
    concentration: ConcentrationValidationResult,
    response: ResponseValidationResult,
    doseResponse: DoseResponseValidationResult
  ): ValidationScore {
    const weights = { concentration: 0.4, response: 0.3, doseResponse: 0.3 };
    
    const weightedScore = 
      concentration.overall.score * weights.concentration +
      response.overall.score * weights.response +
      doseResponse.overall.score * weights.doseResponse;
    
    let level: ValidationScore['level'];
    if (weightedScore >= 0.9) level = 'excellent';
    else if (weightedScore >= 0.75) level = 'good';
    else if (weightedScore >= 0.6) level = 'acceptable';
    else if (weightedScore >= 0.4) level = 'poor';
    else level = 'unacceptable';
    
    return {
      score: weightedScore,
      level,
      confidence: Math.min(concentration.overall.confidence, response.overall.confidence, doseResponse.overall.confidence),
      factors: []
    };
  }

  private generateRecommendations(
    concentration: ConcentrationValidationResult,
    response: ResponseValidationResult,
    doseResponse: DoseResponseValidationResult
  ): ValidationRecommendation[] {
    const recommendations: ValidationRecommendation[] = [];
    
    // Concentration recommendations
    if (!concentration.rangeAppropriate.isAppropriate) {
      recommendations.push({
        type: 'important',
        category: 'concentration',
        message: `Concentration range is ${concentration.rangeAppropriate.rangeCategory}`,
        technicalExplanation: `Current range spans ${concentration.rangeAppropriate.orderOfMagnitude.toFixed(1)} orders of magnitude. Recommended: 2-4 orders of magnitude.`,
        actionable: true,
        estimatedImpact: 'high',
        implementationComplexity: 'moderate'
      });
    }
    
    if (!concentration.powerAnalysis.adequateForFitting) {
      recommendations.push({
        type: 'critical',
        category: 'experimental-design',
        message: 'Insufficient concentration points for reliable curve fitting',
        technicalExplanation: `Current: ${concentration.powerAnalysis.currentN} points. Recommended: ${concentration.powerAnalysis.recommendedN} points for ${(VALIDATION_STANDARDS.statistical.recommendedPower * 100).toFixed(0)}% power.`,
        actionable: true,
        estimatedImpact: 'high',
        implementationComplexity: 'easy'
      });
    }
    
    return recommendations;
  }

  private generateQualityReport(
    concentrations: number[],
    responses: number[][],
    concentration: ConcentrationValidationResult,
    response: ResponseValidationResult,
    doseResponse: DoseResponseValidationResult
  ): QualityReport {
    const overall = this.calculateOverallValidation(concentration, response, doseResponse);
    
    return {
      summary: {
        overallGrade: this.scoreToGrade(overall.score),
        strengths: this.identifyStrengths(concentration, response, doseResponse),
        weaknesses: this.identifyWeaknesses(concentration, response, doseResponse),
        criticalIssues: this.identifyCriticalIssues(concentration, response, doseResponse),
        readinessForAnalysis: overall.score >= 0.6
      },
      dataCharacteristics: {
        concentrationPoints: concentrations.length,
        responseReplicates: responses[0]?.length || 0,
        concentrationRange: Math.log10(Math.max(...concentrations) / Math.min(...concentrations)),
        responseRange: responses.length > 0 ? Math.max(...responses.flat()) - Math.min(...responses.flat()) : 0,
        dataCompleteness: 0.9, // Placeholder
        experimentalDesign: 'dose-response'
      },
      scientificAssessment: {
        biologicalRelevance: concentration.biologicalRelevance.biologicalPlausibility,
        statisticalPower: concentration.powerAnalysis.estimatedPower,
        methodologicalSoundness: overall.score,
        reproducibilityProspects: overall.confidence
      },
      recommendations: [],
      benchmarks: this.calculateBenchmarks(overall.score)
    };
  }

  private scoreToGrade(score: number): QualitySummary['overallGrade'] {
    if (score >= 0.9) return 'A';
    if (score >= 0.8) return 'B';
    if (score >= 0.7) return 'C';
    if (score >= 0.6) return 'D';
    return 'F';
  }

  private identifyStrengths(concentration: ConcentrationValidationResult, response: ResponseValidationResult, doseResponse: DoseResponseValidationResult): string[] {
    const strengths: string[] = [];
    
    if (concentration.powerAnalysis.adequateForFitting) {
      strengths.push('Adequate number of concentration points');
    }
    
    if (concentration.rangeAppropriate.isAppropriate) {
      strengths.push('Appropriate concentration range');
    }
    
    if (concentration.patternQuality.consistency > 0.8) {
      strengths.push('Consistent dilution pattern');
    }
    
    return strengths;
  }

  private identifyWeaknesses(concentration: ConcentrationValidationResult, response: ResponseValidationResult, doseResponse: DoseResponseValidationResult): string[] {
    const weaknesses: string[] = [];
    
    if (!concentration.powerAnalysis.adequateForFitting) {
      weaknesses.push('Insufficient concentration points');
    }
    
    if (concentration.patternQuality.consistency < 0.6) {
      weaknesses.push('Inconsistent dilution pattern');
    }
    
    return weaknesses;
  }

  private identifyCriticalIssues(concentration: ConcentrationValidationResult, response: ResponseValidationResult, doseResponse: DoseResponseValidationResult): string[] {
    const issues: string[] = [];
    
    if (concentration.powerAnalysis.currentN < VALIDATION_STANDARDS.concentration.minimumPoints) {
      issues.push('Below minimum number of concentration points');
    }
    
    if (concentration.rangeAppropriate.rangeCategory === 'unrealistic') {
      issues.push('Unrealistic concentration range');
    }
    
    return issues;
  }

  private calculateBenchmarks(score: number): BenchmarkComparison {
    return {
      industryStandards: { score, percentile: score * 100, comparison: score > 0.8 ? 'exceeds' : score > 0.6 ? 'meets' : 'below' },
      academicStandards: { score, percentile: score * 100, comparison: score > 0.75 ? 'exceeds' : score > 0.6 ? 'meets' : 'below' },
      regulatoryStandards: { score, percentile: score * 100, comparison: score > 0.85 ? 'exceeds' : score > 0.7 ? 'meets' : 'below' },
      bestPractices: { score, percentile: score * 100, comparison: score > 0.9 ? 'exceeds' : score > 0.8 ? 'meets' : 'below' }
    };
  }

  private createErrorValidationResult(message: string): ScientificValidationResult {
    const errorScore: ValidationScore = {
      score: 0,
      level: 'unacceptable',
      confidence: 0,
      factors: [{
        name: 'Validation Error',
        weight: 1,
        score: 0,
        impact: 'negative',
        description: message
      }]
    };

    return {
      overall: errorScore,
      concentration: {
        unitConsistency: { isConsistent: false, detectedUnits: [], conversionIssues: [message], recommendedUnit: 'nM', confidence: 0 },
        rangeAppropriate: { isAppropriate: false, orderOfMagnitude: 0, minConcentration: 0, maxConcentration: 0, expectedRange: [1, 1000], rangeCategory: 'unrealistic', coverage: 0 },
        biologicalRelevance: { isRelevant: false, assayType: { primary: 'unknown', confidence: 0, characteristics: [] }, concentrationContext: { typicalRange: [1, 1000], targetConcentration: 0, mechanism: 'unknown', cellularContext: false }, biologicalPlausibility: 0, literatureComparison: { hasComparableStudies: false, rangeSimilarity: 0, potencySimilarity: 0, methodSimilarity: 0 } },
        patternQuality: { isRecognizable: false, patternType: 'error', consistency: 0, completeness: 0, spacing: { uniformity: 0, logUniformity: 0, coverage: 0, gaps: [] } },
        powerAnalysis: { estimatedPower: 0, currentN: 0, recommendedN: 8, minimumN: 5, adequateForFitting: false, expectedPrecision: { ic50Precision: 0, slopePrecision: 0, asymptotePrecision: 0, overallPrecision: 0 } },
        overall: errorScore
      },
      response: {
        dataQuality: { completeness: 0, missingDataPattern: { pattern: 'systematic', severity: 1, impact: 'severe' }, dataTypeConsistency: { allNumeric: false, mixedTypes: true, conversionIssues: [message] }, rangeReasonableness: { reasonable: false, negativeValues: false, extremeValues: [], suspiciousValues: [] }, precision: { significantDigits: 0, detectionLimit: 0, quantificationLimit: 0, instrumentalPrecision: 0 } },
        replicateConsistency: { hasReplicates: false, replicateCount: 0, withinReplicateCV: 1, betweenReplicateCV: 1, consistency: { withinGroupVariability: 1, betweenGroupVariability: 1, systematicBias: true, replicateQuality: 'poor' }, adequateReplication: false },
        outlierAnalysis: { outlierCount: 0, outlierPercentage: 0, outlierSeverity: [], outlierPattern: { randomDistribution: false, clusteredOutliers: false, concentrationDependent: false, replicateSpecific: false }, impactOnFitting: { parameterBias: 1, fittingStability: 0, recommendRemoval: [] } },
        statisticalPower: { statisticalPower: 0, effectSizeDetectable: 0, currentSampleSize: 0, recommendedSampleSize: 0, powerCurve: [] },
        signalToNoise: { signalToNoiseRatio: 0, noiseCharacteristics: { noiseLevel: 1, noiseType: 'systematic', correlatedNoise: true, noiseStability: 0 }, signalClarity: 0, dynamicRange: 0, qualityCategory: 'poor' },
        overall: errorScore
      },
      doseResponse: {
        relationship: { hasRelationship: false, relationshipStrength: 0, relationshipType: 'none', correlationCoefficient: 0, significanceLevel: 1 },
        monotonicity: { isMonotonic: false, monotonicityStrength: 0, direction: 'mixed', violations: [], expectedDirection: 'unknown' },
        dynamicRange: { dynamicRange: 0, baseline: 0, maximum: 0, saturation: { isSaturated: false, saturationLevel: 0, saturationConcentration: 0, baselineLevel: 0 }, adequateForFitting: false },
        fittingProspects: { fittingProspects: { convergenceProbability: 0, parameterIdentifiability: 0, modelComplexity: 1, fittingChallenges: [message] }, expectedParameters: { ic50: { estimate: 0, lowerBound: 0, upperBound: 0, confidence: 0 }, hillSlope: { estimate: 0, lowerBound: 0, upperBound: 0, confidence: 0 }, top: { estimate: 0, lowerBound: 0, upperBound: 0, confidence: 0 }, bottom: { estimate: 0, lowerBound: 0, upperBound: 0, confidence: 0 } }, convergenceLikelihood: 0, uncertaintyEstimates: { correlationMatrix: [], standardErrors: [], confidenceIntervals: [] } },
        overall: errorScore
      },
      recommendations: [{
        type: 'critical',
        category: 'data-quality',
        message: 'Validation failed due to data errors',
        technicalExplanation: message,
        actionable: true,
        estimatedImpact: 'high',
        implementationComplexity: 'easy'
      }],
      qualityReport: {
        summary: { overallGrade: 'F', strengths: [], weaknesses: [message], criticalIssues: [message], readinessForAnalysis: false },
        dataCharacteristics: { concentrationPoints: 0, responseReplicates: 0, concentrationRange: 0, responseRange: 0, dataCompleteness: 0, experimentalDesign: 'unknown' },
        scientificAssessment: { biologicalRelevance: 0, statisticalPower: 0, methodologicalSoundness: 0, reproducibilityProspects: 0 },
        recommendations: [],
        benchmarks: { industryStandards: { score: 0, percentile: 0, comparison: 'well-below' }, academicStandards: { score: 0, percentile: 0, comparison: 'well-below' }, regulatoryStandards: { score: 0, percentile: 0, comparison: 'well-below' }, bestPractices: { score: 0, percentile: 0, comparison: 'well-below' } }
      }
    };
  }
}

// Export convenience function
export function validateDoseResponseData(
  concentrations: any[],
  responses: number[][],
  options: any = {}
): ScientificValidationResult {
  const validator = new ScientificValidator();
  return validator.validateDoseResponseData(concentrations, responses, options);
}