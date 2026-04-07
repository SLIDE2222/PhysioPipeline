import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.profile.createMany({
    data: [
      {
        name: "Dra. Mariana Alves",
        specialty: "Fisioterapia Ortopédica",
        city: "São Paulo",
        neighborhood: "Moema",
        phone: "11999991111",
        publicEmail: "mariana@example.com",
        bio: "Especialista em reabilitação musculoesquelética e recuperação funcional.",
        attendance: "Clínica e domiciliar",
      },
      {
        name: "Dra. Patrícia Lima",
        specialty: "Fisioterapia Respiratória",
        city: "Itapetininga",
        neighborhood: "Centro",
        phone: "11999994444",
        publicEmail: "patricia@example.com",
        bio: "Suporte respiratório com foco em qualidade de vida.",
        attendance: "Clínica e domiciliar",
      }
    ],
    skipDuplicates: true,
  });

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
