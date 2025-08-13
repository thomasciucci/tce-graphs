/**
 * Scientific Validator Test Suite
 * Testing comprehensive biological and statistical validation
 */

import { ScientificValidator, ScientificValidationResult } from '../scientificValidator';

describe('ScientificValidator', () => {
  let validator: ScientificValidator;

  beforeEach(() => {
    validator = new ScientificValidator();
  });

  describe('Concentration Validation', () => {
    test('should validate appropriate concentration ranges', () => {
      const appropriateConcentrations = [100000, 10000, 1000, 100, 10, 1]; // 100 μM to 1 nM
      const responses = [[100, 98, 102], [90, 88, 92], [70, 68, 72], [40, 38, 42], [15, 13, 17], [5, 3, 7]];
      
      const result = validator.validateDoseResponseData(appropriateConcentrations, responses);
      
      expect(result.concentration.rangeAppropriate.isAppropriate).toBe(true);
      expect(result.concentration.rangeAppropriate.orderOfMagnitude).toBeGreaterThan(2);
      expect(result.concentration.rangeAppropriate.rangeCategory).toBe('appropriate');
    });

    test('should flag too narrow concentration ranges', () => {
      const narrowConcentrations = [1000, 900, 800, 700, 600]; // Less than 1 order of magnitude
      const responses = [[100], [90], [80], [70], [60]];
      
      const result = validator.validateDoseResponseData(narrowConcentrations, responses);
      
      expect(result.concentration.rangeAppropriate.isAppropriate).toBe(false);
      expect(result.concentration.rangeAppropriate.rangeCategory).toBe('too-narrow');
      expect(result.concentration.overall.level).toBe('poor');
    });

    test('should flag too wide concentration ranges', () => {
      const wideConcentrations = [1e9, 1e6, 1e3, 1, 1e-3, 1e-6, 1e-9]; // 18 orders of magnitude
      const responses = [[100], [95], [85], [70], [40], [20], [5]];
      
      const result = validator.validateDoseResponseData(wideConcentrations, responses);
      
      expect(result.concentration.rangeAppropriate.rangeCategory).toBe('too-wide');
      expect(result.concentration.overall.level).not.toBe('excellent');
    });

    test('should detect unrealistic concentration ranges', () => {
      const unrealisticConcentrations = [1e15, 1e12, 1e9, 1e6]; // Unrealistically high
      const responses = [[100], [90], [70], [40]];
      
      const result = validator.validateDoseResponseData(unrealisticConcentrations, responses);
      
      expect(result.concentration.rangeAppropriate.rangeCategory).toBe('unrealistic');
      expect(result.concentration.biologicalRelevance.isRelevant).toBe(false);
    });

    test('should validate unit consistency', () => {
      const consistentConcentrations = [1000, 100, 10, 1]; // All nM
      const responses = [[100], [80], [50], [20]];
      
      const result = validator.validateDoseResponseData(consistentConcentrations, responses);
      
      expect(result.concentration.unitConsistency.isConsistent).toBe(true);
      expect(result.concentration.unitConsistency.detectedUnits).toContain('nM');
      expect(result.concentration.unitConsistency.confidence).toBeGreaterThan(0.9);
    });

    test('should assess biological relevance by assay type', () => {
      const bindingConcentrations = [1000, 100, 10, 1, 0.1]; // Typical binding assay range
      const responses = [[100], [90], [70], [30], [10]];
      
      const result = validator.validateDoseResponseData(bindingConcentrations, responses, {
        assayType: 'binding'
      });
      
      expect(result.concentration.biologicalRelevance.isRelevant).toBe(true);
      expect(result.concentration.biologicalRelevance.assayType.primary).toBe('binding');
      expect(result.concentration.biologicalRelevance.biologicalPlausibility).toBeGreaterThan(0.7);
    });

    test('should perform statistical power analysis', () => {
      const sufficientConcentrations = [10000, 1000, 100, 10, 1, 0.1, 0.01, 0.001]; // 8 points
      const responses = [[100], [95], [85], [70], [45], [25], [10], [5]];
      
      const result = validator.validateDoseResponseData(sufficientConcentrations, responses);
      
      expect(result.concentration.powerAnalysis.currentN).toBe(8);
      expect(result.concentration.powerAnalysis.adequateForFitting).toBe(true);
      expect(result.concentration.powerAnalysis.estimatedPower).toBeGreaterThan(0.8);
    });

    test('should flag insufficient concentration points', () => {
      const insufficientConcentrations = [1000, 100, 10]; // Only 3 points
      const responses = [[100], [50], [10]];
      
      const result = validator.validateDoseResponseData(insufficientConcentrations, responses);
      
      expect(result.concentration.powerAnalysis.currentN).toBe(3);
      expect(result.concentration.powerAnalysis.adequateForFitting).toBe(false);
      expect(result.concentration.overall.level).not.toBe('excellent');
    });
  });

  describe('Response Data Validation', () => {
    test('should assess data completeness', () => {
      const concentrations = [1000, 100, 10, 1];
      const completeResponses = [[100, 98, 102], [80, 78, 82], [40, 38, 42], [10, 8, 12]];
      
      const result = validator.validateDoseResponseData(concentrations, completeResponses);
      
      expect(result.response.dataQuality.completeness).toBe(1.0);
      expect(result.response.dataQuality.dataTypeConsistency.allNumeric).toBe(true);
    });

    test('should detect missing data patterns', () => {
      const concentrations = [1000, 100, 10, 1];
      const incompleteResponses = [[100, 98], [80], [40, 38, 42], []]; // Missing data
      
      const result = validator.validateDoseResponseData(concentrations, incompleteResponses);
      
      expect(result.response.dataQuality.completeness).toBeLessThan(1.0);
      expect(result.response.dataQuality.missingDataPattern.severity).toBeGreaterThan(0.2);
    });

    test('should assess replicate consistency', () => {
      const concentrations = [1000, 100, 10, 1];
      const consistentReplicates = [[100, 101, 99], [80, 81, 79], [40, 41, 39], [10, 11, 9]];
      
      const result = validator.validateDoseResponseData(concentrations, consistentReplicates);
      
      expect(result.response.replicateConsistency.hasReplicates).toBe(true);
      expect(result.response.replicateConsistency.replicateCount).toBe(3);
      expect(result.response.replicateConsistency.withinReplicateCV).toBeLessThan(0.1);
      expect(result.response.replicateConsistency.adequateReplication).toBe(true);
    });

    test('should detect inconsistent replicates', () => {
      const concentrations = [1000, 100, 10, 1];
      const inconsistentReplicates = [[100, 80, 120], [80, 60, 100], [40, 20, 60], [10, 5, 15]]; // High variability
      
      const result = validator.validateDoseResponseData(concentrations, inconsistentReplicates);
      
      expect(result.response.replicateConsistency.withinReplicateCV).toBeGreaterThan(0.2);
      expect(result.response.replicateConsistency.adequateReplication).toBe(false);
      expect(result.response.overall.level).not.toBe('excellent');
    });

    test('should detect outliers in response data', () => {
      const concentrations = [1000, 100, 10, 1];
      const responsesWithOutliers = [[100, 98, 200], [80, 78, 82], [40, 38, 42], [10, 8, 12]]; // 200 is outlier
      
      const result = validator.validateDoseResponseData(concentrations, responsesWithOutliers);
      
      expect(result.response.outlierAnalysis.outlierCount).toBeGreaterThan(0);
      expect(result.response.outlierAnalysis.outlierPercentage).toBeGreaterThan(0);
      expect(result.response.outlierAnalysis.impactOnFitting.parameterBias).toBeGreaterThan(0);
    });

    test('should assess signal-to-noise ratio', () => {
      const concentrations = [10000, 1000, 100, 10, 1];
      const highSignalResponses = [[100, 99, 101], [80, 79, 81], [50, 49, 51], [20, 19, 21], [5, 4, 6]]; // Good S/N
      
      const result = validator.validateDoseResponseData(concentrations, highSignalResponses);
      
      expect(result.response.signalToNoise.signalToNoiseRatio).toBeGreaterThan(5);
      expect(result.response.signalToNoise.signalClarity).toBeGreaterThan(0.8);
      expect(result.response.signalToNoise.qualityCategory).toBe('excellent');
    });

    test('should calculate dynamic range', () => {
      const concentrations = [10000, 1000, 100, 10, 1];
      const wideRangeResponses = [[100], [90], [70], [30], [5]]; // Wide dynamic range
      
      const result = validator.validateDoseResponseData(concentrations, wideRangeResponses);
      
      expect(result.response.signalToNoise.dynamicRange).toBeGreaterThan(10); // 100/5 = 20
    });
  });

  describe('Dose-Response Relationship Validation', () => {
    test('should detect strong dose-response relationships', () => {
      const concentrations = [10000, 1000, 100, 10, 1];
      const sigmoidResponses = [[5], [20], [50], [80], [95]]; // Classic sigmoid
      
      const result = validator.validateDoseResponseData(concentrations, sigmoidResponses);
      
      expect(result.doseResponse.relationship.hasRelationship).toBe(true);
      expect(result.doseResponse.relationship.relationshipStrength).toBeGreaterThan(0.8);
      expect(result.doseResponse.relationship.relationshipType).toBe('sigmoid');
    });

    test('should assess monotonicity', () => {
      const concentrations = [10000, 1000, 100, 10, 1];
      const monotonicResponses = [[10], [25], [50], [75], [90]]; // Monotonic increase
      
      const result = validator.validateDoseResponseData(concentrations, monotonicResponses);
      
      expect(result.doseResponse.monotonicity.isMonotonic).toBe(true);
      expect(result.doseResponse.monotonicity.direction).toBe('increasing');
      expect(result.doseResponse.monotonicity.monotonicityStrength).toBeGreaterThan(0.8);
    });

    test('should detect non-monotonic responses', () => {
      const concentrations = [10000, 1000, 100, 10, 1];
      const nonMonotonicResponses = [[10], [50], [30], [80], [90]]; // Non-monotonic
      
      const result = validator.validateDoseResponseData(concentrations, nonMonotonicResponses);
      
      expect(result.doseResponse.monotonicity.isMonotonic).toBe(false);
      expect(result.doseResponse.monotonicity.violations.length).toBeGreaterThan(0);
    });

    test('should validate dynamic range for fitting', () => {
      const concentrations = [10000, 1000, 100, 10, 1];
      const adequateRangeResponses = [[100], [85], [60], [25], [5]]; // Good range for fitting
      
      const result = validator.validateDoseResponseData(concentrations, adequateRangeResponses);
      
      expect(result.doseResponse.dynamicRange.adequateForFitting).toBe(true);
      expect(result.doseResponse.dynamicRange.dynamicRange).toBeGreaterThan(5);
    });

    test('should assess fitting prospects', () => {
      const concentrations = [100000, 10000, 1000, 100, 10, 1, 0.1, 0.01];
      const idealResponses = [[5], [10], [25], [50], [75], [90], [95], [98]]; // Ideal sigmoid
      
      const result = validator.validateDoseResponseData(concentrations, idealResponses);
      
      expect(result.doseResponse.fittingProspects.fittingProspects.convergenceProbability).toBeGreaterThan(0.8);
      expect(result.doseResponse.fittingProspects.fittingProspects.parameterIdentifiability).toBeGreaterThan(0.8);
    });
  });

  describe('Overall Quality Assessment', () => {
    test('should assign excellent grade to high-quality data', () => {
      const excellentConcentrations = [100000, 10000, 1000, 100, 10, 1, 0.1, 0.01];
      const excellentResponses = [
        [100, 99, 101], [95, 94, 96], [85, 84, 86], [70, 69, 71],
        [45, 44, 46], [25, 24, 26], [10, 9, 11], [5, 4, 6]
      ];
      
      const result = validator.validateDoseResponseData(excellentConcentrations, excellentResponses);
      
      expect(result.overall.level).toBe('excellent');
      expect(result.overall.score).toBeGreaterThan(0.9);
      expect(result.qualityReport.summary.overallGrade).toBe('A');
      expect(result.qualityReport.summary.readinessForAnalysis).toBe(true);
    });

    test('should assign poor grade to low-quality data', () => {
      const poorConcentrations = [1000, 900]; // Too few points, narrow range
      const poorResponses = [[100], [90]]; // Insufficient data
      
      const result = validator.validateDoseResponseData(poorConcentrations, poorResponses);
      
      expect(result.overall.level).toBe('poor');
      expect(result.overall.score).toBeLessThan(0.4);
      expect(result.qualityReport.summary.overallGrade).not.toBe('A');
      expect(result.qualityReport.summary.readinessForAnalysis).toBe(false);
    });

    test('should provide balanced assessment for mixed quality', () => {
      const mixedConcentrations = [10000, 1000, 100, 10, 1]; // Good range, adequate points
      const mixedResponses = [[100, 80], [90, 70], [60, 40], [30, 10], [10, 5]]; // Some variability
      
      const result = validator.validateDoseResponseData(mixedConcentrations, mixedResponses);
      
      expect(result.overall.level).toBeOneOf(['good', 'acceptable']);
      expect(result.overall.score).toBeGreaterThan(0.5);
      expect(result.overall.score).toBeLessThan(0.9);
    });
  });

  describe('Scientific Recommendations', () => {
    test('should recommend adding concentration points for insufficient data', () => {
      const fewConcentrations = [1000, 100, 10];
      const fewResponses = [[100], [50], [10]];
      
      const result = validator.validateDoseResponseData(fewConcentrations, fewResponses);
      
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some(rec => 
        rec.message.toLowerCase().includes('concentration') && 
        rec.message.toLowerCase().includes('point')
      )).toBe(true);
    });

    test('should recommend expanding concentration range', () => {
      const narrowConcentrations = [500, 400, 300, 200, 100];
      const narrowResponses = [[100], [90], [80], [70], [60]];
      
      const result = validator.validateDoseResponseData(narrowConcentrations, narrowResponses);
      
      expect(result.recommendations.some(rec => 
        rec.message.toLowerCase().includes('range')
      )).toBe(true);
    });

    test('should recommend increasing replication', () => {
      const concentrations = [10000, 1000, 100, 10, 1];
      const singleResponses = [[100], [80], [50], [20], [5]]; // No replicates
      
      const result = validator.validateDoseResponseData(concentrations, singleResponses);
      
      expect(result.recommendations.some(rec => 
        rec.message.toLowerCase().includes('replicate')
      )).toBe(true);
    });
  });

  describe('Assay-Specific Validation', () => {
    test('should validate binding assay characteristics', () => {
      const bindingConcentrations = [1000, 316, 100, 32, 10, 3.2, 1];
      const bindingResponses = [[100], [90], [70], [45], [20], [8], [3]];
      
      const result = validator.validateDoseResponseData(bindingConcentrations, bindingResponses, {
        assayType: 'binding'
      });
      
      expect(result.concentration.biologicalRelevance.assayType.primary).toBe('binding');
      expect(result.concentration.biologicalRelevance.isRelevant).toBe(true);
    });

    test('should validate cytotoxicity assay characteristics', () => {
      const cytotoxConcentrations = [100000, 10000, 1000, 100, 10];
      const cytotoxResponses = [[5], [15], [40], [70], [95]]; // Viability
      
      const result = validator.validateDoseResponseData(cytotoxConcentrations, cytotoxResponses, {
        assayType: 'cytotoxicity'
      });
      
      expect(result.concentration.biologicalRelevance.assayType.primary).toBe('cytotoxicity');
      expect(result.concentration.biologicalRelevance.concentrationContext.cellularContext).toBe(true);
    });

    test('should validate functional assay characteristics', () => {
      const functionalConcentrations = [10000, 3162, 1000, 316, 100, 32, 10];
      const functionalResponses = [[10], [25], [45], [65], [80], [90], [95]];
      
      const result = validator.validateDoseResponseData(functionalConcentrations, functionalResponses, {
        assayType: 'functional'
      });
      
      expect(result.concentration.biologicalRelevance.assayType.primary).toBe('functional');
    });
  });

  describe('Benchmarking', () => {
    test('should compare against industry standards', () => {
      const standardConcentrations = [100000, 10000, 1000, 100, 10, 1];
      const standardResponses = [[100, 98, 102], [90, 88, 92], [70, 68, 72], [40, 38, 42], [15, 13, 17], [5, 3, 7]];
      
      const result = validator.validateDoseResponseData(standardConcentrations, standardResponses);
      
      expect(result.qualityReport.benchmarks.industryStandards.score).toBeGreaterThan(0.7);
      expect(result.qualityReport.benchmarks.industryStandards.comparison).toBeOneOf(['meets', 'exceeds']);
    });

    test('should compare against academic standards', () => {
      const academicConcentrations = [100000, 31623, 10000, 3162, 1000, 316, 100, 32, 10];
      const academicResponses = [
        [100, 99, 101], [95, 94, 96], [85, 84, 86], [70, 69, 71], [50, 49, 51],
        [30, 29, 31], [15, 14, 16], [8, 7, 9], [5, 4, 6]
      ];
      
      const result = validator.validateDoseResponseData(academicConcentrations, academicResponses);
      
      expect(result.qualityReport.benchmarks.academicStandards.comparison).toBeOneOf(['meets', 'exceeds']);
    });

    test('should compare against regulatory standards', () => {
      const regulatoryConcentrations = [1000000, 100000, 10000, 1000, 100, 10, 1, 0.1];
      const regulatoryResponses = [
        [100, 100, 100], [98, 97, 99], [90, 89, 91], [75, 74, 76],
        [50, 49, 51], [25, 24, 26], [10, 9, 11], [5, 4, 6]
      ];
      
      const result = validator.validateDoseResponseData(regulatoryConcentrations, regulatoryResponses);
      
      expect(result.qualityReport.benchmarks.regulatoryStandards.score).toBeGreaterThan(0.8);
    });
  });

  describe('Error Handling', () => {
    test('should handle empty concentration data', () => {
      const result = validator.validateDoseResponseData([], []);
      
      expect(result.overall.level).toBe('unacceptable');
      expect(result.recommendations.some(rec => rec.type === 'critical')).toBe(true);
    });

    test('should handle mismatched data lengths', () => {
      const concentrations = [1000, 100, 10];
      const responses = [[100], [50]]; // One less response
      
      const result = validator.validateDoseResponseData(concentrations, responses);
      
      expect(result.overall.level).toBe('poor');
      expect(result.recommendations.some(rec => rec.type === 'critical')).toBe(true);
    });

    test('should handle invalid concentration values', () => {
      const invalidConcentrations = [NaN, Infinity, -100, 0];
      const responses = [[100], [80], [60], [40]];
      
      const result = validator.validateDoseResponseData(invalidConcentrations, responses);
      
      expect(result.concentration.overall.level).toBe('unacceptable');
      expect(result.recommendations.some(rec => rec.message.includes('invalid'))).toBe(true);
    });

    test('should handle invalid response values', () => {
      const concentrations = [1000, 100, 10, 1];
      const invalidResponses = [[NaN], [Infinity], [-100], [null]];
      
      const result = validator.validateDoseResponseData(concentrations, invalidResponses);
      
      expect(result.response.overall.level).toBe('unacceptable');
    });
  });

  describe('Performance Tests', () => {
    test('should handle large datasets efficiently', () => {
      const largeConcentrations = Array.from({ length: 1000 }, (_, i) => 100000 / Math.pow(2, i / 100));
      const largeResponses = largeConcentrations.map(conc => [100 / (1 + Math.pow(conc / 1000, -1))]);
      
      const startTime = performance.now();
      const result = validator.validateDoseResponseData(largeConcentrations, largeResponses);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
      expect(result.overall.level).toBeDefined();
    });

    test('should maintain accuracy with noisy data', () => {
      const noisyConcentrations = [10000, 9950, 1050, 95, 12, 0.9]; // Slightly noisy
      const noisyResponses = [[102], [88], [52], [23], [8]]; // Missing one response (mismatch)
      
      const result = validator.validateDoseResponseData(noisyConcentrations, noisyResponses);
      
      expect(result.overall.score).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });
});

// Helper function to extend Jest matchers
expect.extend({
  toBeOneOf(received: any, validOptions: any[]) {
    const pass = validOptions.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${validOptions.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${validOptions.join(', ')}`,
        pass: false,
      };
    }
  },
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(validOptions: any[]): R;
    }
  }
}