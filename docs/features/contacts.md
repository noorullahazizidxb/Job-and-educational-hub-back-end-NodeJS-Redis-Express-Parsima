# Contacts

`src/routes/contacts.js` → `src/services/contacts.controller.js`. Schema: `src/validation/contacts.schema.js`.

```mermaid
flowchart LR
  form[POST /api/contacts]
  staff[GET / GET /:id DELETE /:id]
  form --> validate[createContactSchema]
  validate --> controller[ContactsController]
  staff --> controller
  controller --> prisma[Prisma Contact]
```

The public site form is `src/components/sections/contact-form.client.tsx` in the Next.js app. `src/routes/contacts.js` does not attach `requireAdmin` to list or delete. Treat that as a gap if those screens are staff-only.
