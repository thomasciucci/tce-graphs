/**
 * Enhanced Testing Framework for Multi-Dataset and Pattern Detection
 * Tests the new dilution pattern recognition and multi-dataset capabilities
 */

import { analyzeExcelDataEnhanced } from './enhancedDetection';
import { parseExcelDataEnhanced, EnhancedParseOptions } from './enhancedParser';
import { analyzeDilutionPattern } from './dilutionPatterns';
import { scanForMultipleDatasets } from './multiDatasetDetection';

export interface EnhancedTestCase {
  id: string;
  name: string;
  description: string;
  data: any[][];
  category: 'dilution_patterns' | 'multi_dataset' | 'pattern_vs_keyword' | 'complex_scenarios';
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  expectedResult: {
    // Pattern detection expectations
    shouldDetectPattern?: boolean;
    expectedPatternType?: 'serial' | 'log_scale' | 'linear' | 'custom';
    expectedDilutionFactor?: number;
    minPatternConfidence?: number;
    
    // Multi-dataset expectations
    expectedDatasetCount?: number;
    expectedValidDatasets?: number;
    expectedLayout?: 'single' | 'vertical_stack' | 'horizontal_layout' | 'grid';
    
    // Detection method expectations
    expectedDetectionMethod?: 'pattern' | 'keyword' | 'hybrid';
    minOverallConfidence?: number;
    
    // General expectations
    shouldSucceed?: boolean;
    maxErrors?: number;
  };
}

export class EnhancedTestSuite {
  private testCases: EnhancedTestCase[] = [];

  constructor() {
    this.initializeEnhancedTests();
  }

  /**
   * Initialize all enhanced test cases
   */
  private initializeEnhancedTests(): void {
    this.addDilutionPatternTests();
    this.addMultiDatasetTests();
    this.addPatternVsKeywordTests();
    this.addComplexScenarioTests();
  }

  /**
   * Dilution pattern recognition tests
   */
  private addDilutionPatternTests(): void {
    // Test 1: Perfect 3-fold serial dilution
    this.addTestCase({
      id: 'pattern_001',
      name: 'Perfect 3x Serial Dilution',
      description: 'Clear 3-fold serial dilution pattern',
      category: 'dilution_patterns',
      difficulty: 'easy',
      data: [
        ['Concentration', 'Response A', 'Response B'],
        [243, 95.2, 93.8],
        [81, 89.1, 87.5],
        [27, 75.3, 78.2],
        [9, 45.2, 48.1],
        [3, 25.8, 28.3],
        [1, 15.2, 12.7]
      ],
      expectedResult: {
        shouldDetectPattern: true,
        expectedPatternType: 'serial',
        expectedDilutionFactor: 3,
        minPatternConfidence: 0.8,
        expectedDetectionMethod: 'pattern',
        minOverallConfidence: 0.7,
        shouldSucceed: true
      }
    });

    // Test 2: Log10 scale pattern
    this.addTestCase({
      id: 'pattern_002',
      name: 'Log10 Scale Pattern',
      description: 'Powers of 10 concentration series',
      category: 'dilution_patterns',
      difficulty: 'easy',
      data: [
        ['Dose [nM]', 'Activity'],
        [100000, 98.5],
        [10000, 92.1],
        [1000, 78.6],
        [100, 52.3],
        [10, 28.9],
        [1, 12.4],
        [0.1, 5.2]
      ],
      expectedResult: {
        shouldDetectPattern: true,
        expectedPatternType: 'log_scale',
        expectedDilutionFactor: 10,
        minPatternConfidence: 0.9,
        expectedDetectionMethod: 'pattern',
        shouldSucceed: true
      }
    });

    // Test 3: Irregular pattern with missing headers
    this.addTestCase({
      id: 'pattern_003',
      name: 'Irregular Pattern No Headers',
      description: 'Concentration pattern without clear headers',
      category: 'dilution_patterns',
      difficulty: 'hard',
      data: [
        [1000, 89.2, 91.5, 88.7],
        [316, 78.1, 81.3, 76.9],
        [100, 65.4, 68.2, 63.1],
        [31.6, 45.8, 48.9, 42.7],
        [10, 28.3, 31.1, 25.8],
        [3.16, 15.7, 18.2, 13.4]
      ],
      expectedResult: {
        shouldDetectPattern: true,
        expectedPatternType: 'custom',
        minPatternConfidence: 0.6,
        expectedDetectionMethod: 'pattern',
        shouldSucceed: true
      }
    });

    // Test 4: Mixed units requiring normalization
    this.addTestCase({
      id: 'pattern_004',
      name: 'Mixed Units Pattern',
      description: 'Serial dilution with mixed concentration units',
      category: 'dilution_patterns',
      difficulty: 'medium',
      data: [
        ['Concentration', 'Response'],
        ['1 mM', 92.5],
        ['100 μM', 85.3],
        ['10 μM', 67.8],
        ['1 μM', 45.2],
        ['100 nM', 28.9],
        ['10 nM', 15.6]
      ],
      expectedResult: {
        shouldDetectPattern: true,
        expectedPatternType: 'serial',
        expectedDilutionFactor: 10,
        minPatternConfidence: 0.7,
        expectedDetectionMethod: 'pattern',
        shouldSucceed: true
      }
    });
  }

  /**
   * Multi-dataset detection tests
   */
  private addMultiDatasetTests(): void {
    // Test 1: Two datasets vertically stacked
    this.addTestCase({
      id: 'multi_001',
      name: 'Two Vertical Datasets',
      description: 'Two datasets stacked vertically with gap',
      category: 'multi_dataset',
      difficulty: 'medium',
      data: [
        ['Experiment 1'],
        ['Conc [nM]', 'Sample A', 'Sample B'],
        [100, 85.2, 87.1],
        [10, 55.8, 58.3],
        [1, 25.7, 28.2],
        [0.1, 12.4, 15.1],
        [''],
        ['Experiment 2'],
        ['Dose [μM]', 'Compound X', 'Compound Y'],
        [10, 92.1, 89.7],
        [1, 78.5, 81.2],
        [0.1, 45.8, 48.9],
        [0.01, 22.3, 25.6]
      ],
      expectedResult: {
        expectedDatasetCount: 2,
        expectedValidDatasets: 2,
        expectedLayout: 'vertical_stack',
        shouldSucceed: true,
        expectedDetectionMethod: 'pattern'
      }
    });

    // Test 2: Three datasets in horizontal layout
    this.addTestCase({
      id: 'multi_002',
      name: 'Three Horizontal Datasets',
      description: 'Three small datasets arranged horizontally',
      category: 'multi_dataset',
      difficulty: 'hard',
      data: [
        ['Dataset A', '', '', 'Dataset B', '', '', 'Dataset C', ''],
        ['Conc', 'Resp1', 'Resp2', 'Dose', 'Act1', 'Act2', 'Conc', 'Inhib'],
        [100, 89.2, 91.1, 1000, 95.3, 93.7, 50, 87.5],
        [10, 65.8, 68.2, 100, 78.9, 81.2, 5, 62.1],
        [1, 35.7, 38.1, 10, 45.6, 48.3, 0.5, 28.9],
        [0.1, 15.2, 18.7, 1, 22.1, 25.4, 0.05, 12.3]
      ],
      expectedResult: {
        expectedDatasetCount: 3,
        expectedValidDatasets: 3,
        expectedLayout: 'horizontal_layout',
        shouldSucceed: true,
        minOverallConfidence: 0.6
      }
    });

    // Test 3: Grid layout with 4 datasets
    this.addTestCase({
      id: 'multi_003',
      name: 'Grid Layout Datasets',
      description: 'Four datasets in 2x2 grid arrangement',
      category: 'multi_dataset',
      difficulty: 'extreme',
      data: [
        ['Set A', '', '', '', 'Set B', ''],
        ['Conc', 'R1', 'R2', '', 'Dose', 'Act'],
        [100, 85, 87, '', 1000, 92],
        [10, 55, 58, '', 100, 75],
        [1, 25, 28, '', 10, 45],
        ['', '', '', '', '', ''],
        ['Set C', '', '', '', 'Set D', ''],
        ['Conc', 'I1', 'I2', '', 'Dose', 'Vit'],
        [50, 78, 81, '', 200, 89],
        [5, 45, 48, '', 20, 67],
        [0.5, 22, 25, '', 2, 35]
      ],
      expectedResult: {
        expectedDatasetCount: 4,
        expectedValidDatasets: 4,
        expectedLayout: 'grid',
        shouldSucceed: true,
        minOverallConfidence: 0.5
      }
    });
  }

  /**
   * Pattern vs keyword detection comparison tests
   */
  private addPatternVsKeywordTests(): void {
    // Test 1: Clear pattern but no concentration keywords
    this.addTestCase({
      id: 'compare_001',
      name: 'Pattern Without Keywords',
      description: 'Clear dilution pattern but headers lack concentration keywords',
      category: 'pattern_vs_keyword',
      difficulty: 'medium',
      data: [
        ['Treatment', 'Cell Viability', 'Protein Expression'],
        [1000, 92.5, 87.3],
        [100, 78.2, 71.8],
        [10, 45.7, 48.9],
        [1, 22.1, 25.6],
        [0.1, 12.8, 15.2]
      ],
      expectedResult: {
        shouldDetectPattern: true,
        expectedPatternType: 'serial',
        expectedDilutionFactor: 10,
        expectedDetectionMethod: 'pattern',
        minPatternConfidence: 0.8,
        shouldSucceed: true
      }
    });

    // Test 2: Concentration keywords but poor pattern
    this.addTestCase({
      id: 'compare_002',
      name: 'Keywords Without Pattern',
      description: 'Clear concentration keywords but irregular pattern',
      category: 'pattern_vs_keyword',
      difficulty: 'medium',
      data: [
        ['Concentration [nM]', 'Response A', 'Response B'],
        [100, 85.2, 87.1],
        [35, 55.8, 58.3],
        [12, 25.7, 28.2],
        [7, 22.4, 25.1],
        [2, 15.8, 18.3]
      ],
      expectedResult: {
        shouldDetectPattern: false,
        expectedDetectionMethod: 'keyword',
        minOverallConfidence: 0.4,
        shouldSucceed: true
      }
    });

    // Test 3: Both pattern and keywords present
    this.addTestCase({
      id: 'compare_003',
      name: 'Pattern And Keywords',
      description: 'Both clear pattern and concentration keywords',
      category: 'pattern_vs_keyword',
      difficulty: 'easy',
      data: [
        ['Concentration [μM]', 'Inhibition %', 'Cell Count'],
        [100, 95.2, 1250],
        [10, 78.5, 2890],
        [1, 45.8, 5670],
        [0.1, 22.3, 7820],
        [0.01, 8.7, 9210]
      ],
      expectedResult: {
        shouldDetectPattern: true,
        expectedPatternType: 'serial',
        expectedDilutionFactor: 10,
        expectedDetectionMethod: 'pattern',
        minPatternConfidence: 0.9,
        minOverallConfidence: 0.8,
        shouldSucceed: true
      }
    });
  }

  /**
   * Complex real-world scenario tests
   */
  private addComplexScenarioTests(): void {
    // Test 1: Multiple datasets with different pattern types
    this.addTestCase({
      id: 'complex_001',
      name: 'Mixed Pattern Types',
      description: 'Multiple datasets with different dilution patterns',
      category: 'complex_scenarios',
      difficulty: 'extreme',
      data: [
        ['Linear Dilution Series'],
        ['Conc', 'Response'],
        [50, 85.2],
        [40, 78.5],
        [30, 65.8],
        [20, 45.7],
        [10, 28.3],
        [''],
        ['Log Scale Series'],
        ['Dose [nM]', 'Activity'],
        [10000, 92.1],
        [1000, 78.6],
        [100, 52.3],
        [10, 28.9],
        [1, 12.4]
      ],
      expectedResult: {
        expectedDatasetCount: 2,
        expectedValidDatasets: 2,
        shouldSucceed: true,
        minOverallConfidence: 0.6
      }
    });

    // Test 2: Corrupted data with recovery potential
    this.addTestCase({
      id: 'complex_002',
      name: 'Corrupted Multi-Dataset',
      description: 'Multiple datasets with various data quality issues',
      category: 'complex_scenarios',
      difficulty: 'extreme',
      data: [
        ['Good Dataset'],
        ['Conc [nM]', 'Response'],
        [1000, 89.2],
        [100, 75.8],
        [10, 45.3],
        [1, 22.1],
        [''],
        ['Problematic Dataset'],
        ['Dose', 'Activity'],
        ['1000 nM', '92.5%'],
        [null, 78.2],
        ['10 nM', 'High'],
        [1, '25.8%'],
        ['0.1 nM', 12.4]
      ],
      expectedResult: {
        expectedDatasetCount: 2,
        expectedValidDatasets: 1,
        shouldSucceed: false,
        maxErrors: 3
      }
    });
  }

  /**
   * Add a test case to the suite
   */
  addTestCase(testCase: EnhancedTestCase): void {
    this.testCases.push(testCase);
  }

  /**
   * Run all enhanced tests
   */
  async runEnhancedTests(options?: EnhancedParseOptions): Promise<{
    totalTests: number;
    passedTests: number;
    results: Array<{
      testId: string;
      passed: boolean;
      actualResult: any;
      errors: string[];
      executionTime: number;
    }>;
    categoryResults: Record<string, { passed: number; total: number }>;
  }> {
    const results: Array<{
      testId: string;
      passed: boolean;
      actualResult: any;
      errors: string[];
      executionTime: number;
    }> = [];

    const categoryResults: Record<string, { passed: number; total: number }> = {
      dilution_patterns: { passed: 0, total: 0 },
      multi_dataset: { passed: 0, total: 0 },
      pattern_vs_keyword: { passed: 0, total: 0 },
      complex_scenarios: { passed: 0, total: 0 }
    };

    for (const testCase of this.testCases) {
      const result = await this.runSingleEnhancedTest(testCase, options);
      results.push(result);

      categoryResults[testCase.category].total++;
      if (result.passed) {
        categoryResults[testCase.category].passed++;
      }
    }

    const passedTests = results.filter(r => r.passed).length;

    return {
      totalTests: results.length,
      passedTests,
      results,
      categoryResults
    };
  }

  /**
   * Run a single enhanced test
   */
  async runSingleEnhancedTest(
    testCase: EnhancedTestCase,
    options?: EnhancedParseOptions
  ): Promise<{
    testId: string;
    passed: boolean;
    actualResult: any;
    errors: string[];
    executionTime: number;
  }> {
    const startTime = performance.now();
    const errors: string[] = [];
    let passed = false;

    try {
      // Run enhanced detection and parsing
      const detectionResult = analyzeExcelDataEnhanced(testCase.data);
      const parseResult = await parseExcelDataEnhanced(testCase.data, options);

      // Validate results against expectations
      passed = this.validateEnhancedResults(testCase, detectionResult, parseResult, errors);

      return {
        testId: testCase.id,
        passed,
        actualResult: { detectionResult, parseResult },
        errors,
        executionTime: performance.now() - startTime
      };

    } catch (error) {
      errors.push(`Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        testId: testCase.id,
        passed: false,
        actualResult: null,
        errors,
        executionTime: performance.now() - startTime
      };
    }
  }

  /**
   * Validate enhanced test results
   */
  private validateEnhancedResults(
    testCase: EnhancedTestCase,
    detectionResult: any,
    parseResult: any,
    errors: string[]
  ): boolean {
    const expected = testCase.expectedResult;
    let isValid = true;

    // Check pattern detection
    if (expected.shouldDetectPattern !== undefined) {
      const hasPattern = detectionResult.concentrationAnalysis?.isValid || false;
      if (hasPattern !== expected.shouldDetectPattern) {
        errors.push(`Pattern detection mismatch: expected ${expected.shouldDetectPattern}, got ${hasPattern}`);
        isValid = false;
      }
    }

    // Check pattern type
    if (expected.expectedPatternType && detectionResult.concentrationAnalysis?.bestPattern) {
      const actualType = detectionResult.concentrationAnalysis.bestPattern.type;
      if (actualType !== expected.expectedPatternType) {
        errors.push(`Pattern type mismatch: expected ${expected.expectedPatternType}, got ${actualType}`);
        isValid = false;
      }
    }

    // Check dilution factor
    if (expected.expectedDilutionFactor && detectionResult.concentrationAnalysis?.bestPattern) {
      const actualFactor = detectionResult.concentrationAnalysis.bestPattern.factor;
      const tolerance = 0.1;
      if (actualFactor && Math.abs(actualFactor - expected.expectedDilutionFactor) > tolerance) {
        errors.push(`Dilution factor mismatch: expected ${expected.expectedDilutionFactor}, got ${actualFactor}`);
        isValid = false;
      }
    }

    // Check multi-dataset results
    if (expected.expectedDatasetCount !== undefined) {
      const actualCount = detectionResult.multiDatasetResult?.totalBlocks || 1;
      if (actualCount !== expected.expectedDatasetCount) {
        errors.push(`Dataset count mismatch: expected ${expected.expectedDatasetCount}, got ${actualCount}`);
        isValid = false;
      }
    }

    // Check detection method
    if (expected.expectedDetectionMethod) {
      const actualMethod = detectionResult.detectionMethod;
      if (actualMethod !== expected.expectedDetectionMethod) {
        errors.push(`Detection method mismatch: expected ${expected.expectedDetectionMethod}, got ${actualMethod}`);
        isValid = false;
      }
    }

    // Check confidence levels
    if (expected.minPatternConfidence !== undefined) {
      const actualConfidence = detectionResult.patternBasedConfidence || 0;
      if (actualConfidence < expected.minPatternConfidence) {
        errors.push(`Pattern confidence too low: ${actualConfidence} < ${expected.minPatternConfidence}`);
        isValid = false;
      }
    }

    // Check overall success
    if (expected.shouldSucceed !== undefined) {
      if (parseResult.success !== expected.shouldSucceed) {
        errors.push(`Success mismatch: expected ${expected.shouldSucceed}, got ${parseResult.success}`);
        isValid = false;
      }
    }

    return isValid;
  }
}

/**
 * Export default enhanced test suite
 */
export const enhancedTestSuite = new EnhancedTestSuite();