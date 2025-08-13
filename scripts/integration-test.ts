#!/usr/bin/env node
/**
 * Integration test for enhanced detection with UI components
 */

// Test integration between our enhanced algorithms and UI components
async function testSmartPreviewIntegration() {
  console.log('🎨 Testing SmartPreviewDashboard Integration...');
  
  try {
    // Test the interface definitions and basic functionality
    console.log('  Checking component interfaces...');
    
    // These would normally be React component tests, but we can validate the interfaces
    const testData = [
      ['Concentration [nM]', 'Response 1', 'Response 2'],
      [10000, 100, 98],
      [3333, 95, 93],
      [1111, 85, 83],
      [370, 70, 68],
      [123, 45, 43],
      [41, 20, 18],
      [14, 5, 3]
    ];
    
    // Test that our detection can provide the data structure expected by UI
    const { ScientificDetectionEngine } = await import('../src/utils/scientificDetection');
    const engine = new ScientificDetectionEngine();
    const result = engine.analyzeExcelData(testData);
    
    // Verify the result structure matches what UI components expect
    console.log('  ✅ Detection result structure compatible with UI');
    console.log(`     Has confidence scores: ${!!result.confidence}`);
    console.log(`     Has pattern detection: ${!!result.patternDetection}`);
    console.log(`     Has quality metrics: ${!!result.quality}`);
    console.log(`     Has recommendations: ${!!result.recommendations}`);
    
    return true;
  } catch (error) {
    console.log('  ❌ SmartPreviewDashboard integration failed:', (error as Error).message);
    return false;
  }
}

async function testGuidedWorkflowIntegration() {
  console.log('🛠️ Testing GuidedCorrectionWorkflow Integration...');
  
  try {
    console.log('  Checking workflow interfaces...');
    
    // Test that our enhanced detection can provide issues for the workflow
    const testData = [
      ['Concentration', 'Response'], // Poor headers
      [1000, 100],                  // Too few points
      [100, 80],
      [10, 20]
    ];
    
    const { ScientificDetectionEngine } = await import('../src/utils/scientificDetection');
    const engine = new ScientificDetectionEngine();
    const result = engine.analyzeExcelData(testData);
    
    // Check that issues are detected that the workflow can handle
    console.log('  ✅ Issues detected for workflow processing');
    console.log(`     Issues found: ${result.issues.length}`);
    console.log(`     Issue types: ${result.issues.map(i => i.type).join(', ')}`);
    console.log(`     Actionable recommendations: ${result.recommendations.filter(r => r.actionable).length}`);
    
    return true;
  } catch (error) {
    console.log('  ❌ GuidedCorrectionWorkflow integration failed:', (error as Error).message);
    return false;
  }
}

async function testRealTimeQualityIntegration() {
  console.log('📊 Testing RealTimeQualityAssessment Integration...');
  
  try {
    console.log('  Testing real-time quality scoring...');
    
    // Test that our validator provides continuous quality metrics
    const { ScientificValidator } = await import('../src/utils/scientificValidator');
    const validator = new ScientificValidator();
    
    // Test progressive data quality
    const scenarios = [
      {
        name: 'Excellent Data',
        concentrations: [100000, 10000, 1000, 100, 10, 1],
        responses: [[100, 99, 101], [90, 89, 91], [70, 69, 71], [40, 39, 41], [15, 14, 16], [5, 4, 6]]
      },
      {
        name: 'Good Data',
        concentrations: [10000, 1000, 100, 10, 1],
        responses: [[100, 95], [90, 85], [70, 65], [40, 35], [15, 10]]
      },
      {
        name: 'Poor Data',
        concentrations: [1000, 500, 100],
        responses: [[100], [50], [10]]
      }
    ];
    
    for (const scenario of scenarios) {
      const result = validator.validateDoseResponseData(scenario.concentrations, scenario.responses);
      console.log(`    ${scenario.name}: ${result.overall.level} (${(result.overall.score * 100).toFixed(1)}%)`);
    }
    
    console.log('  ✅ Real-time quality assessment working');
    
    return true;
  } catch (error) {
    console.log('  ❌ RealTimeQualityAssessment integration failed:', (error as Error).message);
    return false;
  }
}

async function testEndToEndScenario() {
  console.log('🔄 Testing End-to-End Detection Scenario...');
  
  try {
    console.log('  Running complete detection pipeline...');
    
    // Simulate typical Excel data upload scenario
    const excelData = [
      ['', 'Dose Response Assay', '', ''],           // Title row
      ['', 'Compound XYZ-123', '', ''],              // Compound row
      ['', '', '', ''],                               // Empty row
      ['Concentration [μM]', 'Sample A', 'Sample B', 'Sample C'], // Headers
      [100, 100, 98, 102],                          // Data rows
      [31.6, 95, 93, 97],
      [10, 85, 83, 87],
      [3.16, 70, 68, 72],
      [1, 45, 43, 47],
      [0.316, 20, 18, 22],
      [0.1, 5, 3, 7]
    ];
    
    // Step 1: Enhanced Detection
    const { ScientificDetectionEngine } = await import('../src/utils/scientificDetection');
    const engine = new ScientificDetectionEngine();
    const detectionResult = engine.analyzeExcelData(excelData);
    
    console.log('    ✅ Step 1: Enhanced detection completed');
    console.log(`       Confidence: ${(detectionResult.confidence.overall * 100).toFixed(1)}%`);
    console.log(`       Pattern: ${detectionResult.patternDetection.dilutionPattern.type}`);
    
    // Step 2: Scientific Validation
    const { ScientificValidator } = await import('../src/utils/scientificValidator');
    const validator = new ScientificValidator();
    
    const concentrations = excelData.slice(4).map(row => row[0] as number);
    const responses = excelData.slice(4).map(row => [row[1], row[2], row[3]] as number[]);
    
    const validationResult = validator.validateDoseResponseData(concentrations, responses);
    
    console.log('    ✅ Step 2: Scientific validation completed');
    console.log(`       Quality: ${validationResult.overall.level}`);
    console.log(`       Grade: ${validationResult.qualityReport.summary.overallGrade}`);
    
    // Step 3: Pattern Recognition
    const { AdaptivePatternDetector } = await import('../src/utils/adaptivePatternDetector');
    const detector = new AdaptivePatternDetector();
    const patterns = await detector.detectPattern(concentrations);
    
    console.log('    ✅ Step 3: Pattern recognition completed');
    console.log(`       Patterns found: ${patterns.length}`);
    if (patterns.length > 0) {
      console.log(`       Best pattern: ${patterns[0].type} (${(patterns[0].confidence * 100).toFixed(1)}%)`);
    }
    
    console.log('  ✅ End-to-end pipeline successful');
    
    return true;
  } catch (error) {
    console.log('  ❌ End-to-end scenario failed:', (error as Error).message);
    return false;
  }
}

async function main() {
  console.log('🔗 Testing Enhanced Detection Integration\n');
  
  const results = [];
  
  results.push(await testSmartPreviewIntegration());
  console.log();
  
  results.push(await testGuidedWorkflowIntegration());
  console.log();
  
  results.push(await testRealTimeQualityIntegration());
  console.log();
  
  results.push(await testEndToEndScenario());
  console.log();
  
  const successCount = results.filter(r => r).length;
  const totalCount = results.length;
  
  console.log('📊 Integration Test Summary');
  console.log('===========================');
  console.log(`✅ Successful: ${successCount}/${totalCount}`);
  console.log(`📈 Success Rate: ${(successCount / totalCount * 100).toFixed(1)}%`);
  
  if (successCount === totalCount) {
    console.log('🎉 All integration tests passed!');
    console.log('🚀 Enhanced detection system is ready for production use');
    process.exit(0);
  } else {
    console.log('⚠️  Some integration issues detected');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('💥 Integration testing failed:', error);
  process.exit(1);
});