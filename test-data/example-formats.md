# Test Data Examples for Enhanced Import System

This document describes various Excel file formats that the enhanced import system should handle correctly.

## Test Case 1: Standard TCE Format
**File**: `standard-tce-format.xlsx`
**Description**: Well-formatted file with clear headers and consistent units

```
| TCE [nM] | CD4 Activation | CD8 Activation | Cytotoxicity |
|----------|---------------|---------------|--------------|
| 1000     | 85.2          | 82.1          | 5.3          |
| 100      | 72.8          | 68.9          | 3.1          |
| 10       | 45.6          | 42.3          | 1.8          |
| 1        | 18.9          | 15.7          | 0.9          |
| 0.1      | 5.2           | 4.1           | 0.3          |
```

**Expected Results**:
- Confidence: High (>90%)
- Assay Type: T Cell Activation
- Concentration Unit: nM
- Issues: None

## Test Case 2: Scientific Notation Format
**File**: `scientific-notation.xlsx`
**Description**: Concentrations in scientific notation with molar units

```
| Concentration (M) | Viability % | Activation % |
|-------------------|-------------|--------------|
| 1E-6              | 92.5        | 88.3         |
| 1E-7              | 78.2        | 74.6         |
| 1E-8              | 52.1        | 48.9         |
| 1E-9              | 23.4        | 20.8         |
| 1E-10             | 8.7         | 6.2          |
```

**Expected Results**:
- Confidence: High (>85%)
- Concentration Unit: M (converted to nM)
- Values: 1E-6 M = 1000 nM, etc.

## Test Case 3: Mixed Units Format
**File**: `mixed-units.xlsx`
**Description**: Different concentration units mixed within the file

```
| Sheet 1: μM Concentrations |      |      |
| Dose (μM) | Sample A | Sample B |
| 10        | 89.2     | 87.5     |
| 1         | 65.3     | 63.8     |
| 0.1       | 35.7     | 33.2     |

| Sheet 2: nM Concentrations |      |      |
| TCE [nM]  | Sample C | Sample D |
| 1000      | 91.1     | 89.6     |
| 100       | 68.4     | 66.9     |
| 10        | 38.2     | 36.7     |
```

**Expected Results**:
- Multiple sheets detected
- Units converted consistently to nM
- Option to merge or analyze separately

## Test Case 4: Complex Header Structure
**File**: `complex-headers.xlsx`
**Description**: Multiple header rows and merged cells

```
| Row 1: |            | T Cell Activation Assay |            |
| Row 2: |            | Treatment Results       |            |
| Row 3: | TCE [nM]   | CD25+ %                | IL-2 (pg/mL) |
| Row 4: | 1000       | 82.3                   | 450          |
| Row 5: | 100        | 61.7                   | 320          |
| Row 6: | 10         | 28.9                   | 150          |
```

**Expected Results**:
- Header row correctly identified as Row 3
- Data starts from Row 4
- Merged cells handled gracefully

## Test Case 5: Row-Oriented Data
**File**: `row-oriented.xlsx`
**Description**: Concentrations in rows instead of columns

```
| Sample ID    | Concentration | 1000 nM | 100 nM | 10 nM | 1 nM |
|--------------|---------------|---------|--------|-------|------|
| CD4_Donor_1  | Activation %  | 85.2    | 68.3   | 42.1  | 18.7 |
| CD4_Donor_2  | Activation %  | 87.9    | 71.2   | 45.8  | 21.3 |
| CD8_Donor_1  | Activation %  | 79.6    | 62.5   | 38.9  | 16.2 |
```

**Expected Results**:
- Row orientation detected
- Concentrations extracted from header row
- Samples processed correctly

## Test Case 6: Missing Data and Irregular Format
**File**: `irregular-format.xlsx`
**Description**: Missing values, empty rows, and inconsistent formatting

```
| TCE Concentration | Sample 1 | Sample 2 | Sample 3 |
|-------------------|----------|----------|----------|
| 1000 nM           | 89.2     |          | 91.5     |
|                   |          |          |          |
| 100nM             | 72.8     | 70.3     | 74.1     |
| 10 nM             |          | 45.6     | 47.2     |
| 1nM               | 18.9     | 16.2     |          |
|                   |          |          |          |
| 0.1 nM            | 5.3      | 4.8      | 6.1      |
```

**Expected Results**:
- Missing values handled gracefully
- Empty rows ignored
- Inconsistent spacing in units parsed correctly

## Test Case 7: Multiple Assay Types
**File**: `multiple-assays.xlsx`
**Description**: Different assay types in separate sheets

```
Sheet 1: Cytotoxicity
| TCE [nM] | Target Cell Death % | Bystander Death % |
|----------|-------------------|------------------|
| 1000     | 95.2              | 12.3             |
| 100      | 82.7              | 8.9              |
| 10       | 45.3              | 3.2              |

Sheet 2: Proliferation
| Concentration | Ki67+ CD4+ % | Ki67+ CD8+ % |
|---------------|--------------|--------------|
| 1000 nM       | 78.9         | 73.2         |
| 100 nM        | 58.3         | 52.7         |
| 10 nM         | 28.6         | 25.1         |
```

**Expected Results**:
- Different assay types detected per sheet
- Appropriate analysis for each type

## Test Case 8: Large Dataset
**File**: `large-dataset.xlsx`
**Description**: Many samples and concentration points

```
| TCE [nM] | S1 | S2 | S3 | ... | S20 |
|----------|----|----|----|----|-----|
| 10000    | 98 | 97 | 99 | ... | 96  |
| 3000     | 92 | 91 | 94 | ... | 90  |
| 1000     | 85 | 84 | 87 | ... | 83  |
| 300      | 72 | 71 | 74 | ... | 70  |
| 100      | 58 | 57 | 60 | ... | 56  |
| 30       | 38 | 37 | 40 | ... | 36  |
| 10       | 22 | 21 | 24 | ... | 20  |
| 3        | 12 | 11 | 14 | ... | 10  |
| 1        | 6  | 5  | 8  | ... | 4   |
| 0.3      | 3  | 2  | 5  | ... | 1   |
```

**Expected Results**:
- Performance acceptable (<15 seconds)
- All samples properly processed
- Memory usage within limits

## Test Case 9: Error Cases
**File**: `error-cases.xlsx`
**Description**: Common error scenarios

```
Sheet 1: Invalid Concentrations
| TCE      | Sample A | Sample B |
|----------|----------|----------|
| High     | 89.2     | 87.5     |
| Medium   | 65.3     | 63.8     |
| Low      | 35.7     | 33.2     |

Sheet 2: Missing Response Data
| TCE [nM] | Sample C | Sample D |
|----------|----------|----------|
| 1000     | 91.1     |          |
| 100      |          |          |
| 10       | 38.2     | 36.7     |
```

**Expected Results**:
- Clear error messages
- Suggestions for fixes
- Graceful handling without crashes

## Test Case 10: Real-World Complex File
**File**: `real-world-complex.xlsx`
**Description**: Combination of multiple challenges

```
| Date: 2024-08-03 |              | Experiment #1234     |            |
|                  |              |                      |            |
| TCE Concentration| CD4+ CD25+   | CD8+ CD25+          | Target     |
| (nM)             | Activation % | Activation %        | Lysis %    |
| 1.00E+03         | 82.3         | 79.1                | 8.5        |
| 1.00E+02         | 65.7         | 62.3                | 5.2        |
| 1.00E+01         | 38.9         | 35.6                | 2.1        |
| 1.00E+00         | 16.2         | 14.8                | 0.8        |
| 1.00E-01         | 4.7          | 3.9                 | 0.2        |
```

**Expected Results**:
- Confidence: Medium-High (70-85%)
- Multiple assay types detected
- Scientific notation handled correctly
- Extra header rows ignored

## Validation Criteria

For each test case, the system should:

1. **Parse Successfully**: No fatal errors during import
2. **Achieve Expected Confidence**: Meet or exceed confidence thresholds
3. **Detect Layout Correctly**: Identify proper data structure
4. **Convert Units Properly**: Standardize to nM
5. **Handle Edge Cases**: Graceful degradation for problems
6. **Provide Clear Feedback**: Meaningful error messages and suggestions
7. **Maintain Performance**: Process within reasonable time limits
8. **Preserve Data Integrity**: No data loss or corruption during import

## Performance Benchmarks

| Test Case | Expected Processing Time | Memory Usage | Confidence Score |
|-----------|-------------------------|--------------|------------------|
| Standard  | < 2 seconds            | < 50 MB      | > 90%           |
| Scientific| < 3 seconds            | < 50 MB      | > 85%           |
| Mixed     | < 5 seconds            | < 75 MB      | > 80%           |
| Complex   | < 8 seconds            | < 100 MB     | > 70%           |
| Large     | < 15 seconds           | < 200 MB     | > 85%           |
| Errors    | < 3 seconds            | < 50 MB      | < 50%           |

These test cases ensure the enhanced import system handles the full spectrum of real-world Excel files encountered in dose-response analysis.