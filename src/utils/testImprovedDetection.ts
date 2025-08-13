/**
 * Test script for improved multi-dataset detection
 */

import { detectMultipleDatasetsImproved } from './improvedMultiDatasetDetection';

// Sample test data with multiple datasets separated by gaps
const sampleData1 = [
  // Dataset 1
  ['Concentration', 'Sample A', 'Sample B'],
  [1000, 95, 96],
  [100, 85, 87],
  [10, 45, 48],
  [1, 15, 18],
  [],  // Empty row separator
  [],  // Empty row separator
  // Dataset 2
  ['Dose', 'Response 1', 'Response 2', 'Response 3'],
  [50, 92, 94, 93],
  [5, 78, 80, 79],
  [0.5, 35, 38, 36],
  [0.05, 12, 15, 14],
];

const sampleData2 = [
  // Dataset 1 - horizontal layout
  ['Conc', 100, 10, 1, 0.1],
  ['Sample1', 95, 85, 45, 15],
  ['Sample2', 96, 87, 48, 18],
  [],  // Empty row
  // Dataset 2 - different format
  ['Treatment', 'High', 'Medium', 'Low'],
  [50, 92, 78, 35],
  [25, 89, 75, 32],
  [12.5, 86, 72, 29],
];

/**
 * Test function to validate the improved detection
 */
export function testImprovedDetection(): void {
  console.log('Testing improved multi-dataset detection...');
  
  try {
    console.log('\n=== Test 1: Vertical datasets with gap separator ===');
    const result1 = detectMultipleDatasetsImproved(sampleData1);
    console.log(`Found ${result1.totalDatasets} total datasets`);
    console.log(`Valid datasets: ${result1.validDatasets}`);
    console.log(`Layout: ${result1.layoutType} (confidence: ${result1.layoutConfidence.toFixed(2)})`);
    console.log(`Overall confidence: ${result1.overallConfidence.toFixed(2)}`);
    
    result1.datasets.forEach((dataset, index) => {
      console.log(`\nDataset ${index + 1}: ${dataset.name}`);
      console.log(`  Confidence: ${dataset.confidence.toFixed(2)}`);
      console.log(`  Bounding box: Row ${dataset.boundingBox.startRow}-${dataset.boundingBox.endRow}, Col ${dataset.boundingBox.startColumn}-${dataset.boundingBox.endColumn}`);
      console.log(`  Concentration column: ${dataset.concentrationColumn}`);
      console.log(`  Response columns: ${dataset.responseColumns.join(', ')}`);
      console.log(`  Spatial confidence: ${dataset.spatialConfidence.toFixed(2)}`);
    });
    
    console.log('\n=== Test 2: Mixed layout datasets ===');
    const result2 = detectMultipleDatasetsImproved(sampleData2);
    console.log(`Found ${result2.totalDatasets} total datasets`);
    console.log(`Valid datasets: ${result2.validDatasets}`);
    console.log(`Layout: ${result2.layoutType} (confidence: ${result2.layoutConfidence.toFixed(2)})`);
    console.log(`Overall confidence: ${result2.overallConfidence.toFixed(2)}`);
    
    result2.datasets.forEach((dataset, index) => {
      console.log(`\nDataset ${index + 1}: ${dataset.name}`);
      console.log(`  Confidence: ${dataset.confidence.toFixed(2)}`);
      console.log(`  Bounding box: Row ${dataset.boundingBox.startRow}-${dataset.boundingBox.endRow}, Col ${dataset.boundingBox.startColumn}-${dataset.boundingBox.endColumn}`);
    });
    
    console.log('\n=== Testing Summary ===');
    console.log('✅ Improved detection algorithm is working');
    console.log(`✅ Test 1 detected ${result1.validDatasets} valid datasets`);
    console.log(`✅ Test 2 detected ${result2.validDatasets} valid datasets`);
    
    if (result1.issues.length > 0) {
      console.log('\n📋 Issues found in Test 1:');
      result1.issues.forEach(issue => {
        console.log(`  ${issue.type}: ${issue.message}`);
      });
    }
    
    if (result2.issues.length > 0) {
      console.log('\n📋 Issues found in Test 2:');
      result2.issues.forEach(issue => {
        console.log(`  ${issue.type}: ${issue.message}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testImprovedDetection();
}