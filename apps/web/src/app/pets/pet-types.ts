export type PetSpecies = 'DOG' | 'CAT' | 'RABBIT';

export type Pet = {
  id: string;
  name: string;
  species: PetSpecies;
  breed: string | null;
  birthDate: string | null;
  weightKg: number | null;
  careNotes: string | null;
  archivedAt: string | null;
};

export const speciesLabels: Record<PetSpecies, string> = {
  DOG: 'สุนัข',
  CAT: 'แมว',
  RABBIT: 'กระต่าย',
};

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

export function isPet(value: unknown): value is Pet {
  if (typeof value !== 'object' || value === null) return false;

  const pet = value as Record<string, unknown>;

  return (
    typeof pet.id === 'string' &&
    typeof pet.name === 'string' &&
    (pet.species === 'DOG' ||
      pet.species === 'CAT' ||
      pet.species === 'RABBIT') &&
    isNullableString(pet.breed) &&
    isNullableString(pet.birthDate) &&
    (pet.weightKg === null ||
      (typeof pet.weightKg === 'number' &&
        Number.isFinite(pet.weightKg))) &&
    isNullableString(pet.careNotes) &&
    isNullableString(pet.archivedAt)
  );
}