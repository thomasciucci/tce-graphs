# nVitro Data Science Specialist - Usage Guide

## Quick Start

### How to Activate the Subagent

Use the Task tool to launch the data science specialist when you encounter science, data, or graphics challenges:

```
Task tool parameters:
- subagent_type: "general-purpose" 
- description: "Data science analysis"
- prompt: "[Your detailed request with scientific context]"
```

### When to Use This Subagent

**Primary Use Cases:**
- Curve fitting algorithm improvements
- Statistical method implementation  
- Data visualization enhancements
- Scientific chart design
- Algorithm optimization
- Data quality assessment

**Keywords that trigger usage:**
- Curve fitting, statistical analysis, confidence intervals
- Data visualization, chart design, publication quality
- EC50, Hill slope, dose-response modeling
- Algorithm optimization, performance improvement
- Outlier detection, model validation

## Example Usage Scenarios

### 1. Improving Curve Fitting Accuracy

**Situation:** Current 4PL fitting fails on ~5% of datasets

**How to activate:**
```markdown
Use Task tool with prompt:

"I need help improving curve fitting robustness in nVitro Studio. The current 4PL implementation in src/fitUtils.ts fails on about 5% of datasets, particularly those with:
- Few data points (< 6 concentrations)  
- High response variability
- Very steep or shallow curves

Current method uses grid search optimization. Need:
1. Analysis of failure modes
2. More robust optimization algorithms
3. Better parameter initialization
4. Fallback methods for difficult cases
5. Implementation in TypeScript

Please analyze the current code and provide production-ready improvements."
```

**Expected deliverables:**
- Analysis of convergence issues
- Enhanced optimization algorithms
- Robust parameter initialization
- Fallback fitting methods
- Comprehensive error handling
- Validation against problem datasets

### 2. Adding Statistical Features

**Situation:** Users want confidence intervals for EC50 values

**How to activate:**
```markdown
Use Task tool with prompt:

"Need to add statistical enhancements to nVitro Studio dose-response analysis. Currently only providing point estimates. Users requesting:

1. Confidence intervals for EC50, Hill slope, Top, Bottom
2. Model goodness-of-fit diagnostics
3. Parameter uncertainty quantification
4. Bootstrap confidence intervals option
5. Residual analysis plots

Current FittedCurve interface in src/types.ts needs extension. Results should integrate with existing visualization in src/components/ResultsDisplay.tsx.

Please design and implement these statistical enhancements with proper scientific rigor."
```

**Expected deliverables:**
- Extended TypeScript interfaces
- Confidence interval algorithms
- Bootstrap implementation
- Diagnostic functions
- Enhanced visualization components
- Statistical interpretation guidance

### 3. Publication-Quality Visualization

**Situation:** Charts need to meet scientific publication standards

**How to activate:**
```markdown
Use Task tool with prompt:

"The current chart visualization in src/components/ResultsDisplay.tsx needs enhancement for publication quality. Requirements:

1. Scientific color schemes (colorblind-accessible)
2. Proper error bar representation (SEM/SD/CI options)
3. Publication-standard formatting (Nature/Science guidelines)
4. High-resolution export capability
5. Multi-panel layouts for dataset comparison
6. Professional typography and spacing

Current implementation uses Recharts library. Need to maintain interactivity while achieving publication standards.

Please redesign the visualization system following scientific best practices."
```

**Expected deliverables:**
- Scientific color palette implementation
- Enhanced chart components
- Error bar customization
- Export quality optimization
- Multi-panel layout designs
- Typography and spacing improvements

### 4. Data Quality Assessment

**Situation:** Need automated data validation and QC tools

**How to activate:**
```markdown
Use Task tool with prompt:

"Need to implement comprehensive data quality assessment for nVitro Studio. Excel files often have:

1. Missing or invalid concentration values
2. Response values outside expected ranges
3. Inconsistent replicate patterns
4. Outliers that affect curve fitting
5. Poor experimental design (inadequate concentration ranges)

Need automated QC pipeline that:
- Validates data structure and types
- Detects outliers using statistical methods
- Assesses concentration range adequacy
- Flags potential experimental issues
- Provides actionable feedback to users

Should integrate with existing FileUpload component and data processing pipeline."
```

**Expected deliverables:**
- Data validation algorithms
- Outlier detection methods
- Quality metrics calculation
- User feedback system
- Integration with upload workflow
- Comprehensive error reporting

## Advanced Usage Patterns

### Complex Scientific Consultations

**Multi-part analysis requests:**
```markdown
"I need consultation on implementing advanced dose-response modeling:

Part 1: Current 4PL model limitations for our specific assay types
Part 2: Alternative models (3PL, 5PL, Weibull) implementation
Part 3: Model selection criteria and validation
Part 4: User interface for model selection
Part 5: Comparative analysis features

This is for biological assays measuring [specific endpoints]. Need scientifically rigorous approach with proper validation."
```

### Performance Optimization

**Large dataset handling:**
```markdown
"nVitro Studio needs optimization for large datasets (1000+ curves). Current performance bottlenecks:

1. Curve fitting takes too long for batch analysis
2. Chart rendering slows with many datasets
3. Export generation times are excessive
4. Memory usage grows with dataset size

Need performance analysis and optimization while maintaining scientific accuracy. Consider:
- Parallel processing opportunities
- Algorithm efficiency improvements
- Memory management optimization
- Progressive rendering techniques"
```

### Integration with External Tools

**Cross-platform compatibility:**
```markdown
"Need to enhance export compatibility with external scientific tools:

1. GraphPad Prism format improvements
2. R/Python data exchange formats
3. Statistical software integration
4. Metadata preservation in exports
5. Batch processing capabilities

Should maintain data integrity and statistical validity across platforms."
```

## Best Practices for Effective Usage

### 1. Provide Comprehensive Context

**Good request structure:**
```markdown
Context: [Scientific domain and specific problem]
Current implementation: [Relevant files and methods]
Requirements: [Specific needs and constraints]
Expected outcome: [Deliverables and success criteria]
Technical constraints: [Performance, compatibility, etc.]
```

### 2. Include Relevant Files

Always mention specific files when requesting code changes:
- `src/fitUtils.ts` - for algorithm improvements
- `src/types.ts` - for data structure changes
- `src/components/ResultsDisplay.tsx` - for visualization
- `src/utils/*.ts` - for export functionality

### 3. Specify Scientific Requirements

**Include:**
- Statistical rigor requirements
- Publication standards needed
- Validation criteria
- Performance constraints
- User experience considerations

### 4. Request Validation Approaches

Ask for:
- Test data recommendations
- Validation methods
- Benchmark comparisons
- Quality assurance steps

## Response Quality Expectations

### Scientific Accuracy
- All methods peer-reviewed or well-established
- Clear statement of assumptions
- Acknowledgment of limitations
- Appropriate uncertainty quantification

### Implementation Quality
- Production-ready TypeScript code
- Comprehensive error handling
- Clear documentation
- Integration with existing codebase

### User Experience
- Clear explanation of methods
- Practical implementation guidance
- Interpretation assistance
- Alternative approaches when appropriate

## Troubleshooting

### If Subagent Responses Are Too Technical
- Request simpler explanations
- Ask for practical implementation focus
- Specify user experience priorities

### If Responses Lack Scientific Rigor
- Emphasize statistical accuracy requirements
- Request references and validation
- Ask for assumption clarification

### If Implementation Doesn't Integrate Well
- Provide more context about existing code
- Specify integration constraints
- Request step-by-step implementation

## Follow-Up Actions

After receiving subagent recommendations:

1. **Review Implementation**: Check scientific accuracy and code quality
2. **Test with Real Data**: Validate with actual datasets
3. **User Testing**: Ensure usability improvements
4. **Documentation**: Update project documentation
5. **Performance Validation**: Benchmark any performance claims

## Documentation Updates

When implementing subagent solutions:
- Update `CHANGELOG.md` with new features
- Modify `ARCHITECTURE.md` if design changes
- Enhance `README.md` with new capabilities
- Update `CLAUDE.md` with implementation details