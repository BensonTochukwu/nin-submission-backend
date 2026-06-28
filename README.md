# NYSC Form Collector Backend

NestJS backend for NYSC form collection with Prisma/Postgres, Redis/BullMQ document compression, private S3/R2-compatible storage, Swagger docs, and Postman testing.

## Stack

- NestJS, class-validator DTOs, Swagger
- Prisma + PostgreSQL
- BullMQ + Redis
- Ghostscript PDF compression
- S3/R2-compatible private object storage with signed admin download URLs

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file and point the services at your local or hosted infrastructure. The app defaults to localhost values when variables are omitted:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nysc_forms"
REDIS_HOST="localhost"
REDIS_PORT="6379"
JWT_SECRET="change_me"
PORT="3000"
APP_URL="http://localhost:3000"
S3_ENDPOINT="http://localhost:9000"
S3_REGION="us-east-1"
S3_BUCKET="nysc-forms"
S3_ACCESS_KEY_ID="your-access-key"
S3_SECRET_ACCESS_KEY="your-secret-key"
S3_FORCE_PATH_STYLE="true"
```

3. Generate Prisma Client, run migrations, and seed the initial admin:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

4. Start the API and PDF worker in separate terminals:

```bash
npm run start:dev
npm run worker:dev
```

5. Open Swagger:

```text
http://localhost:3000/docs
```

Seeded super admin:

```text
email: admin@nysc.local
password: Password123!
```

## Useful Commands

```bash
npm run build
npm run start:dev
npm run worker:dev
npm run prisma:migrate
npm run prisma:seed
npm run test
```

## Postman Testing

Import `NYSC_Form_Collector.postman_collection.json` into Postman.

The collection includes:

- auth login
- get current admin
- create admin
- create form
- add fields
- get public form
- submit public form with NIN upload
- view submissions
- update submission status
- generate QR code
- export responses as Excel
- export responses as CSV
- download uploaded NIN PDFs as ZIP

Set the collection variable `baseUrl` to `http://localhost:3000`. The login request automatically stores the JWT as `token`, and the create/submit requests capture `formId`, `formSlug`, `uploadedFileId`, and `submissionId`.

For the NIN upload request, provide:

- `state`, using `LAGOS` or `ONDO`
- `name`
- `email`
- `phone`
- `stateCode`, for example `LA/24B/1234`
- `ninNumber`
- `ninPdf` file upload, using a PDF, JPG, JPEG, or PNG file

Image uploads are converted to PDF and compressed below 200KB before the submission is saved. Stored files are renamed from the state code with separators removed, for example `LA/24B/1234` becomes `LA24B1234.pdf`.

## Notes

- Public submissions require an active form and reject submissions after `closesAt`.
- Each form can enable or disable Lagos and Ondo independently. At least one state must remain enabled.
- Duplicate `stateCode` submissions are rejected per form unless `allowDuplicateStateCode` is true.
- NIN uploads must be valid PDFs or valid JPG/JPEG/PNG images up to 20MB.
- Uploaded documents are stored temporarily, queued, converted/compressed as PDFs, uploaded privately to S3/R2, and then temp files are removed.
- If Ghostscript cannot reduce a file to 200KB or below, the smallest compressed file is stored with `compressionStatus=NEEDS_REVIEW`.
- Admin submission responses and Excel exports use signed URLs. Private storage URLs are not exposed publicly.
