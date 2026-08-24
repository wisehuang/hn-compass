## ADDED Requirements

### Requirement: Safe article acquisition
The article fetcher SHALL accept only HTTP or HTTPS URLs, reject loopback, private, link-local, multicast, unspecified, and non-routable destinations, validate each redirect target, follow no more than three redirects, timeout after ten seconds, and read no more than 2 MiB. It SHALL sanitize extracted HTML to plain text before model input.

#### Scenario: Redirect reaches a private address
- **WHEN** a public article URL redirects to a private IP address
- **THEN** the fetcher stops before requesting the private destination and records an unsafe-URL failure

### Requirement: Validated Traditional Chinese article summaries
The generator SHALL send source content as quoted untrusted material to the OpenAI Responses API and validate structured output with Zod. A valid article summary SHALL contain `tldr`, `keyPoints`, `caveats`, `readerValue`, and `sourceLanguage` in Traditional Chinese while retaining useful English technical terms.

#### Scenario: Article response matches schema
- **WHEN** the model returns all required article fields with valid types
- **THEN** the application persists the JSON payload with its model, prompt version, input hash, and generation timestamp

### Requirement: Evidence-grounded discussion summaries
The generator SHALL produce `overview`, nullable `consensus`, supporting and dissenting viewpoints with persisted representative comment IDs, practical takeaways, and unresolved questions. It SHALL set consensus to null when evidence is sparse or materially mixed and SHALL NOT invent comment IDs, claims, citations, or facts.

#### Scenario: Mixed comment evidence
- **WHEN** collected comments present materially conflicting viewpoints without a dominant position
- **THEN** the persisted discussion payload has `consensus` set to null and identifies supported viewpoints only with stored comment IDs

### Requirement: Summary failure and regeneration control
The application SHALL persist malformed model output or generation failures as diagnostic work status without publishing it. It SHALL generate summaries only during ingestion or an authenticated regeneration operation, with OpenAI concurrency no greater than two.

#### Scenario: Model returns an invalid payload
- **WHEN** a model response omits a required discussion field
- **THEN** Zod validation fails, no invalid payload is available to public readers, and the failure remains retryable
