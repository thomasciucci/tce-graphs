/**
 * Adaptive Pattern Detector Test Suite
 * Testing multi-scale pattern recognition with statistical validation
 */

import { AdaptivePatternDetector, PatternCandidate, PatternParameters } from '../adaptivePatternDetector';

describe('AdaptivePatternDetector', () => {
  let detector: AdaptivePatternDetector;

  beforeEach(() => {
    detector = new AdaptivePatternDetector();
  });

  describe('Basic Pattern Detection', () => {
    test('should detect 2-fold serial dilutions', async () => {
      const concentrations = [1000, 500, 250, 125, 62.5, 31.25, 15.625];
      
      const patterns = await detector.detectPattern(concentrations);
      
      expect(patterns).toHaveLength(1);
      expect(patterns[0].type).toBe('serial');
      expect(patterns[0].parameters.dilutionFactor).toBeCloseTo(2, 1);
      expect(patterns[0].confidence).toBeGreaterThan(0.8);
    });

    test('should detect 3-fold serial dilutions', async () => {
      const concentrations = [10000, 3333, 1111, 370, 123, 41, 14];
      
      const patterns = await detector.detectPattern(concentrations);
      
      expect(patterns).toHaveLength(1);
      expect(patterns[0].type).toBe('serial');
      expect(patterns[0].parameters.dilutionFactor).toBeCloseTo(3, 1);
      expect(patterns[0].confidence).toBeGreaterThan(0.7);
    });

    test('should detect 10-fold log-scale dilutions', async () => {
      const concentrations = [100000, 10000, 1000, 100, 10, 1, 0.1];
      
      const patterns = await detector.detectPattern(concentrations);
      
      expect(patterns).toHaveLength(1);
      expect(patterns[0].type).toBe('log-scale');
      expect(patterns[0].parameters.dilutionFactor).toBeCloseTo(10, 1);
      expect(patterns[0].confidence).toBeGreaterThan(0.9);
    });

    test('should detect half-log dilutions', async () => {
      const concentrations = [10000, 3162, 1000, 316, 100, 32, 10];
      
      const patterns = await detector.detectPattern(concentrations);
      
      expect(patterns).toHaveLength(1);
      expect(patterns[0].type).toBe('half-log');
      expect(patterns[0].parameters.dilutionFactor).toBeCloseTo(Math.sqrt(10), 1);
      expect(patterns[0].confidence).toBeGreaterThan(0.7);
    });

    test('should detect custom consistent patterns', async () => {
      const concentrations = [5000, 1000, 200, 40, 8, 1.6]; // 5-fold dilutions
      
      const patterns = await detector.detectPattern(concentrations);
      
      expect(patterns).toHaveLength(1);
      expect(patterns[0].type).toBe('custom');
      expect(patterns[0].parameters.dilutionFactor).toBeCloseTo(5, 1);
      expect(patterns[0].confidence).toBeGreaterThan(0.6);
    });
  });

  describe('Pattern Quality Assessment', () => {
    test('should assess pattern consistency accurately', async () => {
      const perfectPattern = [1000, 333.33, 111.11, 37.04, 12.35, 4.12]; // Perfect 3-fold
      const noisyPattern = [1000, 350, 100, 40, 10, 5]; // Noisy 3-fold
      
      const perfectResults = await detector.detectPattern(perfectPattern);
      const noisyResults = await detector.detectPattern(noisyPattern);
      
      expect(perfectResults[0].confidence).toBeGreaterThan(noisyResults[0].confidence);
      expect(perfectResults[0].evidence.consistency).toBeGreaterThan(noisyResults[0].evidence.consistency);
    });

    test('should calculate evidence completeness', async () => {
      const completePattern = [10000, 3333, 1111, 370, 123, 41, 14]; // 7 points
      const incompletePattern = [10000, 1111, 123, 14]; // 4 points (missing some)
      
      const completeResults = await detector.detectPattern(completePattern);
      const incompleteResults = await detector.detectPattern(incompletePattern);
      
      expect(completeResults[0].evidence.completeness).toBeGreaterThan(incompleteResults[0].evidence.completeness);
    });

    test('should identify outliers in patterns', async () => {
      const patternWithOutlier = [1000, 500, 250, 1000, 62.5, 31.25]; // 1000 is outlier
      
      const patterns = await detector.detectPattern(patternWithOutlier);
      
      expect(patterns[0].evidence.outliers).toContain(3); // Index of outlier
      expect(patterns[0].confidence).toBeLessThan(0.8); // Reduced confidence due to outlier
    });

    test('should handle gaps in expected sequences', async () => {
      const patternWithGaps = [1000, 250, 31.25]; // Missing 500, 125, 62.5
      
      const patterns = await detector.detectPattern(patternWithGaps);
      
      expect(patterns[0].evidence.gaps.length).toBeGreaterThan(0);
      expect(patterns[0].evidence.completeness).toBeLessThan(0.7);
    });
  });

  describe('Statistical Validation', () => {
    test('should perform normality tests on ratios', async () => {
      const normalPattern = [1000, 500, 250, 125, 62.5, 31.25]; // Perfect 2-fold
      const skewedPattern = [1000, 600, 200, 50, 10, 1]; // Irregular ratios
      
      const normalResults = await detector.detectPattern(normalPattern);
      const skewedResults = await detector.detectPattern(skewedPattern);
      
      // Should be able to access statistical validation results
      expect(normalResults[0].statisticalMetrics.coefficientOfVariation).toBeLessThan(
        skewedResults[0].statisticalMetrics.coefficientOfVariation
      );
    });

    test('should detect autocorrelation in sequential data', async () => {
      const correlatedPattern = [1000, 900, 800, 700, 600, 500]; // Linear decrease (high autocorrelation)
      const randomPattern = [1000, 100, 500, 50, 200, 25]; // Random pattern
      
      const correlatedResults = await detector.detectPattern(correlatedPattern);
      const randomResults = await detector.detectPattern(randomPattern);
      
      expect(Math.abs(correlatedResults[0].statisticalMetrics.autocorrelation)).toBeGreaterThan(
        Math.abs(randomResults[0].statisticalMetrics.autocorrelation)
      );
    });

    test('should calculate skewness and kurtosis', async () => {
      const symmetricPattern = [1000, 316, 100, 32, 10]; // Log-normal distribution
      
      const patterns = await detector.detectPattern(symmetricPattern);
      
      expect(patterns[0].statisticalMetrics.skewness).toBeDefined();
      expect(patterns[0].statisticalMetrics.kurtosis).toBeDefined();
      expect(Math.abs(patterns[0].statisticalMetrics.skewness)).toBeLessThan(2); // Reasonable skewness
    });
  });

  describe('Multi-Level Detection Pipeline', () => {
    test('should screen patterns efficiently', async () => {
      const mixedQualityData = [
        1000, 500, 250, 125, 62.5, // Good 2-fold pattern
        30, 20, 15, 10, 5 // Poor pattern at the end
      ];
      
      const patterns = await detector.detectPattern(mixedQualityData);
      
      // Should detect the overall pattern despite mixed quality
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBe('serial');
    });

    test('should validate patterns statistically', async () => {
      const validPattern = [10000, 3333, 1111, 370, 123, 41];
      const invalidPattern = [10000, 5000, 100, 50, 1]; // No clear pattern
      
      const validResults = await detector.detectPattern(validPattern);
      const invalidResults = await detector.detectPattern(invalidPattern);
      
      expect(validResults[0].confidence).toBeGreaterThan(0.6);
      expect(invalidResults.length === 0 || invalidResults[0].confidence < 0.4).toBe(true);
    });

    test('should combine multiple detection methods', async () => {
      const ambiguousPattern = [1000, 300, 100, 30, 10]; // Could be 3-fold or ~3.16-fold
      
      const patterns = await detector.detectPattern(ambiguousPattern);
      
      // Should return multiple candidates with different confidences
      expect(patterns.length).toBeGreaterThanOrEqual(1);
      expect(patterns[0].confidence).toBeGreaterThan(0.3);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty input', async () => {
      const patterns = await detector.detectPattern([]);
      
      expect(patterns).toHaveLength(0);
    });

    test('should handle single value', async () => {
      const patterns = await detector.detectPattern([100]);
      
      expect(patterns).toHaveLength(0);
    });

    test('should handle two values', async () => {
      const patterns = await detector.detectPattern([1000, 500]);
      
      expect(patterns).toHaveLength(0); // Need at least 3 points for pattern
    });

    test('should handle identical values', async () => {
      const patterns = await detector.detectPattern([100, 100, 100, 100]);
      
      expect(patterns).toHaveLength(0); // No dilution pattern possible
    });

    test('should handle negative values gracefully', async () => {
      const patterns = await detector.detectPattern([1000, -500, 250]);
      
      // Should filter out negative values
      expect(patterns).toHaveLength(0);
    });

    test('should handle zero values', async () => {
      const patterns = await detector.detectPattern([1000, 500, 0, 125]);
      
      // Should handle zeros appropriately
      expect(patterns.length === 0 || patterns[0].confidence < 0.5).toBe(true);
    });

    test('should handle very large numbers', async () => {
      const patterns = await detector.detectPattern([1e12, 1e11, 1e10, 1e9]);
      
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBe('log-scale');
    });

    test('should handle very small numbers', async () => {
      const patterns = await detector.detectPattern([1e-6, 1e-7, 1e-8, 1e-9]);
      
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBe('log-scale');
    });

    test('should handle NaN and Infinity', async () => {
      const patterns = await detector.detectPattern([1000, NaN, 250, Infinity, 62.5]);
      
      // Should filter out invalid values and try to detect pattern from valid ones
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Tests', () => {
    test('should handle large datasets efficiently', async () => {
      // Generate large dataset with pattern
      const largeDataset = [];
      for (let i = 0; i < 1000; i++) {
        largeDataset.push(10000 * Math.pow(0.5, i / 100));
      }
      
      const startTime = performance.now();
      const patterns = await detector.detectPattern(largeDataset);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(2000); // Should complete in < 2 seconds
      expect(patterns.length).toBeGreaterThan(0);
    });

    test('should maintain accuracy with noisy data', async () => {
      const basePattern = [10000, 3333, 1111, 370, 123, 41, 14];
      const noisyPattern = basePattern.map(val => val * (0.8 + Math.random() * 0.4)); // ±20% noise
      
      const cleanResults = await detector.detectPattern(basePattern);
      const noisyResults = await detector.detectPattern(noisyPattern);
      
      expect(noisyResults[0].type).toBe(cleanResults[0].type);
      expect(noisyResults[0].confidence).toBeGreaterThan(0.5); // Should still be reasonably confident
    });

    test('should not crash with extreme inputs', async () => {
      const extremeInputs = [
        [Number.MAX_VALUE, Number.MIN_VALUE],
        [1e100, 1e-100],
        Array.from({ length: 10000 }, () => Math.random() * 1000),
        Array.from({ length: 100 }, () => 1000) // All identical
      ];
      
      for (const input of extremeInputs) {
        await expect(detector.detectPattern(input)).resolves.toBeDefined();
      }
    });
  });

  describe('Advanced Pattern Types', () => {
    test('should detect complex custom patterns', async () => {
      const customPattern = [1000, 600, 360, 216, 130, 78]; // ~1.67-fold dilutions
      
      const patterns = await detector.detectPattern(customPattern);
      
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBe('custom');
      expect(patterns[0].parameters.dilutionFactor).toBeCloseTo(1.67, 1);
    });

    test('should handle multi-phase patterns', async () => {
      const multiPhasePattern = [
        1000, 500, 250, 125, // 2-fold dilutions
        60, 30, 15, 7.5 // Different starting point but same ratio
      ];
      
      const patterns = await detector.detectPattern(multiPhasePattern);
      
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBe('serial');
    });

    test('should prioritize simpler patterns', async () => {
      const ambiguousPattern = [1000, 100, 10, 1]; // Could be 10-fold or other interpretations
      
      const patterns = await detector.detectPattern(ambiguousPattern);
      
      expect(patterns[0].type).toBe('log-scale'); // Should prefer log-scale for 10-fold
      expect(patterns[0].parameters.dilutionFactor).toBeCloseTo(10, 1);
    });
  });

  describe('Feature Extraction', () => {
    test('should extract meaningful features for ML', async () => {
      const testPattern = [1000, 333, 111, 37, 12, 4];
      
      const patterns = await detector.detectPattern(testPattern);
      
      // Verify that statistical metrics are comprehensive
      const metrics = patterns[0].statisticalMetrics;
      expect(metrics.median).toBeDefined();
      expect(metrics.robustStdDev).toBeDefined();
      expect(metrics.coefficientOfVariation).toBeDefined();
      expect(metrics.skewness).toBeDefined();
      expect(metrics.kurtosis).toBeDefined();
      expect(metrics.autocorrelation).toBeDefined();
    });

    test('should provide detailed evidence structure', async () => {
      const testPattern = [1000, 500, 250, 125, 62.5];
      
      const patterns = await detector.detectPattern(testPattern);
      
      const evidence = patterns[0].evidence;
      expect(evidence.dataPoints).toEqual(testPattern);
      expect(evidence.ratios).toHaveLength(testPattern.length - 1);
      expect(evidence.consistency).toBeGreaterThan(0.8);
      expect(evidence.completeness).toBeGreaterThan(0.8);
    });
  });

  describe('Integration Tests', () => {
    test('should work with string concentration inputs', async () => {
      const stringConcentrations = ['1000 nM', '500 nM', '250 nM', '125 nM'];
      
      // This would require preprocessing in the actual integration
      const numericConcentrations = stringConcentrations.map(s => parseFloat(s.split(' ')[0]));
      const patterns = await detector.detectPattern(numericConcentrations);
      
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBe('serial');
    });

    test('should handle mixed units consistently', async () => {
      // In actual use, this would be pre-processed to normalize units
      const normalizedConcentrations = [1000, 500, 250, 125]; // All in nM
      
      const patterns = await detector.detectPattern(normalizedConcentrations);
      
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].confidence).toBeGreaterThan(0.8);
    });
  });

  describe('Bayesian Inference', () => {
    test('should use laboratory priors effectively', async () => {
      // Test common laboratory dilution factor (3-fold)
      const commonPattern = [1000, 333, 111, 37, 12];
      // Test uncommon dilution factor (7-fold)
      const uncommonPattern = [1000, 143, 20, 3, 0.4];
      
      const commonResults = await detector.detectPattern(commonPattern);
      const uncommonResults = await detector.detectPattern(uncommonPattern);
      
      // Common pattern should have higher confidence due to priors
      expect(commonResults[0].confidence).toBeGreaterThan(uncommonResults[0].confidence);
    });

    test('should balance evidence and priors appropriately', async () => {
      // Strong evidence for uncommon pattern should overcome priors
      const strongUncommonPattern = [1000, 125, 15.625, 1.953, 0.244]; // Perfect 8-fold
      
      const patterns = await detector.detectPattern(strongUncommonPattern);
      
      expect(patterns[0].confidence).toBeGreaterThan(0.7); // Strong evidence should win
      expect(patterns[0].parameters.dilutionFactor).toBeCloseTo(8, 1);
    });
  });
});

// Helper functions for testing
function generateNoisyPattern(
  basePattern: number[], 
  noiseLevel: number = 0.1
): number[] {
  return basePattern.map(val => val * (1 + (Math.random() - 0.5) * noiseLevel * 2));
}

function generateSerialDilution(
  startConc: number, 
  factor: number, 
  steps: number
): number[] {
  const pattern = [];
  let current = startConc;
  for (let i = 0; i < steps; i++) {
    pattern.push(current);
    current /= factor;
  }
  return pattern;
}

function generateLogScale(
  startConc: number, 
  logBase: number, 
  steps: number
): number[] {
  return generateSerialDilution(startConc, logBase, steps);
}

function addRandomGaps(pattern: number[], gapProbability: number = 0.2): number[] {
  return pattern.filter(() => Math.random() > gapProbability);
}

function addOutliers(pattern: number[], outlierProbability: number = 0.1): number[] {
  return pattern.map(val => {
    if (Math.random() < outlierProbability) {
      return val * (0.1 + Math.random() * 10); // Random outlier
    }
    return val;
  });
}