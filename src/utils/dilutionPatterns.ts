/**
 * Dilution Pattern Recognition for nVitro Studio
 * Scientific analysis of concentration sequences for dose-response experiments
 */

export interface DilutionPattern {
  type: 'serial' | 'log_scale' | 'linear' | 'custom' | 'irregular';
  factor?: number; // Dilution factor (e.g., 3 for 3-fold dilutions)
  confidence: number; // 0-1 confidence score
  direction: 'ascending' | 'descending';
  range: { min: number; max: number };
  consistency: number; // How consistent the pattern is (0-1)
  gaps: number[]; // Indices where pattern breaks
  suggestions?: string[];
}

export interface ConcentrationAnalysis {
  values: number[];
  originalValues: any[];
  indices: number[];
  patterns: DilutionPattern[];
  bestPattern: DilutionPattern | null;
  overallConfidence: number;
  isValid: boolean;
  metadata: {
    estimatedUnit: string;
    logSpan: number; // Log10 range
    pointCount: number;
    hasRegularSpacing: boolean;
  };
}

/**
 * Analyzes a sequence of values to detect dilution patterns
 */
export function analyzeDilutionPattern(
  values: any[],
  indices?: number[]
): ConcentrationAnalysis {
  const result: ConcentrationAnalysis = {
    values: [],
    originalValues: values,
    indices: indices || values.map((_, i) => i),
    patterns: [],
    bestPattern: null,
    overallConfidence: 0,
    isValid: false,
    metadata: {
      estimatedUnit: 'nM',
      logSpan: 0,
      pointCount: 0,
      hasRegularSpacing: false
    }
  };

  // Step 1: Extract and clean numeric values
  const cleanedData = extractConcentrationValues(values);
  result.values = cleanedData.values;
  result.metadata.pointCount = cleanedData.values.length;

  if (cleanedData.values.length < 3) {
    result.patterns.push({
      type: 'irregular',
      confidence: 0.1,
      direction: 'ascending',
      range: { min: 0, max: 0 },
      consistency: 0,
      gaps: [],
      suggestions: ['Need at least 3 concentration points for pattern analysis']
    });
    return result;
  }

  // Step 2: Calculate metadata
  result.metadata = calculateMetadata(cleanedData.values, cleanedData.unit);

  // Step 3: Detect various pattern types
  result.patterns = [
    ...detectSerialDilutions(cleanedData.values),
    ...detectLogScalePatterns(cleanedData.values),
    ...detectLinearPatterns(cleanedData.values),
    ...detectCustomPatterns(cleanedData.values)
  ];

  // Step 4: Select best pattern
  result.bestPattern = selectBestPattern(result.patterns);
  result.overallConfidence = result.bestPattern?.confidence || 0;
  result.isValid = result.overallConfidence > 0.6;

  return result;
}

/**
 * Extracts numeric concentration values and detects units
 */
function extractConcentrationValues(values: any[]): {
  values: number[];
  unit: string;
  indices: number[];
} {
  const result = {
    values: [] as number[],
    unit: 'nM',
    indices: [] as number[]
  };

  const unitFrequency: Record<string, number> = {};

  values.forEach((value, index) => {
    if (value === null || value === undefined || value === '') return;

    let numValue: number;
    let detectedUnit = 'nM';

    if (typeof value === 'number') {
      numValue = value;
    } else if (typeof value === 'string') {
      // Extract number and unit from string
      const match = value.match(/([0-9.e\-+]+)\s*([a-zA-Z/μ]*)/i);
      if (match) {
        numValue = parseFloat(match[1]);
        detectedUnit = match[2] || 'nM';
      } else {
        // Try to parse as plain number
        numValue = parseFloat(value);
        if (isNaN(numValue)) return;
      }
    } else {
      return;
    }

    if (!isNaN(numValue) && numValue >= 0) {
      result.values.push(numValue);
      result.indices.push(index);
      unitFrequency[detectedUnit] = (unitFrequency[detectedUnit] || 0) + 1;
    }
  });

  // Determine most common unit
  const mostCommonUnit = Object.entries(unitFrequency)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 'nM';
  result.unit = mostCommonUnit;

  return result;
}

/**
 * Calculates metadata about the concentration sequence
 */
function calculateMetadata(values: number[], unit: string) {
  const sortedValues = [...values].sort((a, b) => a - b);
  const min = sortedValues[0];
  const max = sortedValues[sortedValues.length - 1];
  
  const logSpan = max > 0 && min > 0 ? Math.log10(max / min) : 0;
  
  // Check for regular spacing
  const spacings = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i] > 0 && values[i-1] > 0) {
      spacings.push(values[i] / values[i-1]);
    }
  }
  
  const avgSpacing = spacings.length > 0 ? spacings.reduce((sum, s) => sum + s, 0) / spacings.length : 0;
  const spacingVariability = spacings.length > 0 ? 
    spacings.reduce((sum, s) => sum + Math.abs(s - avgSpacing), 0) / spacings.length : 0;
  
  const hasRegularSpacing = spacingVariability / avgSpacing < 0.3;

  return {
    estimatedUnit: unit,
    logSpan,
    pointCount: values.length,
    hasRegularSpacing
  };
}

/**
 * Detects serial dilution patterns (2x, 3x, 10x, etc.)
 */
function detectSerialDilutions(values: number[]): DilutionPattern[] {
  const patterns: DilutionPattern[] = [];
  
  // Common dilution factors to test
  const commonFactors = [2, 3, 4, 5, 10, Math.sqrt(10), Math.sqrt(3)];
  
  for (const factor of commonFactors) {
    const pattern = analyzeSerialDilution(values, factor);
    if (pattern.confidence > 0.3) {
      patterns.push(pattern);
    }
  }

  // Try to detect custom factors
  const customPattern = detectCustomSerialDilution(values);
  if (customPattern.confidence > 0.3) {
    patterns.push(customPattern);
  }

  return patterns;
}

/**
 * Analyzes if values follow a specific serial dilution factor
 */
function analyzeSerialDilution(values: number[], factor: number): DilutionPattern {
  const sorted = [...values].sort((a, b) => a - b);
  const ascending = JSON.stringify(values) === JSON.stringify(sorted);
  const descending = JSON.stringify(values) === JSON.stringify([...sorted].reverse());
  
  if (!ascending && !descending) {
    return createLowConfidencePattern('serial', factor);
  }

  const direction = ascending ? 'ascending' : 'descending';
  const testValues = ascending ? values : [...values].reverse();
  
  let matches = 0;
  const gaps: number[] = [];
  
  for (let i = 1; i < testValues.length; i++) {
    const expectedRatio = factor;
    const actualRatio = testValues[i] / testValues[i-1];
    const error = Math.abs(actualRatio - expectedRatio) / expectedRatio;
    
    if (error < 0.3) { // 30% tolerance
      matches++;
    } else {
      gaps.push(i);
    }
  }

  const consistency = matches / (testValues.length - 1);
  const confidence = Math.min(consistency * 1.2, 1.0); // Boost confidence for perfect matches

  return {
    type: 'serial',
    factor,
    confidence,
    direction,
    range: { min: Math.min(...values), max: Math.max(...values) },
    consistency,
    gaps,
    suggestions: gaps.length > 0 ? 
      [`${gaps.length} irregularities in ${factor}x dilution pattern`] : 
      [`Perfect ${factor}x serial dilution detected`]
  };
}

/**
 * Detects custom serial dilution factors
 */
function detectCustomSerialDilution(values: number[]): DilutionPattern {
  if (values.length < 3) return createLowConfidencePattern('custom');

  const sorted = [...values].sort((a, b) => a - b);
  const ascending = JSON.stringify(values) === JSON.stringify(sorted);
  const descending = JSON.stringify(values) === JSON.stringify([...sorted].reverse());
  
  if (!ascending && !descending) {
    return createLowConfidencePattern('custom');
  }

  const direction = ascending ? 'ascending' : 'descending';
  const testValues = ascending ? values : [...values].reverse();
  
  // Calculate ratios between consecutive values
  const ratios: number[] = [];
  for (let i = 1; i < testValues.length; i++) {
    if (testValues[i-1] > 0) {
      ratios.push(testValues[i] / testValues[i-1]);
    }
  }

  if (ratios.length === 0) return createLowConfidencePattern('custom');

  // Find the most consistent ratio
  const avgRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
  const variance = ratios.reduce((sum, r) => sum + Math.pow(r - avgRatio, 2), 0) / ratios.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = stdDev / avgRatio;

  const consistency = Math.max(0, 1 - coefficientOfVariation);
  const confidence = consistency > 0.7 ? consistency * 0.9 : consistency * 0.6;

  const gaps = ratios.map((ratio, i) => {
    const error = Math.abs(ratio - avgRatio) / avgRatio;
    return error > 0.3 ? i + 1 : -1;
  }).filter(gap => gap !== -1);

  return {
    type: 'custom',
    factor: avgRatio,
    confidence,
    direction,
    range: { min: Math.min(...values), max: Math.max(...values) },
    consistency,
    gaps,
    suggestions: [
      `Custom ${avgRatio.toFixed(2)}x dilution pattern detected`,
      ...(gaps.length > 0 ? [`${gaps.length} irregularities found`] : [])
    ]
  };
}

/**
 * Detects log-scale patterns (powers of 10, etc.)
 */
function detectLogScalePatterns(values: number[]): DilutionPattern[] {
  const patterns: DilutionPattern[] = [];
  
  // Test for powers of 10
  const logPattern = analyzeLogScale(values, 10);
  if (logPattern.confidence > 0.3) {
    patterns.push(logPattern);
  }

  // Test for half-log scale (√10)
  const halfLogPattern = analyzeLogScale(values, Math.sqrt(10));
  if (halfLogPattern.confidence > 0.3) {
    patterns.push(halfLogPattern);
  }

  return patterns;
}

/**
 * Analyzes if values follow a log scale pattern
 */
function analyzeLogScale(values: number[], base: number): DilutionPattern {
  if (values.some(v => v <= 0)) {
    return createLowConfidencePattern('log_scale', base);
  }

  const logValues = values.map(v => Math.log(v) / Math.log(base));
  const sorted = [...logValues].sort((a, b) => a - b);
  
  // Check if log values are approximately integers or regular intervals
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    intervals.push(sorted[i] - sorted[i-1]);
  }

  const avgInterval = intervals.reduce((sum, int) => sum + int, 0) / intervals.length;
  const variance = intervals.reduce((sum, int) => sum + Math.pow(int - avgInterval, 2), 0) / intervals.length;
  const consistency = Math.max(0, 1 - Math.sqrt(variance));

  // Check if original values follow the log pattern
  const ascending = JSON.stringify(values) === JSON.stringify([...values].sort((a, b) => a - b));
  const descending = JSON.stringify(values) === JSON.stringify([...values].sort((a, b) => b - a));

  if (!ascending && !descending) {
    return createLowConfidencePattern('log_scale', base);
  }

  const confidence = consistency * (avgInterval > 0.8 && avgInterval < 1.2 ? 1.0 : 0.7);

  return {
    type: 'log_scale',
    factor: base,
    confidence,
    direction: ascending ? 'ascending' : 'descending',
    range: { min: Math.min(...values), max: Math.max(...values) },
    consistency,
    gaps: [],
    suggestions: [
      `Log${base === 10 ? '10' : base.toFixed(1)} scale pattern detected`,
      `Average interval: ${avgInterval.toFixed(2)} log units`
    ]
  };
}

/**
 * Detects linear patterns
 */
function detectLinearPatterns(values: number[]): DilutionPattern[] {
  const patterns: DilutionPattern[] = [];
  
  const sorted = [...values].sort((a, b) => a - b);
  const ascending = JSON.stringify(values) === JSON.stringify(sorted);
  const descending = JSON.stringify(values) === JSON.stringify([...sorted].reverse());
  
  if (!ascending && !descending) {
    return patterns;
  }

  const direction = ascending ? 'ascending' : 'descending';
  const testValues = ascending ? values : [...values].reverse();
  
  // Calculate differences between consecutive values
  const differences: number[] = [];
  for (let i = 1; i < testValues.length; i++) {
    differences.push(testValues[i] - testValues[i-1]);
  }

  if (differences.length === 0) return patterns;

  const avgDifference = differences.reduce((sum, d) => sum + d, 0) / differences.length;
  const variance = differences.reduce((sum, d) => sum + Math.pow(d - avgDifference, 2), 0) / differences.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = avgDifference > 0 ? stdDev / avgDifference : 1;

  const consistency = Math.max(0, 1 - coefficientOfVariation);
  const confidence = consistency > 0.8 ? consistency * 0.7 : consistency * 0.4; // Linear patterns less common in dose-response

  if (confidence > 0.3) {
    patterns.push({
      type: 'linear',
      confidence,
      direction,
      range: { min: Math.min(...values), max: Math.max(...values) },
      consistency,
      gaps: [],
      suggestions: [
        `Linear progression detected (step: ${avgDifference.toFixed(2)})`,
        'Note: Linear concentrations are uncommon in dose-response experiments'
      ]
    });
  }

  return patterns;
}

/**
 * Detects other custom patterns
 */
function detectCustomPatterns(values: number[]): DilutionPattern[] {
  // This could be expanded to detect other scientific patterns
  // For now, return empty array
  return [];
}

/**
 * Selects the best pattern from detected patterns
 */
function selectBestPattern(patterns: DilutionPattern[]): DilutionPattern | null {
  if (patterns.length === 0) return null;

  // Priority scoring: serial > log_scale > custom > linear > irregular
  const typeScores = {
    'serial': 1.0,
    'log_scale': 0.9,
    'custom': 0.8,
    'linear': 0.6,
    'irregular': 0.3
  };

  const scoredPatterns = patterns.map(pattern => ({
    pattern,
    score: pattern.confidence * typeScores[pattern.type]
  }));

  scoredPatterns.sort((a, b) => b.score - a.score);
  return scoredPatterns[0].pattern;
}

/**
 * Creates a low confidence pattern for failed detections
 */
function createLowConfidencePattern(
  type: DilutionPattern['type'], 
  factor?: number
): DilutionPattern {
  return {
    type,
    factor,
    confidence: 0.1,
    direction: 'ascending',
    range: { min: 0, max: 0 },
    consistency: 0,
    gaps: [],
    suggestions: [`No clear ${type} pattern detected`]
  };
}

/**
 * Validates if a concentration sequence is suitable for dose-response analysis
 */
export function validateConcentrationSequence(analysis: ConcentrationAnalysis): {
  isValid: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check minimum requirements
  if (analysis.values.length < 3) {
    issues.push('Need at least 3 concentration points');
    recommendations.push('Add more concentration points for reliable curve fitting');
  }

  // Check concentration range
  if (analysis.metadata.logSpan < 2) {
    issues.push('Concentration range too narrow (< 2 log units)');
    recommendations.push('Expand concentration range to at least 100-fold (2 log units)');
  }

  // Check for negative or zero values
  if (analysis.values.some(v => v <= 0)) {
    issues.push('Negative or zero concentration values detected');
    recommendations.push('Ensure all concentrations are positive values');
  }

  // Check pattern quality
  if (analysis.overallConfidence < 0.4) {
    issues.push('Poor dilution pattern consistency');
    recommendations.push('Consider using standard dilution series (3x, 10x, etc.)');
  }

  // Optimal range recommendations
  if (analysis.metadata.logSpan > 6) {
    recommendations.push('Very wide concentration range - ensure instrument sensitivity');
  }

  const isValid = issues.length === 0 && analysis.overallConfidence > 0.3;

  return { isValid, issues, recommendations };
}

/**
 * Suggests improvements for concentration sequences
 */
export function suggestConcentrationImprovements(analysis: ConcentrationAnalysis): string[] {
  const suggestions: string[] = [];

  if (!analysis.bestPattern) {
    suggestions.push('Consider using a standard dilution series (e.g., 3-fold or 10-fold)');
    return suggestions;
  }

  const pattern = analysis.bestPattern;

  switch (pattern.type) {
    case 'serial':
      if (pattern.consistency < 0.8) {
        suggestions.push(`Improve consistency of ${pattern.factor}x dilution series`);
      }
      if (pattern.gaps.length > 0) {
        suggestions.push(`Check concentrations at positions: ${pattern.gaps.join(', ')}`);
      }
      break;

    case 'log_scale':
      if (pattern.consistency < 0.8) {
        suggestions.push('Consider more regular log-scale intervals');
      }
      break;

    case 'linear':
      suggestions.push('Consider switching to log-scale dilutions for better dose-response coverage');
      break;

    case 'custom':
      if (pattern.consistency < 0.7) {
        suggestions.push('Consider standardizing dilution factor for more consistent results');
      }
      break;
  }

  return suggestions;
}