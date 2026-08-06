# Export Engine

The Export Engine consumes only `ReportsService`; it does not issue financial queries or persist generated files. The protected export endpoint selects one of the eleven allow-listed reports and renders its structured response in CSV, XLSX, or PDF.

CSV uses UTF-8 with BOM and RFC-style quoting. Text cells starting with `=`, `+`, or `@` are prefixed with an apostrophe to prevent spreadsheet formula execution; monetary strings, including negative amounts, remain unchanged. XLSX uses text cells for values and applies the same formula protection. PDF is generated locally with PDFKit, has no remote HTML, fonts, images, or sensitive identifiers.

All downloads are `private, no-store`, set `nosniff`, have sanitized filenames, and are held only in memory. Limits are 10,000 rows for CSV/XLSX and 2,000 for PDF. Audit metadata records only report type, format, currency, row count, and byte size. Future large exports should move to background jobs and object storage.

## Final validation

Authenticated local smoke requests for summary exports completed for CSV, XLSX, and PDF. Each response returned a download buffer with the expected content type and security headers. The smoke uncovered and corrected explicit NestJS renderer injection in `ExportsService`; no financial query or rendering rule was changed. The full project validation passed: Prisma validation and generation, typecheck, all tests, lint, build, and `git diff --check`.
