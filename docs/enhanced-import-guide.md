# Enhanced Excel Import Guide for nVitro Studio

## Overview

The Enhanced Excel Import system in nVitro Studio provides intelligent data detection and flexible parsing capabilities for dose-response analysis. This guide covers the features, usage, and troubleshooting for importing complex Excel files.

## Key Features

### 🔍 Intelligent Data Detection
- **Automatic Layout Recognition**: Detects column vs. row-oriented data layouts
- **Header Detection**: Identifies header rows with fuzzy matching
- **Concentration Column Detection**: Recognizes concentration data with various units
- **Assay Type Recognition**: Automatically detects common assay types (cytotoxicity, activation, etc.)
- **Quality Assessment**: Provides confidence scores and issue identification

### 🔧 Flexible Unit Handling
- **Multiple Units**: Supports M, mM, μM, nM, pM with automatic conversion
- **Scientific Notation**: Handles formats like "1E-6 M" or "2.5e-9"
- **Mixed Formats**: Processes "10 nM", "1.5μM", or plain numbers
- **Unit Detection**: Automatically detects and converts units to nM

### 📊 Advanced Parsing
- **Multiple Sheets**: Process multiple sheets with different formats
- **Complex Layouts**: Handle merged cells, empty rows, and irregular formatting
- **Data Validation**: Identifies and reports data quality issues
- **Preview with Highlighting**: Visual confirmation of detected data structure

## Supported Excel Formats

### Standard Column-Oriented Layout
```
| Concentration (nM) | Sample A | Sample B | Sample C |
|--------------------|----------|----------|----------|
| 1000               | 95.2     | 93.8     | 96.1     |
| 100                | 78.5     | 80.2     | 77.9     |
| 10                 | 45.3     | 43.7     | 47.1     |
| 1                  | 15.8     | 17.2     | 14.5     |
```

### Scientific Notation Format
```
| TCE [M]  | Cytotoxicity % | Activation % |
|----------|----------------|--------------|
| 1E-6     | 90.5          | 85.2         |
| 1E-7     | 75.3          | 70.8         |
| 1E-8     | 45.7          | 42.1         |
| 1E-9     | 15.2          | 12.8         |
```

### Mixed Unit Format
```
| Dose     | Response 1 | Response 2 |
|----------|------------|------------|
| 10 μM    | 92.3       | 89.7       |
| 1.5 μM   | 78.4       | 75.9       |
| 150 nM   | 52.1       | 48.6       |
| 15 nM    | 25.8       | 23.2       |
```

### Complex Header Layout
```
|          | Assay Results        |           |
|----------|---------------------|-----------|
| TCE [nM] | Replicate 1        | Replicate 2|
| 1000     | 95.2               | 93.8       |
| 100      | 78.5               | 80.2       |
| 10       | 45.3               | 43.7       |
```

## Usage Guide

### Step 1: Choose Import Mode

**Enhanced Mode** (Recommended)
- Intelligent data detection
- Support for complex formats
- Interactive preview and validation
- Manual configuration options

**Legacy Mode**
- Simple, fast import
- Backward compatibility
- Best for well-formatted files

### Step 2: Upload Excel File

1. Click "Choose Excel File"
2. Select your .xlsx or .xls file
3. Wait for automatic analysis

### Step 3: Review Detection Results

The system will display:
- **Confidence Score**: High (>80%), Medium (60-80%), Low (<60%)
- **Detected Layout**: Column/row orientation
- **Issues Found**: Errors, warnings, and suggestions
- **Data Preview**: Visual confirmation with highlighting

### Step 4: Configure Import (if needed)

For files with low confidence scores:
1. Review detected issues
2. Use manual configuration if needed
3. Adjust header row, data range, or column assignments
4. Validate configuration before importing

### Step 5: Import Data

1. Select sheets to import
2. Choose between merging multiple datasets or keeping separate
3. Click "Import Selected Data"

## Confidence Scoring

### High Confidence (80-100%)
- Clear header structure detected
- Valid concentration dilution series
- Recognized assay type
- Proper data formatting

### Medium Confidence (60-79%)
- Some ambiguity in layout detection
- Minor formatting issues
- Concentration pattern detected but units unclear
- Manual review recommended

### Low Confidence (<60%)
- Significant detection issues
- Unclear data structure
- Missing or invalid concentration data
- Manual configuration likely needed

## Common Issues and Solutions

### Issue: "No concentration column detected"
**Cause**: No clear concentration keywords or numeric pattern found
**Solution**: 
- Use manual configuration to specify concentration column
- Ensure concentration values are numeric
- Add unit information to headers (e.g., "TCE [nM]")

### Issue: "Insufficient data points"
**Cause**: Less than 3 data points detected
**Solution**:
- Check for empty rows within data
- Verify data range selection
- Ensure concentration values are properly formatted

### Issue: "Invalid concentration values"
**Cause**: Non-numeric or negative concentration values
**Solution**:
- Check for text in concentration column
- Remove or fix invalid entries
- Use scientific notation correctly (1E-6, not 1x10^-6)

### Issue: "Mixed concentration units"
**Cause**: Inconsistent unit usage within same column
**Solution**:
- Standardize units within each column
- Use consistent formatting (all "nM" or all "μM")
- Let the system auto-convert between sheets

## Advanced Features

### Manual Configuration
When automatic detection fails:
1. **Header Row**: Specify which row contains column names
2. **Data Range**: Define start and end rows for data
3. **Column Assignment**: Manually assign concentration and response columns
4. **Sample Names**: Edit sample/column names

### Multiple Sheet Handling
Options for multiple sheets:
- **Separate Analysis**: Analyze each sheet independently
- **Merge Data**: Combine all sheets into single dataset
- **Selective Import**: Choose specific sheets to include

### Data Validation
Before import, the system checks for:
- Minimum data points (3+ required)
- Valid concentration ranges
- Numeric response values
- Consistent data formatting

## Tips for Best Results

### Excel File Preparation
1. **Clear Headers**: Use descriptive column names with units
2. **Consistent Formatting**: Keep number formats consistent within columns
3. **Remove Empty Rows**: Clean up data between valid entries
4. **Unit Specification**: Include units in headers (e.g., "[nM]")

### Concentration Data
1. **Dilution Series**: Use log-scale dilutions (10x, 3x, etc.)
2. **Proper Range**: Include appropriate concentration range for assay
3. **Scientific Notation**: Use standard format (1E-6, not 1×10^-6)
4. **Unit Consistency**: Use same unit within each file/sheet

### Response Data
1. **Numeric Values**: Ensure all response values are numbers
2. **Consistent Scale**: Use same measurement scale (%, absolute values)
3. **Missing Data**: Leave cells empty rather than using text placeholders
4. **Replicates**: Group technical replicates logically

## Error Messages and Meanings

| Error Message | Meaning | Action Required |
|---------------|---------|-----------------|
| "Failed to parse Excel file format" | File is corrupted or not valid Excel | Check file integrity, try re-saving |
| "No valid datasets found" | No recognizable data structure | Use manual configuration |
| "Concentration column contains non-numeric data" | Invalid values in concentration column | Clean concentration data |
| "Insufficient response columns" | Less than 1 response column detected | Check data layout, verify columns |
| "Data range too small" | Less than 3 data points | Add more concentration points |

## Performance Considerations

### File Size Limits
- **Recommended**: < 10 MB for optimal performance
- **Maximum**: 50 MB (may be slower)
- **Sheets**: Up to 20 sheets per workbook

### Processing Time
- **Simple files**: < 2 seconds
- **Complex files**: 5-15 seconds
- **Large files**: Up to 30 seconds

### Memory Usage
- Client-side processing only
- Memory usage scales with file size
- Large files may require browser refresh if memory issues occur

## Troubleshooting

### Performance Issues
1. Close other browser tabs
2. Use smaller files when possible
3. Process sheets individually for very large files
4. Refresh browser if memory issues occur

### Detection Problems
1. Try legacy mode for simple, well-formatted files
2. Use manual configuration for complex layouts
3. Clean up Excel file formatting before import
4. Split complex files into simpler sheets

### Import Failures
1. Check console for detailed error messages
2. Verify file is not password protected
3. Ensure file is not corrupted
4. Try saving Excel file in newest format (.xlsx)

## API Reference

For developers extending the system:

### Core Functions
- `parseExcelFile(file, options)`: Main parsing function
- `detectDataLayout(sheetData)`: Layout detection
- `parseConcentration(text)`: Concentration parsing
- `isConcentrationColumn(values)`: Column type detection

### Configuration Options
- `autoDetect`: Enable/disable automatic detection
- `minimumDataPoints`: Minimum required data points
- `maxPreviewRows`: Rows shown in preview
- `preferredOrientation`: Hint for layout detection

## Support and Feedback

For additional support or to report issues:
1. Check this documentation first
2. Try both Enhanced and Legacy modes
3. Export detection report for troubleshooting
4. Contact support with specific file examples

The Enhanced Import system is designed to handle the vast majority of real-world Excel formats while providing clear feedback and options for edge cases.