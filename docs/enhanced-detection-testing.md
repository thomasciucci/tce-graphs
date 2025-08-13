# Enhanced Data Detection Testing Guide

This document explains how to test the enhanced data detection and parsing system in nVitro Studio.

## Overview

The enhanced detection system includes:
- **Pattern-based detection**: Mathematical analysis of concentration sequences
- **Multi-dataset support**: Detection and parsing of multiple data blocks in a single sheet
- **Dilution pattern recognition**: Automatic identification of serial dilutions, log scales, and custom patterns
- **Hybrid detection**: Combination of pattern analysis and keyword matching

## Test Categories

### 1. Dilution Patterns (`dilution_patterns`)
Tests the system's ability to detect various dilution patterns:
- Serial dilutions (2x, 3x, 10x, etc.)
- Log scale patterns (log10, custom log bases)
- Linear patterns
- Mixed unit handling
- Irregular but valid patterns

### 2. Multi-Dataset (`multi_dataset`)
Tests detection of multiple datasets in a single sheet:
- Vertically stacked datasets
- Horizontally arranged datasets
- Grid layouts (2x2, etc.)
- Mixed arrangements with gaps

### 3. Pattern vs Keyword (`pattern_vs_keyword`)
Compares pattern-based detection with keyword-based detection:
- Clear patterns without concentration keywords
- Keywords without clear patterns
- Both patterns and keywords present

### 4. Complex Scenarios (`complex_scenarios`)
Real-world challenging cases:
- Multiple datasets with different pattern types
- Corrupted data with recovery potential
- Mixed data quality scenarios

## Difficulty Levels

- **Easy**: Clear, well-formatted data with obvious patterns
- **Medium**: Minor formatting issues or mixed units
- **Hard**: Missing headers, irregular patterns, or data quality issues
- **Extreme**: Complex layouts, corrupted data, or edge cases

## Running Tests

### Quick Start

```bash
# Install dependencies (if not already done)
npm install

# Run smoke tests (quick validation)
npm run test:enhanced-detection --smoke

# Run all tests
npm run test:enhanced-detection

# Run with verbose output
npm run test:enhanced-detection --verbose
```

### Category-Specific Tests

```bash
# Test dilution pattern recognition
npm run test:enhanced-detection --category dilution_patterns

# Test multi-dataset detection
npm run test:enhanced-detection --category multi_dataset

# Test pattern vs keyword comparison
npm run test:enhanced-detection --category pattern_vs_keyword

# Test complex scenarios
npm run test:enhanced-detection --category complex_scenarios
```

### Difficulty-Specific Tests

```bash
# Test easy cases only
npm run test:enhanced-detection --difficulty easy

# Test challenging cases
npm run test:enhanced-detection --difficulty hard

# Test extreme edge cases
npm run test:enhanced-detection --difficulty extreme
```

### Configuration Options

```bash
# Set minimum pattern confidence threshold
npm run test:enhanced-detection --pattern-confidence 0.7

# Enable multi-dataset detection
npm run test:enhanced-detection --enable-multi

# Prioritize pattern detection over keywords
npm run test:enhanced-detection --prioritize-patterns

# Combine options
npm run test:enhanced-detection --category dilution_patterns --difficulty medium --verbose --pattern-confidence 0.6
```

### Full Test Suite

```bash
# Run comprehensive tests with detailed reporting
npm run test:enhanced-detection --full
```

## Understanding Test Results

### Summary Metrics
- **Total Tests**: Number of test cases executed
- **Passed/Failed**: Success and failure counts
- **Success Rate**: Percentage of tests that passed
- **Total Time**: Total execution time

### Category Breakdown
Shows success rates for each test category:
- ✅ 80%+ success rate (Excellent)
- ⚠️ 60-79% success rate (Good)
- ❌ <60% success rate (Needs attention)

### Performance Metrics
- **Average Execution Time**: Mean time per test
- **Slowest Test**: Test that took the longest
- **Fastest Test**: Test that completed quickest

### Failed Test Details
For each failed test:
- Test name and category
- Error messages and suggestions
- Execution time

## Test Data Examples

### Perfect Serial Dilution
```javascript
[
  ['Concentration', 'Response A', 'Response B'],
  [243, 95.2, 93.8],
  [81, 89.1, 87.5],
  [27, 75.3, 78.2],
  [9, 45.2, 48.1],
  [3, 25.8, 28.3],
  [1, 15.2, 12.7]
]
```

### Log10 Scale Pattern
```javascript
[
  ['Dose [nM]', 'Activity'],
  [100000, 98.5],
  [10000, 92.1],
  [1000, 78.6],
  [100, 52.3],
  [10, 28.9],
  [1, 12.4],
  [0.1, 5.2]
]
```

### Multi-Dataset Layout
```javascript
[
  ['Experiment 1'],
  ['Conc [nM]', 'Sample A', 'Sample B'],
  [100, 85.2, 87.1],
  [10, 55.8, 58.3],
  [1, 25.7, 28.2],
  [''],
  ['Experiment 2'],
  ['Dose [μM]', 'Compound X', 'Compound Y'],
  [10, 92.1, 89.7],
  [1, 78.5, 81.2],
  [0.1, 45.8, 48.9]
]
```

## Interpreting Results

### Success Criteria
Tests pass when:
- Pattern detection works correctly
- Concentration columns are identified accurately
- Response columns are found
- Confidence scores meet thresholds
- Multi-dataset boundaries are detected properly

### Common Failure Reasons
- Insufficient pattern confidence
- Incorrect column mapping
- Invalid concentration sequences
- Multi-dataset detection issues
- Data quality problems

### Troubleshooting

If tests fail:
1. Check the specific error messages
2. Review the test data format
3. Adjust confidence thresholds if needed
4. Consider data formatting improvements
5. Review detection algorithm parameters

## Adding New Tests

To add new test cases:

1. Open `src/utils/enhancedTestFramework.ts`
2. Add test case to appropriate category method
3. Define expected results
4. Run tests to validate

Example:
```typescript
this.addTestCase({
  id: 'pattern_005',
  name: 'Custom Pattern Test',
  description: 'Your test description',
  category: 'dilution_patterns',
  difficulty: 'medium',
  data: [
    // Your test data
  ],
  expectedResult: {
    shouldDetectPattern: true,
    expectedPatternType: 'serial',
    expectedDilutionFactor: 2,
    minPatternConfidence: 0.7,
    shouldSucceed: true
  }
});
```

## Integration with CI/CD

For continuous integration:

```bash
# Exit codes:
# 0: All tests passed (≥80% success rate)
# 1: Some failures but functional (60-79% success rate)
# 2: Critical failures (<60% success rate)
# 3: Test execution error

# Example CI script
npm run test:enhanced-detection --smoke || exit $?
```

## Performance Benchmarks

Target performance metrics:
- **Average test execution**: <50ms per test
- **Full suite completion**: <5 seconds
- **Memory usage**: <100MB during testing
- **Success rate**: ≥90% for easy/medium tests, ≥70% for hard/extreme tests

## Best Practices

1. **Regular Testing**: Run smoke tests before commits
2. **Full Testing**: Run complete suite before releases
3. **Performance Monitoring**: Watch for execution time increases
4. **Failure Analysis**: Investigate all test failures promptly
5. **Test Coverage**: Ensure new features have corresponding tests