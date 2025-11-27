---
"wellcrafted": minor
---

feat(error): add typed context and cause support to createTaggedError

Introduces three usage modes for `createTaggedError`:

1. **Flexible mode**: Context and cause are optional with any shape
2. **Fixed context mode**: Context is required with an exact type
3. **Both fixed mode**: Context required, cause constrained to specific type

The `TaggedError` type now uses conditional types so that `context` and `cause` properties only exist when specified, making the types more precise.

```typescript
// Mode 1: Flexible
const { NetworkError } = createTaggedError('NetworkError');
NetworkError({ message: 'Timeout' });
NetworkError({ message: 'Timeout', context: { url: '...' } });

// Mode 2: Fixed context (context required)
type BlobContext = { filename: string; code: 'INVALID' | 'TOO_LARGE' };
const { BlobError } = createTaggedError<'BlobError', BlobContext>('BlobError');
BlobError({ message: 'Invalid', context: { filename: 'x', code: 'INVALID' } });

// Mode 3: Both fixed
const { ApiError } = createTaggedError<'ApiError', ApiContext, NetworkError>('ApiError');
```
