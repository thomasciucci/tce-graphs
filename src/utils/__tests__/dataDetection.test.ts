import {
  parseConcentration,
  isConcentrationColumn,
  analyzeHeaderRow,
  detectAssayType,
  detectDataLayout
} from '../dataDetection';

describe('Data Detection Utilities', () => {
  describe('parseConcentration', () => {
    test('parses simple numeric values', () => {
      const result = parseConcentration('10');
      expect(result.value).toBe(10);
      expect(result.unit.unit).toBe('nM');
      expect(result.isValid).toBe(true);
    });

    test('parses values with nM unit', () => {
      const result = parseConcentration('10 nM');
      expect(result.value).toBe(10);
      expect(result.unit.unit).toBe('nM');
      expect(result.unit.detected).toBe(true);
      expect(result.isValid).toBe(true);
    });

    test('parses values with μM unit and converts to nM', () => {
      const result = parseConcentration('1.5 μM');
      expect(result.value).toBe(1500); // 1.5 μM = 1500 nM
      expect(result.unit.unit).toBe('μM');
      expect(result.unit.detected).toBe(true);
      expect(result.isValid).toBe(true);
    });

    test('parses scientific notation', () => {
      const result = parseConcentration('1.5e-6 M');
      expect(result.value).toBe(1500); // 1.5e-6 M = 1500 nM
      expect(result.unit.unit).toBe('M');
      expect(result.unit.detected).toBe(true);
      expect(result.isValid).toBe(true);
    });

    test('handles invalid values', () => {
      const result = parseConcentration('not a number');
      expect(result.value).toBeNaN();
      expect(result.isValid).toBe(false);
    });

    test('handles negative values as invalid', () => {
      const result = parseConcentration('-10 nM');
      expect(result.isValid).toBe(false);
    });
  });

  describe('isConcentrationColumn', () => {
    test('identifies dilution series', () => {
      const values = ['100', '10', '1', '0.1', '0.01'];
      const result = isConcentrationColumn(values);
      expect(result.isConcentration).toBe(true);
      expect(result.confidence).toBeGreaterThan(50);
    });

    test('identifies concentration values with units', () => {
      const values = ['100 nM', '10 nM', '1 nM', '0.1 nM'];
      const result = isConcentrationColumn(values);
      expect(result.isConcentration).toBe(true);
      expect(result.confidence).toBeGreaterThan(70);
    });

    test('rejects non-numeric columns', () => {
      const values = ['Sample A', 'Sample B', 'Sample C'];
      const result = isConcentrationColumn(values);
      expect(result.isConcentration).toBe(false);
      expect(result.confidence).toBeLessThan(50);
    });

    test('handles mixed content', () => {
      const values = ['Concentration', '100', '10', '1', 'Control'];
      const result = isConcentrationColumn(values);
      // Should still detect as concentration due to numeric pattern
      expect(result.confidence).toBeGreaterThan(30);
    });
  });

  describe('analyzeHeaderRow', () => {
    test('identifies concentration and response columns', () => {
      const row = ['Concentration (nM)', 'Sample A', 'Sample B', 'Sample C'];
      const result = analyzeHeaderRow(row);
      
      expect(result.concentrationColumn).toBe(0);
      expect(result.responseColumns).toEqual([1, 2, 3]);
      expect(result.sampleNames).toEqual(['Sample A', 'Sample B', 'Sample C']);
      expect(result.confidence).toBeGreaterThan(40);
    });

    test('handles TCE concentration pattern', () => {
      const row = ['TCE [nM]', 'CD4 Activation', 'CD8 Activation', 'Cytotoxicity'];
      const result = analyzeHeaderRow(row);
      
      expect(result.concentrationColumn).toBe(0);
      expect(result.responseColumns).toEqual([1, 2, 3]);
      expect(result.confidence).toBeGreaterThan(40);
    });

    test('assumes first column as concentration when no keywords found', () => {
      const row = ['Values', 'Result 1', 'Result 2', 'Result 3'];
      const result = analyzeHeaderRow(row);
      
      expect(result.concentrationColumn).toBe(0);
      expect(result.responseColumns).toEqual([1, 2, 3]);
    });
  });

  describe('detectAssayType', () => {
    test('detects cytotoxicity assay', () => {
      const sheetData = [
        ['TCE [nM]', 'Cytotoxicity %'],
        ['100', '90'],
        ['10', '50'],
        ['1', '10']
      ];
      
      const result = detectAssayType(sheetData);
      expect(result.type).toBe('Cytotoxicity');
      expect(result.confidence).toBeGreaterThan(50);
    });

    test('detects T cell activation assay', () => {
      const sheetData = [
        ['Concentration', 'CD25+ CD4+ %', 'IL-2 Production'],
        ['1000', '80', '500'],
        ['100', '60', '300'],
        ['10', '20', '100']
      ];
      
      const result = detectAssayType(sheetData);
      expect(result.type).toBe('T Cell Activation');
      expect(result.confidence).toBeGreaterThan(50);
    });

    test('returns unknown for unrecognized patterns', () => {
      const sheetData = [
        ['X Values', 'Y Values'],
        ['1', '2'],
        ['3', '4']
      ];
      
      const result = detectAssayType(sheetData);
      expect(result.type).toBe('Unknown');
      expect(result.confidence).toBe(0);
    });
  });

  describe('detectDataLayout', () => {
    test('detects valid column-oriented layout', () => {
      const sheetData = [
        ['TCE [nM]', 'Sample A', 'Sample B', 'Sample C'],
        ['100', '90', '85', '88'],
        ['10', '70', '65', '72'],
        ['1', '30', '25', '35'],
        ['0.1', '10', '8', '12']
      ];
      
      const result = detectDataLayout(sheetData);
      
      expect(result.confidence).toBeGreaterThan(70);
      expect(result.detectedLayout.orientation).toBe('column');
      expect(result.detectedLayout.headerRow).toBe(0);
      expect(result.detectedLayout.dataStartRow).toBe(1);
      expect(result.detectedLayout.concentrationColumn).toBe(0);
      expect(result.detectedLayout.responseColumns).toEqual([1, 2, 3]);
      expect(result.detectedLayout.sampleNames).toEqual(['Sample A', 'Sample B', 'Sample C']);
    });

    test('handles missing data gracefully', () => {
      const sheetData = [
        ['Header'],
        ['1']
      ];
      
      const result = detectDataLayout(sheetData);
      expect(result.confidence).toBe(0);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].type).toBe('error');
    });

    test('detects issues with insufficient data points', () => {
      const sheetData = [
        ['Concentration', 'Response'],
        ['100', '90'],
        ['10', '70']
      ];
      
      const result = detectDataLayout(sheetData);
      expect(result.issues.some(issue => 
        issue.type === 'error' && issue.message.includes('Insufficient data points')
      )).toBe(true);
    });

    test('provides suggestions for improvements', () => {
      const sheetData = [
        ['TCE [nM]', 'Cytotoxicity %'],
        ['100', '90'],
        ['10', '70'],
        ['1', '30'],
        ['0.1', '10'],
        ['0.01', '5']
      ];
      
      const result = detectDataLayout(sheetData);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Real-world Scenarios', () => {
    test('handles Excel file with merged cells representation', () => {
      const sheetData = [
        [null, null, 'Assay Results', null],
        ['TCE Concentration (nM)', 'Replicate 1', 'Replicate 2', 'Replicate 3'],
        ['1000', '95.2', '93.8', '96.1'],
        ['100', '78.5', '80.2', '77.9'],
        ['10', '45.3', '43.7', '47.1'],
        ['1', '15.8', '17.2', '14.5']
      ];
      
      const result = detectDataLayout(sheetData);
      expect(result.confidence).toBeGreaterThan(60);
      expect(result.detectedLayout.headerRow).toBe(1); // Should skip the merged cell row
    });

    test('handles scientific notation in concentration values', () => {
      const sheetData = [
        ['Concentration (M)', 'Response (%)'],
        ['1E-6', '85'],
        ['1E-7', '65'],
        ['1E-8', '35'],
        ['1E-9', '15']
      ];
      
      const result = detectDataLayout(sheetData);
      expect(result.confidence).toBeGreaterThan(70);
      expect(result.detectedLayout.concentrationUnit.unit).toBe('M');
    });

    test('handles comma decimal separators', () => {
      const sheetData = [
        ['Dose (μM)', 'Viability (%)'],
        ['10,5', '92,3'],
        ['1,05', '78,7'],
        ['0,105', '45,2'],
        ['0,0105', '12,8']
      ];
      
      // Note: This would require additional handling for comma separators
      // For now, we test that it doesn't crash
      const result = detectDataLayout(sheetData);
      expect(result).toBeDefined();
    });

    test('handles empty rows within data', () => {
      const sheetData = [
        ['TCE [nM]', 'Sample 1', 'Sample 2'],
        ['100', '90', '85'],
        ['10', '70', '65'],
        [null, null, null], // Empty row
        ['1', '30', '25'],
        ['0.1', '10', '8']
      ];
      
      const result = detectDataLayout(sheetData);
      expect(result.detectedLayout.dataEndRow).toBe(1); // Should stop at first empty row
    });
  });
});