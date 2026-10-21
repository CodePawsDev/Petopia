import {
  GroomingServiceKind,
  PetSpecies,
  Prisma,
} from '../src/generated/prisma/client';

type RateInput = {
  species: PetSpecies;
  minWeightKg: number;
  maxWeightKg: number;
  priceSatang: number;
  durationMinutes: number;
  requiresAssessment: boolean;
};

type PriceRow = {
  species: PetSpecies;
  min: number;
  max: number;
  bath: [number, number];
  haircut: [number, number];
  spa: [number, number];
};

const priceRows: PriceRow[] = [
  {
    species: PetSpecies.DOG,
    min: 0,
    max: 5,
    bath: [300, 45],
    haircut: [550, 90],
    spa: [200, 20],
  },
  {
    species: PetSpecies.DOG,
    min: 5,
    max: 10,
    bath: [400, 60],
    haircut: [700, 105],
    spa: [250, 25],
  },
  {
    species: PetSpecies.DOG,
    min: 10,
    max: 20,
    bath: [550, 75],
    haircut: [900, 120],
    spa: [350, 30],
  },
  {
    species: PetSpecies.DOG,
    min: 20,
    max: 40,
    bath: [750, 90],
    haircut: [1200, 150],
    spa: [450, 35],
  },
  {
    species: PetSpecies.DOG,
    min: 40,
    max: 60,
    bath: [1000, 120],
    haircut: [1500, 180],
    spa: [550, 45],
  },
  {
    species: PetSpecies.DOG,
    min: 60,
    max: 80,
    bath: [1250, 150],
    haircut: [1800, 210],
    spa: [650, 50],
  },
  {
    species: PetSpecies.CAT,
    min: 0,
    max: 5,
    bath: [400, 60],
    haircut: [700, 90],
    spa: [250, 25],
  },
  {
    species: PetSpecies.CAT,
    min: 5,
    max: 10,
    bath: [550, 75],
    haircut: [900, 120],
    spa: [350, 30],
  },
  {
    species: PetSpecies.CAT,
    min: 10,
    max: 15,
    bath: [700, 90],
    haircut: [1100, 150],
    spa: [450, 35],
  },
  {
    species: PetSpecies.RABBIT,
    min: 0,
    max: 2,
    bath: [350, 45],
    haircut: [550, 75],
    spa: [200, 20],
  },
  {
    species: PetSpecies.RABBIT,
    min: 2,
    max: 5,
    bath: [450, 60],
    haircut: [700, 90],
    spa: [250, 25],
  },
  {
    species: PetSpecies.RABBIT,
    min: 5,
    max: 8,
    bath: [550, 75],
    haircut: [850, 105],
    spa: [300, 30],
  },
];

function makeRate(
  species: PetSpecies,
  min: number,
  max: number,
  priceBaht: number,
  durationMinutes: number,
): RateInput {
  return {
    species,
    minWeightKg: min,
    maxWeightKg: max,
    priceSatang: priceBaht * 100,
    durationMinutes,
    requiresAssessment: species === PetSpecies.RABBIT,
  };
}

function mainRates(key: 'bath' | 'haircut' | 'spa'): RateInput[] {
  return priceRows.map((row) =>
    makeRate(row.species, row.min, row.max, ...row[key]),
  );
}

function fixedRates(priceBaht: number, minutes: number): RateInput[] {
  return [
    makeRate(PetSpecies.DOG, 0, 80, priceBaht, minutes),
    makeRate(PetSpecies.CAT, 0, 15, priceBaht, minutes),
    makeRate(PetSpecies.RABBIT, 0, 8, priceBaht, minutes),
  ];
}

const services = [
  {
    code: 'BATH',
    name: 'อาบน้ำ',
    kind: GroomingServiceKind.BATH,
    rates: mainRates('bath'),
  },
  {
    code: 'BATH_WITH_HAIRCUT',
    name: 'อาบน้ำพร้อมตัดขน',
    kind: GroomingServiceKind.BATH_WITH_HAIRCUT,
    rates: mainRates('haircut'),
  },
  {
    code: 'COAT_SPA',
    name: 'สปาขน',
    kind: GroomingServiceKind.COAT_SPA,
    rates: mainRates('spa'),
  },
  {
    code: 'EAR_CLEANING',
    name: 'ทำความสะอาดหู',
    kind: GroomingServiceKind.EAR_CLEANING,
    rates: fixedRates(80, 10),
  },
  {
    code: 'NAIL_TRIMMING',
    name: 'ตัดเล็บ',
    kind: GroomingServiceKind.NAIL_TRIMMING,
    rates: fixedRates(100, 10),
  },
  {
    code: 'TOOTH_BRUSHING',
    name: 'แปรงฟันสุนัข',
    kind: GroomingServiceKind.TOOTH_BRUSHING,
    rates: [
      makeRate(PetSpecies.DOG, 0, 10, 100, 10),
      makeRate(PetSpecies.DOG, 10, 80, 150, 15),
    ],
  },
];

function validateRates(rates: RateInput[]): void {
  for (const species of Object.values(PetSpecies)) {
    const sorted = rates
      .filter((rate) => rate.species === species)
      .sort((a, b) => a.minWeightKg - b.minWeightKg);

    for (let index = 0; index < sorted.length; index++) {
      const rate = sorted[index];

      if (
        rate.minWeightKg < 0 ||
        rate.maxWeightKg <= rate.minWeightKg ||
        !Number.isSafeInteger(rate.priceSatang) ||
        rate.priceSatang <= 0 ||
        !Number.isSafeInteger(rate.durationMinutes) ||
        rate.durationMinutes <= 0
      ) {
        throw new Error(`Invalid demo rate for ${species}`);
      }

      const previous = sorted[index - 1];

      if (previous && rate.minWeightKg < previous.maxWeightKg) {
        throw new Error(`Overlapping demo rates for ${species}`);
      }
    }
  }
}

export async function seedServiceCatalog(
  tx: Prisma.TransactionClient,
  businessUnitId: string,
): Promise<void> {
  for (const [index, definition] of services.entries()) {
    validateRates(definition.rates);

    const service = await tx.groomingService.upsert({
      where: {
        businessUnitId_code: {
          businessUnitId,
          code: definition.code,
        },
      },
      update: {},
      create: {
        businessUnitId,
        code: definition.code,
        name: definition.name,
        kind: definition.kind,
        sortOrder: index,
      },
    });

    for (const rate of definition.rates) {
      await tx.groomingServiceRate.upsert({
        where: {
          serviceId_species_minWeightKg_maxWeightKg: {
            serviceId: service.id,
            species: rate.species,
            minWeightKg: rate.minWeightKg,
            maxWeightKg: rate.maxWeightKg,
          },
        },
        update: {},
        create: {
          serviceId: service.id,
          ...rate,
        },
      });
    }
  }
}
