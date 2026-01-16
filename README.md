# @famgia/omnify-atlas

Atlas CLI integration for Omnify schemas. Generate HCL schemas and compute database diffs.

## Installation

```bash
npm install @famgia/omnify-atlas
```

## Prerequisites

[Atlas CLI](https://atlasgo.io/getting-started/) must be installed:

```bash
# macOS
brew install ariga/tap/atlas

# Linux
curl -sSf https://atlasgo.sh | sh
```

## Usage

```typescript
import {
  generateHCL,
  runAtlasDiff,
  AtlasRunner,
  HCLGenerator
} from '@famgia/omnify-atlas';

// Generate Atlas HCL from schemas
const hcl = generateHCL(schemas, {
  dialect: 'mysql',
});

// Run Atlas diff
const diff = await runAtlasDiff({
  from: 'file://schema.hcl',
  to: 'mysql://user:pass@localhost:3306/db',
});
```

## Features

- HCL schema generation from Omnify schemas
- Atlas CLI wrapper for diffing
- Support for MySQL, PostgreSQL, SQLite
- Lock file management
- Migration preview

## Generated HCL

```hcl
table "users" {
  schema = schema.main

  column "id" {
    type = bigint
    auto_increment = true
  }

  column "email" {
    type = varchar(255)
  }

  primary_key {
    columns = [column.id]
  }

  index "users_email_unique" {
    columns = [column.email]
    unique = true
  }
}
```

## Related Packages

- [@famgia/omnify-core](https://www.npmjs.com/package/@famgia/omnify-core) - Core engine
- [@famgia/omnify-cli](https://www.npmjs.com/package/@famgia/omnify-cli) - CLI tool
- [@famgia/omnify-laravel](https://www.npmjs.com/package/@famgia/omnify-laravel) - Laravel generator

## License

MIT
