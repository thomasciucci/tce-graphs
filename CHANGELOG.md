# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Created comprehensive project documentation:
  - README.md with project overview and quick start guide
  - DEVELOPMENT.md with development workflows and guidelines  
  - ARCHITECTURE.md documenting system design and components
  - CLAUDE.md for Claude Code configuration and project context
  - CHANGELOG.md for tracking project changes
- Created specialized Data Science Subagent system:
  - SUBAGENT_SPEC.md with detailed agent specifications
  - AGENT_PROMPT.md with agent prompt template and capabilities
  - AGENT_INTEGRATION.md documenting integration patterns
  - AGENT_USAGE.md with usage examples and best practices
  - agent-config.json with configuration parameters
- Implemented comprehensive Excel import enhancement system:
  - Enhanced data detection with intelligent header and concentration recognition
  - Flexible parsing architecture with modular components and error recovery
  - Interactive preview modal with manual override capabilities  
  - Comprehensive error handling and data repair utilities
  - Testing framework with 20+ test cases for various Excel formats
  - IMPORT_ENHANCEMENT_GUIDE.md with complete implementation documentation

## [Previous Changes from Git History]

### Fixed
- Fix PowerPoint export chart image handling (a373ef1)

### Added
- Implement working PowerPoint export functionality (a9256cb)
- Add PowerPoint export functionality with aligned button layout (e73fac2)
- Add bar chart support to PDF export functionality (5649041)

### Changed
- Update app background to shaded burgundy and rebrand to nVitro Studio (efe60cc)