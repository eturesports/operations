import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const prisma = new PrismaClient();

const __dirname = dirname(fileURLToPath(import.meta.url));

type SeedPlayer = {
  name: string;
  university: string | null;
  season: string | null;
  division: string | null;
  program: string | null;
  scholarship: number | null;
  legacyNumber: number | null;
  notes: string | null;
};

async function main() {
  // 1) Deportes base (multideporte: MSOC + WSOC)
  const msoc = await prisma.sport.upsert({
    where: { code: "MSOC" },
    update: {},
    create: { code: "MSOC", name: "Fútbol masculino", order: 1 },
  });
  await prisma.sport.upsert({
    where: { code: "WSOC" },
    update: {},
    create: { code: "WSOC", name: "Fútbol femenino", order: 2 },
  });

  // 2) Importa los jugadores MSOC desde el Excel exportado.
  const file = join(__dirname, "seed-data", "msoc.json");
  const players = JSON.parse(readFileSync(file, "utf8")) as SeedPlayer[];

  const existing = await prisma.player.count({ where: { sportId: msoc.id } });
  if (existing > 0) {
    console.log(
      `MSOC ya tiene ${existing} jugadores; se omite la importación para no duplicar.`
    );
  } else {
    // Inserta preservando el orden del Excel mediante legacyNumber.
    for (const p of players) {
      await prisma.player.create({
        data: {
          sportId: msoc.id,
          name: p.name,
          university: p.university,
          season: p.season,
          division: p.division,
          program: p.program,
          scholarship: p.scholarship,
          legacyNumber: p.legacyNumber,
          notes: p.notes,
        },
      });
    }
    console.log(`Importados ${players.length} jugadores de MSOC.`);
  }

  const total = await prisma.player.count();
  const sum = await prisma.player.aggregate({ _sum: { scholarship: true } });
  console.log(
    `Total en BD: ${total} jugadores · ${
      sum._sum.scholarship?.toLocaleString("es-ES") ?? 0
    } USD en becas.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
