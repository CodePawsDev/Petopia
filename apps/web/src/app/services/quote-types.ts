import type {
    CatalogBranch,
    PetSpecies,
    ServiceKind,
  } from './catalog-types';
  
  export type QuotePet = {
    id: string;
    name: string;
    species: PetSpecies;
    weightKg: number | null;
    archivedAt: string | null;
  };
  
  export type QuoteItem = {
    serviceId: string;
    rateId: string;
    code: string;
    name: string;
    kind: ServiceKind;
    priceSatang: number;
    durationMinutes: number;
    requiresAssessment: boolean;
  };
  
  export type ServiceQuote = {
    branch: CatalogBranch;
    pet: {
      id: string;
      name: string;
      species: PetSpecies;
      weightKg: number;
    };
    currency: 'THB';
    items: QuoteItem[];
    totalPriceSatang: number;
    totalDurationMinutes: number;
    requiresAssessment: boolean;
  };
  
  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
  
  function isPositiveNumber(value: unknown): value is number {
    return (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value > 0
    );
  }
  
  function isPositiveInteger(value: unknown): value is number {
    return isPositiveNumber(value) && Number.isSafeInteger(value);
  }
  
  function isSpecies(value: unknown): value is PetSpecies {
    return value === 'DOG' || value === 'CAT' || value === 'RABBIT';
  }
  
  function isServiceKind(value: unknown): value is ServiceKind {
    return (
      value === 'BATH' ||
      value === 'BATH_WITH_HAIRCUT' ||
      value === 'COAT_SPA' ||
      value === 'EAR_CLEANING' ||
      value === 'NAIL_TRIMMING' ||
      value === 'TOOTH_BRUSHING'
    );
  }
  
  function isQuotePet(value: unknown): value is QuotePet {
    return (
      isRecord(value) &&
      typeof value.id === 'string' &&
      typeof value.name === 'string' &&
      isSpecies(value.species) &&
      (value.weightKg === null || isPositiveNumber(value.weightKg)) &&
      (value.archivedAt === null || typeof value.archivedAt === 'string')
    );
  }
  
  export function isQuotePets(value: unknown): value is QuotePet[] {
    return Array.isArray(value) && value.every(isQuotePet);
  }
  
  function isQuoteItem(value: unknown): value is QuoteItem {
    return (
      isRecord(value) &&
      typeof value.serviceId === 'string' &&
      typeof value.rateId === 'string' &&
      typeof value.code === 'string' &&
      typeof value.name === 'string' &&
      isServiceKind(value.kind) &&
      isPositiveInteger(value.priceSatang) &&
      isPositiveInteger(value.durationMinutes) &&
      typeof value.requiresAssessment === 'boolean'
    );
  }
  
  export function isServiceQuote(value: unknown): value is ServiceQuote {
    if (
      !isRecord(value) ||
      !isRecord(value.branch) ||
      typeof value.branch.id !== 'string' ||
      typeof value.branch.code !== 'string' ||
      typeof value.branch.name !== 'string' ||
      !isRecord(value.pet) ||
      typeof value.pet.id !== 'string' ||
      typeof value.pet.name !== 'string' ||
      !isSpecies(value.pet.species) ||
      !isPositiveNumber(value.pet.weightKg) ||
      value.currency !== 'THB' ||
      !Array.isArray(value.items) ||
      value.items.length === 0 ||
      !value.items.every(isQuoteItem) ||
      !isPositiveInteger(value.totalPriceSatang) ||
      !isPositiveInteger(value.totalDurationMinutes) ||
      typeof value.requiresAssessment !== 'boolean'
    ) {
      return false;
    }
  
    const items = value.items;
  
    return (
      new Set(items.map((item) => item.serviceId)).size === items.length &&
      value.totalPriceSatang ===
        items.reduce((total, item) => total + item.priceSatang, 0) &&
      value.totalDurationMinutes ===
        items.reduce((total, item) => total + item.durationMinutes, 0) &&
      value.requiresAssessment ===
        items.some((item) => item.requiresAssessment)
    );
  }