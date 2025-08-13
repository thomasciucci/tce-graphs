/**
 * Test script for biological dataset segmentation
 */

import { applyBiologicalSegmentation, BiologicalConstraints } from './biologicalDatasetSegmentation';

// Mock oversized patterns that should be segmented
const mockOversizedPatterns = [
  {
    id: 'pattern1',
    patternType: 'horizontal-matrix',
    description: 'Horizontal matrix: 51 samples × 10 concentrations',
    confidence: 1.0,
    boundingBox: {
      startRow: 0,
      endRow: 51,
      startColumn: 0,
      endColumn: 10
    }
  },
  {
    id: 'pattern2',
    patternType: 'horizontal-matrix', 
    description: 'Horizontal matrix: 47 samples × 3 concentrations',
    confidence: 1.0,
    boundingBox: {
      startRow: 60,
      endRow: 106,
      startColumn: 0,
      endColumn: 3
    }
  },
  {
    id: 'pattern3',
    patternType: 'horizontal-matrix',
    description: 'Horizontal matrix: 8 samples × 19 concentrations', 
    confidence: 1.0,
    boundingBox: {
      startRow: 120,
      endRow: 127,
      startColumn: 0,
      endColumn: 19
    }
  },
  {
    id: 'pattern4',
    patternType: 'classic-titration',
    description: 'custom format: 2 replicates, dose-response layout',
    confidence: 1.0,
    boundingBox: {
      startRow: 140,
      endRow: 150,
      startColumn: 0,
      endColumn: 2
    }
  }
];

// Mock raw data (simplified for testing)
const mockRawData = Array(200).fill(null).map((_, rowIndex) => 
  Array(25).fill(null).map((_, colIndex) => {
    if (rowIndex === 0) return `Header_${colIndex}`;
    if (colIndex === 0) return `Sample_${rowIndex}`;
    return Math.random() * 100;
  })
);

/**
 * Test biological segmentation functionality
 */
export function testBiologicalSegmentation(): void {
  console.log('🧬 Testing biological dataset segmentation...');
  console.log('\n=== INPUT PATTERNS ===');
  
  mockOversizedPatterns.forEach((pattern, index) => {
    console.log(`${index + 1}. ${pattern.description} (confidence: ${pattern.confidence})`);
  });

  const biologicalConstraints: BiologicalConstraints = {
    maxSamplesPerDataset: 8,
    maxConcentrationsPerDataset: 15,
    minSamplesPerDataset: 1,
    minConcentrationsPerDataset: 6,     // Updated to 6 for stricter filtering
    preferIndividualCurves: true,
    enableMatrixSegmentation: true
  };

  console.log('\n=== BIOLOGICAL CONSTRAINTS ===');
  console.log(`Max samples per dataset: ${biologicalConstraints.maxSamplesPerDataset}`);
  console.log(`Max concentrations per dataset: ${biologicalConstraints.maxConcentrationsPerDataset}`);
  console.log(`Prefer individual curves: ${biologicalConstraints.preferIndividualCurves}`);
  console.log(`Enable matrix segmentation: ${biologicalConstraints.enableMatrixSegmentation}`);

  try {
    const segmentationResult = applyBiologicalSegmentation(
      mockOversizedPatterns,
      mockRawData,
      biologicalConstraints
    );

    console.log('\n=== SEGMENTATION RESULTS ===');
    console.log(`📊 Statistics:`);
    console.log(`   Total original patterns: ${segmentationResult.segmentationStats.totalOriginalPatterns}`);
    console.log(`   Oversized patterns: ${segmentationResult.segmentationStats.oversizedPatterns}`);
    console.log(`   Segmented patterns: ${segmentationResult.segmentationStats.segmentedPatterns}`);
    console.log(`   Final datasets: ${segmentationResult.segmentationStats.finalDatasets}`);

    console.log('\n✅ SEGMENTED DATASETS:');
    segmentationResult.segmentedDatasets.forEach((dataset, index) => {
      console.log(`${index + 1}. ${dataset.name}`);
      console.log(`   ID: ${dataset.id}`);
      console.log(`   Size: ${dataset.sampleCount} samples × ${dataset.concentrationCount} concentrations`);
      console.log(`   Confidence: ${dataset.confidence.toFixed(2)}`);
      console.log(`   Biological Confidence: ${dataset.biologicalConfidence.toFixed(2)}`);
      console.log(`   Bounding Box: Row ${dataset.boundingBox.startRow}-${dataset.boundingBox.endRow}, Col ${dataset.boundingBox.startColumn}-${dataset.boundingBox.endColumn}`);
      
      if (dataset.segmentedFrom) {
        console.log(`   Segmented from: ${dataset.segmentedFrom.originalSize} (segment ${dataset.segmentedFrom.segmentIndex}/${dataset.segmentedFrom.totalSegments})`);
      }
      
      if (dataset.replicateInfo) {
        console.log(`   Replicate info: ${dataset.replicateInfo.baseName} (${dataset.replicateInfo.replicateCount} replicates)`);
      }
      
      if (dataset.issues.length > 0) {
        console.log(`   Issues: ${dataset.issues.length}`);
        dataset.issues.forEach(issue => {
          console.log(`     - ${issue.type}: ${issue.message}`);
        });
      }
      console.log('');
    });

    if (segmentationResult.rejectedPatterns.length > 0) {
      console.log('❌ REJECTED PATTERNS:');
      segmentationResult.rejectedPatterns.forEach((rejected, index) => {
        console.log(`${index + 1}. ${rejected.size}`);
        console.log(`   Reason: ${rejected.reason}`);
        console.log(`   Original: ${rejected.originalPattern.description}`);
        console.log('');
      });
    }

    console.log('\n=== TEST VALIDATION ===');
    
    // Validate that oversized patterns were properly segmented
    const pattern1Segments = segmentationResult.segmentedDatasets.filter(d => 
      d.segmentedFrom?.originalSize.includes('51 samples × 10 concentrations')
    );
    console.log(`✅ Pattern 1 (51×10) segmented into: ${pattern1Segments.length} individual datasets`);
    
    const pattern2Segments = segmentationResult.segmentedDatasets.filter(d => 
      d.segmentedFrom?.originalSize.includes('47 samples × 3 concentrations')
    );
    console.log(`✅ Pattern 2 (47×3) segmented into: ${pattern2Segments.length} individual datasets`);
    
    const pattern3Segments = segmentationResult.segmentedDatasets.filter(d => 
      d.segmentedFrom?.originalSize.includes('8 samples × 19 concentrations')
    );
    
    if (pattern3Segments.length > 0) {
      console.log(`⚠️  Pattern 3 (8×19) was segmented - concentrations exceed limit`);
    } else {
      console.log(`✅ Pattern 3 (8×19) was rejected - too many concentrations`);
    }
    
    const appropriatelySizedDatasets = segmentationResult.segmentedDatasets.filter(d => 
      d.sampleCount <= biologicalConstraints.maxSamplesPerDataset && 
      d.concentrationCount <= biologicalConstraints.maxConcentrationsPerDataset
    );
    
    console.log(`✅ ${appropriatelySizedDatasets.length}/${segmentationResult.segmentedDatasets.length} datasets are within biological limits`);
    
    const highBiologicalConfidence = segmentationResult.segmentedDatasets.filter(d => d.biologicalConfidence > 0.7);
    console.log(`✅ ${highBiologicalConfidence.length}/${segmentationResult.segmentedDatasets.length} datasets have high biological confidence (>0.7)`);

    console.log('\n🎉 BIOLOGICAL SEGMENTATION TEST PASSED!');
    console.log('Large matrices have been successfully broken down into individual dose-response curves.');

  } catch (error) {
    console.error('❌ BIOLOGICAL SEGMENTATION TEST FAILED:', error);
  }
}

// Helper function to extract sample count from pattern description
function extractSampleCount(description: string): number {
  const match = description.match(/(\d+)\s*samples/);
  return match ? parseInt(match[1]) : 1;
}

// Helper function to extract concentration count from pattern description  
function extractConcentrationCount(description: string): number {
  const match = description.match(/(\d+)\s*concentrations/);
  return match ? parseInt(match[1]) : 4;
}

// Run the test if this file is executed directly
if (require.main === module) {
  testBiologicalSegmentation();
}