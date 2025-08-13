/**
 * Scientific Detection Engine Test Suite
 * Comprehensive testing of enhanced detection algorithms with statistical validation
 */

import { ScientificDetectionEngine, ScientificDetectionResult } from '../scientificDetection';
import { AdaptivePatternDetector, PatternCandidate } from '../adaptivePatternDetector';
import { ScientificValidator } from '../scientificValidator';

describe('ScientificDetectionEngine', () => {
  let detectionEngine: ScientificDetectionEngine;

  beforeEach(() => {
    detectionEngine = new ScientificDetectionEngine();
  });

  describe('Basic Functionality', () => {
    test('should handle empty input gracefully', () => {
      const result = detectionEngine.analyzeExcelData([]);
      
      expect(result.confidence.overall).toBe(0);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('error');
      expect(result.issues[0].message).toContain('No data found');
    });

    test('should handle malformed input', () => {
      const malformedData = [
        [null, undefined, ''],
        [NaN, Infinity, -Infinity]
      ];
      
      const result = detectionEngine.analyzeExcelData(malformedData);
      
      expect(result.confidence.overall).toBeLessThan(0.3);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test('should process minimal valid data', () => {
      const minimalData = [
        ['Concentration [nM]', 'Response 1', 'Response 2'],
        [1000, 100, 95],
        [100, 80, 85],
        [10, 20, 25]
      ];
      
      const result = detectionEngine.analyzeExcelData(minimalData);
      
      expect(result.confidence.overall).toBeGreaterThan(0.5);
      expect(result.headerRow).toBe(0);
      expect(result.concentrationColumn).toBe(0);
      expect(result.responseColumns).toContain(1);
      expect(result.responseColumns).toContain(2);
    });
  });

  describe('Pattern Recognition', () => {
    test('should detect serial dilution patterns', () => {
      const serialDilutionData = [
        ['Concentration [nM]', 'Response'],
        [10000, 100],
        [3333, 95],
        [1111, 85],
        [370, 70],
        [123, 45],
        [41, 20],
        [14, 5]
      ];
      
      const result = detectionEngine.analyzeExcelData(serialDilutionData);
      
      expect(result.confidence.pattern).toBeGreaterThan(0.7);
      expect(result.patternDetection.dilutionPattern.type).toBe('serial');
      expect(result.patternDetection.dilutionPattern.parameters.dilutionFactor).toBeCloseTo(3, 1);
    });

    test('should detect log-scale dilution patterns', () => {
      const logScaleData = [
        ['Concentration [nM]', 'Response'],
        [100000, 100],
        [10000, 95],
        [1000, 85],
        [100, 65],
        [10, 35],
        [1, 10],
        [0.1, 5]
      ];
      
      const result = detectionEngine.analyzeExcelData(logScaleData);
      
      expect(result.confidence.pattern).toBeGreaterThan(0.8);
      expect(result.patternDetection.dilutionPattern.type).toBe('log-scale');
      expect(result.patternDetection.dilutionPattern.parameters.dilutionFactor).toBeCloseTo(10, 1);
    });

    test('should detect half-log dilution patterns', () => {
      const halfLogData = [
        ['Concentration [nM]', 'Response'],
        [10000, 100],
        [3162, 90],
        [1000, 80],
        [316, 65],
        [100, 45],
        [32, 25],
        [10, 10]
      ];
      
      const result = detectionEngine.analyzeExcelData(halfLogData);
      
      expect(result.confidence.pattern).toBeGreaterThan(0.7);
      expect(result.patternDetection.dilutionPattern.type).toBe('half-log');
      expect(result.patternDetection.dilutionPattern.parameters.dilutionFactor).toBeCloseTo(Math.sqrt(10), 1);
    });

    test('should handle irregular patterns gracefully', () => {
      const irregularData = [
        ['Concentration [nM]', 'Response'],
        [1000, 100],
        [847, 95],
        [234, 85],
        [67, 70],
        [23, 45],
        [8.5, 20],
        [2.1, 5]
      ];
      
      const result = detectionEngine.analyzeExcelData(irregularData);
      
      expect(result.patternDetection.dilutionPattern.type).toBe('irregular');
      expect(result.confidence.pattern).toBeLessThan(0.6);
      expect(result.issues.some(issue => issue.message.includes('irregular'))).toBe(true);
    });
  });

  describe('Statistical Validation', () => {
    test('should calculate robust statistical metrics', () => {
      const dataWithOutliers = [
        ['Concentration [nM]', 'Response'],
        [10000, 100],
        [3333, 95],
        [1111, 85],
        [370, 10000], // Outlier
        [123, 45],
        [41, 20],
        [14, 5]
      ];
      
      const result = detectionEngine.analyzeExcelData(dataWithOutliers);
      
      expect(result.patternDetection.statisticalValidation.outlierAnalysis.outlierIndices).toContain(3);
      expect(result.patternDetection.robustnessMetrics.sensitivity).toBeLessThan(0.8);
      expect(result.issues.some(issue => issue.message.includes('outlier'))).toBe(true);
    });

    test('should assess pattern consistency', () => {
      const consistentData = [
        ['Concentration [nM]', 'Response'],
        [1000, 100],
        [500, 90],
        [250, 80],
        [125, 65],
        [62.5, 45],
        [31.25, 25],
        [15.625, 10]
      ];
      
      const result = detectionEngine.analyzeExcelData(consistentData);
      
      expect(result.patternDetection.dilutionPattern.statistics.consistencyScore).toBeGreaterThan(0.9);
      expect(result.confidence.statistical).toBeGreaterThan(0.8);
    });

    test('should perform Bayesian pattern classification', () => {
      const commonPatternData = [
        ['Concentration [nM]', 'Response'],
        [10000, 100],
        [3333, 95],
        [1111, 85],
        [370, 70],
        [123, 45],
        [41, 20]
      ];
      
      const result = detectionEngine.analyzeExcelData(commonPatternData);
      
      expect(result.patternDetection.dilutionPattern.bayesianInference.posteriorProbability).toBeGreaterThan(0.5);
      expect(result.patternDetection.dilutionPattern.bayesianInference.evidenceStrength).toBeGreaterThan(0.3);
    });
  });

  describe('Multi-dimensional Confidence', () => {
    test('should calculate separate confidence dimensions', () => {
      const wellStructuredData = [
        ['Concentration [nM]', 'Sample 1', 'Sample 2', 'Sample 3'],
        [10000, 100, 98, 102],
        [1000, 90, 88, 92],
        [100, 70, 68, 72],
        [10, 30, 28, 32],
        [1, 10, 8, 12]
      ];
      
      const result = detectionEngine.analyzeExcelData(wellStructuredData);
      
      expect(result.confidence.structural).toBeGreaterThan(0.7);
      expect(result.confidence.pattern).toBeGreaterThan(0.7);
      expect(result.confidence.scientific).toBeGreaterThan(0.5);
      expect(result.confidence.statistical).toBeGreaterThan(0.5);
      expect(result.confidence.overall).toBeGreaterThan(0.6);
    });

    test('should weight confidence dimensions appropriately', () => {
      const poorStructureData = [
        [null, '', 'Data', ''],
        [1000, 100, null, ''],
        [100, 80, '', null],
        [10, 20, 15, '']
      ];
      
      const result = detectionEngine.analyzeExcelData(poorStructureData);
      
      expect(result.confidence.structural).toBeLessThan(0.5);
      expect(result.confidence.overall).toBeLessThan(result.confidence.pattern); // Pattern might be better than structure
    });
  });

  describe('Scientific Validation Integration', () => {
    test('should validate concentration ranges', () => {
      const appropriateRangeData = [
        ['Concentration [nM]', 'Response'],
        [100000, 100], // 100 μM
        [10000, 95],   // 10 μM
        [1000, 85],    // 1 μM
        [100, 65],     // 100 nM
        [10, 35],      // 10 nM
        [1, 10]        // 1 nM
      ];
      
      const result = detectionEngine.analyzeExcelData(appropriateRangeData);
      
      expect(result.scientificValidation.concentrationValidation.rangeAppropriate).toBe(true);
      expect(result.scientificValidation.concentrationValidation.orderOfMagnitude).toBeGreaterThan(2);
      expect(result.confidence.scientific).toBeGreaterThan(0.7);
    });

    test('should flag unrealistic concentration ranges', () => {
      const unrealisticRangeData = [
        ['Concentration [nM]', 'Response'],
        [1e12, 100], // Unrealistically high
        [1e11, 95],
        [1e10, 85],
        [1e9, 65],
        [1e8, 35],
        [1e7, 10]
      ];
      
      const result = detectionEngine.analyzeExcelData(unrealisticRangeData);
      
      expect(result.scientificValidation.concentrationValidation.rangeAppropriate).toBe(false);
      expect(result.issues.some(issue => issue.message.includes('unrealistic'))).toBe(true);
      expect(result.confidence.scientific).toBeLessThan(0.5);
    });

    test('should assess biological relevance', () => {
      const biologicallyRelevantData = [
        ['Concentration [nM]', 'Cell Viability %'],
        [10000, 100],
        [1000, 95],
        [100, 80],
        [10, 50],
        [1, 20],
        [0.1, 10]
      ];
      
      const result = detectionEngine.analyzeExcelData(biologicallyRelevantData);
      
      expect(result.scientificValidation.biologicalRelevance.isRelevant).toBe(true);
      expect(result.scientificValidation.biologicalRelevance.assayType.primary).not.toBe('unknown');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle single column data', () => {
      const singleColumnData = [
        ['Values'],
        [100],
        [50],
        [25]
      ];
      
      const result = detectionEngine.analyzeExcelData(singleColumnData);
      
      expect(result.responseColumns).toHaveLength(0);
      expect(result.issues.some(issue => issue.type === 'error')).toBe(true);
    });

    test('should handle mixed data types gracefully', () => {
      const mixedTypeData = [
        ['Concentration', 'Response'],
        ['1000 nM', 100],
        [100, '85%'],
        ['10 μM', 'High'],
        [1, null]
      ];
      
      const result = detectionEngine.analyzeExcelData(mixedTypeData);
      
      expect(result.issues.some(issue => issue.message.includes('type'))).toBe(true);
      expect(result.confidence.overall).toBeLessThan(0.7);
    });

    test('should handle very large datasets efficiently', () => {
      const largeDataset = [
        ['Concentration [nM]', 'Response 1', 'Response 2', 'Response 3']
      ];
      
      // Generate 1000 data rows
      for (let i = 0; i < 1000; i++) {
        const conc = 10000 * Math.pow(0.5, i / 100); // Exponential decay
        largeDataset.push([conc, Math.random() * 100, Math.random() * 100, Math.random() * 100]);
      }
      
      const startTime = performance.now();
      const result = detectionEngine.analyzeExcelData(largeDataset);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.confidence.overall).toBeGreaterThan(0);
    });

    test('should validate against infinite and NaN values', () => {
      const invalidValueData = [
        ['Concentration [nM]', 'Response'],
        [Infinity, 100],
        [1000, NaN],
        [-Infinity, 50],
        [100, Infinity],
        [10, -50]
      ];
      
      const result = detectionEngine.analyzeExcelData(invalidValueData);
      
      expect(result.issues.some(issue => issue.message.includes('invalid'))).toBe(true);
      expect(result.confidence.overall).toBeLessThan(0.5);
    });
  });

  describe('Performance and Scalability', () => {
    test('should maintain performance with complex patterns', () => {
      const complexPatternData = [
        ['Concentration [nM]', 'Response A', 'Response B', 'Response C', 'Response D']
      ];
      
      // Generate complex multi-phase dose-response
      for (let i = 0; i < 50; i++) {
        const conc = 100000 * Math.pow(0.1, i / 10);
        const responses = Array.from({ length: 4 }, () => {
          // Sigmoid response with noise
          const sigmoid = 100 / (1 + Math.pow(conc / 1000, -1));
          return sigmoid + (Math.random() - 0.5) * 10;
        });
        complexPatternData.push([conc, ...responses]);
      }
      
      const startTime = performance.now();
      const result = detectionEngine.analyzeExcelData(complexPatternData);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
      expect(result.responseColumns).toHaveLength(4);
      expect(result.confidence.pattern).toBeGreaterThan(0.5);
    });

    test('should handle memory efficiently with large datasets', () => {
      const memoryTestData = [
        ['Concentration [nM]', 'Response']
      ];
      
      // Generate 5000 data points
      for (let i = 0; i < 5000; i++) {
        memoryTestData.push([1000 / (i + 1), Math.random() * 100]);
      }
      
      const initialMemory = process.memoryUsage().heapUsed;
      const result = detectionEngine.analyzeExcelData(memoryTestData);
      const finalMemory = process.memoryUsage().heapUsed;
      
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      expect(memoryIncrease).toBeLessThan(100); // Should use less than 100MB additional memory
      expect(result.confidence.overall).toBeGreaterThan(0);
    });
  });

  describe('Quality Assessment', () => {
    test('should generate appropriate quality scores', () => {
      const highQualityData = [
        ['Concentration [nM]', 'Sample 1', 'Sample 2', 'Sample 3'],
        [10000, 100, 98, 102],
        [3333, 95, 93, 97],
        [1111, 85, 83, 87],
        [370, 70, 68, 72],
        [123, 45, 43, 47],
        [41, 20, 18, 22],
        [14, 5, 3, 7]
      ];
      
      const result = detectionEngine.analyzeExcelData(highQualityData);
      
      expect(result.quality.dataCompleteness).toBeGreaterThan(0.9);
      expect(result.quality.patternConsistency).toBeGreaterThan(0.8);
      expect(result.quality.concentrationRange.score).toBeGreaterThan(0.7);
      expect(result.quality.responseVariability.score).toBeGreaterThan(0.7);
    });

    test('should provide actionable recommendations', () => {
      const improvableData = [
        ['Conc', 'Resp'], // Poor header
        [1000, 100],
        [100, 80],     // Only 3 points - insufficient for good fitting
        [10, 20]
      ];
      
      const result = detectionEngine.analyzeExcelData(improvableData);
      
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some(rec => rec.actionable)).toBe(true);
      expect(result.recommendations.some(rec => rec.category === 'data-quality')).toBe(true);
    });
  });

  describe('Integration with Adaptive Pattern Detector', () => {
    test('should integrate seamlessly with adaptive pattern detection', async () => {
      const patternData = [
        ['Concentration [nM]', 'Response'],
        [10000, 100],
        [5000, 95],
        [2500, 85],
        [1250, 70],
        [625, 45],
        [312.5, 25],
        [156.25, 10]
      ];
      
      const detectionResult = detectionEngine.analyzeExcelData(patternData);
      
      // Test that it works with adaptive pattern detector
      const adaptiveDetector = new AdaptivePatternDetector();
      const concentrationValues = patternData.slice(1).map(row => row[0] as number);
      const adaptivePatterns = await adaptiveDetector.detectPattern(concentrationValues);
      
      expect(adaptivePatterns.length).toBeGreaterThan(0);
      expect(adaptivePatterns[0].confidence).toBeGreaterThan(0.7);
      expect(detectionResult.confidence.pattern).toBeCloseTo(adaptivePatterns[0].confidence, 1);
    });
  });

  describe('Regression Tests', () => {
    test('should maintain backward compatibility with existing detection', () => {
      const legacyFormatData = [
        ['Concentration [nM]', 'Response'],
        [1000, 100],
        [100, 50],
        [10, 10]
      ];
      
      const result = detectionEngine.analyzeExcelData(legacyFormatData);
      
      // Ensure all legacy properties are present
      expect(result).toHaveProperty('headerRow');
      expect(result).toHaveProperty('concentrationColumn');
      expect(result).toHaveProperty('responseColumns');
      expect(result).toHaveProperty('dataStartRow');
      expect(result).toHaveProperty('detectedLayout');
      expect(result).toHaveProperty('concentrationUnit');
      expect(result).toHaveProperty('issues');
      
      // Ensure legacy values are reasonable
      expect(result.headerRow).toBeGreaterThanOrEqual(0);
      expect(result.concentrationColumn).toBeGreaterThanOrEqual(0);
      expect(result.responseColumns.length).toBeGreaterThan(0);
    });

    test('should not break with previous edge cases', () => {
      const edgeCases = [
        [], // Empty array
        [[]], // Array with empty sub-array
        [[null]], // Array with null
        [['header'], [1]], // Single column
        [['', ''], ['', '']] // Empty strings
      ];
      
      edgeCases.forEach((edgeCase, index) => {
        expect(() => {
          const result = detectionEngine.analyzeExcelData(edgeCase);
          expect(result).toBeDefined();
          expect(result.confidence).toBeDefined();
          expect(result.issues).toBeDefined();
        }).not.toThrow();
      });
    });
  });
});

// Helper functions for testing
function generateSerialDilutionData(
  startConc: number, 
  dilutionFactor: number, 
  steps: number, 
  replicates: number = 1,
  noiseLevel: number = 0
): any[][] {
  const data: any[][] = [
    ['Concentration [nM]', ...Array.from({ length: replicates }, (_, i) => `Sample ${i + 1}`)]
  ];
  
  for (let i = 0; i < steps; i++) {
    const conc = startConc / Math.pow(dilutionFactor, i);
    const responses = Array.from({ length: replicates }, () => {
      // Simple sigmoid response with noise
      const response = 100 / (1 + Math.pow(conc / 1000, -1));
      return response + (Math.random() - 0.5) * noiseLevel;
    });
    data.push([conc, ...responses]);
  }
  
  return data;
}

function generateLogScaleData(
  startConc: number, 
  steps: number, 
  replicates: number = 1
): any[][] {
  return generateSerialDilutionData(startConc, 10, steps, replicates);
}

function generateHalfLogData(
  startConc: number, 
  steps: number, 
  replicates: number = 1
): any[][] {
  return generateSerialDilutionData(startConc, Math.sqrt(10), steps, replicates);
}