# Service Catalog — Demo Rules

Status: Agreed for initial implementation

## Scope

- Supported species: DOG, CAT and RABBIT.
- Both demo branches use the same service catalog, prices and durations.
- Prices are fictional demo data in THB.
- Branch-specific promotions are deferred.
- Task 09 provides catalog read APIs and customer-facing pages.
- Booking and checkout are implemented separately.

## Service selection

- One booking is for one pet at one branch.
- Multiple distinct services may be selected.
- Each service has quantity one.
- Bath and bath-with-haircut are mutually exclusive.
- Coat spa, ear cleaning, nail trimming and dog tooth brushing may be selected independently.
- Demo bath packages do not include the separately listed services.
- Dog tooth-brushing rates are selected from weight, not by the customer.

## Weight rules

- Weight must be positive, with at most three decimal places.
- Each weight band has an exclusive lower bound and inclusive upper bound.
- The first band starts above zero.
- Maximum supported weights:
  - DOG: 80 kg.
  - CAT: 15 kg.
  - RABBIT: 8 kg.
- Weight above the supported maximum requires branch assessment and cannot receive an automatic quote.
- Missing weight permits viewing the price table but prevents a pet-specific quote.
- These service limits do not restrict storing a pet profile.

## Demo price table

Each service column contains price in THB / duration in minutes.

| Species | Weight kg | Bath       | Bath with haircut | Coat spa |
| ------- | --------- | ---------- | ----------------- | -------- |
| DOG     | > 0–5     | 300 / 45   | 550 / 90          | 200 / 20 |
| DOG     | > 5–10    | 400 / 60   | 700 / 105         | 250 / 25 |
| DOG     | > 10–20   | 550 / 75   | 900 / 120         | 350 / 30 |
| DOG     | > 20–40   | 750 / 90   | 1200 / 150        | 450 / 35 |
| DOG     | > 40–60   | 1000 / 120 | 1500 / 180        | 550 / 45 |
| DOG     | > 60–80   | 1250 / 150 | 1800 / 210        | 650 / 50 |
| CAT     | > 0–5     | 400 / 60   | 700 / 90          | 250 / 25 |
| CAT     | > 5–10    | 550 / 75   | 900 / 120         | 350 / 30 |
| CAT     | > 10–15   | 700 / 90   | 1100 / 150        | 450 / 35 |
| RABBIT  | > 0–2     | 350 / 45   | 550 / 75          | 200 / 20 |
| RABBIT  | > 2–5     | 450 / 60   | 700 / 90          | 250 / 25 |
| RABBIT  | > 5–8     | 550 / 75   | 850 / 105         | 300 / 30 |

## Other services

Species weight limits still apply to fixed-price services.

| Service        | Species          | Weight kg               | Price THB | Duration minutes |
| -------------- | ---------------- | ----------------------- | --------- | ---------------- |
| Ear cleaning   | DOG, CAT, RABBIT | Within supported limits | 80        | 10               |
| Nail trimming  | DOG, CAT, RABBIT | Within supported limits | 100       | 10               |
| Tooth brushing | DOG              | > 0–10                  | 100       | 10               |
| Tooth brushing | DOG              | > 10–80                 | 150       | 15               |

## Calculation and booking rules

- Total price is the sum of selected service prices.
- Total duration is the sum of selected service durations.
- Services are assumed to be performed sequentially.
- The API determines applicable rates and calculates totals.
- Client-supplied prices and durations are not authoritative.
- Booking must preserve the selected service names, prices and durations as snapshots.
- Rabbit services require staff assessment before booking confirmation.
- The assessment and confirmation workflow must be defined during booking implementation; it is not implemented by the catalog alone.
