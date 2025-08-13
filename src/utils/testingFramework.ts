/**
 * Testing Framework for Excel Import Flexibility
 * Comprehensive testing suite for various Excel data formats
 */

import { analyzeExcelData, DetectionResult } from './dataDetection';
import { parseExcelData, ParseResult, ParseOptions } from './flexibleParser';
import { attemptDataRecovery, RecoveryOptions } from './errorRecovery';

export interface TestCase {
  id: string;
  name: string;
  description: string;
  data: any[][];
  expectedResult: ExpectedResult;
  category: TestCategory;
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
}

export interface ExpectedResult {
  shouldDetect: boolean;
  expectedHeaderRow?: number;
  expectedConcentrationColumn?: number;
  expectedResponseColumns?: number[];
  expectedDataRows?: number;
  expectedConfidence?: number;
  allowableErrors?: number;
  requiresRecovery?: boolean;
}

export type TestCategory = 
  | 'standard_format'
  | 'header_variations'
  | 'concentration_formats'
  | 'unit_variations'
  | 'missing_data'
  | 'formatting_issues'
  | 'complex_layouts'
  | 'error_recovery';

export interface TestResult {
  testId: string;
  passed: boolean;
  actualResult: ParseResult;
  detectionResult: DetectionResult;
  recoveryResult?: any;
  errors: string[];
  warnings: string[];
  executionTime: number;
}

export interface TestSuiteResult {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: TestResult[];
  categorySummary: Record<TestCategory, { passed: number; total: number }>;
  overallScore: number;
}

/**
 * Comprehensive test suite for Excel import flexibility
 */
export class ExcelImportTestSuite {
  private testCases: TestCase[] = [];

  constructor() {
    this.initializeTestCases();
  }

  /**
   * Run all test cases
   */
  async runAllTests(options?: ParseOptions): Promise<TestSuiteResult> {
    const results: TestResult[] = [];
    const categorySummary: Record<TestCategory, { passed: number; total: number }> = {
      standard_format: { passed: 0, total: 0 },
      header_variations: { passed: 0, total: 0 },
      concentration_formats: { passed: 0, total: 0 },
      unit_variations: { passed: 0, total: 0 },
      missing_data: { passed: 0, total: 0 },
      formatting_issues: { passed: 0, total: 0 },
      complex_layouts: { passed: 0, total: 0 },
      error_recovery: { passed: 0, total: 0 }
    };

    for (const testCase of this.testCases) {
      const result = await this.runSingleTest(testCase, options);
      results.push(result);
      
      categorySummary[testCase.category].total++;
      if (result.passed) {
        categorySummary[testCase.category].passed++;
      }
    }

    const passedTests = results.filter(r => r.passed).length;
    const overallScore = (passedTests / results.length) * 100;

    return {
      totalTests: results.length,
      passedTests,
      failedTests: results.length - passedTests,
      results,
      categorySummary,
      overallScore
    };
  }

  /**
   * Run tests for a specific category
   */
  async runCategoryTests(category: TestCategory, options?: ParseOptions): Promise<TestSuiteResult> {
    const categoryTests = this.testCases.filter(tc => tc.category === category);
    const tempSuite = new ExcelImportTestSuite();
    tempSuite.testCases = categoryTests;
    return tempSuite.runAllTests(options);
  }

  /**
   * Run a single test case
   */
  async runSingleTest(testCase: TestCase, options?: ParseOptions): Promise<TestResult> {
    const startTime = performance.now();
    
    const result: TestResult = {
      testId: testCase.id,
      passed: false,
      actualResult: {} as ParseResult,
      detectionResult: {} as DetectionResult,
      errors: [],
      warnings: [],
      executionTime: 0
    };

    try {
      // Step 1: Run detection
      result.detectionResult = analyzeExcelData(testCase.data);
      
      // Step 2: Run parsing
      result.actualResult = await parseExcelData(testCase.data, options);
      
      // Step 3: Run recovery if needed
      if (testCase.expectedResult.requiresRecovery && !result.actualResult.success) {
        const recoveryOptions: RecoveryOptions = {
          attemptConcentrationRepair: true,
          attemptResponseRepair: true,
          fillMissingConcentrations: true,
          interpolateResponses: true,
          removeIncompleteRows: true,
          maxErrorThreshold: 0.2
        };
        
        result.recoveryResult = await attemptDataRecovery(
          testCase.data,
          result.detectionResult,
          result.actualResult.errors,
          recoveryOptions
        );
      }
      
      // Step 4: Validate results
      result.passed = this.validateTestResult(testCase, result);
      
    } catch (error) {
      result.errors.push(`Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    result.executionTime = performance.now() - startTime;
    return result;
  }

  /**
   * Add a custom test case
   */
  addTestCase(testCase: TestCase): void {
    this.testCases.push(testCase);
  }

  /**
   * Get all test cases for a category
   */
  getTestCasesByCategory(category: TestCategory): TestCase[] {
    return this.testCases.filter(tc => tc.category === category);
  }

  /**
   * Initialize all test cases
   */
  private initializeTestCases(): void {
    this.addStandardFormatTests();
    this.addHeaderVariationTests();
    this.addConcentrationFormatTests();
    this.addUnitVariationTests();
    this.addMissingDataTests();
    this.addFormattingIssueTests();
    this.addComplexLayoutTests();
    this.addErrorRecoveryTests();
  }

  /**
   * Standard format test cases
   */
  private addStandardFormatTests(): void {
    // Test 1: Perfect standard format
    this.addTestCase({
      id: 'std_001',
      name: 'Perfect Standard Format',
      description: 'Standard dose-response format with clear headers',
      category: 'standard_format',
      difficulty: 'easy',
      data: [
        ['Concentration [nM]', 'Sample A', 'Sample B', 'Sample C'],
        [0.1, 10.2, 12.1, 9.8],
        [1.0, 25.4, 28.2, 24.9],
        [10.0, 67.3, 71.2, 69.1],
        [100.0, 89.5, 92.1, 88.7]
      ],
      expectedResult: {
        shouldDetect: true,
        expectedHeaderRow: 0,
        expectedConcentrationColumn: 0,
        expectedResponseColumns: [1, 2, 3],
        expectedDataRows: 4,
        expectedConfidence: 0.8
      }
    });

    // Test 2: Standard format with different column order
    this.addTestCase({
      id: 'std_002',
      name: 'Standard Format - Different Column Order',
      description: 'Concentration in middle column',
      category: 'standard_format',
      difficulty: 'easy',
      data: [
        ['Sample A', 'Dose [μM]', 'Sample B', 'Sample C'],
        [10.2, 0.1, 12.1, 9.8],
        [25.4, 1.0, 28.2, 24.9],
        [67.3, 10.0, 71.2, 69.1]
      ],
      expectedResult: {
        shouldDetect: true,
        expectedHeaderRow: 0,
        expectedConcentrationColumn: 1,
        expectedResponseColumns: [0, 2, 3],
        expectedDataRows: 3
      }
    });
  }

  /**
   * Header variation test cases
   */
  private addHeaderVariationTests(): void {
    // Test with header in row 2
    this.addTestCase({
      id: 'hdr_001',
      name: 'Header in Row 2',
      description: 'Header row not at the top',
      category: 'header_variations',
      difficulty: 'medium',
      data: [
        ['Dose Response Experiment'],
        ['Concentration [nM]', 'Response A', 'Response B'],
        [0.1, 15.2, 18.1],
        [1.0, 35.4, 38.2],
        [10.0, 77.3, 81.2]
      ],
      expectedResult: {
        shouldDetect: true,
        expectedHeaderRow: 1,
        expectedConcentrationColumn: 0,
        expectedResponseColumns: [1, 2],
        expectedDataRows: 3
      }
    });

    // Test with missing headers
    this.addTestCase({
      id: 'hdr_002',
      name: 'Missing Headers',
      description: 'Data starts immediately without headers',
      category: 'header_variations',
      difficulty: 'hard',
      data: [
        [0.1, 15.2, 18.1, 16.5],
        [1.0, 35.4, 38.2, 36.1],
        [10.0, 77.3, 81.2, 79.5],
        [100.0, 95.1, 97.2, 96.0]
      ],
      expectedResult: {
        shouldDetect: true,
        expectedHeaderRow: -1, // No header
        expectedConcentrationColumn: 0,
        expectedResponseColumns: [1, 2, 3],
        expectedDataRows: 4,
        expectedConfidence: 0.6
      }
    });
  }

  /**
   * Concentration format test cases
   */
  private addConcentrationFormatTests(): void {
    // Test with scientific notation
    this.addTestCase({
      id: 'conc_001',
      name: 'Scientific Notation Concentrations',
      description: 'Concentrations in scientific notation',
      category: 'concentration_formats',
      difficulty: 'medium',
      data: [
        ['Concentration', 'Response'],
        ['1e-7', 10.5],
        ['1e-6', 25.2],
        ['1e-5', 67.8],
        ['1e-4', 89.1]
      ],
      expectedResult: {
        shouldDetect: true,
        expectedHeaderRow: 0,
        expectedConcentrationColumn: 0,
        expectedResponseColumns: [1],
        expectedDataRows: 4
      }
    });

    // Test with mixed formats
    this.addTestCase({
      id: 'conc_002',
      name: 'Mixed Concentration Formats',
      description: 'Mix of numbers and strings with units',
      category: 'concentration_formats',
      difficulty: 'hard',
      data: [
        ['Dose', 'Activity'],
        [0.1, 12.3],
        ['1 nM', 28.5],
        ['10 nM', 65.2],
        ['0.1 μM', 87.9]
      ],
      expectedResult: {
        shouldDetect: true,
        expectedHeaderRow: 0,
        expectedConcentrationColumn: 0,
        expectedResponseColumns: [1],
        requiresRecovery: true
      }
    });
  }

  /**
   * Unit variation test cases
   */
  private addUnitVariationTests(): void {
    // Test with different units
    this.addTestCase({
      id: 'unit_001',
      name: 'Multiple Concentration Units',
      description: 'Different units requiring conversion',
      category: 'unit_variations',
      difficulty: 'medium',
      data: [
        ['Concentration', 'Response'],
        ['100 pM', 5.2],
        ['1 nM', 15.8],
        ['0.01 μM', 28.5],
        ['0.1 μM', 65.2],
        ['1 μM', 87.9]
      ],
      expectedResult: {
        shouldDetect: true,
        expectedHeaderRow: 0,
        expectedConcentrationColumn: 0,
        expectedResponseColumns: [1],
        requiresRecovery: true
      }
    });
  }

  /**
   * Missing data test cases
   */
  private addMissingDataTests(): void {
    // Test with missing concentration values
    this.addTestCase({
      id: 'miss_001',
      name: 'Missing Concentration Values',
      description: 'Some concentration values are missing',
      category: 'missing_data',
      difficulty: 'hard',
      data: [
        ['Concentration [nM]', 'Sample A', 'Sample B'],
        [0.1, 10.2, 12.1],
        [null, 25.4, 28.2], // Missing concentration
        [10.0, 67.3, 71.2],
        ['', 89.5, 92.1] // Empty concentration
      ],
      expectedResult: {
        shouldDetect: true,
        expectedHeaderRow: 0,
        expectedConcentrationColumn: 0,
        expectedResponseColumns: [1, 2],
        requiresRecovery: true,
        allowableErrors: 2
      }
    });

    // Test with missing response values
    this.addTestCase({
      id: 'miss_002',
      name: 'Missing Response Values',
      description: 'Some response values are missing',
      category: 'missing_data',
      difficulty: 'medium',
      data: [
        ['Concentration [nM]', 'Sample A', 'Sample B', 'Sample C'],
        [0.1, 10.2, null, 9.8],
        [1.0, 25.4, 28.2, ''],
        [10.0, '', 71.2, 69.1],
        [100.0, 89.5, 92.1, 88.7]
      ],
      expectedResult: {
        shouldDetect: true,
        expectedHeaderRow: 0,
        expectedConcentrationColumn: 0,
        expectedResponseColumns: [1, 2, 3],
        requiresRecovery: true
      }
    });
  }

  /**
   * Formatting issue test cases
   */
  private addFormattingIssueTests(): void {
    // Test with percentage values
    this.addTestCase({
      id: 'fmt_001',
      name: 'Percentage Response Values',
      description: 'Response values formatted as percentages',
      category: 'formatting_issues',
      difficulty: 'medium',
      data: [
        ['Concentration [nM]', 'Inhibition %'],
        [0.1, '15.2%'],
        [1.0, '35.4%'],
        [10.0, '77.3%'],
        [100.0, '95.1%']
      ],
      expectedResult: {
        shouldDetect: true,
        expectedHeaderRow: 0,
        expectedConcentrationColumn: 0,
        expectedResponseColumns: [1],
        requiresRecovery: true
      }
    });

    // Test with text in numeric columns
    this.addTestCase({
      id: 'fmt_002',
      name: 'Text in Numeric Columns',
      description: 'Non-numeric text mixed with numbers',
      category: 'formatting_issues',
      difficulty: 'hard',
      data: [
        ['Dose [nM]', 'Response'],
        [0.1, '15.2'],
        ['1.0', 35.4],
        ['ND', 'ND'], // Non-detectable
        [100.0, 'High']
      ],
      expectedResult: {
        shouldDetect: true,
        requiresRecovery: true,
        allowableErrors: 2
      }
    });
  }

  /**
   * Complex layout test cases
   */
  private addComplexLayoutTests(): void {
    // Test with merged header cells (simulated)
    this.addTestCase({
      id: 'complex_001',
      name: 'Complex Header Structure',
      description: 'Headers with sub-headers',
      category: 'complex_layouts',
      difficulty: 'extreme',
      data: [
        ['', 'Compound A', 'Compound A', 'Compound B', 'Compound B'],
        ['Concentration [nM]', 'Replicate 1', 'Replicate 2', 'Replicate 1', 'Replicate 2'],
        [0.1, 10.2, 12.1, 15.5, 14.2],
        [1.0, 25.4, 28.2, 32.1, 30.5],
        [10.0, 67.3, 71.2, 75.8, 73.1]
      ],
      expectedResult: {
        shouldDetect: true,
        expectedHeaderRow: 1,
        expectedConcentrationColumn: 0,
        expectedResponseColumns: [1, 2, 3, 4],
        expectedConfidence: 0.7
      }
    });
  }

  /**
   * Error recovery test cases
   */
  private addErrorRecoveryTests(): void {
    // Test severe data corruption
    this.addTestCase({
      id: 'recovery_001',
      name: 'Severely Corrupted Data',
      description: 'Multiple types of errors requiring recovery',
      category: 'error_recovery',
      difficulty: 'extreme',
      data: [
        ['Concentration', 'Response A', 'Response B'],
        ['0.1 nM', '15.2%', 18.1],
        [null, '', 'ND'],
        ['1e-6 M', 35.4, ''],
        ['ND', 'High', 'Low'],
        [100, 89.5, 92.1]
      ],
      expectedResult: {
        shouldDetect: true,
        requiresRecovery: true,
        allowableErrors: 3,
        expectedDataRows: 2 // After recovery
      }
    });
  }

  /**
   * Validate test results against expectations
   */
  private validateTestResult(testCase: TestCase, result: TestResult): boolean {
    const expected = testCase.expectedResult;
    const detection = result.detectionResult;
    const parse = result.actualResult;

    // Check if detection should succeed
    if (expected.shouldDetect && detection.confidence < 0.3) {
      result.errors.push(`Detection confidence too low: ${detection.confidence}`);
      return false;
    }

    // Check specific expectations
    if (expected.expectedHeaderRow !== undefined && 
        detection.headerRow !== expected.expectedHeaderRow) {
      result.errors.push(`Header row mismatch: expected ${expected.expectedHeaderRow}, got ${detection.headerRow}`);
      return false;
    }

    if (expected.expectedConcentrationColumn !== undefined && 
        detection.concentrationColumn !== expected.expectedConcentrationColumn) {
      result.errors.push(`Concentration column mismatch: expected ${expected.expectedConcentrationColumn}, got ${detection.concentrationColumn}`);
      return false;
    }

    if (expected.expectedResponseColumns !== undefined) {
      const actualCols = detection.responseColumns.sort();
      const expectedCols = expected.expectedResponseColumns.sort();
      if (!this.arraysEqual(actualCols, expectedCols)) {
        result.errors.push(`Response columns mismatch: expected [${expectedCols}], got [${actualCols}]`);
        return false;
      }
    }

    // Check error tolerance
    if (expected.allowableErrors !== undefined) {
      const criticalErrors = parse.errors.filter(e => e.type === 'critical').length;
      if (criticalErrors > expected.allowableErrors) {
        result.errors.push(`Too many critical errors: ${criticalErrors} > ${expected.allowableErrors}`);
        return false;
      }
    }

    // Check if recovery requirements are met
    if (expected.requiresRecovery && !result.recoveryResult) {
      result.warnings.push('Test expected recovery but none was attempted');
    }

    return result.errors.length === 0;
  }

  /**
   * Helper function to compare arrays
   */
  private arraysEqual(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((val, i) => val === b[i]);
  }
}

/**
 * Create a standardized test report
 */
export function generateTestReport(results: TestSuiteResult): string {
  const report = [
    '# Excel Import Flexibility Test Report',
    '',
    `**Overall Score: ${results.overallScore.toFixed(1)}%**`,
    `**Tests Passed: ${results.passedTests}/${results.totalTests}**`,
    '',
    '## Category Summary',
    ''
  ];

  Object.entries(results.categorySummary).forEach(([category, summary]) => {
    const score = summary.total > 0 ? (summary.passed / summary.total * 100).toFixed(1) : 'N/A';
    report.push(`- **${category}**: ${summary.passed}/${summary.total} (${score}%)`);
  });

  report.push('', '## Failed Tests', '');

  const failedTests = results.results.filter(r => !r.passed);
  if (failedTests.length === 0) {
    report.push('All tests passed! 🎉');
  } else {
    failedTests.forEach(test => {
      report.push(`### ${test.testId}`);
      report.push(`**Errors:**`);
      test.errors.forEach(error => report.push(`- ${error}`));
      if (test.warnings.length > 0) {
        report.push(`**Warnings:**`);
        test.warnings.forEach(warning => report.push(`- ${warning}`));
      }
      report.push('');
    });
  }

  return report.join('\n');
}

/**
 * Export default test suite instance
 */
export const defaultTestSuite = new ExcelImportTestSuite();