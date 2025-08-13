# Development Guide

This document provides guidelines for developing and contributing to nVitro Studio.

## Development Environment Setup

### Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Comes with Node.js (or use yarn/pnpm)
- **Git**: For version control
- **Code Editor**: VS Code recommended with TypeScript extensions

### Initial Setup

```bash
# Clone the repository
git clone [repository-url]
cd tce-graphs

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000` with hot reloading enabled.

## Project Scripts

```bash
# Development
npm run dev          # Start development server with Turbopack
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript compiler check (if available)
```

## Development Workflow

### 1. Feature Development

1. Create a feature branch from `main`
2. Make your changes following the coding standards
3. Test your changes thoroughly
4. Run linting and type checking
5. Create a pull request

### 2. Testing

Currently the project uses manual testing. Test the following functionality:

- **File Upload**: Test with various Excel file formats
- **Data Editing**: Verify inline editing works correctly
- **Curve Fitting**: Test with different dataset types
- **Export Functions**: Verify PDF, PowerPoint, and Prism exports
- **Multi-Dataset**: Test with multiple table imports
- **Responsive Design**: Test on different screen sizes

### 3. Code Quality

- **ESLint**: Follow the configured linting rules
- **TypeScript**: Maintain strict typing
- **Code Formatting**: Use consistent formatting
- **Error Handling**: Include proper error handling for file operations

## Architecture Guidelines

### Component Structure

- Keep components focused on single responsibilities
- Use TypeScript interfaces for props
- Implement proper error boundaries
- Follow React best practices for hooks and state management

### State Management

- Use React's built-in state management (useState, useEffect)
- Implement proper data flow patterns
- Avoid prop drilling with context when necessary
- Maintain immutable state updates

### File Organization

```
src/
├── app/              # Next.js app router files
├── components/       # Reusable React components
├── utils/           # Utility functions and helpers
├── types.ts         # TypeScript type definitions
└── fitUtils.ts      # Core curve fitting algorithms
```

## Coding Standards

### TypeScript

- Use strict typing throughout the codebase
- Define interfaces for all data structures
- Avoid `any` type - use proper typing
- Use generics where appropriate

### React Components

```typescript
// Preferred component structure
interface ComponentProps {
  data: DataPoint[];
  onUpdate: (data: DataPoint[]) => void;
}

export default function Component({ data, onUpdate }: ComponentProps) {
  // Component logic
  return (
    // JSX
  );
}
```

### Styling

- Use Tailwind CSS for all styling
- Follow utility-first approach
- Use consistent color scheme (burgundy theme)
- Implement responsive design patterns

### Error Handling

```typescript
// File operations
try {
  const result = await processFile(file);
  return result;
} catch (error) {
  console.error('File processing failed:', error);
  // Show user-friendly error message
}
```

## Key Dependencies

### Core Framework
- **Next.js 15**: React framework with app router
- **React 19**: UI library
- **TypeScript**: Type safety

### UI & Styling
- **Tailwind CSS**: Utility-first CSS framework
- **Headless UI**: Accessible UI components
- **Recharts**: Chart visualization library

### Data Processing
- **XLSX**: Excel file parsing
- **jsPDF**: PDF generation
- **html2canvas**: Chart image capture

## Common Development Tasks

### Adding New Export Format

1. Create new utility file in `src/utils/`
2. Define export interface in `types.ts`
3. Add export button to main interface
4. Implement error handling and user feedback

### Adding New Chart Type

1. Extend `FittedCurve` interface if needed
2. Add chart component to `ResultsDisplay.tsx`
3. Update chart settings in global state
4. Test with various data formats

### Modifying Curve Fitting

1. Update algorithms in `fitUtils.ts`
2. Ensure backward compatibility
3. Update `FittedCurve` interface if parameters change
4. Test with existing sample data

## Performance Considerations

- **File Processing**: Handle large Excel files efficiently
- **Chart Rendering**: Optimize for datasets with many data points
- **State Updates**: Minimize unnecessary re-renders
- **Memory Usage**: Clean up resources after file processing

## Browser Support

- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **Mobile**: Responsive design for tablet and mobile devices
- **File API**: Requires modern browser with File API support

## Debugging

### Common Issues

1. **File Upload Errors**: Check file format and size limits
2. **Chart Rendering**: Verify data format matches expected interface
3. **Export Failures**: Check browser permissions and file size
4. **TypeScript Errors**: Ensure all interfaces are properly defined

### Development Tools

- **React Developer Tools**: For component debugging
- **Browser DevTools**: For performance and network debugging
- **TypeScript Compiler**: For type checking
- **ESLint**: For code quality issues

## Deployment

### Production Build

```bash
npm run build
npm run start
```

### Environment Variables

Currently no environment variables are required for basic functionality.

### Static Export (if needed)

The application can be configured for static export by modifying `next.config.ts` if deployment to static hosting is required.

## Contributing Guidelines

1. **Code Review**: All changes should be reviewed
2. **Documentation**: Update documentation for new features
3. **Testing**: Thoroughly test all changes
4. **Changelog**: Update CHANGELOG.md for significant changes
5. **Versioning**: Follow semantic versioning principles

## Troubleshooting

### Development Server Issues

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### TypeScript Issues

```bash
# Check for type errors
npx tsc --noEmit
```

### Build Issues

```bash
# Clean build
rm -rf .next
npm run build
```