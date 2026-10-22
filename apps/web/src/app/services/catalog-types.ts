export type PetSpecies = 'DOG' | 'CAT' | 'RABBIT';

export type ServiceKind =
  | 'BATH'
  | 'BATH_WITH_HAIRCUT'
  | 'COAT_SPA'
  | 'EAR_CLEANING'
  | 'NAIL_TRIMMING'
  | 'TOOTH_BRUSHING';

export type CatalogBranch = {
  id: string;
  code: string;
  name: string;
};

export type BranchOption = CatalogBranch & {
  timezone: string;
};

export type ServiceRate = {
  id: string;
  species: PetSpecies;
  minWeightKg: number;
  maxWeightKg: number;
  priceSatang: number;
  durationMinutes: number;
  requiresAssessment: boolean;
};

export type CatalogService = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  kind: ServiceKind;
  rates: ServiceRate[];
};

export type ServiceCatalog = {
  branch: CatalogBranch;
  currency: 'THB';
  services: CatalogService[];
};

export type GroomerCatalog = {
  branch: CatalogBranch;
  groomers: Array<{
    id: string;
    displayName: string;
  }>;
};

export const speciesLabels: Record<PetSpecies, string> = {
  DOG: 'สุนัข',
  CAT: 'แมว',
  RABBIT: 'กระต่าย',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isSafeInteger(value) && value > 0;
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

function isBranch(value: unknown): value is CatalogBranch {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.code === 'string' &&
    typeof value.name === 'string'
  );
}

export function isBranchOptions(value: unknown): value is BranchOption[] {
  return (
    Array.isArray(value) &&
    value.every(
      (branch: unknown) =>
        isBranch(branch) &&
        'timezone' in branch &&
        typeof branch.timezone === 'string',
    )
  );
}

function isServiceRate(value: unknown): value is ServiceRate {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isSpecies(value.species) &&
    isFiniteNumber(value.minWeightKg) &&
    value.minWeightKg >= 0 &&
    isFiniteNumber(value.maxWeightKg) &&
    value.maxWeightKg > value.minWeightKg &&
    isPositiveInteger(value.priceSatang) &&
    isPositiveInteger(value.durationMinutes) &&
    typeof value.requiresAssessment === 'boolean'
  );
}

function isCatalogService(value: unknown): value is CatalogService {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.code === 'string' &&
    typeof value.name === 'string' &&
    (value.description === null || typeof value.description === 'string') &&
    isServiceKind(value.kind) &&
    Array.isArray(value.rates) &&
    value.rates.every(isServiceRate)
  );
}

export function isServiceCatalog(value: unknown): value is ServiceCatalog {
  return (
    isRecord(value) &&
    isBranch(value.branch) &&
    value.currency === 'THB' &&
    Array.isArray(value.services) &&
    value.services.every(isCatalogService)
  );
}

export function isGroomerCatalog(value: unknown): value is GroomerCatalog {
  return (
    isRecord(value) &&
    isBranch(value.branch) &&
    Array.isArray(value.groomers) &&
    value.groomers.every(
      (groomer: unknown) =>
        isRecord(groomer) &&
        typeof groomer.id === 'string' &&
        typeof groomer.displayName === 'string',
    )
  );
}
