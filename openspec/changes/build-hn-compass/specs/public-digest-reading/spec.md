## ADDED Requirements

### Requirement: Latest daily editorial reading page
The home page SHALL render the latest persisted digest with date, archive navigation, story rank, title, source domain, article preview, discussion preview, comment count, original article link, HN discussion link, and internal detail link. It SHALL render explicit empty and failure states when no digest projection is available.

#### Scenario: Latest digest exists
- **WHEN** a reader opens `/` after a digest is persisted
- **THEN** every displayed story includes both original-source links and a link to its detail page

### Requirement: Immutable daily archive rendering
The `/daily/[date]` page SHALL render only the persisted snapshot for a valid digest date and SHALL NOT trigger RSS, Firebase, article, or OpenAI network work during a public GET request. A missing digest date SHALL render a friendly not-found state.

#### Scenario: Archive date is absent
- **WHEN** a reader opens `/daily/2026-08-24` and that date has no persisted digest
- **THEN** the page renders a not-found state without contacting an upstream provider

### Requirement: Source-grounded story detail rendering
The `/stories/[storyId]` page SHALL show story metadata, source links, structured article insight, structured discussion insight, representative sanitized comments, summary generated timestamp, AI model, prompt version, and an AI-generated-content disclosure. It SHALL never render raw external article or HN comment HTML.

#### Scenario: Story has both summaries
- **WHEN** a reader opens a persisted story with article and discussion summary payloads
- **THEN** the page shows all required sections and external source links with readable labels

### Requirement: Accessible JellyUI editorial interface
The interface SHALL use JellyUI as its primary primitive and token system, support light and dark modes, use restrained HN-orange accents, provide semantic landmarks and headings, expose visible keyboard focus, and remain readable on mobile and desktop widths.

#### Scenario: Keyboard navigation
- **WHEN** a keyboard-only reader tabs through story actions
- **THEN** each interactive control has a visible focus indicator and an accessible name
