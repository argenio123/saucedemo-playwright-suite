import { test, expect } from '../fixtures/test';
import { PRODUCTS, PRODUCT_NAMES, priceOf } from '../data/products';
import { note, defect } from '../utils/report';

/**
 * Product catalogue: contents, integrity and sorting.
 * Covers TC-016 to TC-026.
 */
test.describe('Product catalogue @S7a456d7b', () => {

  test('TC-016 The catalogue lists exactly six products @Tb9cc5a26', async ({ shopper }, testInfo) => {
    await expect(shopper.items).toHaveCount(6);
    const names = await shopper.names();

    expect(names.sort()).toEqual([...PRODUCT_NAMES].sort());

    note(testInfo, `The catalogue rendered exactly six products and the set matched the reference catalogue with no additions or omissions: ${names.join(', ')}.`);
  });

  test('TC-017 Every product card carries a name, description, price and image @T23522b1c', async ({ shopper }, testInfo) => {
    const count = await shopper.items.count();
    const incomplete: string[] = [];

    for (let i = 0; i < count; i++) {
      const card = shopper.items.nth(i);
      const name = (await card.locator('.inventory_item_name').textContent())?.trim() ?? '';
      const desc = (await card.locator('.inventory_item_desc').textContent())?.trim() ?? '';
      const price = (await card.locator('.inventory_item_price').textContent())?.trim() ?? '';
      const img = await card.locator('img').getAttribute('src');

      if (!name || !desc || !price.startsWith('$') || !img) {
        incomplete.push(`${name || `card ${i}`} (desc=${!!desc}, price="${price}", img=${img})`);
      }
    }

    expect.soft(incomplete, 'every card must be complete').toHaveLength(0);
    note(testInfo, `All ${count} product cards were inspected for the four mandatory elements. ${incomplete.length === 0 ? 'Every card carried a non-empty name, description, a price formatted with a leading $, and an image source.' : `Incomplete cards: ${incomplete.join('; ')}.`}`);
  });

  test('TC-018 Displayed prices match the reference catalogue @T8a22c500', async ({ shopper }, testInfo) => {
    const mismatches: string[] = [];

    for (const product of PRODUCTS) {
      const shown = (await shopper.card(product.name).locator('.inventory_item_price').textContent())?.trim() ?? '';
      const value = Number(shown.replace(/[^0-9.]/g, ''));
      if (value !== product.price) {
        mismatches.push(`${product.name}: expected $${product.price.toFixed(2)}, displayed ${shown}`);
      }
    }

    expect.soft(mismatches, 'catalogue prices must not drift').toHaveLength(0);
    note(testInfo, mismatches.length === 0
      ? `All six prices matched the reference catalogue exactly, from $${Math.min(...PRODUCTS.map(p => p.price)).toFixed(2)} to $${Math.max(...PRODUCTS.map(p => p.price)).toFixed(2)}.`
      : `Price discrepancies found: ${mismatches.join('; ')}.`);
  });

  test('TC-019 Sorting by name A to Z orders the catalogue ascending @Te0e1426f', async ({ shopper }, testInfo) => {
    await shopper.sortBy('az');
    const names = await shopper.names();

    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    note(testInfo, `With "Name (A to Z)" selected the catalogue was returned in ascending alphabetical order: ${names.join(' < ')}.`);
  });

  test('TC-020 Sorting by name Z to A orders the catalogue descending @T93ea24e7', async ({ shopper }, testInfo) => {
    await shopper.sortBy('za');
    const names = await shopper.names();

    expect(names).toEqual([...names].sort((a, b) => b.localeCompare(a)));
    note(testInfo, `With "Name (Z to A)" selected the catalogue was returned in descending alphabetical order, beginning with "${names[0]}" and ending with "${names[names.length - 1]}".`);
  });

  test('TC-021 Sorting by price low to high orders the catalogue ascending @T299a0850', async ({ shopper }, testInfo) => {
    await shopper.sortBy('lohi');
    const prices = await shopper.prices();

    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    note(testInfo, `With "Price (low to high)" selected the prices ascended without exception: ${prices.map(p => `$${p.toFixed(2)}`).join(' <= ')}.`);
  });

  test('TC-022 Sorting by price high to low orders the catalogue descending @T681541ab', async ({ shopper }, testInfo) => {
    await shopper.sortBy('hilo');
    const prices = await shopper.prices();

    expect(prices).toEqual([...prices].sort((a, b) => b - a));
    expect(prices[0]).toBe(priceOf('Sauce Labs Fleece Jacket'));
    note(testInfo, `With "Price (high to low)" selected the prices descended without exception and the most expensive item, the Fleece Jacket at $${priceOf('Sauce Labs Fleece Jacket').toFixed(2)}, was first.`);
  });

  test('TC-023 The sort control offers exactly the four documented options @Tb4a4b12e', async ({ shopper }, testInfo) => {
    const values = await shopper.sortDropdown.locator('option').evaluateAll(
      opts => opts.map(o => (o as HTMLOptionElement).value),
    );

    expect(values).toEqual(['az', 'za', 'lohi', 'hilo']);
    note(testInfo, 'The sort control exposed exactly the four documented options (az, za, lohi, hilo) in the expected order, with no unimplemented entries.');
  });

  test('TC-024 The product detail page matches the card it was opened from @Tf47ba6e6', async ({ shopper, page }, testInfo) => {
    const target = 'Sauce Labs Backpack';
    await shopper.openProduct(target);

    const detailName = (await page.locator('.inventory_details_name').textContent())?.trim();
    const detailPrice = (await page.locator('.inventory_details_price').textContent())?.trim();

    expect(detailName).toBe(target);
    expect(Number((detailPrice ?? '').replace(/[^0-9.]/g, ''))).toBe(priceOf(target));

    note(testInfo, `Opening "${target}" from the catalogue navigated to /inventory-item.html, where the detail view showed the same name and the same price (${detailPrice}) as the originating card.`);
  });

  test('TC-025 Back to products returns to the catalogue @Tb4177004', async ({ shopper, page }, testInfo) => {
    await shopper.openProduct('Sauce Labs Bike Light');
    await page.locator('#back-to-products').click();

    await shopper.expectLoaded();
    await expect(shopper.items).toHaveCount(6);

    note(testInfo, 'The "Back to products" control returned from the product detail view to the catalogue with all six products still rendered.');
  });

  test('TC-026 Product images are distinct for problem_user @Tc09caa50', async ({ loginPage, inventoryPage }, testInfo) => {
    // A defect probe rather than a happy path: problem_user is published as a
    // faulty account, so this test documents what it actually renders.
    await loginPage.goto();
    await loginPage.loginExpectingSuccess('problem_user');

    const sources = await inventoryPage.imageSources();
    const distinct = new Set(sources);

    if (distinct.size === sources.length) {
      note(testInfo, `problem_user rendered ${sources.length} product images and all of them were distinct.`);
    } else {
      note(testInfo, `DEFECT CONFIRMED: problem_user rendered ${sources.length} product cards but only ${distinct.size} distinct image source(s) - the same asset is served for multiple products. Sources observed: ${[...distinct].join(', ')}.`);
      defect(testInfo, 'DEF-SD-002', 'Known injected defect on problem_user; recorded to prove the suite detects it.');
    }

    expect.soft(distinct.size, 'each product must have its own image').toBe(sources.length);
  });
});
