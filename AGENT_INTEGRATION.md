# Data Science Subagent Integration Guide

## Overview

This document describes how to integrate and use the nVitro Data Science Specialist subagent within the nVitro Studio development workflow.

## Integration Patterns

### 1. Task-Based Activation

The subagent should be activated for specific categories of work:

#### Scientific Analysis Tasks
```
- Curve fitting algorithm improvements
- Statistical method implementation
- Model validation and diagnostics
- Parameter interpretation guidance
- Experimental design consultation
```

#### Data Processing Tasks
```
- Data quality assessment
- Outlier detection implementation
- Data transformation algorithms
- Multi-dataset analysis methods
- Performance optimization for large datasets
```

#### Visualization Tasks
```
- Chart design and customization
- Color scheme implementation
- Publication-ready export formatting
- Interactive visualization features
- Accessibility improvements
```

### 2. Code Integration Workflow

#### Step 1: Problem Assessment
When you encounter science/data/graphics challenges:

```typescript
// Example: Need to improve curve fitting
const issue = {
  area: "curve-fitting",
  problem: "Poor fits for steep dose-response curves",
  context: "4PL model struggles with Hill slopes > 3",
  files: ["src/fitUtils.ts", "src/types.ts"]
};
```

#### Step 2: Subagent Activation
Activate the subagent with specific context:

```markdown
@DataScienceSpecialist

I need help improving curve fitting for steep dose-response curves. The current 4PL implementation in `src/fitUtils.ts` struggles with Hill slopes > 3, leading to poor parameter estimation.

Current implementation uses grid search optimization. Need:
1. Better parameter initialization
2. Constraint handling for extreme slopes
3. Alternative optimization methods
4. Validation against known datasets

Please analyze the current code and propose improvements.
```

#### Step 3: Implementation Integration
The subagent will provide:
- Scientifically rigorous analysis
- Production-ready TypeScript code
- Proper error handling
- Documentation and comments
- Testing suggestions

### 3. File-Specific Integration Points

#### Core Algorithm Files
**`src/fitUtils.ts`** - Curve fitting algorithms
```typescript
// Subagent can enhance:
- Parameter optimization methods
- Alternative curve models
- Constraint handling
- Confidence interval calculation
- Robust fitting methods
```

**`src/types.ts`** - Data structure definitions
```typescript
// Subagent can add:
- Statistical result interfaces
- Model parameter types
- Quality metrics structures
- Validation result types
```

#### Visualization Files
**`src/components/ResultsDisplay.tsx`** - Chart rendering
```typescript
// Subagent can improve:
- Scientific chart layouts
- Color scheme implementations
- Error bar representations
- Interactive features
- Accessibility enhancements
```

#### Export Utilities
**`src/utils/pdfExport.ts`** - PDF generation
**`src/utils/pptExport.ts`** - PowerPoint export
```typescript
// Subagent can optimize:
- Publication-quality formatting
- Chart image capture
- Statistical summary layouts
- Template designs
```

## Usage Examples

### Example 1: Improving Curve Fitting

**Request:**
```markdown
@DataScienceSpecialist

The current curve fitting occasionally fails with this error: "Optimization did not converge". 
This happens with about 5% of datasets, particularly those with:
- Few data points (< 6 concentrations)
- High variability in responses
- Steep or shallow curves

Can you analyze the issue and implement more robust fitting?
```

**Expected Response:**
- Analysis of convergence failure causes
- Implementation of robust optimization methods
- Parameter initialization improvements
- Fallback algorithms for difficult cases
- Validation with problematic datasets

### Example 2: Statistical Enhancement

**Request:**
```markdown
@DataScienceSpecialist

Users want confidence intervals for EC50 values. Currently we only provide point estimates. 
Need to implement:
1. Confidence intervals for all fitted parameters
2. Model fit diagnostics (R², residual plots)
3. Parameter correlation matrix
4. Bootstrap confidence intervals as an option

Please design and implement these statistical enhancements.
```

**Expected Response:**
- Statistical theory explanation
- Implementation of confidence interval methods
- Bootstrap resampling algorithm
- Diagnostic plot functions
- User interface integration suggestions

### Example 3: Visualization Improvement

**Request:**
```markdown
@DataScienceSpecialist

The current charts don't meet publication standards. Need improvements for:
1. Scientific color schemes (colorblind-friendly)
2. Error bar representation (SEM vs SD options)
3. Multi-panel layouts for comparing datasets
4. Vector export capability (SVG)
5. Annotation features for highlighting key points

Please redesign the visualization system.
```

**Expected Response:**
- Scientific visualization principles
- Publication-standard color palettes
- Enhanced chart component implementations
- Export format optimizations
- Interactive annotation features

## Best Practices

### 1. Context Provision
Always provide the subagent with:
- Specific problem description
- Relevant file locations
- Current implementation details
- Scientific requirements/constraints
- User experience considerations

### 2. Quality Validation
After subagent implementation:
- Review scientific accuracy
- Test with diverse datasets
- Validate against known standards
- Check integration with existing code
- Verify user experience improvements

### 3. Documentation Updates
When integrating subagent solutions:
- Update ARCHITECTURE.md if design changes
- Add method descriptions to README.md
- Document new features in CHANGELOG.md
- Update CLAUDE.md with new capabilities

## Collaboration Workflow

### Primary Developer + Subagent
```
1. Developer identifies science/data/graphics challenge
2. Developer activates subagent with detailed context
3. Subagent provides scientifically rigorous solution
4. Developer reviews and integrates solution
5. Developer validates with real data/users
6. Developer documents implementation
```

### Quality Assurance Process
```
1. Scientific accuracy review
2. Code quality assessment
3. Integration testing
4. User experience validation
5. Performance benchmarking
6. Documentation completeness
```

## Common Integration Patterns

### Algorithm Enhancement
```typescript
// Before: Simple implementation
function fitCurve(x: number[], y: number[]): FittedCurve {
  // Basic grid search
}

// After: Subagent-enhanced implementation
function fitCurve(
  x: number[], 
  y: number[], 
  options: FittingOptions = {}
): FittedCurve {
  // Robust optimization with multiple methods
  // Confidence intervals
  // Quality diagnostics
  // Error handling
}
```

### Visualization Enhancement
```typescript
// Before: Basic chart
<Line data={data} stroke="blue" />

// After: Subagent-enhanced chart
<Line 
  data={data} 
  stroke={scientificColorPalette[index]}
  strokeWidth={2}
  strokeDasharray={curveStyle}
  connectNulls={false}
/>
<ErrorBar dataKey="error" width={4} />
```

### Statistical Integration
```typescript
// Before: Point estimates only
interface FittedCurve {
  ec50: number;
  hillSlope: number;
  rSquared: number;
}

// After: Comprehensive statistics
interface FittedCurve {
  ec50: ParameterEstimate;
  hillSlope: ParameterEstimate;
  rSquared: number;
  diagnostics: ModelDiagnostics;
  confidenceIntervals: ConfidenceIntervals;
}
```

## Troubleshooting

### Common Issues
1. **Integration Conflicts**: Ensure subagent solutions integrate cleanly with existing code
2. **Performance Impact**: Validate that enhanced algorithms don't slow down the application
3. **User Experience**: Ensure scientific rigor doesn't compromise usability
4. **Maintenance**: Document complex algorithms for future maintenance

### Resolution Strategies
1. **Iterative Integration**: Implement subagent solutions gradually
2. **Fallback Methods**: Maintain simpler alternatives for edge cases
3. **User Controls**: Allow users to choose between simple and advanced methods
4. **Clear Documentation**: Explain when and why to use different approaches