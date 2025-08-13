#!/usr/bin/env node
/**
 * Simple validation script for enhanced detection algorithms
 */

// Test our individual components directly
async function testScientificDetection() {
  console.log('🧪 Testing Scientific Detection Engine...');
  
  try {
    // Dynamically import our modules
    const { ScientificDetectionEngine } = await import('../src/utils/scientificDetection');
    
    const engine = new ScientificDetectionEngine();
    
    // Test with simple dose-response data
    const testData = [
      ['Concentration [nM]', 'Response'],
      [10000, 100],
      [3333, 95],
      [1111, 85],
      [370, 70],
      [123, 45],
      [41, 20],
      [14, 5]
    ];
    
    console.log('  Testing with serial dilution data...');
    const result = engine.analyzeExcelData(testData);
    
    console.log('  ✅ Scientific Detection Engine working');
    console.log(`     Overall confidence: ${(result.confidence.overall * 100).toFixed(1)}%`);
    console.log(`     Pattern detected: ${result.patternDetection.dilutionPattern.type}`);
    console.log(`     Issues found: ${result.issues.length}`);
    
    return true;
  } catch (error) {
    console.log('  ❌ Scientific Detection Engine failed:', error.message);
    return false;
  }
}

async function testAdaptivePatternDetector() {
  console.log('🔍 Testing Adaptive Pattern Detector...');
  
  try {
    const { AdaptivePatternDetector } = await import('../src/utils/adaptivePatternDetector');
    
    const detector = new AdaptivePatternDetector();
    
    // Test with perfect 3-fold dilution
    const concentrations = [10000, 3333, 1111, 370, 123, 41, 14];
    
    console.log('  Testing pattern detection with 3-fold dilution...');
    const patterns = await detector.detectPattern(concentrations);
    
    console.log('  ✅ Adaptive Pattern Detector working');
    console.log(`     Patterns found: ${patterns.length}`);
    if (patterns.length > 0) {
      console.log(`     Best pattern: ${patterns[0].type} (${(patterns[0].confidence * 100).toFixed(1)}% confidence)`);
      console.log(`     Dilution factor: ${patterns[0].parameters.dilutionFactor.toFixed(2)}`);
    }
    
    return true;
  } catch (error) {
    console.log('  ❌ Adaptive Pattern Detector failed:', error.message);
    return false;
  }
}

async function testScientificValidator() {
  console.log('🔬 Testing Scientific Validator...');
  
  try {
    const { ScientificValidator } = await import('../src/utils/scientificValidator');
    
    const validator = new ScientificValidator();
    
    // Test with good quality dose-response data
    const concentrations = [100000, 10000, 1000, 100, 10, 1];
    const responses = [[100, 98, 102], [90, 88, 92], [70, 68, 72], [40, 38, 42], [15, 13, 17], [5, 3, 7]];
    
    console.log('  Testing data validation with triplicate dose-response...');
    const result = validator.validateDoseResponseData(concentrations, responses);
    
    console.log('  ✅ Scientific Validator working');
    console.log(`     Overall quality: ${result.overall.level}`);
    console.log(`     Overall score: ${(result.overall.score * 100).toFixed(1)}%`);
    console.log(`     Grade: ${result.qualityReport.summary.overallGrade}`);
    console.log(`     Ready for analysis: ${result.qualityReport.summary.readinessForAnalysis}`);
    
    return true;
  } catch (error) {
    console.log('  ❌ Scientific Validator failed:', error.message);
    return false;
  }
}

async function testRobustDetectionEngine() {
  console.log('🎯 Testing Robust Detection Engine...');
  
  try {
    const { RobustDetectionEngine } = await import('../src/utils/robustDetectionEngine');
    
    const engine = new RobustDetectionEngine();
    
    // Test with Excel-like data
    const testData = [
      ['Concentration [nM]', 'Sample 1', 'Sample 2', 'Sample 3'],
      [10000, 100, 98, 102],
      [1000, 90, 88, 92],
      [100, 70, 68, 72],
      [10, 30, 28, 32],
      [1, 10, 8, 12]
    ];
    
    console.log('  Testing robust detection with triplicate data...');
    const result = await engine.detectWithRobustness(testData);
    
    console.log('  ✅ Robust Detection Engine working');
    console.log(`     Consensus confidence: ${(result.consensusConfidence * 100).toFixed(1)}%`);
    console.log(`     Methods agreement: ${(result.methodAgreement * 100).toFixed(1)}%`);
    console.log(`     Quality assessment: ${result.qualityAssessment.overallGrade}`);
    console.log(`     Recommendations: ${result.recommendations.length}`);
    
    return true;
  } catch (error) {
    console.log('  ❌ Robust Detection Engine failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Validating Enhanced Detection Algorithms\n');
  
  const results = [];
  
  results.push(await testScientificDetection());
  console.log();
  
  results.push(await testAdaptivePatternDetector());
  console.log();
  
  results.push(await testScientificValidator());
  console.log();
  
  results.push(await testRobustDetectionEngine());
  console.log();
  
  const successCount = results.filter(r => r).length;
  const totalCount = results.length;
  
  console.log('📊 Validation Summary');
  console.log('====================');
  console.log(`✅ Successful: ${successCount}/${totalCount}`);
  console.log(`📈 Success Rate: ${(successCount / totalCount * 100).toFixed(1)}%`);
  
  if (successCount === totalCount) {
    console.log('🎉 All enhanced algorithms validated successfully!');
    process.exit(0);
  } else {
    console.log('⚠️  Some algorithms need attention');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('💥 Validation failed:', error);
  process.exit(1);
});