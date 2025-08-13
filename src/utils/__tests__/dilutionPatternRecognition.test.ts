/**
 * Comprehensive test cases for dilution pattern recognition and multi-dataset detection
 * Tests the enhanced Excel import system for nVitro Studio
 */

import { 
  analyzeDilutionPattern, 
  detectMultipleDatasets, 
  analyzeExcelData,
  parseConcentration,
  normalizeConcentration,
  DilutionPatternInfo,
  DatasetDetection,
  DetectionResult,
  CellData
} from '../dataDetection';

describe('Dilution Pattern Recognition', () => {
  describe('analyzeDilutionPattern', () => {
    test('detects 3-fold serial dilution pattern', () => {
      const concentrations = [1000, 333.33, 111.11, 37.04, 12.35]; // 3x dilution
      const pattern = analyzeDilutionPattern(concentrations);
      
      expect(pattern.type).toBe('serial');
      expect(pattern.factor).toBeCloseTo(3, 1);
      expect(pattern.confidence).toBeGreaterThan(0.8);
      expect(pattern.patternConsistency).toBeGreaterThan(0.9);
      expect(pattern.concentrationRange.orderOfMagnitude).toBeCloseTo(1.9, 1);
    });

    test('detects 10-fold log-scale dilution pattern', () => {
      const concentrations = [10000, 1000, 100, 10, 1]; // 10x dilution
      const pattern = analyzeDilutionPattern(concentrations);
      
      expect(pattern.type).toBe('log-scale');
      expect(pattern.factor).toBe(10);
      expect(pattern.confidence).toBeGreaterThan(0.9);
      expect(pattern.patternConsistency).toBeGreaterThan(0.95);
      expect(pattern.concentrationRange.orderOfMagnitude).toBe(4);
    });

    test('detects half-log (√10) dilution pattern', () => {
      const concentrations = [100, 31.62, 10, 3.162, 1]; // √10 ≈ 3.162x dilution
      const pattern = analyzeDilutionPattern(concentrations);
      
      expect(pattern.type).toBe('half-log');
      expect(pattern.factor).toBeCloseTo(Math.sqrt(10), 1);
      expect(pattern.confidence).toBeGreaterThan(0.7);
    });

    test('detects custom dilution ratio', () => {
      const concentrations = [500, 100, 20, 4, 0.8]; // 5x dilution
      const pattern = analyzeDilutionPattern(concentrations);
      
      expect(pattern.type).toBe('custom');
      expect(pattern.factor).toBeCloseTo(5, 1);
      expect(pattern.confidence).toBeGreaterThan(0.6);
    });

    test('identifies irregular patterns', () => {
      const concentrations = [1000, 500, 300, 50, 5]; // Irregular ratios
      const pattern = analyzeDilutionPattern(concentrations);
      
      expect(pattern.type).toBe('irregular');
      expect(pattern.confidence).toBeLessThan(0.5);
      expect(pattern.irregularities.length).toBeGreaterThan(0);
    });

    test('handles insufficient data points', () => {
      const concentrations = [100, 10]; // Only 2 points
      const pattern = analyzeDilutionPattern(concentrations);
      
      expect(pattern.type).toBe('unknown');
      expect(pattern.confidence).toBe(0);
      expect(pattern.irregularities).toContain('Insufficient data points for pattern analysis');
    });

    test('detects missing concentration points in serial dilution', () => {
      const concentrations = [1000, 111.11, 12.35]; // Missing 333.33 and 37.04 from 3x series
      const pattern = analyzeDilutionPattern(concentrations);
      
      expect(pattern.missingPoints.length).toBeGreaterThan(0);
    });

    test('validates scientific appropriateness of concentration range', () => {
      // Very wide range (7 orders of magnitude)
      const wideRange = [1e9, 1e6, 1e3, 1, 1e-3];
      const widePattern = analyzeDilutionPattern(wideRange);
      expect(widePattern.concentrationRange.orderOfMagnitude).toBeGreaterThan(6);

      // Narrow range (1 order of magnitude)  
      const narrowRange = [100, 50, 25, 12.5];
      const narrowPattern = analyzeDilutionPattern(narrowRange);
      expect(narrowPattern.concentrationRange.orderOfMagnitude).toBeLessThan(1);
    });
  });

  describe('Concentration parsing and normalization', () => {
    test('parses concentrations with various units', () => {
      const testCases = [
        { input: '1 mM', expected: { value: 1, unit: 'mM', isValid: true } },
        { input: '500 nM', expected: { value: 500, unit: 'nM', isValid: true } },
        { input: '10 μM', expected: { value: 10, unit: 'μM', isValid: true } },
        { input: '1.5e-6 M', expected: { value: 1.5e-6, unit: 'M', isValid: true } },
        { input: 'invalid', expected: { isValid: false } }
      ];

      testCases.forEach(testCase => {
        const result = parseConcentration(testCase.input);
        expect(result.isValid).toBe(testCase.expected.isValid);
        if (testCase.expected.isValid) {
          expect(result.value).toBeCloseTo(testCase.expected.value, 6);
          expect(result.unit).toBe(testCase.expected.unit);
        }
      });
    });

    test('normalizes concentrations to nM', () => {
      const testCases = [
        { value: 1, unit: 'M', expected: 1e9 },
        { value: 1, unit: 'mM', expected: 1e6 },
        { value: 1, unit: 'μM', expected: 1e3 },
        { value: 1, unit: 'nM', expected: 1 },
        { value: 1, unit: 'pM', expected: 1e-3 }
      ];

      testCases.forEach(testCase => {
        const concentration = { 
          value: testCase.value, 
          unit: testCase.unit, 
          isValid: true, 
          originalText: `${testCase.value} ${testCase.unit}` 
        };
        const normalized = normalizeConcentration(concentration);
        expect(normalized).toBeCloseTo(testCase.expected, 3);
      });
    });
  });
});

describe('Multi-Dataset Detection', () => {
  function createMockCellData(data: (string | number)[][]): CellData[][] {
    return data.map((row, rowIndex) =>
      row.map((cell, colIndex) => ({
        value: cell,
        type: typeof cell === 'number' ? 'number' : (cell === '' ? 'empty' : 'string'),
        originalValue: cell,
        row: rowIndex,
        column: colIndex
      }))
    );
  }

  describe('detectMultipleDatasets', () => {
    test('detects single dataset in simple layout', () => {
      const mockData = createMockCellData([
        ['Concentration [nM]', 'Sample 1', 'Sample 2'],
        [1000, 100, 95],
        [100, 80, 85],
        [10, 60, 65],
        [1, 40, 45]
      ]);

      const datasets = detectMultipleDatasets(mockData);
      expect(datasets).toHaveLength(1);
      expect(datasets[0].confidence).toBeGreaterThan(0.5);
    });

    test('detects multiple datasets in vertical stacking', () => {
      const mockData = createMockCellData([
        // Dataset 1
        ['Concentration [nM]', 'Sample A1', 'Sample A2'],
        [1000, 100, 95],
        [100, 80, 85],
        [10, 60, 65],
        ['', '', ''], // Empty row separator
        // Dataset 2
        ['Dose [μM]', 'Sample B1', 'Sample B2'],
        [10, 90, 88],
        [1, 70, 72],
        [0.1, 50, 52]
      ]);

      const datasets = detectMultipleDatasets(mockData);
      expect(datasets.length).toBeGreaterThanOrEqual(2);
      
      datasets.forEach(dataset => {
        expect(dataset.confidence).toBeGreaterThan(0.3);
        expect(dataset.responseColumns.length).toBeGreaterThan(0);
      });
    });

    test('detects multiple datasets in horizontal arrangement', () => {
      const mockData = createMockCellData([
        ['Conc [nM]', 'S1', 'S2', '', 'Dose [μM]', 'T1', 'T2'],
        [1000, 100, 95, '', 10, 90, 88],
        [100, 80, 85, '', 1, 70, 72],
        [10, 60, 65, '', 0.1, 50, 52]
      ]);

      const datasets = detectMultipleDatasets(mockData);
      expect(datasets.length).toBeGreaterThanOrEqual(2);
    });

    test('handles complex grid patterns with multiple datasets', () => {
      const mockData = createMockCellData([
        // Row 1: Dataset 1 and 2 side by side
        ['Conc [nM]', 'A1', 'A2', '', 'Dose [μM]', 'B1', 'B2'],
        [1000, 100, 95, '', 10, 90, 88],
        [100, 80, 85, '', 1, 70, 72],
        ['', '', '', '', '', '', ''], // Empty separator
        // Row 2: Dataset 3 and 4 side by side
        ['Conc [mM]', 'C1', 'C2', '', 'Conc [pM]', 'D1', 'D2'],
        [1, 110, 105, '', 1000000, 120, 118],
        [0.1, 90, 92, '', 100000, 100, 102]
      ]);

      const datasets = detectMultipleDatasets(mockData);
      expect(datasets.length).toBeGreaterThanOrEqual(2);
      
      // Check that datasets have proper bounding boxes
      datasets.forEach(dataset => {
        expect(dataset.boundingBox.startRow).toBeGreaterThanOrEqual(0);
        expect(dataset.boundingBox.endRow).toBeGreaterThan(dataset.boundingBox.startRow);
        expect(dataset.boundingBox.startColumn).toBeGreaterThanOrEqual(0);
        expect(dataset.boundingBox.endColumn).toBeGreaterThan(dataset.boundingBox.startColumn);
      });
    });
  });

  describe('Enhanced Excel data analysis', () => {
    test('prioritizes dilution pattern over header keywords', () => {
      // Data with poor header but clear dilution pattern
      const mockData = createMockCellData([
        ['Unknown', 'Test1', 'Test2'], // No concentration keywords
        [10000, 100, 95], // Clear 10x dilution pattern
        [1000, 80, 85],
        [100, 60, 65],
        [10, 40, 45],
        [1, 20, 25]
      ]);

      const result = analyzeExcelData(mockData);
      expect(result.concentrationColumn).toBe(0);
      expect(result.patternConfidence).toBeGreaterThan(0.8);
      expect(result.dilutionPattern?.type).toBe('log-scale');
    });

    test('combines structural and pattern confidence appropriately', () => {
      // Data with good header AND good pattern
      const goodData = createMockCellData([
        ['Concentration [nM]', 'Sample 1', 'Sample 2'],
        [1000, 100, 95],
        [333, 80, 85],
        [111, 60, 65],
        [37, 40, 45]
      ]);

      const goodResult = analyzeExcelData(goodData);
      expect(goodResult.confidence).toBeGreaterThan(0.8);

      // Data with poor header but decent pattern
      const patternOnlyData = createMockCellData([
        ['Col1', 'Col2', 'Col3'],
        [1000, 100, 95],
        [333, 80, 85],
        [111, 60, 65],
        [37, 40, 45]
      ]);

      const patternResult = analyzeExcelData(patternOnlyData);
      expect(patternResult.confidence).toBeGreaterThan(0.5);
      expect(patternResult.confidence).toBeLessThan(goodResult.confidence);
    });

    test('provides comprehensive issue reporting for pattern irregularities', () => {
      const irregularData = createMockCellData([
        ['Concentration [nM]', 'Sample 1'],
        [1000, 100], // Very wide range
        [1, 80],     // but only 3 orders
        [0.001, 60], // and irregular ratios
        ['invalid', 40] // Plus invalid data
      ]);

      const result = analyzeExcelData(irregularData);
      expect(result.issues.length).toBeGreaterThan(0);
      
      const warningMessages = result.issues.map(issue => issue.message);
      expect(warningMessages.some(msg => msg.includes('pattern'))).toBeTruthy();
    });
  });
});

describe('Integration Tests', () => {
  test('end-to-end multi-dataset detection and parsing workflow', () => {
    const complexData = createMockCellData([
      // First dataset: 3-fold serial dilution
      ['Concentration [nM]', 'Drug A Rep1', 'Drug A Rep2'],
      [3000, 10, 12],
      [1000, 30, 32],
      [333, 50, 48],
      [111, 70, 72],
      [37, 85, 88],
      ['', '', ''], // Separator
      
      // Second dataset: Log-scale dilution
      ['Dose [μM]', 'Drug B Rep1', 'Drug B Rep2'],
      [100, 5, 8],
      [10, 25, 28],
      [1, 45, 42],
      [0.1, 65, 68],
      [0.01, 80, 82]
    ]);

    function createMockCellData(data: (string | number)[][]): CellData[][] {
      return data.map((row, rowIndex) =>
        row.map((cell, colIndex) => ({
          value: cell,
          type: typeof cell === 'number' ? 'number' : (cell === '' ? 'empty' : 'string'),
          originalValue: cell,
          row: rowIndex,
          column: colIndex
        }))
      );
    }

    // Test main analysis
    const result = analyzeExcelData(complexData);
    
    expect(result.detectedLayout).toBe('multi-block');
    expect(result.multipleDatasets).toBeDefined();
    expect(result.multipleDatasets!.length).toBeGreaterThanOrEqual(2);
    
    // Test first dataset
    const firstDataset = result.multipleDatasets![0];
    expect(firstDataset.dilutionPattern?.type).toBe('serial');
    expect(firstDataset.dilutionPattern?.factor).toBeCloseTo(3, 1);
    
    // Test second dataset 
    const secondDataset = result.multipleDatasets![1];
    expect(secondDataset.dilutionPattern?.type).toBe('log-scale');
    expect(secondDataset.dilutionPattern?.factor).toBe(10);
    
    // Verify no overlap in bounding boxes
    const firstBounds = firstDataset.boundingBox;
    const secondBounds = secondDataset.boundingBox;
    expect(firstBounds.endRow).toBeLessThan(secondBounds.startRow);
  });

  test('performance with large datasets', () => {
    // Generate large dataset with 1000 rows and 50 columns
    const largeData: (string | number)[][] = [];
    
    // Header row
    const header = ['Concentration [nM]'];
    for (let i = 1; i < 50; i++) {
      header.push(`Sample ${i}`);
    }
    largeData.push(header);
    
    // Data rows with 10-fold dilutions
    for (let row = 0; row < 1000; row++) {
      const dataRow: (string | number)[] = [Math.pow(10, 9 - (row % 10))]; // 10-fold dilution pattern
      for (let col = 1; col < 50; col++) {
        dataRow.push(Math.random() * 100); // Random response values
      }
      largeData.push(dataRow);
    }

    function createMockCellData(data: (string | number)[][]): CellData[][] {
      return data.map((row, rowIndex) =>
        row.map((cell, colIndex) => ({
          value: cell,
          type: typeof cell === 'number' ? 'number' : 'string',
          originalValue: cell,
          row: rowIndex,
          column: colIndex
        }))
      );
    }

    const startTime = performance.now();
    const result = analyzeExcelData(createMockCellData(largeData));
    const endTime = performance.now();
    
    // Should complete within reasonable time (< 5 seconds)
    expect(endTime - startTime).toBeLessThan(5000);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.dilutionPattern?.type).toBe('log-scale');
  });
});