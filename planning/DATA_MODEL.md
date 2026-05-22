model Organization {
  id        String   @id @default(cuid())
  name      String
  programs  Program[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Program {
  id             String       @id @default(cuid())
  organizationId String
  name           String
  organization   Organization @relation(fields: [organizationId], references: [id])
  teams          Team[]
  seasons        Season[]
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
}

model Person {
  id        String   @id @default(cuid())
  firstName String
  lastName  String
  email     String?
  phone     String?
  roles     RoleAssignment[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
