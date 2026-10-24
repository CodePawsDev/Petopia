import { createHash } from 'node:crypto';

type QuoteSnapshot = {
  branch: {
    id: string;
    code: string;
    name: string;
  };
  pet: {
    id: string;
    name: string;
    species: string;
    weightKg: number;
  };
  currency: string;
  items: {
    serviceId: string;
    rateId: string;
    code: string;
    name: string;
    kind: string;
    priceSatang: number;
    durationMinutes: number;
    requiresAssessment: boolean;
  }[];
  totalPriceSatang: number;
  totalDurationMinutes: number;
  requiresAssessment: boolean;
};

export function calculateQuoteHash(quote: QuoteSnapshot): string {
  const items = quote.items
    .map((item) => ({
      serviceId: item.serviceId.toLowerCase(),
      rateId: item.rateId.toLowerCase(),
      code: item.code,
      name: item.name,
      kind: item.kind,
      priceSatang: item.priceSatang,
      durationMinutes: item.durationMinutes,
      requiresAssessment: item.requiresAssessment,
    }))
    .sort((a, b) =>
      a.serviceId < b.serviceId ? -1 : a.serviceId > b.serviceId ? 1 : 0,
    );

  const snapshot = {
    version: 1,
    branch: {
      id: quote.branch.id.toLowerCase(),
      code: quote.branch.code,
      name: quote.branch.name,
    },
    pet: {
      id: quote.pet.id.toLowerCase(),
      name: quote.pet.name,
      species: quote.pet.species,
      weightKg: quote.pet.weightKg,
    },
    currency: quote.currency,
    items,
    totalPriceSatang: quote.totalPriceSatang,
    totalDurationMinutes: quote.totalDurationMinutes,
    requiresAssessment: quote.requiresAssessment,
  };

  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}
