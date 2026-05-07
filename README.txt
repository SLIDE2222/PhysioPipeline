Replace your existing prisma/schema.prisma with this file.

Changes made:
- Added User.name String? for Google first name/account name.
- Added User.phone String? so the phone number can be tied directly to the account.
- Added User.googleSub String? @unique for safer Google account linking.

After replacing, run:
npx prisma db push
npx prisma generate

Then redeploy the backend.
