# Claude Configuration

This file contains configuration and context for Claude Code to help with development tasks in this project.

## Project Overview
nVitro Studio is a professional dose-response analysis tool for biological assays. It's a Next.js 15 web application that processes Excel files, performs four-parameter logistic curve fitting, and generates comprehensive reports.

## Key Commands
- Development: `npm run dev` (with Turbopack)
- Build: `npm run build`
- Production: `npm run start`
- Lint: `npm run lint`
- TypeScript check: Available but not in package.json scripts

## Project Structure
```
src/
├── app/                    # Next.js app router
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main application (1000+ lines)
├── components/            # React components
│   ├── CurveFitter.tsx    # Curve fitting interface
│   ├── DataEditor.tsx     # Data editing interface
│   ├── FileUpload.tsx     # File upload component
│   ├── ResultsDisplay.tsx # Chart and results display
│   ├── PowerPointExport.tsx # PowerPoint export
│   ├── PrismExportModal.tsx # Prism export modal
│   ├── CurveNameEditor.tsx
│   └── UnifiedColumnReplicateEditor.tsx
├── utils/                 # Utility functions
│   ├── csvExport.ts       # CSV export utilities
│   ├── pdfExport.ts       # PDF generation
│   ├── pptExport.ts       # PowerPoint generation
│   ├── prismExport.ts     # Prism format export
│   └── prismExportSimple.ts
├── fitUtils.ts            # Core curve fitting algorithms
└── types.ts               # TypeScript type definitions
```

## Core Features
- Excel file upload and processing (.xls, .xlsx)
- Four-parameter logistic regression curve fitting
- Interactive chart visualization (Recharts)
- Multi-dataset support with replicate handling
- Export to PDF, PowerPoint, and Prism formats
- Real-time data editing capabilities

## Key Technologies
- Next.js 15 with React 19
- TypeScript for type safety
- Tailwind CSS for styling
- Recharts for data visualization
- XLSX for Excel file parsing
- jsPDF + html2canvas for PDF export
- Headless UI for accessible components

## Development Notes
- Large main page component (1000+ lines) - could benefit from refactoring
- Complex state management with multiple dataset tracking
- Client-side only processing (no backend)
- Recent focus on PowerPoint and PDF export improvements
- Uses advanced React patterns (forwardRef, useMemo, useCallback)
- Comprehensive error handling for file operations

## Data Flow
1. Excel file upload → XLSX parsing
2. Data configuration (column names, replicates)
3. Four-parameter logistic curve fitting
4. Interactive visualization and editing
5. Export to various formats (PDF, PowerPoint, Prism)

## Common Tasks
- Curve fitting algorithm improvements are in `fitUtils.ts`
- Export functionality is in `utils/` directory
- Chart modifications are in `ResultsDisplay.tsx`
- Main application logic is in `app/page.tsx`

## Workflow Modes (Current)
The application now supports two main workflow modes:

1. **Visual Selection Mode** (Default, gate-based)
   - Uses `SimpleFileUpload` → `GateSelector` 
   - Enhanced pattern detection with visual gate selection
   - Supports bidirectional, multi-dilution, outlier-tolerant detection

2. **Legacy Mode** (Advanced users)
   - Uses `SmartFileUpload` → `FileUpload`
   - Traditional tabular import with enhanced detection backend
   - Same detection capabilities as Visual Selection mode

## Enhanced Mode Files - ARCHIVED FOR FUTURE CLEANUP
The following files were part of an intermediate "Enhanced Mode" that has been simplified out of the workflow but should be kept for potential future integration or cleanup:

### Enhanced Components (64 untracked files):
- `src/components/EnhancedFileUpload.tsx`
- `src/components/EnhancedDataPreviewModal.tsx`
- `src/components/SmartPreviewDashboard.tsx`
- `src/components/GuidedCorrectionWorkflow.tsx`
- `src/components/RealTimeQualityAssessment.tsx`
- `src/components/ManualDataConfig.tsx`
- Plus ~58 other enhanced components and utilities

### Enhanced Utils (39 utility files):
- `src/utils/enhancedDetection.ts`
- `src/utils/enhancedParser.ts`
- `src/utils/adaptivePatternDetector.ts`
- `src/utils/biologicalDatasetSegmentation.ts`
- `src/utils/robustDetectionEngine.ts`
- `src/utils/scientificDetection.ts`
- `src/utils/scientificValidator.ts`
- Plus ~32 other enhanced utilities

### Test Files:
- `src/utils/__tests__/` directory
- `src/utils/testRunner.ts`
- `src/utils/enhancedTestFramework.ts`
- Various testing utilities

**Note**: These files contain advanced pattern detection logic that was successfully integrated into the main detection pipeline (`enhancedDosePatternDetection.ts`). They can be safely removed once the simplified workflow is confirmed working properly.

## Specialized Subagents Available

### nVitro Data Science Specialist
Use for science/data/statistical analysis questions:

**Activate when working on:**
- Curve fitting algorithm improvements
- Statistical method implementation
- Algorithm optimization
- Data quality assessment
- Scientific method validation

**How to activate:**
```
Use Task tool with:
- subagent_type: "general-purpose"
- description: "Data science analysis" 
- prompt: "[Detailed scientific context and requirements]"
```

### nVitro Data Graphist
Use for visualization/graphics/export questions:

**Activate when working on:**
- Chart design and customization
- Publication-quality graphics
- Multi-format export (PDF, PowerPoint, GraphPad Prism)
- Color schemes and typography
- Interactive visualization features
- Template and styling systems

**How to activate:**
```
Use Task tool with:
- subagent_type: "general-purpose"
- description: "Data visualization design"
- prompt: "[Detailed visualization and export requirements]"
```

**Key files both agents work with:**
- `src/fitUtils.ts` - Curve fitting algorithms
- `src/types.ts` - Data structure definitions
- `src/components/ResultsDisplay.tsx` - Chart visualization
- `src/utils/pdfExport.ts` - PDF generation
- `src/utils/pptExport.ts` - PowerPoint export
- `src/utils/prismExport.ts` - GraphPad Prism export

**Documentation available:**
- `SUBAGENT_SPEC.md` - Data Science Specialist specifications
- `DATA_GRAPHIST_SPEC.md` - Data Graphist specifications
- `AGENT_PROMPT.md` - Data Science Specialist prompt
- `DATA_GRAPHIST_PROMPT.md` - Data Graphist prompt
- `agent-config.json` - Data Science Specialist configuration
- `data-graphist-config.json` - Data Graphist configuration