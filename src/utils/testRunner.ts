/**
 * Test Runner for Enhanced Data Detection System
 * Executes comprehensive tests for pattern recognition and multi-dataset support
 */

import { enhancedTestSuite, EnhancedTestCase } from './enhancedTestFramework';
import { EnhancedParseOptions } from './enhancedParser';

export interface TestRunOptions {
  categories?: ('dilution_patterns' | 'multi_dataset' | 'pattern_vs_keyword' | 'complex_scenarios')[];
  difficultyLevels?: ('easy' | 'medium' | 'hard' | 'extreme')[];
  verbose?: boolean;
  stopOnError?: boolean;
  generateReport?: boolean;
}

export interface TestReport {
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    successRate: number;
    totalTime: number;
  };
  categoryBreakdown: Record<string, {
    total: number;
    passed: number;
    failed: number;
    successRate: number;
  }>;
  failedTests: Array<{
    testId: string;
    name: string;
    category: string;
    difficulty: string;
    errors: string[];
    executionTime: number;
  }>;
  performance: {
    averageExecutionTime: number;
    slowestTest: {
      testId: string;
      name: string;
      executionTime: number;
    };
    fastestTest: {
      testId: string;
      name: string;
      executionTime: number;
    };
  };
}

/**
 * Runs enhanced detection and parsing tests
 */
export async function runEnhancedTests(
  options: TestRunOptions = {},
  parseOptions?: EnhancedParseOptions
): Promise<TestReport> {
  console.log('🚀 Starting Enhanced Data Detection Tests...\n');
  
  const startTime = performance.now();
  
  // Run the test suite
  const results = await enhancedTestSuite.runEnhancedTests(parseOptions);
  
  const totalTime = performance.now() - startTime;
  
  // Generate comprehensive report
  const report = generateTestReport(results, totalTime, options);
  
  if (options.generateReport !== false) {
    printTestReport(report, options.verbose);
  }
  
  return report;
}

/**
 * Generates a comprehensive test report
 */
function generateTestReport(
  results: Awaited<ReturnType<typeof enhancedTestSuite.runEnhancedTests>>,
  totalTime: number,
  options: TestRunOptions
): TestReport {
  const failedTests = results.results
    .filter(r => !r.passed)
    .map(r => {
      // Find the test case to get additional details
      const testCase = findTestCaseById(r.testId);
      return {
        testId: r.testId,
        name: testCase?.name || 'Unknown Test',
        category: testCase?.category || 'unknown',
        difficulty: testCase?.difficulty || 'unknown',
        errors: r.errors,
        executionTime: r.executionTime
      };
    });

  // Calculate category breakdown
  const categoryBreakdown: Record<string, any> = {};
  Object.entries(results.categoryResults).forEach(([category, stats]) => {
    categoryBreakdown[category] = {
      total: stats.total,
      passed: stats.passed,
      failed: stats.total - stats.passed,
      successRate: stats.total > 0 ? (stats.passed / stats.total) * 100 : 0
    };
  });

  // Performance analysis
  const executionTimes = results.results.map(r => r.executionTime);
  const averageExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
  
  const slowestResult = results.results.reduce((slowest, current) => 
    current.executionTime > slowest.executionTime ? current : slowest
  );
  
  const fastestResult = results.results.reduce((fastest, current) => 
    current.executionTime < fastest.executionTime ? current : fastest
  );

  return {
    summary: {
      totalTests: results.totalTests,
      passedTests: results.passedTests,
      failedTests: results.totalTests - results.passedTests,
      successRate: results.totalTests > 0 ? (results.passedTests / results.totalTests) * 100 : 0,
      totalTime
    },
    categoryBreakdown,
    failedTests,
    performance: {
      averageExecutionTime,
      slowestTest: {
        testId: slowestResult.testId,
        name: findTestCaseById(slowestResult.testId)?.name || 'Unknown',
        executionTime: slowestResult.executionTime
      },
      fastestTest: {
        testId: fastestResult.testId,
        name: findTestCaseById(fastestResult.testId)?.name || 'Unknown',
        executionTime: fastestResult.executionTime
      }
    }
  };
}

/**
 * Prints a formatted test report to console
 */
function printTestReport(report: TestReport, verbose: boolean = false): void {
  console.log('📊 Enhanced Detection Test Results');
  console.log('=====================================\n');
  
  // Summary
  console.log('📈 Summary:');
  console.log(`  Total Tests: ${report.summary.totalTests}`);
  console.log(`  Passed: ${report.summary.passedTests} ✅`);
  console.log(`  Failed: ${report.summary.failedTests} ❌`);
  console.log(`  Success Rate: ${report.summary.successRate.toFixed(1)}%`);
  console.log(`  Total Time: ${report.summary.totalTime.toFixed(1)}ms\n`);
  
  // Category breakdown
  console.log('📋 Category Breakdown:');
  Object.entries(report.categoryBreakdown).forEach(([category, stats]) => {
    const icon = stats.successRate >= 80 ? '✅' : stats.successRate >= 60 ? '⚠️' : '❌';
    console.log(`  ${category}: ${stats.passed}/${stats.total} (${stats.successRate.toFixed(1)}%) ${icon}`);
  });
  console.log();
  
  // Performance metrics
  console.log('⏱️ Performance:');
  console.log(`  Average Execution Time: ${report.performance.averageExecutionTime.toFixed(1)}ms`);
  console.log(`  Slowest Test: ${report.performance.slowestTest.name} (${report.performance.slowestTest.executionTime.toFixed(1)}ms)`);
  console.log(`  Fastest Test: ${report.performance.fastestTest.name} (${report.performance.fastestTest.executionTime.toFixed(1)}ms)\n`);
  
  // Failed tests (if any)
  if (report.failedTests.length > 0) {
    console.log('❌ Failed Tests:');
    report.failedTests.forEach((test, index) => {
      console.log(`  ${index + 1}. ${test.name} (${test.category}, ${test.difficulty})`);
      if (verbose) {
        test.errors.forEach(error => {
          console.log(`     Error: ${error}`);
        });
        console.log(`     Execution Time: ${test.executionTime.toFixed(1)}ms`);
      }
    });
    console.log();
  }
  
  // Overall status
  const overallStatus = report.summary.successRate >= 80 ? '🎉 EXCELLENT' : 
                       report.summary.successRate >= 60 ? '👍 GOOD' : 
                       report.summary.successRate >= 40 ? '⚠️ NEEDS WORK' : '🚨 CRITICAL';
  
  console.log(`Overall Status: ${overallStatus}\n`);
}

/**
 * Helper function to find test case by ID
 */
function findTestCaseById(testId: string): EnhancedTestCase | undefined {
  // Access the private testCases array through the suite
  // In a real implementation, you'd expose this through a public method
  return (enhancedTestSuite as any).testCases?.find((tc: EnhancedTestCase) => tc.id === testId);
}

/**
 * Runs tests for a specific category
 */
export async function runCategoryTests(
  category: 'dilution_patterns' | 'multi_dataset' | 'pattern_vs_keyword' | 'complex_scenarios',
  parseOptions?: EnhancedParseOptions
): Promise<TestReport> {
  return runEnhancedTests({ categories: [category] }, parseOptions);
}

/**
 * Runs tests with specific difficulty level
 */
export async function runDifficultyTests(
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme',
  parseOptions?: EnhancedParseOptions
): Promise<TestReport> {
  return runEnhancedTests({ difficultyLevels: [difficulty] }, parseOptions);
}

/**
 * Quick smoke test - runs a subset of critical tests
 */
export async function runSmokeTests(parseOptions?: EnhancedParseOptions): Promise<TestReport> {
  console.log('🔥 Running Smoke Tests (Quick Validation)...\n');
  
  return runEnhancedTests({
    categories: ['dilution_patterns', 'multi_dataset'],
    difficultyLevels: ['easy', 'medium'],
    verbose: false
  }, parseOptions);
}

/**
 * Comprehensive test run with full reporting
 */
export async function runFullTestSuite(parseOptions?: EnhancedParseOptions): Promise<TestReport> {
  console.log('🎯 Running Full Test Suite...\n');
  
  return runEnhancedTests({
    verbose: true,
    generateReport: true
  }, parseOptions);
}

/**
 * Export for use in other test files
 */
export { enhancedTestSuite };